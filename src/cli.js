#!/usr/bin/env node
"use strict";

import { ArgumentParser } from "argparse";
import { createSession, getBatteryInfo, setBatteryInfo } from "./enphase.js"
import { nextState, State, stateFromBatteryInfo } from "./state.js"
import { exit } from "node:process"

const ap = ArgumentParser({
    "description": "The command line interface to Picogrid."
});
ap.add_argument(
    "-u",
    {
        metavar: "<username>",
        type: "str",
        help: "Enphase username"
    },
)
ap.add_argument(
    "-p",
    {
        metavar: "<password>",
        type: "str",
        help: "Enphase password"
    },
)

const args = ap.parse_args();
const session = await createSession(args.u, args.p)
if (!session) {
    console.error("Failed to log in")
    exit(1)
}

const bi = await getBatteryInfo(session)
console.log(bi)
const cs = stateFromBatteryInfo(bi)
const ns = nextState(new Date())

if (ns === cs) {
    console.log("Current state un-changed; doing nothing")
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

console.log(`Changing current state to ${ns.toString()}`)

await setBatteryInfo(session, nbi)
