#!/usr/bin/env node
"use strict";

import { ArgumentParser } from "argparse";
import { login as enphase_login } from "./enphase.js"

const ap = ArgumentParser({
    "description": "The command line interface to Picogrid."
});

const args = ap.parse_args();

console.log("Hello, world!");

enphase_login()
