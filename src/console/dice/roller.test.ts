// src/console/dice/roller.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rollD, determineOutcome, triggerSecondaryDie } from "./roller.ts";

describe("rollD", () => {
    test("rollD(20) returns integer between 1 and 20", () => {
        for (let i = 0; i < 100; i++) {
            const r = rollD(20);
            assert.ok(r >= 1 && r <= 20, `Got ${r}`);
        }
    });
    test("rollD(12) returns integer between 1 and 12", () => {
        for (let i = 0; i < 100; i++) {
            const r = rollD(12);
            assert.ok(r >= 1 && r <= 12, `Got ${r}`);
        }
    });
});

describe("determineOutcome", () => {
    test("natural 1 is always critical-failure", () => {
        assert.equal(determineOutcome(25, 6, 1), "critical-failure");
    });
    test("natural 20 is always critical-success", () => {
        assert.equal(determineOutcome(3, 20, 20), "critical-success");
    });
    test("miss by 6+ is critical-failure", () => {
        assert.equal(determineOutcome(4, 10, 5), "critical-failure");  // margin -6
    });
    test("miss by 3-5 is failure", () => {
        assert.equal(determineOutcome(7, 10, 8), "failure");           // margin -3
    });
    test("miss by 1-2 is partial-failure", () => {
        assert.equal(determineOutcome(9, 10, 10), "partial-failure");  // margin -1
    });
    test("exact DC is bare-success", () => {
        assert.equal(determineOutcome(10, 10, 10), "bare-success");    // margin 0
    });
    test("exceed by 1-3 is clean-success", () => {
        assert.equal(determineOutcome(13, 10, 10), "clean-success");   // margin 3
    });
    test("exceed by 4-6 is strong-success", () => {
        assert.equal(determineOutcome(16, 10, 10), "strong-success");  // margin 6
    });
    test("exceed by 7+ is still strong-success", () => {
        assert.equal(determineOutcome(20, 10, 10), "strong-success");  // margin 10
    });
});

describe("triggerSecondaryDie", () => {
    test("critical-failure triggers D4", () => {
        assert.equal(triggerSecondaryDie("critical-failure").die, 4);
    });
    test("failure triggers D6", () => {
        assert.equal(triggerSecondaryDie("failure").die, 6);
    });
    test("strong-success triggers D8", () => {
        assert.equal(triggerSecondaryDie("strong-success").die, 8);
    });
    test("critical-success triggers D8", () => {
        assert.equal(triggerSecondaryDie("critical-success").die, 8);
    });
    test("bare-success triggers nothing", () => {
        assert.equal(triggerSecondaryDie("bare-success"), null);
    });
    test("clean-success triggers nothing", () => {
        assert.equal(triggerSecondaryDie("clean-success"), null);
    });
    test("partial-failure triggers nothing", () => {
        assert.equal(triggerSecondaryDie("partial-failure"), null);
    });
});
