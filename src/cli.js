#!/usr/bin/env node
"use strict";

import { ArgumentParser } from "argparse";
import { createSession, getBatteryInfo } from "./enphase.js"
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
