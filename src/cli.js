#!/usr/bin/env node
"use strict";

import { ArgumentParser } from "argparse";
import { createSession, getBatteryInfo, setBatteryInfo } from "./enphase.js"
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

// await setBatteryInfo(session, { usage: "backup_only", battery_backup_percentage: 100 })
await setBatteryInfo(session, { usage: "self-consumption", battery_backup_percentage: 30 })
