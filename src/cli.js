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
    "-p",
    {
        dest: "password",
        metavar: "<password>",
        type: "str",
        help: "password for Enphase service"
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
        help: "username for Enphase service"
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

    if (nbi === undefined) {
        throw new Error(`Unexpected state: ${ns}`)
    }

    log.info(`Setting battery info to ${nbi}`)

    await setBatteryInfo(session, nbi)
}
