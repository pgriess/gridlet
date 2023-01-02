// Copyright 2022 Peter Griess
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

// AWS Lambda driver for the Gridlet system
//
// NOTE: We do not need a global timeout handler as the AWS Lambda runtime
//       provides this for us.
"use strict";

import { env } from "node:process"
import { open as fsOpen } from "node:fs/promises"
import { inspect } from "node:util"
import log from "loglevel" // CommonJS, not ES6 module
import { DateTime } from "luxon"
import { createSession, getBatteryInfo, setBatteryInfo } from "./enphase.js"
import { nextState, State, stateFromBatteryInfo } from "./state.js"

const GRIDLET_LOG_LEVEL = JSON.parse(env.GRIDLET_LOG_LEVEL ?? new String(log.levels.ERROR))
const GRIDLET_DRY_RUN = JSON.parse(env.GRIDLET_DRY_RUN ?? "false")

const readFileContents = async (path) => {
    const fh = await fsOpen(path)
    const contents = (await fh.readFile({ encoding: "utf-8" })).trim()
    fh.close()
    return contents
}

export const handler = async (event, context) => {
    log.setDefaultLevel(
        Math.min(
            log.levels.ERROR,
            Math.max(log.levels.TRACE, GRIDLET_LOG_LEVEL),
            GRIDLET_LOG_LEVEL)
    )

    const session = await createSession(
        await readFileContents(".enphase_username.txt"),
        await readFileContents(".enphase_password.txt")
    )
    if (!session) {
        throw new Error("Failed to log in to Enphase")
    }

    const bi = await getBatteryInfo(session)
    log.debug(`battery_info=${inspect(bi)}`)

    const cs = stateFromBatteryInfo(bi)
    const ns = nextState(DateTime.now())

    log.info(`Transitioning state from ${cs.toString()} to ${ns.toString()}`)

    if (ns === cs) {
        log.info("Current state un-changed; doing nothing")
        return "Ok";
    }

    if (!GRIDLET_DRY_RUN) {
        // TODO: Fix formatting
        const nbi =
            (ns === State.CHARGE_BATTERY_FROM_GRID) ? { usage: "backup_only", battery_backup_percentage: 100 } :
                (ns === State.SELF_POWER) ? { usage: "self-consumption", battery_backup_percentage: 30 } :
                    undefined

        if (nbi === undefined) {
            throw new Error(`Unexpected state: ${ns}`)
        }

        log.info(`Setting battery info to ${inspect(nbi)}`)
        await setBatteryInfo(session, nbi)
    }

    return "Ok"
}
