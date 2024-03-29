// Copyright 2023 Peter Griess
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Types and functions for working with states
"use strict";

import { Duration } from "luxon"
import { WeatherCode } from "./tomorrow.js";

// States that we can put the system in
//
// NOTE: Enum pattern from here https://stackoverflow.com/a/44447975
const State = Object.freeze({
    CHARGE_BATTERY_FROM_GRID: Symbol("CHARGE_BATTERY_FROM_GRID"),
    SELF_POWER: Symbol("SELF_POWER"),
})

// Compute the next state
function nextState(now, forecast) {
    const BAD_WEATHER_CODES = [
        WeatherCode.THUNDERSTORM,
        WeatherCode.HEAVY_SNOW,
        WeatherCode.FREEZING_DRIZZLE,
        WeatherCode.FREEZING_RAIN,
        WeatherCode.LIGHT_FREEZING_RAIN,
        WeatherCode.HEAVY_FREEZING_RAIN,
        WeatherCode.ICE_PELLETS,
        WeatherCode.LIGHT_ICE_PELLETS,
        WeatherCode.HEAVY_ICE_PELLETS
    ]

    // Charge from the grid if it's our scheduled time to do so
    const slop = Duration.fromObject({ minutes: 10 })
    const beginSelfDT = now
        .setZone("America/Chicago")
        .set({ "hour": 6, "minute": 0, "second": 0, "millisecond": 0 })
        .minus(slop)
    const endSelfDT = now
        .setZone("America/Chicago")
        .set({ "hour": 20, "minute": 0, "second": 0, "millisecond": 0 })
        .minus(slop)

    if (now < beginSelfDT || endSelfDT < now) {
        return State.CHARGE_BATTERY_FROM_GRID
    }

    // Charge from the grid if there is bad weather coming
    if (forecast) {
        for (let f of forecast) {
            if (BAD_WEATHER_CODES.find((e) => e == f.values.weatherCode)) {
                return State.CHARGE_BATTERY_FROM_GRID
            }

            // Units are meters/sec
            if (f.values.windGust > 20) {
                return State.CHARGE_BATTERY_FROM_GRID
            }
        }
    }

    // No special circumstances, steady as she goes
    return State.SELF_POWER
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
