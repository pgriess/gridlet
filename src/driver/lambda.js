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

import { configFromEnvironment, main } from "../engine.js"

export const handler = async (event, context) => {
    await main(configFromEnvironment())
    return "Ok"
}
