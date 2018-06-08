/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import Format from "../../source/Metadata/Format";
import { ECObjectsError } from "../../source/Exception";
import * as sinon from "sinon";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

describe("Format tests", () => {
  let testFormat: Format;
  describe("accept", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testFormat = new Format(schema, "TestFormat");
    });

    it("should call visitFormat on a SchemaItemVisitor object", async () => {
      expect(testFormat).to.exist;
      const mockVisitor = { visitFormat: sinon.spy() };
      await testFormat.accept(mockVisitor);
      expect(mockVisitor.visitFormat.calledOnce).to.be.true;
      expect(mockVisitor.visitFormat.calledWithExactly(testFormat)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitFormat defined", async () => {
      expect(testFormat).to.exist;
      await testFormat.accept({});
    });
  });
  describe("Tests without Composite", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testFormat = new Format(schema, "AmerMYFI4");
    });
    describe("fromJson", () => {
      it("Basic test", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.name, "AmerMYFI4");
        assert(testFormat.label, "myfi4");
        assert(testFormat.description === "");
        assert(testFormat.roundFactor === 0.0);
        assert(testFormat.formattype, "fractional");
        assert(testFormat.showSignOption, "onlyNegative");
        assert(testFormat.formatTraits!.get("keepSingleZero") === true);
        assert(testFormat.formatTraits!.get("trailZeroes") === true);
        assert(testFormat.precision === 4);
        assert(testFormat.decimalSeparator, ".");
        assert(testFormat.thousandSeparator, ",");
        assert(testFormat.uomSeparator, " ");
        assert(testFormat.stationSeparator, "+");
      });
      it("Name is required", async () => {
        const json = {
          schemaItemType: "Format",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 does not have the required 'name' attribute.`);
      });
      it("Name must be a valid ECName", async () => {
        const json = {
          schemaItemType: "Format",
          name: "10AmerMYFI4",
          label: "myfi4",
          description: "",
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, ``);
      });
      it("Description must be a string", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: 12345678,
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem AmerMYFI4 has an invalid 'description' attribute. It should be of type 'string'.`);
      });
      it("Round factor is not default value", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          roundFactor: 20,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.roundFactor ===  20);
      });
      it("Type is required", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 does not have the required 'type' attribute.`);
      });
      it("Type value is invalid", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "fraction",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'type' attribute.`);
      });
      it("Type is fractional; Precision value is invalid", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "fractional",
          description: "",
          showSignOption: "onlyNegative",
          precision: 3,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
      });
      it("Type is fractional; Precision value is valid", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "fractional",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 16,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.precision === 16);
      });
      it("Type is decimal, scientific, or station; Precision value is invalid", async () => {
        const jsonDecimal = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "decimal",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 13,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonScientific = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "scientific",
          scientificType: "normalized",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 30,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonStation = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: -1,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(jsonDecimal)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
        await expect(testFormat.fromJson(jsonScientific)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
        await expect(testFormat.fromJson(jsonStation)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
      });
      it("Type is decimal, scientific, or station; Precision value is valid", async () => {
        const jsonDecimal = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "decimal",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 3,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonScientific = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "scientific",
          scientificType: "normalized",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 0,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonStation = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 12,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(jsonDecimal);
        assert(testFormat.precision === 3);
        await testFormat.fromJson(jsonScientific);
        assert(testFormat.precision === 0);
        await testFormat.fromJson(jsonStation);
        assert(testFormat.precision === 12);
      });
      it("MinWidth is not an int", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          minWidth: 3.3,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'minWidth' attribute.`);
      });
      it("MinWidth is not positive", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          minWidth: -3,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'minWidth' attribute.`);
      });
      it("Type is scientific; ScientificType is required", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "scientific",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 does not have the required 'scientificType' attribute.`);
      });
      it("ScientificType value is not valid", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "scientific",
          showSignOption: "onlyNegative",
          scientificType: "normal",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'scientificType' attribute.`);
      });
      it("Type is not scientific; ScientificType is provided and should be ignored", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.scientificType === undefined);
      });
      it("showSignOption must be a string", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          showSignOption: 456,
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
      });
      it("showSignOption is not default value", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          showSignOption: "noSign",
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.showSignOption === "noSign");
      });
      it("showSignOption is invalid", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          showSignOption: "noSigned",
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'showSignOption' attribute.`);
      });
      it("UOMSeparator is not default", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: "-",
        };
        await testFormat.fromJson(json);
        assert(testFormat.uomSeparator, "-");
      });
      it("StationSeparator is not default", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          stationSeparator: "-",
        };
        await testFormat.fromJson(json);
        assert(testFormat.stationSeparator, "-");
      });
      it("StationOffsetSize is not an int", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          stationOffsetSize: 3.3,
          type: "station",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'stationOffsetSize' attribute. It should be a positive integer greater than 0.`);
      });
      it("StationOffsetSize is not positive", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          stationOffsetSize: -3,
          type: "station",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'stationOffsetSize' attribute. It should be a positive integer greater than 0.`);
      });
      it("Type is station; StationOffsetSize is required", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "station",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 does not have the required 'stationOffsetSize' attribute.`);
      });
      it("Type is not station; StationOffsetSize is ignored", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          stationOffsetSize: 3,
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.stationOffsetSize === undefined);
      });
      it("decimalSeparator, thousandSeparator, uomSeparator, stationSeparator cannot be more than one character", async () => {
        const jsonDecimalSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "decimal",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 3,
          decimalSeparator: "..",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonThousandSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "scientific",
          scientificType: "normalized",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 0,
          decimalSeparator: ".",
          thousandSeparator: ",.",
          uomSeparator: " ",
        };
        const jsonUOMSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 12,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: "  ",
        };
        const jsonStationSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 12,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
          stationSeparator: "++",
        };
        await expect(testFormat.fromJson(jsonDecimalSeparator)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'decimalSeparator' attribute.`);
        await expect(testFormat.fromJson(jsonThousandSeparator)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'thousandSeparator' attribute.`);
        await expect(testFormat.fromJson(jsonUOMSeparator)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'uomSeparator' attribute.`);
        await expect(testFormat.fromJson(jsonStationSeparator)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'stationSeparator' attribute.`);
      });
    });
    describe("fromJson FormatTraits Tests", () => {
      it("String with valid options", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZeroes|keepSingleZero|zeroEmpty|keepDecimalPoint|applyRounding|fractionDash|showUnitLabel|prependUnitLabel|use1000Separator|exponentOnlyNegative",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        testFormat.formatTraits!.forEach((value: boolean) => {
          assert(value === true);
        });
      });
      it("Valid options with multiple separators", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZeroes;keepSingleZero|zeroEmpty|keepDecimalPoint,applyRounding|fractionDash;showUnitLabel,prependUnitLabel;use1000Separator,exponentOnlyNegative",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        testFormat.formatTraits!.forEach((value: boolean) => {
          assert(value === true);
      });      });
      it("Valid options with invalid separator", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZeroes;keepSingleZero|zeroEmpty|keepDecimalPoint,applyRounding\fractionDash;showUnitLabel,prependUnitLabel;use1000Separator,exponentOnlyNegative",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'formatTraits' option.`);
      });
      it("String with invalid option", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZero|keepSingleZero|zeroEmpty",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'formatTraits' option.`);
      });
      it("Empty string should make formatTraits undefined", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.formatTraits ===  undefined);
      });
      it("String[] with valid options", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: [
            "trailZeroes",
            "keepSingleZero",
            "zeroEmpty",
            "keepDecimalPoint",
            "applyRounding",
            "fractionDash",
            "showUnitLabel",
            "prependUnitLabel",
            "use1000Separator",
            "exponentOnlyNegative",
          ],
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        testFormat.formatTraits!.forEach((value: boolean) => {
            assert(value === true);
        });
      });
      it("String[] with one valid option", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: [
            "trailZeroes",
          ],
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        testFormat.formatTraits!.forEach((value: boolean, key: string) => {
          if (key !== "trailZeroes")
            assert(value === false);
          else
            assert(value === true);
        });
      });
      it("String[] with invalid option", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: [
            "trailZero",
          ],
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'formatTraits' option.`);
      });
    });
  });
  describe("Tests with Composite", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testFormat = new Format(schema, "AmerMYFI4");
    });
    it("Basic test", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: "MILE",
              label: "mile(s)",
            },
            {
              name: "YRD",
              label: "yrd(s)",
            },
            {
              name: "FT",
              label: "'",
            },
            {
              name: "IN",
              label: "\"",
            },
          ],
        },
      };
      await testFormat.fromJson(json);
      assert(testFormat.composite!.unitNames!.length === 4);
      assert(testFormat.composite!.unitLabels!.length === 4);
      assert(testFormat.composite!.includeZero === false);
      assert(testFormat.composite!.spacer === "-");
    });
    it("Throw for Composite with missing units attribute", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'units' attribute.`);
    });
    it("Throw for Composite with empty units array", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'units' attribute.`);
    });
    it("includeZero must be boolean", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: "false",
          spacer: "-",
          units: [
            {
              name: "MILE",
              label: "mile(s)",
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
    });
    it("spacer must be a one character string", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "space",
          units: [
            {
              name: "MILE",
              label: "mile(s)",
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'spacer' attribute.`);
    });
    it("spacer must be a string", async () => {
      const json = {
        includeZero: false,
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: 1,
          units: [
            {
              name: "MILE",
              label: "mile(s)",
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'spacer' attribute.`);
    });
    it("Unit name is required", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              label: "mile(s)",
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    });
    it("Unit label is optional", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: "MILE",
            },
          ],
        },
      };
      await testFormat.fromJson(json);
      assert(testFormat.composite!.unitNames!.length === 1);
      assert(testFormat.composite!.includeZero === false);
      assert(testFormat.composite!.spacer === "-");
    });
    it("Unit name must be a string", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: 1234,
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    });
    it("Label must be a string", async () => {
      const json = {
        includeZero: false,
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: "MILE",
              label: 1,
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    });
    it("Unit names must be unique", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: "MILE",
              label: "mile(s)",
            },
            {
              name: "MILE",
              label: "yrd(s)",
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The unit MILE has a duplicate name.`);
    });
    it("Unit labels do not have to be unique", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: "MILE",
              label: "mile(s)",
            },
            {
              name: "YARD",
              label: "yrd(s)",
            },
          ],
        },
      };
      await testFormat.fromJson(json);
      assert(testFormat.composite!.unitNames!.length === 2);
      assert(testFormat.composite!.unitLabels!.length === 2);
      assert(testFormat.composite!.includeZero === false);
      assert(testFormat.composite!.spacer === "-");
    });
    it("Unit name is not a valid ECName", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: "8MILE",
              label: "mile(s)",
            },
            {
              name: "YARD",
              label: "yrd(s)",
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, ``);
    });
    it("Cannot have more than 4 units", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: "MILE",
              label: "mile(s)",
            },
            {
              name: "YRD",
              label: "yrd(s)",
            },
            {
              name: "FT",
              label: "'",
            },
            {
              name: "IN",
              label: "\"",
            },
            {
              name: "METER",
              label: "meter(s)",
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'units' attribute.`);
    });
  });
  describe.only("formatString tests", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testFormat = new Format(schema, "AmerMYFI4");
    });
    it("Basic test", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: "MILE",
              label: "mile(s)",
            },
            {
              name: "YRD",
              label: "yrd(s)",
            },
            {
              name: "FT",
              label: "'",
            },
            {
              name: "IN",
              label: "\"",
            },
          ],
        },
      };
      await testFormat.fromJson(json);
      assert.deepEqual(testFormat.parseFormatString("DefaultReal", "DefaultReal(4)[u:MILE|mile(s)][u:YRD|yard(s)][u:FT|\'][u:IN|\"]"), {FormatName: "DefaultReal", Precision: 4, UnitList: ["MILE", "YRD", "FT", "IN"], UnitLabels: ["mile(s)", "yard(s)", "'", "\""]});
      assert.deepEqual(testFormat.parseFormatString("DefaultReal", "DefaultReal(4)[u:M|meters]"), {FormatName: "DefaultReal", Precision: 4, UnitList: ["M"], UnitLabels: ["meters"]});
    });
    it("Units are optional", async () => {
      assert.deepEqual(testFormat.parseFormatString("DefaultReal", "DefaultReal(4)"), {FormatName: "DefaultReal", Precision: 4, UnitList: null, UnitLabels: null});
    });
    it("Precision is optional", async () => {
      assert.deepEqual(testFormat.parseFormatString("DefaultReal", "DefaultReal[u:M|meters]"), {FormatName: "DefaultReal", Precision: null, UnitList: ["M"], UnitLabels: ["meters"]});
    });
    it("Precision is not an integer", async () => {
      assert(testFormat.parseFormatString("DefaultReal", "DefaultReal(4.5)[u:M|meters]") === BentleyStatus.ERROR);
    });
    it("No units or precision", async () => {
      assert.deepEqual(testFormat.parseFormatString("DefaultReal", "DefaultReal"), {FormatName: "DefaultReal", Precision: null, UnitList: null, UnitLabels: null});
    });
    it("FormatName does not match", async () => {
      assert(testFormat.parseFormatString("DefaultReal", "Default(4)[u:M|meters]") === BentleyStatus.ERROR);
    });
    it("formatString incorrectly formatted", async () => {
      assert(testFormat.parseFormatString("DefaultReal", "Default[(4)[u:M|meters]") === BentleyStatus.ERROR);
    });
  });
});
