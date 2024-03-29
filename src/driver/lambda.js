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

// AWS Lambda driver for the Gridlet system
//
// NOTE: We do not need a global timeout handler as the AWS Lambda runtime
//       provides this for us.
"use strict";

import { inspect } from "node:util"
import { configDefault, configFromEnvironment, configMerge, main } from "../engine.js"

// The AWS Lambda event is the JSON object from POST request body. No processing
// required, just pass it directly.
function configFromEvent(event) {
    console.log(`event=${inspect(event, { depth: 4, breakLength: Infinity, compact: true })}`)
    return event
}

export const handler = async (event, context) => {
    await main(configMerge(configDefault(), configFromEnvironment(), configFromEvent(event)))
    return "Ok"
}
