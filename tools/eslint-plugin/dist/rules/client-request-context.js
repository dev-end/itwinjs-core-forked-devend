/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

"use strict";

const { getParserServices } = require("./utils/parser");
const { AST_NODE_TYPES } = require("@typescript-eslint/experimental-utils");
const TSESTreeModule = require("@typescript-eslint/typescript-estree");
const { TSESTree } = require("@typescript-eslint/typescript-estree");

const OPTION_DONT_PROPAGATE = "dont-propagate-request-context";
const OPTION_CONTEXT_ARG_NAME = "context-arg-name";

const asyncFuncMoniker = "promise-returning function";

const messages = {
  noCtxParam: `All ${asyncFuncMoniker}s must take a parameter of type ClientRequestContext`,
  noEnterOnFirstLine: `All ${asyncFuncMoniker}s must call 'enter' on their ClientRequestContext immediately`,
  noEnterOnThenResume: `All ${asyncFuncMoniker}s must call 'enter' on their ClientRequestContext immediately in any 'then' callbacks`,
  // TODO: should probably do it after expressions, not statements but that might be more complicated...
  noEnterOnAwaitResume: `All ${asyncFuncMoniker}s must call 'enter' on their ClientRequestContext immediately after resuming from an awaited statement`,
  noEnterOnCatchResume: `All ${asyncFuncMoniker}s must call '{{reqCtxArgName}}.enter()' immediately after catching an async exception`,
  didntPropagate: `All ${asyncFuncMoniker}s must propagate their async to functions`,
  calledCurrent: `All ${asyncFuncMoniker}s must not call ClientRequestContext.current`,
};

/** @type {typeof messages} */
const messageIds = Object.keys(messages).reduce((obj, key) => {
  obj[key] = key;
  return obj;
}, {});

/** throw an error indicating an unreachable condition was reached
 * @param {string} msg
 * @returns {never}
 */
function unreachable(msg) {
  throw Error(msg);
}

/** @typedef {import("@typescript-eslint/typescript-estree")} TSESTreeModule */
/** @typedef {TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration} FuncDeclLike */

/** Get the final element of an Array
 * @template T
 * @param {T[]} array
 * @returns {T | undefined}
 */
function back(array) {
  return array[array.length - 1];
}

/**
 * Find an element in the array, and return the element after it
 * handles undefined arrays by returning undefined
 * @template T
 * @param {T[] | undefined} array
 * @param {Parameters<Array<T>["findIndex"]>[0]} predicate
 * @returns {T | undefined}
 */
function findAfter(array, predicate) {
  if (array === undefined) return undefined;
  const index = array.findIndex(predicate);
  return array[index + 1];
}

class ASTPreconditionViolated extends Error {}

/**
 * Given a syntax construct that has a statement child, replace
 * that statement child with a block
 * @param { TSESTree.Statement
 *        | TSESTree.ArrowFunctionExpression
 *        | TSESTree.IfStatement
 *        | TSESTree.ForOfStatement
 *        | TSESTree.ForInStatement
 *        | TSESTree.ForStatement
 *        } stmt
 * @param {import("@typescript-eslint/experimental-utils/dist/ts-eslint").RuleFixer} fixer
 * @param {{textBefore?: string}}  options
 * @returns {import("@typescript-eslint/experimental-utils/dist/ts-eslint").RuleFix[]}
 */
// XXX: make sure reqCtx is not placed inside if statements incorrectly
function promoteBlocklessStmtFixer(
  stmt,
  fixer,
  { textBefore } = { textBefore: "" }
) {
  const body = stmt.type === "IfStatement" ? stmt.consequent : stmt.body;
  return [
    fixer.insertTextBefore(body, "{" + textBefore),
    fixer.insertTextAfter(body, "}"),
  ];
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Follow the ClientRequestContext rules " +
        "(see https://www.itwinjs.org/learning/backend/managingclientrequestcontext/)",
      category: "TypeScript",
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          [OPTION_DONT_PROPAGATE]: {
            type: "boolean",
            description:
              `normally non-node_module-imported ${asyncFuncMoniker}s are flagged if they do not receive ` +
              `the client request context as an argument, this diables that`,
            default: false,
          },
          [OPTION_CONTEXT_ARG_NAME]: {
            type: "string",
            description: `The name to use for adding an ClientRequestContext parameter when fixing. Defaults to 'clientRequestContext'`,
            default: "clientRequestContext",
          },
        },
      },
    ],
    fixable: "code",
    messages,
  },

  create(context) {
    const parserServices = getParserServices(context);
    const checker = parserServices.program.getTypeChecker();
    const extraOpts = context.options[0];
    const dontPropagate =
      (extraOpts && extraOpts[OPTION_DONT_PROPAGATE]) || false;
    const contextArgName =
      (extraOpts && extraOpts[OPTION_CONTEXT_ARG_NAME]) ||
      "clientRequestContext";

    /**
     * @param {TSESTree.Node} node
     * @returns {FuncDeclLike}
     */
    function getOuterFunction(node) {
      /** @type {TSESTree.Node | undefined} */
      let cur = node;
      while (
        cur &&
        !(
          cur.type === "FunctionExpression" ||
          cur.type === "ArrowFunctionExpression" ||
          cur.type === "FunctionDeclaration"
        )
      )
        cur = cur.parent;
      return cur;
    }

    /**
     * @param {TSESTree.Expression} node
     * @returns {TSESTree.Statement | TSESTree.VariableDeclaration | undefined}
     */
    function getExprOuterStmt(node) {
      /** @type {TSESTree.Node | undefined} */
      let cur = node;
      while (
        cur &&
        !/(Statement|Declaration)$/.test(cur.type) &&
        cur.parent &&
        cur.parent.type !== "FunctionExpression" &&
        cur.parent.type !== "ArrowFunctionExpression" &&
        cur.parent.type !== "FunctionDeclaration"
      )
        cur = cur.parent;
      return cur;
    }

    /**
     * Return the statement immediately following the input statement
     * @param {TSESTree.Node} node
     * @returns {void}
     */
    function ensureNextStmtIsCtxEntry(node) {
      if (node.parent === undefined)
        throw new ASTPreconditionViolated("no parent");

      /** @type {{[K in AST_NODE_TYPES]: (node: TSESTree.Node & {parent: { type: K }}) => TSESTree.Node | undefined}} */
      const nextStmtMethods = {
        ArrowFunctionExpression(node) {
          if (node.parent.body.type === "BlockStatement") {
            return findAfter(node.parent.body.body, (s) => s === node);
            // XXX: promote block-less ARROW FUNC EXPR to block
            // XXX: handle empty body
          } else {
            context.report({
              node,
              messageId: messageIds.noEnterOnAwaitResume,
              fix(fixer) {
                return promoteBlocklessStmtFixer(node.parent, fixer, {
                  textBefore: ``,
                });
              },
            });
            return undefined;
          }
        },
        FunctionExpression(node) {
          return findAfter(node.parent.body.body, (s) => s === node);
        },
        FunctionDeclaration(node) {
          return this.FunctionExpression(node);
        },
        CatchClause(node) {
          return findAfter(node.parent.body.body, (s) => s === node);
        },
        TryStatement(node) {
          return findAfter(node.parent.block.body, (s) => s === node);
        },
        BlockStatement(node) {
          return findAfter(node.parent.body, (s) => s === node);
        },
        IfStatement(node) {
          // XXX: promote block-less IF-CONSEQUENCE to block
          // XXX: handle empty body
          if (node.parent.consequent.type === "BlockStatement") {
            return node.parent.consequent.body[0];
          } else {
            return undefined;
          }
        },
        ForInStatement(node) {
          return undefined;
        },
        ForStatement(node) {},
        ForOfStatement(node) {
          // XXX: promote block-less FOR BODY to blocks
          // XXX: handle empty body
          if (node.parent.body.type === "BlockStatement") {
            return node.parent.body.body[0];
          } else {
            return undefined;
          }
        },
      };

      const nextStmt =
        node.parent.type in nextStmtMethods
          ? nextStmtMethods[node.parent.type](node)
          : unreachable("unhandled statement");

      if (nextStmt === undefined) return;

      if (!isClientRequestContextEnter(nextStmt, lastFunc.reqCtxArgName)) {
        context.report({
          node: nextStmt,
          messageId: messageIds.noEnterOnAwaitResume,
          data: { reqCtxArgName: lastFunc.reqCtxArgName },
          fix(fixer) {
            return fixer.insertTextBefore(
              nextStmt,
              `${lastFunc.reqCtxArgName}.enter();`
            );
          },
        });
      }
    }

    /**
     * @param {FuncDeclLike} node
     * @returns {boolean}
     */
    function returnsPromise(node) {
      /** @type {TSESTreeModule.TSESTreeToTSNode<TSESTree.Node>} */
      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
      if (!tsNode) return false;
      const signature = checker.getSignatureFromDeclaration(tsNode);
      if (!signature) return false;
      const returnType = signature && signature.getReturnType();
      if (!returnType) return false;
      return (
        returnType.symbol &&
        checker.getFullyQualifiedName(returnType.symbol) === "Promise"
      );
    }

    /**
     * @param {TSESTree.Node} node
     * @param {string} reqCtxArgName
     * @return {boolean}
     */
    function isClientRequestContextEnter(node, reqCtxArgName) {
      return Boolean(
        node &&
          node.type === AST_NODE_TYPES.ExpressionStatement &&
          node.expression.type === AST_NODE_TYPES.CallExpression &&
          node.expression.callee.type === AST_NODE_TYPES.MemberExpression &&
          node.expression.callee.object.type === AST_NODE_TYPES.Identifier &&
          node.expression.callee.object.name === reqCtxArgName &&
          node.expression.callee.property.type === AST_NODE_TYPES.Identifier &&
          node.expression.callee.property.name === "enter"
      );
    }

    /**
     * @type {{
     *  func: FuncDeclLike,
     *  awaits: Set<TSESTree.AwaitExpression>,
     *  reqCtxArgName: string
     * }[]}
     */
    const asyncFuncStack = [];

    /**
     * @param {FuncDeclLike} node
     */
    function VisitFuncDeclLike(node) {
      if (!returnsPromise(node)) return;

      /** @type {TSESTreeModule.TSESTreeToTSNode<TSESTree.FunctionExpression>} */
      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

      const clientReqCtx = node.params.find((p) => {
        const actualParam =
          p.type === AST_NODE_TYPES.TSParameterProperty ? p.parameter : p;
        const tsParam = parserServices.esTreeNodeToTSNodeMap.get(actualParam);
        const type = checker.getTypeAtLocation(tsParam);
        // TODO: should probably check the package name here too
        return (
          type.symbol &&
          /ClientRequestContext$/.test(
            checker.getFullyQualifiedName(type.symbol)
          )
        );
      });

      if (clientReqCtx === undefined) {
        context.report({
          node,
          messageId: messageIds.noCtxParam,
          fix(fixer) {
            const hasOtherParams = node.params.length > 0;
            return fixer.insertTextBeforeRange(
              [tsNode.parameters.pos, tsNode.parameters.end],
              `${contextArgName}: ClientRequestContext${
                hasOtherParams ? ", " : ""
              }`
            );
          },
        });
        return;
      }

      const reqCtxArgName = clientReqCtx.name;

      asyncFuncStack.push({
        func: node,
        awaits: new Set(),
        reqCtxArgName,
      });

      if (node.body.type === "BlockStatement") {
        const firstStmt = node.body.body[0];
        if (!isClientRequestContextEnter(firstStmt, reqCtxArgName))
          context.report({
            node: firstStmt || node.body,
            messageId: messageIds.noEnterOnFirstLine,
            data: { reqCtxArgName },
            fix(fixer) {
              if (firstStmt)
                return fixer.insertTextBefore(
                  firstStmt,
                  `${reqCtxArgName}.enter();`
                );
              else if (tsNode.body)
                return fixer.insertTextBeforeRange(
                  // TODO: clarify why the tsNode locations are like this
                  [tsNode.body.end - 1, tsNode.body.end],
                  `${reqCtxArgName}.enter();`
                );
              return null;
            },
          });
      }
    }

    /** @param {TSESTree.FunctionExpression} node */
    function ExitFuncDeclLike(node) {
      const lastFunc = back(asyncFuncStack);
      if (!lastFunc || lastFunc.func !== node) return;
      asyncFuncStack.pop();
      for (const await_ of lastFunc.awaits) {
        //const stmt = getExprOuterStmt(await_);
        // TODO: test + handle cases for expression bodies of arrow functions
        ensureNextStmtIsCtxEntry(await_);
        /*
        if (
          nextStmt &&
          !isClientRequestContextEnter(nextStmt, lastFunc.reqCtxArgName)
        ) {
          context.report({
            node: nextStmt,
            messageId: messageIds.noEnterOnAwaitResume,
            data: { reqCtxArgName: lastFunc.reqCtxArgName },
            fix(fixer) {
              return fixer.insertTextBefore(
                nextStmt,
                `${lastFunc.reqCtxArgName}.enter();`
              );
            },
          });
        }
        */
      }
    }

    return {
      /** @param {TSESTree.AwaitExpression} node */
      AwaitExpression(node) {
        const lastFunc = back(asyncFuncStack);
        // if the stack is empty, this is a top-level await and we can ignore it
        if (lastFunc) lastFunc.awaits.add(node);
      },

      /** @param {TSESTree.CatchClause} node */
      CatchClause(node) {
        const outerFunc = getOuterFunction(node);
        const lastFunc = back(asyncFuncStack);
        if (lastFunc === undefined || lastFunc.func !== outerFunc) return;

        // TODO: abstract firstStmt check and fixer to reused function
        const firstStmt = node.body.body[0];
        if (!isClientRequestContextEnter(firstStmt, lastFunc.reqCtxArgName))
          context.report({
            node: firstStmt || node.body,
            messageId: messageIds.noEnterOnCatchResume,
            data: { reqCtxArgName: lastFunc.reqCtxArgName },
            fix(fixer) {
              const bodyIsEmpty = firstStmt === undefined;
              if (bodyIsEmpty) {
                const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
                return fixer.insertTextBeforeRange(
                  // TODO: clarify why the tsNode locations are like this
                  [tsNode.block.end - 1, tsNode.block.end],
                  `${lastFunc.reqCtxArgName}.enter();`
                );
              }
              return fixer.insertTextBefore(
                firstStmt,
                `${lastFunc.reqCtxArgName}.enter();`
              );
            },
          });
      },

      CallExpression(node) {
        // TODO: need to check we aren't in a non-promise returning function nested in an async function...
        // get the outer function and compare to the top of the stack
        const outerFunc = getOuterFunction(node);
        const lastFunc = back(asyncFuncStack);
        if (lastFunc === undefined || lastFunc.func !== outerFunc) return;
        // TODO: use type checking to check for thenable's methods
        const isThen =
          (node.callee.name ||
            node.callee.property.name ||
            node.callee.property.value) === "then";
        const isCatch =
          (node.callee.name ||
            node.callee.property.name ||
            node.callee.property.value) === "catch";
        const isPromiseCallback = isThen || isCatch;
        if (isPromiseCallback) {
          const callback = node.arguments[0];
          if (
            callback.type === "FunctionExpression" ||
            callback.type === "ArrowFunctionExpression"
          ) {
            // FIXME: deal with non-block body in async funcs...
            if (callback.body.type === "BlockStatement") {
              const firstStmt = callback.body.body[0];
              if (
                !isClientRequestContextEnter(firstStmt, lastFunc.reqCtxArgName)
              )
                context.report({
                  node: firstStmt || callback.body,
                  messageId: isThen
                    ? messageIds.noEnterOnThenResume
                    : messageIds.noEnterOnCatchResume,
                  data: { reqCtxArgName: lastFunc.reqCtxArgName },
                  fix(fixer) {
                    const bodyIsEmpty = firstStmt === undefined;
                    if (bodyIsEmpty) {
                      /** @type {TSESTreeModule.TSESTreeToTSNode<TSESTree.CallExpression>} */
                      const tsNode =
                        parserServices.esTreeNodeToTSNodeMap.get(node);
                      return fixer.insertTextBeforeRange(
                        // TODO: abstract out inserting into empty bodies
                        // TODO: clarify why the tsNode locations are like this
                        [tsNode.getEnd() - 1, tsNode.getEnd()],
                        `${lastFunc.reqCtxArgName}.enter();`
                      );
                    }
                    return fixer.insertTextBefore(
                      firstStmt,
                      `${lastFunc.reqCtxArgName}.enter();`
                    );
                  },
                });
            }
          }
        }
      },

      "ArrowFunctionExpression:exit": ExitFuncDeclLike,
      "FunctionDeclaration:exit": ExitFuncDeclLike,
      "FunctionExpression:exit": ExitFuncDeclLike,
      ArrowFunctionExpression: VisitFuncDeclLike,
      FunctionDeclaration: VisitFuncDeclLike,
      FunctionExpression: VisitFuncDeclLike,
    };
  },
};

module.exports = rule;
