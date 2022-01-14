/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as path from "path";
import * as Semver from "semver";
import * as sinon from "sinon";
import { DbResult, Guid, Id64, Id64String, Logger, LogLevel, OpenMode } from "@itwin/core-bentley";
import { Point3d, Range3d, StandardViewIndex, Transform, YawPitchRollAngles } from "@itwin/core-geometry";
import {
  CategorySelector, DisplayStyle3d, DocumentListModel, Drawing, DrawingCategory, DrawingGraphic, DrawingModel, ECSqlStatement, Element,
  ElementMultiAspect, ElementOwnsChildElements, ElementOwnsExternalSourceAspects, ElementOwnsUniqueAspect, ElementRefersToElements, ElementUniqueAspect, ExternalSource, ExternalSourceAspect, GenericPhysicalMaterial,
  GeometricElement,
  IModelCloneContext, IModelDb, IModelHost, IModelJsFs, IModelSchemaLoader, InformationRecordModel, InformationRecordPartition, LinkElement, Model,
  ModelSelector, OrthographicViewDefinition, PhysicalModel, PhysicalObject, PhysicalPartition, PhysicalType, Relationship, RepositoryLink, Schema,
  SnapshotDb, SpatialCategory, StandaloneDb, SubCategory, Subject, SynchronizationConfigLink,
} from "@itwin/core-backend";
import { ExtensiveTestScenario, IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import {
  AxisAlignedBox3d, BriefcaseIdValue, Code, CodeScopeSpec, CodeSpec, ColorDef, CreateIModelProps, DefinitionElementProps, ElementProps,
  ExternalSourceAspectProps, ExternalSourceProps, IModel, IModelError, PhysicalElementProps, Placement3d, QueryRowFormat, RelatedElement, SynchronizationConfigLinkProps,
} from "@itwin/core-common";
import { IModelExporter, IModelExportHandler, IModelTransformer, TransformerLoggerCategory } from "../../core-transformer";
import {
  ClassCounter, deepEqualWithFpTolerance, FilterByViewTransformer, IModelToTextFileExporter, IModelTransformer3d, IModelTransformerTestUtils, PhysicalModelConsolidator,
  RecordingIModelImporter, TestIModelTransformer, TransformerExtensiveTestScenario,
} from "../IModelTransformerUtils";

describe("IModelTransformer", () => {
  const outputDir: string = path.join(KnownTestLocations.outputDir, "IModelTransformer");

  before(async () => {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir)) {
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    }
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }
    // initialize logging
    if (false) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
      Logger.setLevel(TransformerLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(TransformerLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(TransformerLoggerCategory.IModelTransformer, LogLevel.Trace);
    }
  });

  it("should transform changes from source to target", async () => {
    // Source IModelDb
    const sourceDbFile = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestIModelTransformer-Source.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "TestIModelTransformer-Source" } });
    await ExtensiveTestScenario.prepareDb(sourceDb);
    ExtensiveTestScenario.populateDb(sourceDb);
    sourceDb.saveChanges();
    // Target IModelDb
    const targetDbFile = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestIModelTransformer-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "TestIModelTransformer-Target" } });
    await TransformerExtensiveTestScenario.prepareTargetDb(targetDb);
    targetDb.saveChanges();

    const numSourceUniqueAspects = count(sourceDb, ElementUniqueAspect.classFullName);
    const numSourceMultiAspects = count(sourceDb, ElementMultiAspect.classFullName);
    const numSourceRelationships = count(sourceDb, ElementRefersToElements.classFullName);
    assert.isAtLeast(numSourceUniqueAspects, 1);
    assert.isAtLeast(numSourceMultiAspects, 1);
    assert.isAtLeast(numSourceRelationships, 1);

    if (true) { // initial import
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "==============");
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "Initial Import");
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "==============");
      const targetImporter = new RecordingIModelImporter(targetDb);
      const transformer = new TestIModelTransformer(sourceDb, targetImporter);
      assert.isTrue(transformer.context.isBetweenIModels);
      await transformer.processAll();
      assert.isAtLeast(targetImporter.numModelsInserted, 1);
      assert.equal(targetImporter.numModelsUpdated, 0);
      assert.isAtLeast(targetImporter.numElementsInserted, 1);
      assert.isAtLeast(targetImporter.numElementsUpdated, 1);
      assert.equal(targetImporter.numElementsDeleted, 0);
      assert.isAtLeast(targetImporter.numElementAspectsInserted, 1);
      assert.equal(targetImporter.numElementAspectsUpdated, 0);
      assert.isAtLeast(targetImporter.numRelationshipsInserted, 1);
      assert.equal(targetImporter.numRelationshipsUpdated, 0);
      assert.isAtLeast(count(targetDb, ElementRefersToElements.classFullName), 1);
      assert.isAtLeast(count(targetDb, InformationRecordPartition.classFullName), 1);
      assert.isAtLeast(count(targetDb, InformationRecordModel.classFullName), 1);
      assert.isAtLeast(count(targetDb, "ExtensiveTestScenarioTarget:PhysicalPartitionIsTrackedByRecords"), 1);
      assert.isAtLeast(count(targetDb, "ExtensiveTestScenarioTarget:AuditRecord"), 1);
      assert.equal(3, count(targetDb, "ExtensiveTestScenarioTarget:TargetInformationRecord"));
      targetDb.saveChanges();
      TransformerExtensiveTestScenario.assertTargetDbContents(sourceDb, targetDb);
      transformer.context.dump(`${targetDbFile}.context.txt`);
      transformer.dispose();
    }

    const numTargetElements = count(targetDb, Element.classFullName);
    const numTargetUniqueAspects = count(targetDb, ElementUniqueAspect.classFullName);
    const numTargetMultiAspects = count(targetDb, ElementMultiAspect.classFullName);
    const numTargetExternalSourceAspects = count(targetDb, ExternalSourceAspect.classFullName);
    const numTargetRelationships = count(targetDb, ElementRefersToElements.classFullName);
    assert.isAtLeast(numTargetUniqueAspects, 1);
    assert.isAtLeast(numTargetMultiAspects, 1);
    assert.isAtLeast(numTargetRelationships, 1);

    if (true) { // tests of IModelExporter
      // test #1 - export structure
      const exportFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestIModelTransformer-Source-Export.txt");
      assert.isFalse(IModelJsFs.existsSync(exportFileName));
      const exporter = new IModelToTextFileExporter(sourceDb, exportFileName);
      await exporter.export();
      assert.isTrue(IModelJsFs.existsSync(exportFileName));

      // test #2 - count occurrences of classFullNames
      const classCountsFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestIModelTransformer-Source-Counts.txt");
      assert.isFalse(IModelJsFs.existsSync(classCountsFileName));
      const classCounter = new ClassCounter(sourceDb, classCountsFileName);
      await classCounter.count();
      assert.isTrue(IModelJsFs.existsSync(classCountsFileName));
    }

    if (true) { // second import with no changes to source, should be a no-op
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "");
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "=================");
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "Reimport (no-op)");
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "=================");
      const targetImporter = new RecordingIModelImporter(targetDb);
      const transformer = new TestIModelTransformer(sourceDb, targetImporter);
      await transformer.processAll();
      assert.equal(targetImporter.numModelsInserted, 0);
      assert.equal(targetImporter.numModelsUpdated, 0);
      assert.equal(targetImporter.numElementsInserted, 0);
      assert.equal(targetImporter.numElementsUpdated, 0);
      assert.equal(targetImporter.numElementsDeleted, 0);
      assert.equal(targetImporter.numElementAspectsInserted, 0);
      assert.equal(targetImporter.numElementAspectsUpdated, 0);
      assert.equal(targetImporter.numRelationshipsInserted, 0);
      assert.equal(targetImporter.numRelationshipsUpdated, 0);
      assert.equal(targetImporter.numRelationshipsDeleted, 0);
      assert.equal(numTargetElements, count(targetDb, Element.classFullName), "Second import should not add elements");
      assert.equal(numTargetExternalSourceAspects, count(targetDb, ExternalSourceAspect.classFullName), "Second import should not add aspects");
      assert.equal(numTargetRelationships, count(targetDb, ElementRefersToElements.classFullName), "Second import should not add relationships");
      assert.equal(3, count(targetDb, "ExtensiveTestScenarioTarget:TargetInformationRecord"));
      transformer.dispose();
    }

    if (true) { // update source db, then import again
      ExtensiveTestScenario.updateDb(sourceDb);
      sourceDb.saveChanges();
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "");
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "===============================");
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "Reimport after sourceDb update");
      Logger.logInfo(TransformerLoggerCategory.IModelTransformer, "===============================");
      const targetImporter = new RecordingIModelImporter(targetDb);
      const transformer = new TestIModelTransformer(sourceDb, targetImporter);
      await transformer.processAll();
      assert.equal(targetImporter.numModelsInserted, 0);
      assert.equal(targetImporter.numModelsUpdated, 0);
      assert.equal(targetImporter.numElementsInserted, 1);
      assert.equal(targetImporter.numElementsUpdated, 5);
      assert.equal(targetImporter.numElementsDeleted, 2);
      assert.equal(targetImporter.numElementAspectsInserted, 0);
      assert.equal(targetImporter.numElementAspectsUpdated, 2);
      assert.equal(targetImporter.numRelationshipsInserted, 2);
      assert.equal(targetImporter.numRelationshipsUpdated, 1);
      assert.equal(targetImporter.numRelationshipsDeleted, 1);
      targetDb.saveChanges();
      ExtensiveTestScenario.assertUpdatesInDb(targetDb);
      assert.equal(numTargetRelationships + targetImporter.numRelationshipsInserted - targetImporter.numRelationshipsDeleted, count(targetDb, ElementRefersToElements.classFullName));
      assert.equal(2, count(targetDb, "ExtensiveTestScenarioTarget:TargetInformationRecord"));
      transformer.dispose();
    }

    IModelTestUtils.dumpIModelInfo(sourceDb);
    IModelTestUtils.dumpIModelInfo(targetDb);
    sourceDb.close();
    targetDb.close();
  });

  it("should synchronize changes from master to branch and back", async () => {
    // Simulate branching workflow by initializing branchDb to be a copy of the populated masterDb
    const masterDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "Master.bim");
    const masterDb = SnapshotDb.createEmpty(masterDbFile, { rootSubject: { name: "Branching Workflow" }, createClassViews: true });
    await ExtensiveTestScenario.prepareDb(masterDb);
    ExtensiveTestScenario.populateDb(masterDb);
    masterDb.saveChanges();
    const branchDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "Branch.bim");
    const branchDb = SnapshotDb.createFrom(masterDb, branchDbFile, { createClassViews: true });

    const numMasterElements = count(masterDb, Element.classFullName);
    const numMasterRelationships = count(masterDb, ElementRefersToElements.classFullName);
    assert.isAtLeast(numMasterElements, 12);
    assert.isAtLeast(numMasterRelationships, 1);
    assert.equal(numMasterElements, count(branchDb, Element.classFullName));
    assert.equal(numMasterRelationships, count(branchDb, ElementRefersToElements.classFullName));
    assert.equal(0, count(branchDb, ExternalSourceAspect.classFullName));

    // Ensure that master to branch synchronization did not add any new Elements or Relationships, but did add ExternalSourceAspects
    const masterToBranchTransformer = new IModelTransformer(masterDb, branchDb, { wasSourceIModelCopiedToTarget: true }); // Note use of `wasSourceIModelCopiedToTarget` flag
    await masterToBranchTransformer.processAll();
    masterToBranchTransformer.dispose();
    branchDb.saveChanges();
    assert.equal(numMasterElements, count(branchDb, Element.classFullName));
    assert.equal(numMasterRelationships, count(branchDb, ElementRefersToElements.classFullName));
    assert.isAtLeast(count(branchDb, ExternalSourceAspect.classFullName), numMasterElements + numMasterRelationships - 1); // provenance not recorded for the root Subject

    // Confirm that provenance (captured in ExternalSourceAspects) was set correctly
    const sql = `SELECT aspect.Identifier,aspect.Element.Id FROM ${ExternalSourceAspect.classFullName} aspect WHERE aspect.Kind=:kind`;
    branchDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindString("kind", ExternalSourceAspect.Kind.Element);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const masterElementId = statement.getValue(0).getString(); // ExternalSourceAspect.Identifier is of type string
        const branchElementId = statement.getValue(1).getId();
        assert.equal(masterElementId, branchElementId);
      }
    });

    // Make changes to simulate working on the branch
    ExtensiveTestScenario.updateDb(branchDb);
    ExtensiveTestScenario.assertUpdatesInDb(branchDb);
    branchDb.saveChanges();

    const numBranchElements = count(branchDb, Element.classFullName);
    const numBranchRelationships = count(branchDb, ElementRefersToElements.classFullName);
    assert.notEqual(numBranchElements, numMasterElements);
    assert.notEqual(numBranchRelationships, numMasterRelationships);

    // Synchronize changes from branch back to master
    const branchToMasterTransformer = new IModelTransformer(branchDb, masterDb, { isReverseSynchronization: true, noProvenance: true });
    await branchToMasterTransformer.processAll();
    branchToMasterTransformer.dispose();
    masterDb.saveChanges();
    ExtensiveTestScenario.assertUpdatesInDb(masterDb, false);
    assert.equal(numBranchElements, count(masterDb, Element.classFullName) - 2); // processAll cannot detect deletes when isReverseSynchronization=true
    assert.equal(numBranchRelationships, count(masterDb, ElementRefersToElements.classFullName) - 1); // processAll cannot detect deletes when isReverseSynchronization=true
    assert.equal(0, count(masterDb, ExternalSourceAspect.classFullName));

    masterDb.close();
    branchDb.close();
  });

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  it("should import everything below a Subject", async () => {
    // Source IModelDb
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "SourceImportSubject.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "SourceImportSubject" } });
    await ExtensiveTestScenario.prepareDb(sourceDb);
    ExtensiveTestScenario.populateDb(sourceDb);
    const sourceSubjectId = sourceDb.elements.queryElementIdByCode(Subject.createCode(sourceDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(sourceSubjectId));
    sourceDb.saveChanges();
    // Target IModelDb
    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TargetImportSubject.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "TargetImportSubject" } });
    await TransformerExtensiveTestScenario.prepareTargetDb(targetDb);
    const targetSubjectId = Subject.insert(targetDb, IModel.rootSubjectId, "Target Subject", "Target Subject Description");
    assert.isTrue(Id64.isValidId64(targetSubjectId));
    targetDb.saveChanges();
    // Import from beneath source Subject into target Subject
    const transformer = new TestIModelTransformer(sourceDb, targetDb);
    await transformer.processFonts();
    await transformer.processSubject(sourceSubjectId, targetSubjectId);
    await transformer.processRelationships(ElementRefersToElements.classFullName);
    transformer.dispose();
    targetDb.saveChanges();
    TransformerExtensiveTestScenario.assertTargetDbContents(sourceDb, targetDb, "Target Subject");
    const targetSubject: Subject = targetDb.elements.getElement<Subject>(targetSubjectId);
    assert.equal(targetSubject.description, "Target Subject Description");
    // Close
    sourceDb.close();
    targetDb.close();
  });

  it.skip("should clone Model within same iModel", async () => {
    // Set up the IModelDb with a populated source Subject and an "empty" target Subject
    const iModelFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "CloneModel.bim");
    const iModelDb = SnapshotDb.createEmpty(iModelFile, { rootSubject: { name: "CloneModel" } });
    await ExtensiveTestScenario.prepareDb(iModelDb);
    ExtensiveTestScenario.populateDb(iModelDb);
    const sourceSubjectId = iModelDb.elements.queryElementIdByCode(Subject.createCode(iModelDb, IModel.rootSubjectId, "Subject"))!;
    assert.isTrue(Id64.isValidId64(sourceSubjectId));
    const targetSubjectId = Subject.insert(iModelDb, IModel.rootSubjectId, "Target Subject");
    assert.isTrue(Id64.isValidId64(targetSubjectId));
    iModelDb.saveChanges();
    // Import from beneath source Subject into target Subject
    const transformer = new IModelTransformer(iModelDb, iModelDb);
    await transformer.processSubject(sourceSubjectId, targetSubjectId);
    transformer.dispose();
    iModelDb.saveChanges();
    iModelDb.close();
  });

  /** @note For debugging/testing purposes, you can use `it.only` and hard-code `sourceFileName` to test cloning of a particular iModel. */
  it("should clone test file", async () => {
    // open source iModel
    const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const sourceDb = SnapshotDb.openFile(sourceFileName);
    const numSourceElements = count(sourceDb, Element.classFullName);
    assert.exists(sourceDb);
    assert.isAtLeast(numSourceElements, 12);
    // create target iModel
    const targetDbFile: string = path.join(KnownTestLocations.outputDir, "IModelTransformer", "Clone-Target.bim");
    if (IModelJsFs.existsSync(targetDbFile)) {
      IModelJsFs.removeSync(targetDbFile);
    }
    const targetDbProps: CreateIModelProps = {
      rootSubject: { name: `Cloned target of ${sourceDb.elements.getRootSubject().code.value}` },
      ecefLocation: sourceDb.ecefLocation,
    };
    const targetDb = SnapshotDb.createEmpty(targetDbFile, targetDbProps);
    assert.exists(targetDb);
    // import
    const transformer = new IModelTransformer(sourceDb, targetDb);
    await transformer.processSchemas();
    await transformer.processAll();
    transformer.dispose();
    const numTargetElements = count(targetDb, Element.classFullName);
    assert.isAtLeast(numTargetElements, numSourceElements);
    assert.deepEqual(sourceDb.ecefLocation, targetDb.ecefLocation);
    // clean up
    sourceDb.close();
    targetDb.close();
  });

  it("should include source provenance", async () => {
    // create source iModel
    const sourceDbFile = IModelTestUtils.prepareOutputFile("IModelTransformer", "SourceProvenance.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "Source Provenance Test" } });
    const sourceRepositoryId = IModelTestUtils.insertRepositoryLink(sourceDb, "master.dgn", "https://test.bentley.com/folder/master.dgn", "DGN");
    const sourceExternalSourceId = IModelTestUtils.insertExternalSource(sourceDb, sourceRepositoryId, "Default Model");
    const sourceCategoryId = SpatialCategory.insert(sourceDb, IModel.dictionaryId, "SpatialCategory", { color: ColorDef.green.toJSON() });
    const sourceModelId = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "Physical");
    for (const x of [1, 2, 3]) {
      const physicalObjectProps: PhysicalElementProps = {
        classFullName: PhysicalObject.classFullName,
        model: sourceModelId,
        category: sourceCategoryId,
        code: Code.createEmpty(),
        userLabel: `PhysicalObject(${x})`,
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        placement: Placement3d.fromJSON({ origin: { x }, angles: {} }),
      };
      const physicalObjectId = sourceDb.elements.insertElement(physicalObjectProps);
      const aspectProps: ExternalSourceAspectProps = { // simulate provenance from a Connector
        classFullName: ExternalSourceAspect.classFullName,
        element: { id: physicalObjectId, relClassName: ElementOwnsExternalSourceAspects.classFullName },
        scope: { id: sourceExternalSourceId },
        source: { id: sourceExternalSourceId },
        identifier: `ID${x}`,
        kind: ExternalSourceAspect.Kind.Element,
      };
      sourceDb.elements.insertAspect(aspectProps);
    }
    sourceDb.saveChanges();

    // create target iModel
    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "SourceProvenance-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "Source Provenance Test (Target)" } });

    // clone
    const transformer = new IModelTransformer(sourceDb, targetDb, { includeSourceProvenance: true });
    await transformer.processAll();
    targetDb.saveChanges();

    // verify target contents
    assert.equal(1, count(sourceDb, RepositoryLink.classFullName));
    const targetRepositoryId = targetDb.elements.queryElementIdByCode(LinkElement.createCode(targetDb, IModel.repositoryModelId, "master.dgn"))!;
    assert.isTrue(Id64.isValidId64(targetRepositoryId));
    const targetExternalSourceId = IModelTestUtils.queryByUserLabel(targetDb, "Default Model");
    assert.isTrue(Id64.isValidId64(targetExternalSourceId));
    const targetCategoryId = targetDb.elements.queryElementIdByCode(SpatialCategory.createCode(targetDb, IModel.dictionaryId, "SpatialCategory"))!;
    assert.isTrue(Id64.isValidId64(targetCategoryId));
    const targetPhysicalObjectIds = [
      IModelTestUtils.queryByUserLabel(targetDb, "PhysicalObject(1)"),
      IModelTestUtils.queryByUserLabel(targetDb, "PhysicalObject(2)"),
      IModelTestUtils.queryByUserLabel(targetDb, "PhysicalObject(3)"),
    ];
    for (const targetPhysicalObjectId of targetPhysicalObjectIds) {
      assert.isTrue(Id64.isValidId64(targetPhysicalObjectId));
      const physicalObject = targetDb.elements.getElement<PhysicalObject>(targetPhysicalObjectId, PhysicalObject);
      assert.equal(physicalObject.category, targetCategoryId);
      const aspects = targetDb.elements.getAspects(targetPhysicalObjectId, ExternalSourceAspect.classFullName);
      assert.equal(2, aspects.length, "Expect original source provenance + provenance generated by IModelTransformer");
      for (const aspect of aspects) {
        const externalSourceAspect = aspect as ExternalSourceAspect;
        if (externalSourceAspect.scope.id === transformer.targetScopeElementId) {
          // provenance added by IModelTransformer
          assert.equal(externalSourceAspect.kind, ExternalSourceAspect.Kind.Element);
        } else {
          // provenance carried over from the source iModel
          assert.equal(externalSourceAspect.scope.id, targetExternalSourceId);
          assert.equal(externalSourceAspect.source!.id, targetExternalSourceId);
          assert.isTrue(externalSourceAspect.identifier.startsWith("ID"));
          assert.isTrue(physicalObject.userLabel!.includes(externalSourceAspect.identifier[2]));
          assert.equal(externalSourceAspect.kind, ExternalSourceAspect.Kind.Element);
        }
      }
    }

    // clean up
    transformer.dispose();
    sourceDb.close();
    targetDb.close();
  });

  it("should transform 3d elements in target iModel", async () => {
    // create source iModel
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "Transform3d-Source.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "Transform3d-Source" } });
    const categoryId: Id64String = SpatialCategory.insert(sourceDb, IModel.dictionaryId, "SpatialCategory", { color: ColorDef.green.toJSON() });
    const sourceModelId: Id64String = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "Physical");
    const xArray: number[] = [1, 3, 5, 7, 9];
    const yArray: number[] = [0, 2, 4, 6, 8];
    for (const x of xArray) {
      for (const y of yArray) {
        const physicalObjectProps1: PhysicalElementProps = {
          classFullName: PhysicalObject.classFullName,
          model: sourceModelId,
          category: categoryId,
          code: Code.createEmpty(),
          userLabel: `PhysicalObject(${x},${y})`,
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
          placement: Placement3d.fromJSON({ origin: { x, y }, angles: {} }),
        };
        sourceDb.elements.insertElement(physicalObjectProps1);
      }
    }
    const sourceModel: PhysicalModel = sourceDb.models.getModel<PhysicalModel>(sourceModelId);
    const sourceModelExtents: AxisAlignedBox3d = sourceModel.queryExtents();
    assert.deepEqual(sourceModelExtents, new Range3d(1, 0, 0, 10, 9, 1));
    // create target iModel
    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "Transform3d-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "Transform3d-Target" } });
    // transform
    const transform3d: Transform = Transform.createTranslation(new Point3d(100, 200));
    const transformer = new IModelTransformer3d(sourceDb, targetDb, transform3d);
    await transformer.processAll();
    const targetModelId: Id64String = transformer.context.findTargetElementId(sourceModelId);
    const targetModel: PhysicalModel = targetDb.models.getModel<PhysicalModel>(targetModelId);
    const targetModelExtents: AxisAlignedBox3d = targetModel.queryExtents();
    assert.deepEqual(targetModelExtents, new Range3d(101, 200, 0, 110, 209, 1));
    assert.deepEqual(targetModelExtents, transform3d.multiplyRange(sourceModelExtents));
    // clean up
    transformer.dispose();
    sourceDb.close();
    targetDb.close();
  });

  it("should combine models", async () => {
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "source-separate-models.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "Separate Models" } });
    const sourceCategoryId = SpatialCategory.insert(sourceDb, IModel.dictionaryId, "Category", {});
    const sourceModelId1 = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "M1");
    const sourceModelId2 = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "M2");
    const elementProps11: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: sourceModelId1,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject-M1-E1",
      category: sourceCategoryId,
      geom: IModelTestUtils.createBox(new Point3d(1, 1, 1)),
      placement: Placement3d.fromJSON({ origin: { x: 1, y: 1 }, angles: {} }),
    };
    const sourceElementId11 = sourceDb.elements.insertElement(elementProps11);
    const elementProps21: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: sourceModelId2,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject-M2-E1",
      category: sourceCategoryId,
      geom: IModelTestUtils.createBox(new Point3d(2, 2, 2)),
      placement: Placement3d.fromJSON({ origin: { x: 2, y: 2 }, angles: {} }),
    };
    const sourceElementId21 = sourceDb.elements.insertElement(elementProps21);
    sourceDb.saveChanges();
    assert.equal(count(sourceDb, PhysicalPartition.classFullName), 2);
    assert.equal(count(sourceDb, PhysicalModel.classFullName), 2);
    assert.equal(count(sourceDb, PhysicalObject.classFullName), 2);

    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "target-combined-model.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "Combined Model" } });
    const targetModelId = PhysicalModel.insert(targetDb, IModel.rootSubjectId, "PhysicalModel-Combined");

    const transformer = new PhysicalModelConsolidator(sourceDb, targetDb, targetModelId);
    await transformer.processAll();
    targetDb.saveChanges();

    const targetElement11 = targetDb.elements.getElement(transformer.context.findTargetElementId(sourceElementId11));
    assert.equal(targetElement11.userLabel, "PhysicalObject-M1-E1");
    assert.equal(targetElement11.model, targetModelId);
    const targetElement21 = targetDb.elements.getElement(transformer.context.findTargetElementId(sourceElementId21));
    assert.equal(targetElement21.userLabel, "PhysicalObject-M2-E1");
    assert.equal(targetElement21.model, targetModelId);
    const targetPartition = targetDb.elements.getElement(targetModelId);
    assert.equal(targetPartition.code.value, "PhysicalModel-Combined", "Original CodeValue should be retained");
    assert.equal(count(targetDb, PhysicalPartition.classFullName), 1);
    assert.equal(count(targetDb, PhysicalModel.classFullName), 1);
    assert.equal(count(targetDb, PhysicalObject.classFullName), 2);

    transformer.dispose();
    sourceDb.close();
    targetDb.close();
  });

  it("should consolidate PhysicalModels", async () => {
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "MultiplePhysicalModels.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "Multiple PhysicalModels" } });
    const categoryId: Id64String = SpatialCategory.insert(sourceDb, IModel.dictionaryId, "SpatialCategory", { color: ColorDef.green.toJSON() });
    for (let i = 0; i < 5; i++) {
      const sourceModelId: Id64String = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, `PhysicalModel${i}`);
      const xArray: number[] = [20 * i + 1, 20 * i + 3, 20 * i + 5, 20 * i + 7, 20 * i + 9];
      const yArray: number[] = [0, 2, 4, 6, 8];
      for (const x of xArray) {
        for (const y of yArray) {
          const physicalObjectProps1: PhysicalElementProps = {
            classFullName: PhysicalObject.classFullName,
            model: sourceModelId,
            category: categoryId,
            code: Code.createEmpty(),
            userLabel: `M${i}-PhysicalObject(${x},${y})`,
            geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
            placement: Placement3d.fromJSON({ origin: { x, y }, angles: {} }),
          };
          sourceDb.elements.insertElement(physicalObjectProps1);
        }
      }
    }
    sourceDb.saveChanges();
    assert.equal(5, count(sourceDb, PhysicalModel.classFullName));
    assert.equal(125, count(sourceDb, PhysicalObject.classFullName));

    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "OnePhysicalModel.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "One PhysicalModel" }, createClassViews: true });
    const targetModelId: Id64String = PhysicalModel.insert(targetDb, IModel.rootSubjectId, "PhysicalModel");
    assert.isTrue(Id64.isValidId64(targetModelId));
    targetDb.saveChanges();
    const consolidator = new PhysicalModelConsolidator(sourceDb, targetDb, targetModelId);
    await consolidator.processAll();
    consolidator.dispose();
    assert.equal(1, count(targetDb, PhysicalModel.classFullName));
    const targetPartition = targetDb.elements.getElement<PhysicalPartition>(targetModelId);
    assert.equal(targetPartition.code.value, "PhysicalModel", "Target PhysicalModel name should not be overwritten during consolidation");
    assert.equal(125, count(targetDb, PhysicalObject.classFullName));
    const aspects = targetDb.elements.getAspects(targetPartition.id, ExternalSourceAspect.classFullName);
    assert.isAtLeast(aspects.length, 5, "Provenance should be recorded for each source PhysicalModel");

    const sql = `SELECT ECInstanceId FROM ${PhysicalObject.classFullName}`;
    targetDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const targetElementId = statement.getValue(0).getId();
        const targetElement = targetDb.elements.getElement<PhysicalObject>({ id: targetElementId, wantGeometry: true });
        assert.exists(targetElement.geom);
        assert.isFalse(targetElement.calculateRange3d().isNull);
      }
    });

    sourceDb.close();
    targetDb.close();
  });

  it("should sync Team iModels into Shared", async () => {
    const iModelShared: SnapshotDb = IModelTransformerTestUtils.createSharedIModel(outputDir, ["A", "B"]);

    if (true) {
      const iModelA: SnapshotDb = IModelTransformerTestUtils.createTeamIModel(outputDir, "A", Point3d.create(0, 0, 0), ColorDef.green);
      IModelTransformerTestUtils.assertTeamIModelContents(iModelA, "A");
      const iModelExporterA = new IModelExporter(iModelA);
      iModelExporterA.excludeElement(iModelA.elements.queryElementIdByCode(Subject.createCode(iModelA, IModel.rootSubjectId, "Context"))!);
      const subjectId: Id64String = IModelTestUtils.querySubjectId(iModelShared, "A");
      const transformerA2S = new IModelTransformer(iModelExporterA, iModelShared, { targetScopeElementId: subjectId });
      transformerA2S.context.remapElement(IModel.rootSubjectId, subjectId);
      await transformerA2S.processAll();
      transformerA2S.dispose();
      IModelTestUtils.dumpIModelInfo(iModelA);
      iModelA.close();
      iModelShared.saveChanges("Imported A");
      IModelTransformerTestUtils.assertSharedIModelContents(iModelShared, ["A"]);
    }

    if (true) {
      const iModelB: SnapshotDb = IModelTransformerTestUtils.createTeamIModel(outputDir, "B", Point3d.create(0, 10, 0), ColorDef.blue);
      IModelTransformerTestUtils.assertTeamIModelContents(iModelB, "B");
      const iModelExporterB = new IModelExporter(iModelB);
      iModelExporterB.excludeElement(iModelB.elements.queryElementIdByCode(Subject.createCode(iModelB, IModel.rootSubjectId, "Context"))!);
      const subjectId: Id64String = IModelTestUtils.querySubjectId(iModelShared, "B");
      const transformerB2S = new IModelTransformer(iModelExporterB, iModelShared, { targetScopeElementId: subjectId });
      transformerB2S.context.remapElement(IModel.rootSubjectId, subjectId);
      await transformerB2S.processAll();
      transformerB2S.dispose();
      IModelTestUtils.dumpIModelInfo(iModelB);
      iModelB.close();
      iModelShared.saveChanges("Imported B");
      IModelTransformerTestUtils.assertSharedIModelContents(iModelShared, ["A", "B"]);
    }

    if (true) {
      const iModelConsolidated: SnapshotDb = IModelTransformerTestUtils.createConsolidatedIModel(outputDir, "Consolidated");
      const transformerS2C = new IModelTransformer(iModelShared, iModelConsolidated);
      const subjectA: Id64String = IModelTestUtils.querySubjectId(iModelShared, "A");
      const subjectB: Id64String = IModelTestUtils.querySubjectId(iModelShared, "B");
      const definitionA: Id64String = IModelTestUtils.queryDefinitionPartitionId(iModelShared, subjectA, "A");
      const definitionB: Id64String = IModelTestUtils.queryDefinitionPartitionId(iModelShared, subjectB, "B");
      const definitionC: Id64String = IModelTestUtils.queryDefinitionPartitionId(iModelConsolidated, IModel.rootSubjectId, "Consolidated");
      transformerS2C.context.remapElement(definitionA, definitionC);
      transformerS2C.context.remapElement(definitionB, definitionC);
      const physicalA: Id64String = IModelTestUtils.queryPhysicalPartitionId(iModelShared, subjectA, "A");
      const physicalB: Id64String = IModelTestUtils.queryPhysicalPartitionId(iModelShared, subjectB, "B");
      const physicalC: Id64String = IModelTestUtils.queryPhysicalPartitionId(iModelConsolidated, IModel.rootSubjectId, "Consolidated");
      transformerS2C.context.remapElement(physicalA, physicalC);
      transformerS2C.context.remapElement(physicalB, physicalC);
      await transformerS2C.processModel(definitionA);
      await transformerS2C.processModel(definitionB);
      await transformerS2C.processModel(physicalA);
      await transformerS2C.processModel(physicalB);
      await transformerS2C.processDeferredElements();
      await transformerS2C.processRelationships(ElementRefersToElements.classFullName);
      transformerS2C.dispose();
      IModelTransformerTestUtils.assertConsolidatedIModelContents(iModelConsolidated, "Consolidated");
      IModelTestUtils.dumpIModelInfo(iModelConsolidated);
      iModelConsolidated.close();
    }

    IModelTestUtils.dumpIModelInfo(iModelShared);
    iModelShared.close();
  });

  it("should detect conflicting provenance scopes", async () => {
    const sourceDb1 = IModelTransformerTestUtils.createTeamIModel(outputDir, "S1", Point3d.create(0, 0, 0), ColorDef.green);
    const sourceDb2 = IModelTransformerTestUtils.createTeamIModel(outputDir, "S2", Point3d.create(0, 10, 0), ColorDef.blue);
    assert.notEqual(sourceDb1.iModelId, sourceDb2.iModelId); // iModelId must be different to detect provenance scope conflicts

    const targetDbFile = IModelTestUtils.prepareOutputFile("IModelTransformer", "ConflictingScopes.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "Conflicting Scopes Test" } });

    const transformer1 = new IModelTransformer(sourceDb1, targetDb); // did not set targetScopeElementId
    const transformer2 = new IModelTransformer(sourceDb2, targetDb); // did not set targetScopeElementId

    await transformer1.processAll(); // first one succeeds using IModel.rootSubjectId as the default targetScopeElementId

    try {
      await transformer2.processAll(); // expect IModelError to be thrown because of the targetScopeElementId conflict with second transformation
      assert.fail("Expected provenance scope conflict");
    } catch (e) {
      assert.isTrue(e instanceof IModelError);
    } finally {
      transformer1.dispose();
      transformer2.dispose();
      sourceDb1.close();
      sourceDb2.close();
      targetDb.close();
    }
  });

  it("IModelCloneContext remap tests", async () => {
    const iModelDb: SnapshotDb = IModelTransformerTestUtils.createTeamIModel(outputDir, "Test", Point3d.create(0, 0, 0), ColorDef.green);
    const cloneContext = new IModelCloneContext(iModelDb);
    const sourceId: Id64String = Id64.fromLocalAndBriefcaseIds(1, 1);
    const targetId: Id64String = Id64.fromLocalAndBriefcaseIds(1, 2);
    cloneContext.remapElement(sourceId, targetId);
    assert.equal(targetId, cloneContext.findTargetElementId(sourceId));
    assert.equal(Id64.invalid, cloneContext.findTargetElementId(targetId));
    assert.equal(Id64.invalid, cloneContext.findTargetCodeSpecId(targetId));
    assert.throws(() => cloneContext.remapCodeSpec("SourceNotFound", "TargetNotFound"));
    cloneContext.dispose();
    iModelDb.close();
  });

  it("should clone across schema versions", async () => {
    // NOTE: schema differences between 01.00.00 and 01.00.01 were crafted to reproduce a cloning bug. The goal of this test is to prevent regressions.
    const cloneTestSchema100: string = path.join(KnownTestLocations.assetsDir, "CloneTest.01.00.00.ecschema.xml");
    const cloneTestSchema101: string = path.join(KnownTestLocations.assetsDir, "CloneTest.01.00.01.ecschema.xml");

    const seedDb = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "CloneWithSchemaChanges-Source.bim");
    const sourceDb = SnapshotDb.createFrom(seedDb, sourceDbFile);
    await sourceDb.importSchemas([cloneTestSchema100]);
    const sourceElementProps = {
      classFullName: "CloneTest:PhysicalType",
      model: IModel.dictionaryId,
      code: PhysicalType.createCode(sourceDb, IModel.dictionaryId, "Type1"),
      string1: "a",
      string2: "b",
    };
    const sourceElementId = sourceDb.elements.insertElement(sourceElementProps);
    const sourceElement = sourceDb.elements.getElement(sourceElementId);
    assert.equal(sourceElement.asAny.string1, "a");
    assert.equal(sourceElement.asAny.string2, "b");
    sourceDb.saveChanges();

    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "CloneWithSchemaChanges-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "CloneWithSchemaChanges-Target" } });
    await targetDb.importSchemas([cloneTestSchema101]);

    const transformer = new IModelTransformer(sourceDb, targetDb);
    await transformer.processElement(sourceElementId);
    targetDb.saveChanges();

    const targetElementId = transformer.context.findTargetElementId(sourceElementId);
    const targetElement = targetDb.elements.getElement(targetElementId);
    assert.equal(targetElement.asAny.string1, "a");
    assert.equal(targetElement.asAny.string2, "b");

    seedDb.close();
    sourceDb.close();
    targetDb.close();
  });

  it("Should not visit elements or relationships", async () => {
    // class that asserts if it encounters an element or relationship
    class TestExporter extends IModelExportHandler {
      public iModelExporter: IModelExporter;
      public modelCount = 0;
      public constructor(iModelDb: IModelDb) {
        super();
        this.iModelExporter = new IModelExporter(iModelDb);
        this.iModelExporter.registerHandler(this);
      }
      public override onExportModel(_model: Model, _isUpdate: boolean | undefined): void {
        ++this.modelCount;
      }
      public override onExportElement(_element: Element, _isUpdate: boolean | undefined): void {
        assert.fail("Should not visit element when visitElements=false");
      }
      public override onExportRelationship(_relationship: Relationship, _isUpdate: boolean | undefined): void {
        assert.fail("Should not visit relationship when visitRelationship=false");
      }
    }
    const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const sourceDb: SnapshotDb = SnapshotDb.openFile(sourceFileName);
    const exporter = new TestExporter(sourceDb);
    exporter.iModelExporter.visitElements = false;
    exporter.iModelExporter.visitRelationships = false;
    // call various methods to make sure the onExport* callbacks don't assert
    await exporter.iModelExporter.exportAll();
    await exporter.iModelExporter.exportElement(IModel.rootSubjectId);
    await exporter.iModelExporter.exportChildElements(IModel.rootSubjectId);
    await exporter.iModelExporter.exportModelContents(IModel.repositoryModelId);
    await exporter.iModelExporter.exportRelationships(ElementRefersToElements.classFullName);
    // make sure the exporter actually visited something
    assert.isAtLeast(exporter.modelCount, 4);
    sourceDb.close();
  });

  it("Should filter by ViewDefinition", async () => {
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "FilterByView-Source.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, { rootSubject: { name: "FilterByView-Source" } });
    const categoryNames: string[] = ["C1", "C2", "C3", "C4", "C5"];
    categoryNames.forEach((categoryName) => {
      const categoryId = SpatialCategory.insert(sourceDb, IModel.dictionaryId, categoryName, {});
      CategorySelector.insert(sourceDb, IModel.dictionaryId, categoryName, [categoryId]);
    });
    const modelNames: string[] = ["MA", "MB", "MC", "MD"];
    modelNames.forEach((modelName) => {
      const modelId = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, modelName);
      ModelSelector.insert(sourceDb, IModel.dictionaryId, modelName, [modelId]);

    });
    const projectExtents = new Range3d();
    const displayStyleId = DisplayStyle3d.insert(sourceDb, IModel.dictionaryId, "DisplayStyle");
    for (let x = 0; x < categoryNames.length; x++) { // eslint-disable-line @typescript-eslint/prefer-for-of
      const categoryId = sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(sourceDb, IModel.dictionaryId, categoryNames[x]))!;
      const categorySelectorId = sourceDb.elements.queryElementIdByCode(CategorySelector.createCode(sourceDb, IModel.dictionaryId, categoryNames[x]))!;
      for (let y = 0; y < modelNames.length; y++) { // eslint-disable-line @typescript-eslint/prefer-for-of
        const modelId = sourceDb.elements.queryElementIdByCode(PhysicalPartition.createCode(sourceDb, IModel.rootSubjectId, modelNames[y]))!;
        const modelSelectorId = sourceDb.elements.queryElementIdByCode(ModelSelector.createCode(sourceDb, IModel.dictionaryId, modelNames[y]))!;
        const physicalObjectProps: PhysicalElementProps = {
          classFullName: PhysicalObject.classFullName,
          model: modelId,
          category: categoryId,
          code: Code.createEmpty(),
          userLabel: `${PhysicalObject.className}-${categoryNames[x]}-${modelNames[y]}`,
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1), categoryId),
          placement: {
            origin: Point3d.create(x * 2, y * 2, 0),
            angles: YawPitchRollAngles.createDegrees(0, 0, 0),
          },
        };
        const physicalObjectId = sourceDb.elements.insertElement(physicalObjectProps);
        const physicalObject = sourceDb.elements.getElement<PhysicalObject>(physicalObjectId, PhysicalObject);
        const viewExtents = physicalObject.placement.calculateRange();
        OrthographicViewDefinition.insert(
          sourceDb,
          IModel.dictionaryId,
          `View-${categoryNames[x]}-${modelNames[y]}`,
          modelSelectorId,
          categorySelectorId,
          displayStyleId,
          viewExtents,
          StandardViewIndex.Iso
        );
        projectExtents.extendRange(viewExtents);
      }
    }
    sourceDb.updateProjectExtents(projectExtents);
    const exportCategorySelectorId = CategorySelector.insert(sourceDb, IModel.dictionaryId, "Export", [
      sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(sourceDb, IModel.dictionaryId, categoryNames[0]))!,
      sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(sourceDb, IModel.dictionaryId, categoryNames[2]))!,
      sourceDb.elements.queryElementIdByCode(SpatialCategory.createCode(sourceDb, IModel.dictionaryId, categoryNames[4]))!,
    ]);
    const exportModelSelectorId = ModelSelector.insert(sourceDb, IModel.dictionaryId, "Export", [
      sourceDb.elements.queryElementIdByCode(PhysicalPartition.createCode(sourceDb, IModel.rootSubjectId, modelNames[1]))!,
      sourceDb.elements.queryElementIdByCode(PhysicalPartition.createCode(sourceDb, IModel.rootSubjectId, modelNames[3]))!,
    ]);
    const exportViewId = OrthographicViewDefinition.insert(
      sourceDb,
      IModel.dictionaryId,
      "Export",
      exportModelSelectorId,
      exportCategorySelectorId,
      displayStyleId,
      projectExtents,
      StandardViewIndex.Iso
    );
    sourceDb.saveChanges();

    const targetDbFile: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "FilterByView-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFile, { rootSubject: { name: "FilterByView-Target" } });
    targetDb.updateProjectExtents(sourceDb.projectExtents);

    const transformer = new FilterByViewTransformer(sourceDb, targetDb, exportViewId);
    await transformer.processSchemas();
    await transformer.processAll();
    transformer.dispose();

    targetDb.saveChanges();
    targetDb.close();
    sourceDb.close();
  });

  // WIP: Included as skipped until test file management strategy can be refined.
  it.skip("Merge test", async () => {
    const mergedIModelFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "MergeTest.bim");
    const mergedDb = SnapshotDb.createEmpty(mergedIModelFileName, { rootSubject: { name: "Merge Test" } });
    const campusSubjectId: Id64String = Subject.insert(mergedDb, IModel.rootSubjectId, "Campus");
    assert.isTrue(Id64.isValidId64(campusSubjectId));
    const garageSubjectId: Id64String = Subject.insert(mergedDb, IModel.rootSubjectId, "Garage");
    assert.isTrue(Id64.isValidId64(garageSubjectId));
    const buildingSubjectId: Id64String = Subject.insert(mergedDb, IModel.rootSubjectId, "Building");
    assert.isTrue(Id64.isValidId64(buildingSubjectId));
    mergedDb.saveChanges("Create Subject hierarchy");
    IModelTestUtils.flushTxns(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes

    // Import campus
    if (true) {
      const campusIModelFileName = "D:/data/bim/MergeTest/Campus.bim";
      const campusDb = SnapshotDb.openFile(campusIModelFileName);
      IModelTestUtils.dumpIModelInfo(campusDb);
      const transformer = new IModelTransformer(campusDb, mergedDb, { targetScopeElementId: campusSubjectId });
      await transformer.processSchemas();
      transformer.context.remapElement(IModel.rootSubjectId, campusSubjectId);
      await transformer.processAll();
      transformer.dispose();
      mergedDb.saveChanges("Imported Campus");
      IModelTestUtils.flushTxns(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes
      campusDb.close();
    }

    // Import garage
    if (true) {
      const garageIModelFileName = "D:/data/bim/MergeTest/Garage.bim";
      const garageDb = SnapshotDb.openFile(garageIModelFileName);
      IModelTestUtils.dumpIModelInfo(garageDb);
      const transformer = new IModelTransformer(garageDb, mergedDb, { targetScopeElementId: garageSubjectId });
      transformer.context.remapElement(IModel.rootSubjectId, garageSubjectId);
      await transformer.processAll();
      transformer.dispose();
      mergedDb.saveChanges("Imported Garage");
      IModelTestUtils.flushTxns(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes
      garageDb.close();
    }

    // Import building
    if (true) {
      const buildingIModelFileName = "D:/data/bim/MergeTest/Building.bim";
      const buildingDb = SnapshotDb.openFile(buildingIModelFileName);
      IModelTestUtils.dumpIModelInfo(buildingDb);
      const transformer = new IModelTransformer(buildingDb, mergedDb, { targetScopeElementId: buildingSubjectId });
      await transformer.processSchemas();
      transformer.context.remapElement(IModel.rootSubjectId, buildingSubjectId);
      await transformer.processAll();
      transformer.dispose();
      mergedDb.saveChanges("Imported Building");
      IModelTestUtils.flushTxns(mergedDb); // subsequent calls to importSchemas will fail if this is not called to flush local changes
      buildingDb.close();
    }

    IModelTestUtils.dumpIModelInfo(mergedDb);
    mergedDb.close();
  });

  it("processSchemas should handle out-of-order exported schemas", async () => {
    const testSchema1Path = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestSchema1.ecschema.xml");
    IModelJsFs.writeFileSync(testSchema1Path, `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema1" alias="ts1" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
          <ECEntityClass typeName="TestElement1">
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECProperty propertyName="MyProp1" typeName="string"/>
          </ECEntityClass>
      </ECSchema>`
    );

    const testSchema2Path = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestSchema2.ecschema.xml");
    IModelJsFs.writeFileSync(testSchema2Path, `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema2" alias="ts2" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
          <ECSchemaReference name="TestSchema1" version="01.00.00" alias="ts1"/>
          <ECEntityClass typeName="TestElement2">
            <BaseClass>ts1:TestElement1</BaseClass>
            <ECProperty propertyName="MyProp2" typeName="string"/>
          </ECEntityClass>
      </ECSchema>`
    );

    const sourceDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "OrderTestSource.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbPath, { rootSubject: { name: "Order Test" } });

    await sourceDb.importSchemas([testSchema1Path, testSchema2Path]);
    sourceDb.saveChanges();

    class OrderedExporter extends IModelExporter {
      public override async exportSchemas() {
        const schemaLoader = new IModelSchemaLoader(this.sourceDb);
        const schema1 = schemaLoader.getSchema("TestSchema1");
        const schema2 = schemaLoader.getSchema("TestSchema2");
        // by importing schema2 (which references schema1) first, we
        // prove that the import order in processSchemas does not matter
        await this.handler.onExportSchema(schema2);
        await this.handler.onExportSchema(schema1);
      }
    }

    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "OrderTestTarget.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbPath, { rootSubject: { name: "Order Test" } });
    const transformer = new IModelTransformer(new OrderedExporter(sourceDb), targetDb);

    let error: any;
    try {
      await transformer.processSchemas();
    } catch (_error) {
      error = _error;
    }
    assert.isUndefined(error);

    targetDb.saveChanges();
    const targetImportedSchemasLoader = new IModelSchemaLoader(targetDb);
    const schema1InTarget = targetImportedSchemasLoader.getSchema("TestSchema1");
    assert.isDefined(schema1InTarget);
    const schema2InTarget = targetImportedSchemasLoader.getSchema("TestSchema2");
    assert.isDefined(schema2InTarget);

    sourceDb.close();
    targetDb.close();
  });

  it("processSchemas should wait for the schema import to finish to delete the export directory", async () => {
    const cloneTestSchema100 = path.join(KnownTestLocations.assetsDir, "CloneTest.01.00.00.ecschema.xml");
    const sourceDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "FinallyFirstTest.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbPath, { rootSubject: { name: "FinallyFirstTest" } });
    await sourceDb.importSchemas([cloneTestSchema100]);
    sourceDb.saveChanges();

    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "FinallyFirstTestOut.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbPath, { rootSubject: { name: "FinallyFirstTest" } });
    const transformer = new IModelTransformer(sourceDb, targetDb);

    const importSchemasResolved = sinon.spy();
    let importSchemasPromise: Promise<void>;

    sinon.replace(targetDb, "importSchemas", sinon.fake(async () => {
      importSchemasPromise = new Promise((resolve) => setImmediate(() => {
        importSchemasResolved();
        resolve(undefined);
      }));
      return importSchemasPromise;
    }));

    const removeSyncSpy = sinon.spy(IModelJsFs, "removeSync");

    await transformer.processSchemas();
    assert(removeSyncSpy.calledAfter(importSchemasResolved));

    sinon.restore();
    sourceDb.close();
    targetDb.close();
  });

  it("handles definition element scoped by non-definitional element", async () => {
    const sourceDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "BadPredecessorsExampleSource.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbPath, { rootSubject: { name: "BadPredecessorExampleSource" } });

    // create a document partition in our iModel's root
    const documentListModelId = DocumentListModel.insert(sourceDb, IModelDb.rootSubjectId, "DocumentList");

    // add a drawing to the document partition's model
    const drawingId = sourceDb.elements.insertElement({
      classFullName: Drawing.classFullName,
      model: documentListModelId,
      code: Drawing.createCode(sourceDb, documentListModelId, "Drawing"),
    });
    expect(Id64.isValidId64(drawingId)).to.be.true;

    // submodel our drawing with a DrawingModel
    const model = sourceDb.models.createModel({
      classFullName: DrawingModel.classFullName,
      modeledElement: { id: drawingId },
    });
    sourceDb.models.insertModel(model);

    const myCodeSpecId = sourceDb.codeSpecs.insert(CodeSpec.create(sourceDb, "MyCodeSpec", CodeScopeSpec.Type.RelatedElement));

    // insert a definition element which is scoped by a non-definition element (the drawing)
    const _physicalMaterialId = sourceDb.elements.insertElement({
      classFullName: GenericPhysicalMaterial.classFullName,
      model: IModel.dictionaryId,
      code: new Code({ spec: myCodeSpecId, scope: drawingId, value: "physical material" }),
    } as DefinitionElementProps);

    sourceDb.saveChanges();

    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "BadPredecessorExampleTarget.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbPath, { rootSubject: { name: sourceDb.rootSubject.name } });
    const transformer = new IModelTransformer(sourceDb, targetDb);

    await expect(transformer.processSchemas()).to.eventually.be.fulfilled;
    await expect(transformer.processAll()).to.eventually.be.fulfilled;

    // check if target imodel has the elements that source imodel had
    expect(targetDb.codeSpecs.hasName("MyCodeSpec")).to.be.true;
    const drawingIdTarget = targetDb.elements.queryElementIdByCode(Drawing.createCode(targetDb, documentListModelId, "Drawing"));
    expect(drawingIdTarget).to.not.be.undefined;
    expect(Id64.isValidId64((drawingIdTarget as string))).to.be.true;
    const physicalMaterialIdTarget = targetDb.elements.queryElementIdByCode(new Code({ spec: myCodeSpecId, scope: drawingId, value: "physical material" }));
    expect(physicalMaterialIdTarget).to.not.be.undefined;
    expect(Id64.isValidId64((physicalMaterialIdTarget as string))).to.be.true;

    sourceDb.close();
    targetDb.close();
  });

  it("handle backwards related-instance code in model", async () => {
    const sourceDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "BadPredecessorsExampleSource.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbPath, { rootSubject: { name: "BadPredecessorExampleSource" } });

    // create a document partition in our iModel's root
    const documentListModelId = DocumentListModel.insert(sourceDb, IModelDb.rootSubjectId, "DocumentList");

    // add a drawing to the document partition's model
    const drawing1Id = sourceDb.elements.insertElement({
      classFullName: Drawing.classFullName,
      model: documentListModelId,
      code: Drawing.createCode(sourceDb, documentListModelId, "Drawing1"),
    });

    const drawing2Id = sourceDb.elements.insertElement({
      classFullName: Drawing.classFullName,
      model: documentListModelId,
      code: Drawing.createCode(sourceDb, documentListModelId, "Drawing2"),
    });

    const drawingModel1 = sourceDb.models.createModel({
      classFullName: DrawingModel.classFullName,
      modeledElement: { id: drawing1Id },
    });
    const drawingModel1Id = sourceDb.models.insertModel(drawingModel1);

    const drawingModel2 = sourceDb.models.createModel({
      classFullName: DrawingModel.classFullName,
      modeledElement: { id: drawing2Id },
    });
    const drawingModel2Id = sourceDb.models.insertModel(drawingModel2);

    const modelCodeSpec = sourceDb.codeSpecs.insert(CodeSpec.create(sourceDb, "ModelCodeSpec", CodeScopeSpec.Type.Model));
    const relatedCodeSpecId = sourceDb.codeSpecs.insert(CodeSpec.create(sourceDb, "RelatedCodeSpec", CodeScopeSpec.Type.RelatedElement));

    const categoryId = DrawingCategory.insert(sourceDb, IModel.dictionaryId, "DrawingCategory", { color: ColorDef.green.toJSON() });

    // we make drawingGraphic2 in drawingModel2 first
    const drawingGraphic2Id = new DrawingGraphic({
      classFullName: DrawingGraphic.classFullName,
      model: drawingModel2Id,
      code: new Code({ spec: modelCodeSpec, scope: drawingModel2Id, value: "drawing graphic 2" }),
      category: categoryId,
    }, sourceDb).insert();

    const _drawingGraphic1Id = new DrawingGraphic({
      classFullName: DrawingGraphic.classFullName,
      model: drawingModel1Id,
      code: new Code({ spec: relatedCodeSpecId, scope: drawingGraphic2Id, value: "drawing graphic 1" }),
      category: categoryId,
    }, sourceDb).insert();

    sourceDb.saveChanges();

    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "BadPredecessorExampleTarget.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbPath, { rootSubject: { name: sourceDb.rootSubject.name } });
    const transformer = new IModelTransformer(sourceDb, targetDb);

    await expect(transformer.processSchemas()).to.eventually.be.fulfilled;
    await expect(transformer.processAll()).to.eventually.be.fulfilled;

    // check if target imodel has the elements that source imodel had
    expect(targetDb.codeSpecs.hasName("ModelCodeSpec")).to.be.true;
    expect(targetDb.codeSpecs.hasName("RelatedCodeSpec")).to.be.true;
    const drawingIdTarget1 = targetDb.elements.queryElementIdByCode(Drawing.createCode(targetDb, documentListModelId, "Drawing1"));
    expect(drawingIdTarget1).to.not.be.undefined;
    expect(Id64.isValidId64((drawingIdTarget1 as string))).to.be.true;

    const drawingIdTarget2 = targetDb.elements.queryElementIdByCode(Drawing.createCode(targetDb, documentListModelId, "Drawing2"));
    expect(drawingIdTarget2).to.not.be.undefined;
    expect(Id64.isValidId64((drawingIdTarget2 as string))).to.be.true;

    const drawingGraphicIdTarget2Props = targetDb.elements.getElementProps(drawingGraphic2Id);
    expect(targetDb.elements.queryElementIdByCode(new Code(drawingGraphicIdTarget2Props.code))).to.not.be.undefined;
    expect(Id64.isValidId64((targetDb.elements.queryElementIdByCode(new Code(drawingGraphicIdTarget2Props.code)) as string))).to.be.true;

    const drawingGraphicIdTarget1Props = targetDb.elements.getElementProps(_drawingGraphic1Id);
    expect(targetDb.elements.queryElementIdByCode(new Code(drawingGraphicIdTarget1Props.code))).to.not.be.undefined;
    expect(Id64.isValidId64((targetDb.elements.queryElementIdByCode(new Code(drawingGraphicIdTarget1Props.code)) as string))).to.be.true;
    sourceDb.close();
    targetDb.close();
  });

  // for testing purposes only, based on SetToStandalone.ts, force a snapshot to mimic a standalone iModel
  function setToStandalone(iModelName: string) {
    const nativeDb = new IModelHost.platform.DgnDb();
    nativeDb.openIModel(iModelName, OpenMode.ReadWrite);
    nativeDb.setITwinId(Guid.empty); // empty iTwinId means "standalone"
    nativeDb.saveChanges(); // save change to iTwinId
    nativeDb.deleteAllTxns(); // necessary before resetting briefcaseId
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned); // standalone iModels should always have BriefcaseId unassigned
    nativeDb.saveLocalValue("StandaloneEdit", JSON.stringify({ txns: true }));
    nativeDb.saveChanges(); // save change to briefcaseId
    nativeDb.closeIModel();
  }

  it("biscore update is valid", async () => {

    const sourceDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "BisCoreUpdateSource.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbPath, { rootSubject: { name: "BisCoreUpdate" } });

    // this seed has an old biscore, so we know that transforming an empty source (which starts with a fresh, updated biscore)
    // will cause an update to the old biscore in this target
    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "BisCoreUpdateTarget.bim");
    const seedDb = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
    const targetDbTestCopy = SnapshotDb.createFrom(seedDb, targetDbPath);
    targetDbTestCopy.close();
    seedDb.close();
    setToStandalone(targetDbPath);
    const targetDb = StandaloneDb.openFile(targetDbPath);

    assert(
      Semver.lt(
        Schema.toSemverString(targetDb.querySchemaVersion("BisCore")!),
        Schema.toSemverString(sourceDb.querySchemaVersion("BisCore")!)),
      "The targetDb must have a less up-to-date version of the BisCore schema than the source"
    );

    const transformer = new IModelTransformer(sourceDb, targetDb);
    await transformer.processSchemas();
    targetDb.saveChanges();

    assert(
      Semver.eq(
        Schema.toSemverString(targetDb.querySchemaVersion("BisCore")!),
        Schema.toSemverString(sourceDb.querySchemaVersion("BisCore")!)),
      "The targetDb must now have an equivalent BisCore schema because it was updated"
    );

    sourceDb.close();
    targetDb.close();
  });

  /** gets a mapping of element ids to their invariant content */
  async function getAllElementsInvariants(db: IModelDb, filterPredicate?: (element: Element) => boolean) {
    const result: Record<Id64String, any> = {};
    for await (const row of db.query("SELECT * FROM bis.Element", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      if (!filterPredicate || filterPredicate(db.elements.getElement(row.id))) {
        const { lastMod: _lastMod, ...invariantPortion } = row;
        result[row.id] = invariantPortion;
      }
    }
    return result;
  }

  /** gets the ordered list of the relationships inserted earlier */
  async function getInvariantRelationsContent(
    db: IModelDb,
    filterPredicate?: (rel: {sourceId: string, targetId: string}) => boolean
  ): Promise<{ sourceId: Id64String, targetId: Id64String }[]> {
    const result = [];
    for await (const row of db.query("SELECT * FROM bis.ElementRefersToElements", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      if (!filterPredicate || filterPredicate(row)) {
        const { id: _id, ...invariantPortion } = row;
        result.push(invariantPortion);
      }
    }
    return result;
  }

  it("preserveId option preserves element ids, not other entity ids", async () => {
    const sourceDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "PreserveIdSource.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbPath, { rootSubject: { name: "PreserveId" } });

    const spatialCateg1Id  = SpatialCategory.insert(sourceDb, IModelDb.dictionaryId, "spatial-category1", { color: ColorDef.blue.toJSON() });
    const spatialCateg2Id = SpatialCategory.insert(sourceDb, IModelDb.dictionaryId, "spatial-category2", { color: ColorDef.red.toJSON() });
    const myPhysModelId = PhysicalModel.insert(sourceDb, IModelDb.rootSubjectId, "myPhysicalModel");
    const _physicalObjectIds = [spatialCateg1Id, spatialCateg2Id, spatialCateg2Id, spatialCateg2Id, spatialCateg2Id].map((categoryId, x) => {
      const physicalObjectProps: PhysicalElementProps = {
        classFullName: PhysicalObject.classFullName,
        model: myPhysModelId,
        category: categoryId,
        code: Code.createEmpty(),
        userLabel: `PhysicalObject(${x})`,
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        placement: Placement3d.fromJSON({ origin: { x }, angles: {} }),
      };
      const physicalObjectId = sourceDb.elements.insertElement(physicalObjectProps);
      return physicalObjectId;
    });

    // these link table relationships (ElementRefersToElements > PartitionOriginatesFromRepository) are examples of non-element entities
    const physicalPartitions = new Array(3).fill(null).map((_, index) =>
      new PhysicalPartition({
        classFullName: PhysicalPartition.classFullName,
        model: IModelDb.rootSubjectId,
        parent: {
          id: IModelDb.rootSubjectId,
          relClassName: ElementOwnsChildElements.classFullName,
        },
        code: PhysicalPartition.createCode(sourceDb, IModelDb.rootSubjectId, `physical-partition-${index}`),
      }, sourceDb),
    ).map((partition) => {
      const partitionId = partition.insert();
      const model = new PhysicalModel({
        classFullName: PhysicalPartition.classFullName,
        modeledElement: { id: partitionId },
      }, sourceDb);
      const modelId = model.insert();
      return { modelId, partitionId }; // these are the same id because of submodeling
    });

    const linksIds = new Array(2).fill(null).map((_, index) => {
      const link = new RepositoryLink({
        classFullName: RepositoryLink.classFullName,
        code: RepositoryLink.createCode(sourceDb, IModelDb.rootSubjectId, `repo-link-${index}`),
        model: IModelDb.rootSubjectId,
        repositoryGuid: `2fd0e5ed-a4d7-40cd-be8a-57552f5736b${index}`, // random, doesn't matter, works for up to 10 of course
        format: "my-format",
      }, sourceDb);
      const linkId = link.insert();
      return linkId;
    });

    const _nonElementEntityIds = [
      [physicalPartitions[1].partitionId, linksIds[0]],
      [physicalPartitions[1].partitionId, linksIds[1]],
      [physicalPartitions[2].partitionId, linksIds[0]],
      [physicalPartitions[2].partitionId, linksIds[1]],
    ].map(([sourceId, targetId]) =>
      sourceDb.relationships.insertInstance({
        classFullName: "BisCore:PartitionOriginatesFromRepository",
        sourceId,
        targetId,
      }));

    sourceDb.saveChanges();

    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "PreserveIdTarget.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbPath, { rootSubject: { name: "PreserveId" } });

    const spatialCateg2 = sourceDb.elements.getElement<SpatialCategory>(spatialCateg2Id);

    /** filter the category and all related elements from the source for transformation */
    function filterCategoryTransformationPredicate(elem: Element): boolean {
      // if we don't filter out the elements, the transformer will see that the category is a predecessor
      // and re-add it to the transformation.
      if (elem instanceof GeometricElement && elem.category === spatialCateg2Id)
        return false;
      if (elem.id === spatialCateg2Id)
        return false;
      return true;
    }

    /** filter the category and all related elements from the source for transformation */
    function filterRelationshipsToChangeIds({sourceId, targetId}: {sourceId: Id64String, targetId: Id64String}): boolean {
      // matches source+target of _nonElementEntityIds[0]
      if (sourceId === physicalPartitions[1].partitionId && targetId ===  linksIds[0])
        return false;
      return true;
    }

    /** filter the category and all related and child elements from the source for comparison, not transformation */
    function filterCategoryContentsPredicate(elem: Element): boolean {
      if (elem instanceof GeometricElement && elem.category === spatialCateg2Id)
        return false;
      if (elem.id === spatialCateg2Id)
        return false;
      if (elem.id === spatialCateg2.myDefaultSubCategoryId())
        return false;
      return true;
    }

    class FilterCategoryTransformer extends IModelTransformer {
      public override shouldExportElement(elem: Element): boolean {
        if (!filterCategoryTransformationPredicate(elem))
          return false;
        return super.shouldExportElement(elem);
      }
      public override shouldExportRelationship(rel: Relationship): boolean {
        if (!filterRelationshipsToChangeIds(rel))
          return false;
        return super.shouldExportRelationship(rel);
      }
    }

    const transformer = new FilterCategoryTransformer(sourceDb, targetDb, { preserveElementIdsForFiltering: true });
    await transformer.processAll();
    targetDb.saveChanges();

    const sourceContent = await getAllElementsInvariants(sourceDb, filterCategoryContentsPredicate);
    const targetContent = await getAllElementsInvariants(targetDb);
    expect(targetContent).to.deep.equal(sourceContent);

    const sourceRelations = await getInvariantRelationsContent(sourceDb, filterRelationshipsToChangeIds);
    const targetRelations = await getInvariantRelationsContent(targetDb);
    expect(sourceRelations).to.deep.equal(targetRelations);

    // now try inserting both an element and a relationship into the target to check the two entity id sequences are fine
    const spatialCateg3Id = SpatialCategory.insert(
      targetDb,
      IModelDb.dictionaryId,
      "spatial-category3",
      { color: ColorDef.black.toJSON() }
    );
    expect(Id64.isValid(spatialCateg3Id)).to.be.true;
    const spatialCateg3Subcateg1Id = SubCategory.insert(
      targetDb,
      spatialCateg3Id,
      "spatial-categ-subcateg-1",
      { color: ColorDef.white.toJSON() }
    );
    expect(Id64.isValid(spatialCateg3Subcateg1Id)).to.be.true;
    const insertedInstance = targetDb.relationships.insertInstance({
      classFullName: "BisCore:PartitionOriginatesFromRepository",
      sourceId: physicalPartitions[1].partitionId,
      targetId: linksIds[0],
    });
    expect(Id64.isValid(insertedInstance)).to.be.true;

    sourceDb.close();
    targetDb.close();
  });

  it("preserveId on test model", async () => {
    const seedDb = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
    const sourceDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "PreserveIdOnTestModel-Source.bim");
    // transforming the seed to an empty will update it to the latest bis from the new target
    // which minimizes differences we'd otherwise need to filter later
    const sourceDb  = SnapshotDb.createEmpty(sourceDbPath, { rootSubject: seedDb.rootSubject });
    const seedTransformer = new IModelTransformer(seedDb, sourceDb);
    await seedTransformer.processAll();
    sourceDb.saveChanges();

    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "PreserveIdOnTestModel-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbPath, { rootSubject: sourceDb.rootSubject });

    const transformer = new IModelTransformer(sourceDb, targetDb, { preserveElementIdsForFiltering: true });
    await transformer.processAll();
    targetDb.saveChanges();

    const sourceContent = await getAllElementsInvariants(sourceDb);
    const targetContent = await getAllElementsInvariants(targetDb);
    expect(targetContent).to.deep.equal(sourceContent);

    sourceDb.close();
    targetDb.close();
  });

  function createIModelWithDanglingPredecessor(opts: {name: string, path: string}) {
    const sourceDb = SnapshotDb.createEmpty(opts.path, { rootSubject: { name: opts.name } });

    const sourceCategoryId = SpatialCategory.insert(sourceDb, IModel.dictionaryId, "SpatialCategory", { color: ColorDef.green.toJSON() });
    const sourceModelId = PhysicalModel.insert(sourceDb, IModel.rootSubjectId, "Physical");
    const myPhysObjCodeSpec = CodeSpec.create(sourceDb, "myPhysicalObjects", CodeScopeSpec.Type.ParentElement);
    const myPhysObjCodeSpecId = sourceDb.codeSpecs.insert(myPhysObjCodeSpec);
    const physicalObjects = [1, 2].map((x) => {
      const code = new Code({
        spec: myPhysObjCodeSpecId,
        scope: sourceModelId,
        value: `PhysicalObject(${x})`,
      });
      const props: PhysicalElementProps = {
        classFullName: PhysicalObject.classFullName,
        model: sourceModelId,
        category: sourceCategoryId,
        code,
        userLabel: `PhysicalObject(${x})`,
        geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
        placement: Placement3d.fromJSON({ origin: { x }, angles: {} }),
      };
      const id = sourceDb.elements.insertElement(props);
      return { code, id };
    });
    const displayStyleId = DisplayStyle3d.insert(
      sourceDb,
      IModel.dictionaryId,
      "MyDisplayStyle",
      {
        excludedElements: physicalObjects.map((o) => o.id),
      }
    );
    const displayStyleCode = sourceDb.elements.getElement(displayStyleId).code;

    const physObjId2 = physicalObjects[1].id;
    // this deletion makes the display style have an reference to a now-gone element
    sourceDb.elements.deleteElement(physObjId2);

    sourceDb.saveChanges();

    return [
      sourceDb,
      {
        sourceCategoryId,
        sourceModelId,
        physicalObjects,
        displayStyleId,
        displayStyleCode,
        myPhysObjCodeSpec,
      },
    ] as const;
  }

  /**
   * A transformer that inserts an element at the beginning to ensure the target doesn't end up with the same ids as the source.
   * Useful if you need to check that some source/target element references match and want to be sure it isn't a coincidence,
   * which can happen deterministically in several cases, as well as just copy-paste errors where you accidentally test a
   * source or target db against itself
   * @note it modifies the target so there are side effects
   */
  class ShiftElemIdsTransformer extends IModelTransformer {
    constructor(...args: ConstructorParameters<typeof IModelTransformer>) {
      super(...args);
      try {
        // the choice of element to insert is arbitrary, anything easy works
        PhysicalModel.insert(this.targetDb, IModel.rootSubjectId, "MyShiftElemIdsPhysicalModel");
      } catch (_err) {} // ignore error in case someone tries to transform the same target multiple times with this
    }
  }

  it("predecessor deletion is considered invalid when danglingPredecessorsBehavior='reject' and that is the default", async () => {
    const sourceDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "DanglingPredecessorSource.bim");
    const [
      sourceDb,
      { displayStyleId, physicalObjects },
    ] = createIModelWithDanglingPredecessor({ name: "DanglingPredecessors", path: sourceDbPath });

    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "DanglingPredecessorTarget.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbPath, { rootSubject: sourceDb.rootSubject });

    const defaultTransformer = new ShiftElemIdsTransformer(sourceDb, targetDb);
    await expect(defaultTransformer.processAll()).to.be.rejectedWith(
      /Found a reference to an element "[^"]*" that doesn't exist/
    );

    const ignoreDanglingPredecessorsDisabledTransformer = new ShiftElemIdsTransformer(sourceDb, targetDb, { danglingPredecessorsBehavior: "reject" });
    await expect(ignoreDanglingPredecessorsDisabledTransformer.processAll()).to.be.rejectedWith(
      /Found a reference to an element "[^"]*" that doesn't exist/
    );

    const ignoreDanglingPredecessorsEnabledTransformer = new ShiftElemIdsTransformer(sourceDb, targetDb, { danglingPredecessorsBehavior: "ignore" });
    await expect(ignoreDanglingPredecessorsEnabledTransformer.processAll()).not.to.be.rejected;
    targetDb.saveChanges();

    expect(sourceDb.elements.tryGetElement(physicalObjects[1].id)).to.be.undefined;
    const displayStyleInSource = sourceDb.elements.getElement<DisplayStyle3d>(displayStyleId);
    expect([...displayStyleInSource.settings.excludedElementIds]).to.include(physicalObjects[1].id);

    const displayStyleInTargetId = ignoreDanglingPredecessorsEnabledTransformer.context.findTargetElementId(displayStyleId);
    const displayStyleInTarget = targetDb.elements.getElement<DisplayStyle3d>(displayStyleInTargetId);

    const physObjsInTarget = physicalObjects.map((physObjInSource) => {
      const physObjInTargetId = ignoreDanglingPredecessorsEnabledTransformer.context.findTargetElementId(physObjInSource.id);
      return { ...physObjInSource, id: physObjInTargetId };
    });

    expect(Id64.isValidId64(physObjsInTarget[0].id)).to.be.true;
    expect(Id64.isValidId64(physObjsInTarget[1].id)).not.to.be.true;

    expect(
      [...displayStyleInTarget.settings.excludedElementIds]
    ).to.deep.equal(
      physObjsInTarget
        .filter(({id}) => Id64.isValidId64(id))
        .map(({id}) => id)
    );

    sourceDb.close();
    targetDb.close();
  });

  it("exports aspects of deferred elements", async () => {
    const sourceDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "DeferredElementWithAspects-Source.bim");
    const sourceDb  = SnapshotDb.createEmpty(sourceDbPath, { rootSubject: { name: "deferred-element-with-aspects"} });

    const testSchema1Path = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestSchema1.ecschema.xml");
    // the only two ElementUniqueAspect's in bis are ignored by the transformer, so we add our own to test their export
    IModelJsFs.writeFileSync(testSchema1Path, `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema1" alias="ts1" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
          <ECEntityClass typeName="MyUniqueAspect" description="A test unique aspect" displayLabel="a test unique aspect" modifier="Sealed">
            <BaseClass>bis:ElementUniqueAspect</BaseClass>
            <ECProperty propertyName="MyProp1" typeName="string"/>
        </ECEntityClass>
      </ECSchema>`
    );

    await sourceDb.importSchemas([testSchema1Path]);

    const myPhysicalModelId = PhysicalModel.insert(sourceDb, IModelDb.rootSubjectId, "MyPhysicalModel");
    const mySpatialCategId = SpatialCategory.insert(sourceDb, IModelDb.dictionaryId, "MySpatialCateg", { color: ColorDef.black.toJSON() });
    const myPhysicalObjId = sourceDb.elements.insertElement({
      classFullName: PhysicalObject.classFullName,
      model: myPhysicalModelId,
      category: mySpatialCategId,
      code: Code.createEmpty(),
      userLabel: `MyPhysicalObject`,
      geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
      placement: Placement3d.fromJSON({ origin: { x: 1 }, angles: {} }),
    } as PhysicalElementProps);
    // because they are definition elements, display styles will be transformed first, but deferred until the excludedElements
    // (which are predecessors) are inserted
    const myDisplayStyleId = DisplayStyle3d.insert(sourceDb, IModelDb.dictionaryId, "MyDisplayStyle3d", {
      excludedElements: [myPhysicalObjId],
    });
    const sourceRepositoryId = IModelTestUtils.insertRepositoryLink(sourceDb, "external.repo", "https://external.example.com/folder/external.repo", "TEST");
    const sourceExternalSourceId = IModelTestUtils.insertExternalSource(sourceDb, sourceRepositoryId, "HypotheticalDisplayConfigurer");
    // simulate provenance from a connector as an example of a copied over element multi aspect
    const multiAspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: myDisplayStyleId, relClassName: ElementOwnsExternalSourceAspects.classFullName },
      scope: { id: sourceExternalSourceId },
      source: { id: sourceExternalSourceId },
      identifier: "ID",
      kind: ExternalSourceAspect.Kind.Element,
    };
    sourceDb.elements.insertAspect(multiAspectProps);
    const uniqueAspectProps = {
      classFullName: "TestSchema1:MyUniqueAspect",
      element: { id: myDisplayStyleId, relClassName: ElementOwnsUniqueAspect.classFullName },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      myProp1: "prop_value",
    };
    sourceDb.elements.insertAspect(uniqueAspectProps);
    sourceDb.saveChanges();

    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "PreserveIdOnTestModel-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbPath, { rootSubject: sourceDb.rootSubject });

    class PublicSkipElementTransformer extends IModelTransformer {
      public override skipElement(...args: Parameters<IModelTransformer["skipElement"]>) {
        super.skipElement(...args);
      }
    }

    const transformer = new PublicSkipElementTransformer(sourceDb, targetDb, {
      includeSourceProvenance: true,
      noProvenance: true, // don't add transformer provenance aspects, makes querying for aspects later simpler
    });
    const skipElementSpy = sinon.spy(transformer, "skipElement");

    await transformer.processSchemas();
    await transformer.processAll();
    assert(skipElementSpy.called); // make sure an element was deferred during the transformation

    targetDb.saveChanges();

    const targetExternalSourceAspects = new Array<any>();
    const targetMyUniqueAspects = new Array<any>();
    targetDb.withStatement("SELECT * FROM bis.ExternalSourceAspect", (stmt) => targetExternalSourceAspects.push(...stmt));
    targetDb.withStatement("SELECT * FROM TestSchema1.MyUniqueAspect", (stmt) => targetMyUniqueAspects.push(...stmt));

    expect(targetMyUniqueAspects).to.have.lengthOf(1);
    expect(targetMyUniqueAspects[0].myProp1).to.equal(uniqueAspectProps.myProp1);
    expect(targetExternalSourceAspects).to.have.lengthOf(1);
    expect(targetExternalSourceAspects[0].identifier).to.equal(multiAspectProps.identifier);

    sinon.restore();
    sourceDb.close();
    targetDb.close();
  });

  it("IModelTransformer processes nav property predecessors even in generated classes", async () => {
    const sourceDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "GeneratedNavPropPredecessors-Source.bim");
    const sourceDb = SnapshotDb.createEmpty(sourceDbPath, { rootSubject: { name: "GeneratedNavPropPredecessors" } });

    const testSchema1Path = IModelTestUtils.prepareOutputFile("IModelTransformer", "TestSchema1.ecschema.xml");
    IModelJsFs.writeFileSync(testSchema1Path, `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestGeneratedClasses" alias="tgc" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="TestEntity" description="a sample entity for the end of the test relationships">
          <BaseClass>bis:DefinitionElement</BaseClass>
          <ECProperty propertyName="prop" typeName="string" description="a sample property"/>
        </ECEntityClass>
        <ECRelationshipClass typeName="ElemRel" strength="referencing" description="elem rel 1" modifier="sealed">
          <Source multiplicity="(0..*)" roleLabel="refers to" polymorphic="false">
            <Class class="TestElementWithNavProp"/>
          </Source>
          <Target multiplicity="(0..1)" roleLabel="is referenced by" polymorphic="false">
            <Class class="TestEntity"/>
          </Target>
        </ECRelationshipClass>
        <ECEntityClass typeName="TestElementWithNavProp" description="A test domain class that has a base and mixin applied to it.">
          <BaseClass>bis:DefinitionElement</BaseClass>
          <ECNavigationProperty propertyName="navProp" relationshipName="ElemRel" direction="Forward" displayLabel="Horizontal Alignment" />
        </ECEntityClass>
      </ECSchema>`
    );

    await sourceDb.importSchemas([testSchema1Path]);

    const navPropTargetId = sourceDb.elements.insertElement({
      classFullName: "TestGeneratedClasses:TestEntity",
      prop: "sample-value",
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as ElementProps);

    const elemWithNavPropId = sourceDb.elements.insertElement({
      classFullName: "TestGeneratedClasses:TestElementWithNavProp",
      navProp: {
        id: navPropTargetId,
        relClassName: "TestGeneratedClasses:ElemRel",
      },
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as ElementProps);

    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "GeneratedNavPropPredecessors-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbPath, { rootSubject: sourceDb.rootSubject });

    class ProcessTargetLastTransformer extends IModelTransformer {
      private _exportedNavPropHolder = false;
      public override onExportElement(sourceElem: Element) {
        if (sourceElem.id === elemWithNavPropId) {
          super.onExportElement(sourceElem);
          this._exportedNavPropHolder = true;
        } else if (sourceElem.id === navPropTargetId && !this._exportedNavPropHolder) {
          this.skipElement(sourceElem);
        } else {
          super.onExportElement(sourceElem);
        }
      }
    }

    const transformer = new ProcessTargetLastTransformer(sourceDb, targetDb);
    await transformer.processSchemas();
    await transformer.processAll();

    targetDb.saveChanges();

    function getNavPropContent(db: IModelDb) {
      let results = new Array<{ id: Id64String, navProp: RelatedElement }>();
      db.withPreparedStatement(
        "SELECT ECInstanceId, navProp FROM TestGeneratedClasses.TestElementWithNavProp",
        (stmt) => { results = [...stmt]; }
      );
      return results;
    }

    for (const navPropHolderInSource of getNavPropContent(sourceDb)) {
      const navPropHolderInTargetId = transformer.context.findTargetElementId(navPropHolderInSource.id);
      const navPropHolderInTarget = targetDb.elements.getElement(navPropHolderInTargetId);
      const navPropTargetInTarget = transformer.context.findTargetElementId(navPropHolderInSource.navProp.id);
      // cast to any to access untyped instance properties
      expect((navPropHolderInTarget as any)?.navProp?.id).to.equal(navPropTargetInTarget);
      expect((navPropHolderInTarget as any)?.navProp?.id).not.to.equal(Id64.invalid);
      expect((navPropHolderInTarget as any)?.navProp?.id).not.to.be.undefined;
    }

    expect(getNavPropContent(sourceDb)).to.have.length(1);
    expect(getNavPropContent(targetDb)).to.have.length(1);

    sourceDb.close();
    targetDb.close();
  });

  it.only("local test", async () => {
    // TODO: figure out why geometry serialized is not identical
    // looks like there are some precision issues in some of the geometry. Not sure why the precision is not deterministic
    // it's the same geometry stream, no?
    const geometryConversionTolerance = 1e-10; // FIXME: why is it nondeterministic from the same geometry blob?
    const sourceDb = SnapshotDb.openFile("/tmp/bad-relationships-source.bim");

    const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformer", "GeneratedNavPropPredecessors-Target.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbPath, { rootSubject: sourceDb.rootSubject });

    const transformer = new IModelTransformer(sourceDb, targetDb, { loadSourceGeometry: true });
    await transformer.processSchemas();
    await transformer.processAll();

    targetDb.saveChanges();

    const sourceToTargetMap = new Map<Element, Element | undefined>();
    const targetToSourceMap = new Map<Element, Element | undefined>();
    const targetElemIds = new Set<Id64String>();

    for await (const [sourceElemId] of sourceDb.query("SELECT ECInstanceId FROM bis.Element")) {
      const targetElemId =
        transformer.context.findTargetElementId(sourceElemId);
      const sourceElem = sourceDb.elements.getElement(sourceElemId);
      const targetElem = targetDb.elements.tryGetElement(targetElemId);
      // expect(targetElem.toExist)
      sourceToTargetMap.set(sourceElem, targetElem);
      if (targetElem) {
        targetElemIds.add(targetElemId);
        targetToSourceMap.set(targetElem, sourceElem);
        for (const [propName, prop] of Object.entries(
          sourceElem.getClassMetaData()!.properties
        ) ?? []) {
          if (prop.isNavigation) {
            let relationTargetInSourceId!: Id64String;
            let relationTargetInTargetId!: Id64String;
            expect(sourceElem.classFullName).to.equal(targetElem.classFullName);
            // some custom handled classes make it difficult to inspect the element props directly with the metadata prop name, so we do this instead
            const sql = `SELECT ${propName}.Id from ${sourceElem.classFullName} WHERE ECInstanceId=:id`;
            sourceDb.withPreparedStatement(sql, (stmt) => {
              stmt.bindId("id", sourceElemId);
              stmt.step();
              relationTargetInSourceId = stmt.getValue(0).getId() ?? Id64.invalid;
            });
            targetDb.withPreparedStatement(sql, (stmt) => {
              stmt.bindId("id", targetElemId);
              expect(stmt.step()).to.equal(DbResult.BE_SQLITE_ROW);
              relationTargetInTargetId = stmt.getValue(0).getId() ?? Id64.invalid;
            });
            const mappedRelationTargetInTargetId = transformer.context.findTargetElementId(relationTargetInSourceId);
            expect(relationTargetInTargetId).to.equal(mappedRelationTargetInTargetId);
          } else {
            expect(targetElem.asAny[propName]).to.deep.equalWithFpTolerance(
              sourceElem.asAny[propName],
              geometryConversionTolerance,
            );
          }
        }
        const expectedSourceElemJsonProps = { ...sourceElem.jsonProperties };

        // START jsonProperties TRANSFORMATION EXCEPTIONS
        // the transformer does not propagate source channels which are stored in Subject.jsonProperties.Subject.Job
        if (sourceElem instanceof Subject) {
          if (sourceElem.jsonProperties?.Subject?.Job) {
            if (!expectedSourceElemJsonProps.Subject)
              expectedSourceElemJsonProps.Subject = {};
            expectedSourceElemJsonProps.Subject.Job = undefined;
          }
        }
        if (sourceElem instanceof DisplayStyle3d) {
          if (sourceElem.jsonProperties?.styles?.environment?.sky?.image?.texture === Id64.invalid) {
            delete expectedSourceElemJsonProps.styles.environment.sky.image.texture;
          }
          if (!sourceElem.jsonProperties?.styles?.environment?.sky?.twoColor) {
            expectedSourceElemJsonProps.styles.environment.sky.twoColor = false;
          }
        }
        // END jsonProperties TRANSFORMATION EXCEPTIONS
        expect(targetElem.jsonProperties).to.deep.equalWithFpTolerance(expectedSourceElemJsonProps, geometryConversionTolerance);
      }
    }

    for await (const [targetElemId] of targetDb.query("SELECT ECInstanceId FROM bis.Element")) {
      if (!targetElemIds.has(targetElemId)) {
        const targetElem = targetDb.elements.getElement(targetElemId);
        targetToSourceMap.set(targetElem, undefined);
      }
    }

    const onlyInSourceElements = [...sourceToTargetMap].filter(([_inSource, inTarget]) => inTarget === undefined).map(([inSource]) => inSource);
    const onlyInTargetElements = [...targetToSourceMap].filter(([_inTarget, inSource]) => inSource === undefined).map(([inTarget]) => inTarget);
    const onlyInSourceElemImportantProps = onlyInSourceElements.map(({iModel: _removed1, id: _removed2, ...elemProps}) => elemProps);

    // source will have the connector external source which was not exported without the transformer option `includeSourceProvenance: true`
    expect(onlyInSourceElemImportantProps).to.deep.equal([
      {
        code: new Code({ spec: IModelDb.repositoryModelId, scope: IModelDb.repositoryModelId }),
        description: "syncFile-test",
        federationGuid: "bdf85257-884e-4006-8ac4-c04b9e0d35dd",
        jsonProperties: { synchronizationConfigLink: { } },
        lastSuccessfulRun: undefined,
        model: IModelDb.repositoryModelId,
        parent: undefined,
        url: "iTwin Synchronizer",
        userLabel: "syncFile-test",
      } as Partial<SynchronizationConfigLinkProps>,
      {
        code: Code.createEmpty(),
        model: IModelDb.repositoryModelId,
        connectorName: "Civil",
        connectorVersion: "10.8.0.15",
        federationGuid: "cd1649f1-e494-4a76-9aa5-6339d9f0266f",
        jsonProperties: {},
        parent: undefined,
        repository: {
          id: "0x20000000004",
          relClassName: "BisCore:ExternalSourceIsInRepository",
        },
        userLabel: "Default",
      } as Partial<ExternalSourceProps>,
    ]);
    expect(onlyInTargetElements).to.have.length(0);

    sourceDb.close();
    targetDb.close();
  });
});
