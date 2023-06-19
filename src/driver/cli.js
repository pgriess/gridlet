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

import { ArgumentParser } from "argparse"
import { configDefault, configFromEnvironment, configMerge, main } from "../engine.js";

// Load config from CLI arguments
function configFromCLI() {
    const ap = ArgumentParser({
        description: "The command line interface to Gridlet.",
        epilog: `
To facilitate ease of debugging (e.g. using an IDE), all options are
configurable using environment variables. See the source code for definitions of
what these are and the format that their values should be in.`,
    });

    // Core
    ap.add_argument(
        "-n",
        {
            dest: "dry_run",
            action: "store_true",
            help: "dry-run only; do not take any action",
        }
    )
    ap.add_argument(
        "-q",
        {
            dest: "quiet",
            action: "store_true",
            help: "silence all logging regardless of verbosity"
        }
    )
    ap.add_argument(
        "-v",
        {
            dest: "log_level",
            action: "count",
            help: "increase logging verbosity; can be used multiple times"
        }
    )

    // Enphase
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

    // Tomorrow.io
    ap.add_argument(
        "--tomorrow_api_key",
        {
            dest: "tomorrow_api_key",
            metavar: "<api_key>",
            type: "str",
            help: "Tomorrow.io API key",
        }
    )
    ap.add_argument(
        "--tomorrow_location",
        {
            dest: "tomorrow_location",
            metavar: "<lat,lng>",
            type: "str",
            help: "location for the Tomorrow API, e.g. '29.935,-90.109'",
        }
    )

    return ap.parse_args()
}

main(configMerge(configDefault(), configFromEnvironment(), configFromCLI()))
