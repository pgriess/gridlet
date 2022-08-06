#!/usr/bin/env node
"use strict";

import { ArgumentParser } from "argparse";
import { battery_info_get, session_create } from "./enphase.js"
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
const session = await session_create(args.u, args.p)
if (!session) {
    console.error("Failed to log in")
    exit(1)
}

const bi = await battery_info_get(session)
console.log(bi)
