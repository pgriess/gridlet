#!/usr/bin/env node
"use strict";

const { ArgumentParser } = require("argparse");

const ap = ArgumentParser({
    "description": "The command line interface to Picogrid."
});

const args = ap.parse_args();

console.log("Hello, world!");
