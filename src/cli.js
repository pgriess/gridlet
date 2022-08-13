#!/usr/bin/env node
"use strict";

import { exit } from "node:process"
import { inspect } from "node:util"
import { ArgumentParser } from "argparse"
import log from "loglevel" // CommonJS, not ES6 module
import { DateTime } from "luxon"
import { createSession, getBatteryInfo, setBatteryInfo } from "./enphase.js"
import { nextState, State, stateFromBatteryInfo } from "./state.js"

const ap = ArgumentParser({
    "description": "The command line interface to Picogrid."
});
ap.add_argument(
    "-p",
    {
        dest: "password",
        metavar: "<password>",
        type: "str",
        help: "Enphase password"
    },
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
    "-u",
    {
        dest: "username",
        metavar: "<username>",
        type: "str",
        help: "Enphase username"
    },
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

const args = ap.parse_args();

// Configure logging
log.setDefaultLevel(
    (args.quiet) ?
        log.levels.SILENT :
        Math.max(log.levels.TRACE, log.levels.ERROR - args.verbosity)
)

const session = await createSession(args.username, args.password)
if (!session) {
    log.error("Failed to log in!")
    exit(1)
}

const bi = await getBatteryInfo(session)
log.debug(`battery_info=${inspect(bi)}`)
const cs = stateFromBatteryInfo(bi)
const ns = nextState(DateTime.now())

if (ns === cs) {
    log.info("Current state un-changed; doing nothing")
    exit(0)
}

// TODO: Fix formatting
const nbi =
    (ns === State.CHARGE_BATTERY_FROM_GRID) ? { usage: "backup_only", battery_backup_percentage: 100 } :
        (ns === State.SELF_POWER) ? { usage: "self-consumption", battery_backup_percentage: 30 } :
            undefined

if (nbi === undefined) {
    throw new Error(`Unexpected state: ${ns}`)
}

log.info(`Changing current state to ${ns.toString()}`)

await setBatteryInfo(session, nbi)
