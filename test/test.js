"use strict";

import { strict as assert } from "node:assert"
import { DateTime } from "luxon"
import { nextState, State } from "../src/state.js"

describe("state", () => {
    describe("#nextState", () => {
        it("should self-power", () => {
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T12:00:00")),
                State.SELF_POWER)
        })
        it("should charge from grid", () => {
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T02:00:00")),
                State.CHARGE_BATTERY_FROM_GRID)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T22:00:00")),
                State.CHARGE_BATTERY_FROM_GRID)
        })
        it("should handle slop", () => {
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T06:01:00")),
                State.SELF_POWER)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T05:55:00")),
                State.SELF_POWER)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T05:45:00")),
                State.CHARGE_BATTERY_FROM_GRID)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T19:45:00")),
                State.SELF_POWER)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T19:55:00")),
                State.SELF_POWER)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T20:05:00")),
                State.SELF_POWER)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T20:15:00")),
                State.CHARGE_BATTERY_FROM_GRID)
        })
    })
})
