"use strict";

import { Duration } from "luxon"

// States that we can put the system in
//
// NOTE: Enum pattern from here https://stackoverflow.com/a/44447975
const State = Object.freeze({
    CHARGE_BATTERY_FROM_GRID: Symbol("CHARGE_BATTERY_FROM_GRID"),
    SELF_POWER: Symbol("SELF_POWER"),
})

// Compute the next state
function nextState(now) {
    const slop = Duration.fromObject({ minutes: 10 })
    const beginSelfDT = now
        .set({ "hour": 6, "minute": 0, "second": 0, "millisecond": 0 })
        .minus(slop)
    const endSelfDT = now
        .set({ "hour": 20, "minute": 0, "second": 0, "millisecond": 0 })
        .minus(slop)

    if (beginSelfDT < now && now < endSelfDT) {
        return State.SELF_POWER
    }

    return State.CHARGE_BATTERY_FROM_GRID
}

// Compute the current state from battery info
function stateFromBatteryInfo(bi) {
    if (bi.battery_config.usage === "backup_only") {
        return State.CHARGE_BATTERY_FROM_GRID
    }

    if (bi.battery_config.usage === "self-consumption") {
        return State.SELF_POWER
    }

    throw new Error("Could not determine state from battery info")
}

export { nextState, State, stateFromBatteryInfo }
