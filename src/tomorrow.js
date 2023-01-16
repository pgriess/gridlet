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

// Interact with Tomorrow.io APIs.
"use strict";

import { Request } from "cross-fetch"
import URLSearchParams from "@ungap/url-search-params"

import { fetchRequest } from "./enphase.js"

// Weather codes from the Tomorrow API sourced from
// https://docs.tomorrow.io/reference/data-layers-weather-codes
const WeatherCode = Object.freeze({
    UNKNOWN: Object.freeze({ name: "UNKNOWN", value: 0 }),
    CLEAR_SUNNY: Object.freeze({ name: "CLEAR_SUNNY", value: 1000 }),
    MOSTLY_CLEAR: Object.freeze({ name: "MOSTLY_CLEAR", value: 1100 }),
    PARTLY_CLOUDY: Object.freeze({ name: "PARTLY_CLOUDY", value: 1101 }),
    MOSTLY_CLOUDY: Object.freeze({ name: "MOSTLY_CLOUDY", value: 1102 }),
    CLOUDY: Object.freeze({ name: "CLOUDY", value: 1001 }),
    FOG: Object.freeze({ name: "FOG", value: 2000 }),
    LIGHT_FOG: Object.freeze({ name: "LIGHT_FOG", value: 2100 }),
    DRIZZLE: Object.freeze({ name: "DRIZZLE", value: 4000 }),
    RAIN: Object.freeze({ name: "RAIN", value: 4001 }),
    LIGHT_RAIN: Object.freeze({ name: "LIGHT_RAIN", value: 4200 }),
    HEAVY_RAIN: Object.freeze({ name: "HEAVY_RAIN", value: 4201 }),
    SNOW: Object.freeze({ name: "SNOW", value: 5000 }),
    FLURRIES: Object.freeze({ name: "FLURRIES", value: 5001 }),
    LIGHT_SNOW: Object.freeze({ name: "LIGHT_SNOW", value: 5100 }),
    HEAVY_SNOW: Object.freeze({ name: "HEAVY_SNOW", value: 5101 }),
    FREEZING_DRIZZLE: Object.freeze({ name: "FREEZING_DRIZZLE", value: 6000 }),
    FREEZING_RAIN: Object.freeze({ name: "FREEZING_RAIN", value: 6001 }),
    LIGHT_FREEZING_RAIN: Object.freeze({ name: "LIGHT_FREEZING_RAIN", value: 6200 }),
    HEAVY_FREEZING_RAIN: Object.freeze({ name: "HEAVY_FREEZING_RAIN", value: 6201 }),
    ICE_PELLETS: Object.freeze({ name: "ICE_PELLETS", value: 7000 }),
    HEAVY_ICE_PELLETS: Object.freeze({ name: "HEAVY_ICE_PELLETS", value: 7101 }),
    LIGHT_ICE_PELLETS: Object.freeze({ name: "LIGHT_ICE_PELLETS", value: 7102 }),
    THUNDERSTORM: Object.freeze({ name: "THUNDERSTORM", value: 8000 }),
})

// Convert weather code integer values to WeatherCode enums
function parseWeatherCode(val) {
    for (const [ek, ev] of Object.entries(WeatherCode)) {
        if (ev.value === val) {
            return ev
        }
    }

    throw new Error(`Unexpected weather code value ${val}`)
}

// Return forecast
async function getForecast(apiKey, location, fields, extraParams, fetchOptions) {
    const usp = new URLSearchParams()
    usp.append("apikey", apiKey)
    usp.append("location", location.join(","))
    usp.append("fields", (fields || []).join(","))
    for (const [pn, pv] of Object.entries(extraParams || {})) {
        usp.append(pn, pv)
    }

    const req = new Request(
        `https://api.tomorrow.io/v4/timelines?${usp.toString()}`,
        {
            headers: {
                Accept: "application/json"
            }
        }
    )

    const resp = await fetchRequest(req, fetchOptions)
    const respBody = await resp.text()

    if (resp.status !== 200) {
        throw new Error(`Forecast request failed: statusCode=${resp.status}; statusText=${resp.statusText}; body=${respBody}`)
    }

    return JSON.parse(respBody)
}

export { getForecast, parseWeatherCode, WeatherCode }
