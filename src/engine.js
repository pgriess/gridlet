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

// Driver-agnostic main for the Gridlet system
"use strict";

import { env } from "node:process"
import { inspect } from "node:util"
import log from "loglevel" // CommonJS, not ES6 module
import { DateTime } from "luxon"
import { createSession, getBatteryInfo, setBatteryInfo } from "./enphase.js"
import { nextState, State, stateFromBatteryInfo } from "./state.js"
import { getForecast } from "./tomorrow.js";

// Default configuration values
function configDefault() {
    return {
        dry_run: false,
        log_level: 0,
        log_quiet: false,
        enphase_url_base: "https://enlighten.enphaseenergy.com",
    }
}

// Load config from the environment
function configFromEnvironment() {
    const gridletEnv = {}

    // Core
    if (Object.hasOwn(env, "GRIDLET_DRY_RUN")) {
        gridletEnv.dry_run = JSON.parse(env.GRIDLET_DRY_RUN)
    }

    if (Object.hasOwn(env, "GRIDLET_LOG_LEVEL")) {
        gridletEnv.log_level = JSON.parse(env.GRIDLET_LOG_LEVEL)
    }

    if (Object.hasOwn(env, "GRIDLET_LOG_QUIET")) {
        gridletEnv.log_quiet = JSON.parse(env.GRIDLET_QUIET)
    }

    // Enphase
    if (Object.hasOwn(env, "GRIDLET_ENPHASE_PASSWORD")) {
        gridletEnv.enphase_password = env.GRIDLET_ENPHASE_PASSWORD
    }

    if (Object.hasOwn(env, "GRIDLET_ENPHASE_URL_BASE")) {
        gridletEnv.enphase_url_base = env.GRIDLET_ENPHASE_URL_BASE
    }

    if (Object.hasOwn(env, "GRIDLET_ENPHASE_USER")) {
        gridletEnv.enphase_user = env.GRIDLET_ENPHASE_USER
    }

    // Tomorrow.io
    if (Object.hasOwn(env, "GRIDLET_TOMORROW_API_KEY")) {
        gridletEnv.tomorrow_api_key = env.GRIDLET_TOMORROW_API_KEY
    }

    if (Object.hasOwn(env, "GRIDLET_TOMORROW_LOCATION")) {
        gridletEnv.tomorrow_location = env.GRIDLET_TOMORROW_LOCATION
    }

    return gridletEnv
}

// Merge configurations
//
// This works similarly to Object.assign(), but has some special logic to avoid
// overwriting downstream values if the upstream values are `undefined`.
function configMerge(...configs) {
    const config = {}
    for (const c of configs) {
        for (const [k, v] of Object.entries(c)) {
            if (v === undefined) {
                continue
            }

            config[k] = v
        }
    }

    return config
}

// Run the Gridlet engine
//
// The configuration object should probably be set up by a driver, possibly with
// the help of the configFromEnvironment() and configMerge() helpers.
async function main(config) {
    log.setDefaultLevel(
        (config.log_quiet) ?
            log.levels.SILENT :
            Math.max(log.levels.TRACE, log.levels.ERROR - config.log_level)
    )

    const session = await createSession(config)
    if (!session) {
        throw new Error("Failed to log in!")
    }

    const bi = await getBatteryInfo(config, session)
    log.debug(`battery_info=${inspect(bi)}`)
    const cs = stateFromBatteryInfo(bi)

    let forecast = null
    if (config.tomorrow_api_key && config.tomorrow_location) {
        forecast = await getForecast(
            config.tomorrow_api_key,
            config.tomorrow_location.split(",").map(v => parseFloat(v)),
            ["temperature", "weatherCode", "windGust"],
            { timesteps: "1h", startTime: "now", endTime: "nowPlus4h", "units": "metric" },
        )
        log.debug(`forecast=${inspect(forecast, { depth: 3 })}`)
    }

    const ns = nextState(DateTime.now(), forecast)
    log.info(`Transitioning state from ${cs.toString()} to ${ns.toString()}`)

    if (ns === cs) {
        log.info("Current state un-changed; doing nothing")
        return
    }

    if (!config.dry_run) {
        // TODO: Fix formatting
        const nbi =
            (ns === State.CHARGE_BATTERY_FROM_GRID) ? { usage: "backup_only", battery_backup_percentage: 100 } :
                (ns === State.SELF_POWER) ? { usage: "self-consumption", battery_backup_percentage: 30 } :
                    undefined

        // TODO: Clear timeout
        if (nbi === undefined) {
            throw new Error(`Unexpected state: ${ns}`)
        }

        log.info(`Setting battery info to ${inspect(nbi)}`)
        await setBatteryInfo(config, session, nbi)
    }
}

export { configDefault, configFromEnvironment, configMerge, main }
