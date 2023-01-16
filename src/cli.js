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

import { env, exit } from "node:process"
import { inspect } from "node:util"
import { ArgumentParser } from "argparse"
import log from "loglevel" // CommonJS, not ES6 module
import { DateTime } from "luxon"
import { createSession, getBatteryInfo, setBatteryInfo } from "./enphase.js"
import { nextState, State, stateFromBatteryInfo } from "./state.js"
import { getForecast } from "./tomorrow.js";

const ap = ArgumentParser({
    description: "The command line interface to Gridlet.",
    epilog: `
To facilitate ease of debugging (e.g. using an IDE), all options are
configurable using environment variables. See the source code for definitions of
what these are and the format that their values should be in.`,
});
ap.add_argument(
    "-n",
    {
        dest: "dry_run",
        default: JSON.parse(env.GRIDLET_DRY_RUN ?? "false"),
        action: "store_true",
        help: "dry-run only; do not take any action",
    }
)
ap.add_argument(
    "-q",
    {
        dest: "quiet",
        action: "store_true",
        default: JSON.parse(env.GRIDLET_QUIET ?? "false"),
        help: "silence all logging regardless of verbosity"
    }
)
ap.add_argument(
    "-v",
    {
        dest: "verbosity",
        action: "count",
        default: JSON.parse(env.GRIDLET_LOG_LEVEL ?? "0"),
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
        default: env.GRIDLET_ENPHASE_PASSWORD,
        help: "Enphase password"
    },
)
ap.add_argument(
    "--enphase_user",
    {
        dest: "enphase_user",
        metavar: "<user>",
        type: "str",
        default: env.GRIDLET_ENPHASE_USER,
        help: "Enphase user name"
    },
)

// Tomorrow.io options
ap.add_argument(
    "--tomorrow_api_key",
    {
        dest: "tomorrow_api_key",
        metavar: "<api_key>",
        type: "str",
        default: env.GRIDLET_TOMORROW_API_KEY,
        help: "Tomorrow.io API key",
    }
)
ap.add_argument(
    "--tomorrow_location",
    {
        dest: "tomorrow_location",
        metavar: "<lat,lng>",
        type: "str",
        default: env.GRIDLET_TOMORROW_LOCATION,
        help: "location for the Tomorrow API, e.g. '29.935,-90.109'",
    }
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

const forecast = await getForecast(
    args.tomorrow_api_key,
    args.tomorrow_location.split(",").map(v => parseFloat(v)),
    ["temperature", "weatherCode", "windGust"],
    { timesteps: "1h", startTime: "now", endTime: "nowPlus12h", "units": "metric" },
)
log.debug(`forecast=${inspect(forecast.data.timelines[0].intervals.map(i => i.values))}`)

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
