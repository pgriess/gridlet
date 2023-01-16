#!/usr/bin/env node

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

// CLI driver for the Gridlet system
"use strict";

import { exit } from "node:process"
import { inspect } from "node:util"
import { ArgumentParser } from "argparse"
import log from "loglevel" // CommonJS, not ES6 module
import { DateTime } from "luxon"
import { createSession, getBatteryInfo, setBatteryInfo } from "./enphase.js"
import { nextState, State, stateFromBatteryInfo } from "./state.js"

const ap = ArgumentParser({
    "description": "The command line interface to Gridlet."
});
ap.add_argument(
    "-n",
    {
        dest: "dry_run",
        default: false,
        action: "store_true",
        help: "dry-run only; do not take any action",
    }
)
ap.add_argument(
    "-q",
    {
        dest: "quiet",
        action: "store_true",
        default: false,
        help: "silence all logging regardless of verbosity"
    }
)
ap.add_argument(
    "-v",
    {
        dest: "verbosity",
        action: "count",
        default: 0,
        help: "increase logging verbosity; can be used multiple times"
    }
)

// Enphase options
ap.add_argument(
    "--enphase_password",
    {
        dest: "enphase_password",
        metavar: "<password>",
        type: "str",
        help: "Enphase password"
    },
)
ap.add_argument(
    "--enphase_user",
    {
        dest: "enphase_user",
        metavar: "<user>",
        type: "str",
        help: "Enphase user name"
    },
)

const args = ap.parse_args();

// Configure logging
log.setDefaultLevel(
    (args.quiet) ?
        log.levels.SILENT :
        Math.max(log.levels.TRACE, log.levels.ERROR - args.verbosity)
)

const session = await createSession(args.enphase_user, args.enphase_password)
if (!session) {
    log.error("Failed to log in!")
    exit(1)
}

const bi = await getBatteryInfo(session)
log.debug(`battery_info=${inspect(bi)}`)

const cs = stateFromBatteryInfo(bi)
const ns = nextState(DateTime.now())

log.info(`Transitioning state from ${cs.toString()} to ${ns.toString()}`)

if (ns === cs) {
    log.info("Current state un-changed; doing nothing")
    exit(0)
}

if (!args.dry_run) {
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
    await setBatteryInfo(session, nbi)
}
