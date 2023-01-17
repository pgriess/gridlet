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

// Interact with Enphase devices.
"use strict";

import { inspect } from "node:util"
import { AbortController } from "abort-controller"
import { parse as parseCookie, splitCookiesString } from "set-cookie-parser"
import { fetch, Request } from "cross-fetch"
import log from "loglevel" // CommonJS, not ES6 module
import { DOMParser } from "@xmldom/xmldom"
import formUrlEncoded from "form-urlencoded"

const BASE_URL = "https://enlighten.enphaseenergy.com"
const LOGIN_SUCCESS_LOC_RE = /^https:\/\/enlighten.enphaseenergy.com\/web\/(?<siteId>[0-9]+)\?v=.*$/

// Turn an HTMLCollection into an ES6 iterator
function* htmlCollectionIter(hc) {
    for (let i = 0; i < hc.length; ++i) {
        yield hc.item(i)
    }
}

// Parse cookies from a Response and return them in a Map.
//
// If provided, a map of previous cookies will be used to initialize the
// to-be-returned Map.
function responseCookies(resp, prevCookies) {
    const nextCookies = (prevCookies) ? new Map(prevCookies.entries()) : new Map()

    // The Enphase server can return multiple cookies, which the Fetch library
    // merges into a single ','-seprated header value. This is reasonable
    // behavior for headers that are ','-separated, which does NOT include
    // 'Set-Cookie'. See https://github.com/whatwg/fetch/issues/506. As a
    // workaround, use a special helper that knows how this header is special
    // and can split it correctly.
    for (const cs of splitCookiesString(resp.headers.get("set-cookie"))) {
        // This returns an array, but we know that it will only have one element
        // since we're feeding it the results of splitCookieString().
        const cookie = parseCookie(cs)[0]
        nextCookies.set(cookie.name, cookie.value)
    }

    return nextCookies
}

// Execute a `fetch()` request with some options
//
// TODO: Move this into a helper library
// TODO: Add HTTP status code enforcement
async function fetchRequest(req, options) {
    const defaultOptions = {
        signal: null,
        timeoutMs: 10000,
    }

    const finalOptions = Object.assign({}, defaultOptions, options || {})

    let abortTimeoutID = null;
    let fetchOptions = {}
    if (finalOptions.signal !== null) {
        fetchOptions.signal = finalOptions.signal
    } else if (finalOptions.timeoutMs !== null) {
        const abortController = new AbortController()
        fetchOptions.signal = abortController.signal
        abortTimeoutID = setTimeout(() => {
            log.error(`Request timeout expired; aborting ${inspect(req)}`)
            abortController.abort()
        }, finalOptions.timeoutMs)
    }

    try {
        return await fetch(req, fetchOptions)
    } finally {
        if (abortTimeoutID) {
            clearTimeout(abortTimeoutID)
        }
    }
}

// Create an authenticated session to the Enphase Enlighten system
async function createSession(username, password, options) {
    const bootstrapResp = await fetchRequest(`${BASE_URL}/`, options)
    const cookies = responseCookies(bootstrapResp)

    // Collect form elements
    //
    // We start with the username and password, then overlay hidden form
    // elements fetched from the bootstrap response. We use DOMParser for this
    // because it is a WHATWG standard that is supported by browsers.
    // Unfortunately the non-Browser port of this doesn't support any nice query
    // selectors, so we walk the DOM by hand. We could use jsdom, but it's
    // really heavy. Just live with it.
    const formInputs = new Map([
        ["user[email]", username],
        ["user[password]", password],
    ])
    const doc = (new DOMParser()).parseFromString(await bootstrapResp.text(), "text/html")
    for (const form of htmlCollectionIter(doc.getElementsByTagName("form"))) {
        if (form.getAttribute("action") !== "/login/login") {
            continue
        }

        for (const input of htmlCollectionIter(form.getElementsByTagName("input"))) {
            const inputType = input.getAttribute("type")
            if (inputType !== "hidden" && inputType !== "submit") {
                continue
            }

            formInputs.set(input.getAttribute("name"), input.getAttribute("value"))
        }
    }

    const loginReq = new Request(
        `${BASE_URL}/login/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Cookie: Array
                    .from(cookies)
                    .map(([k, v]) => { return `${k}=${v}` })
                    .join("; "),
            },
            body: formUrlEncoded(Object.fromEntries(formInputs)),
            redirect: "manual",
        },
    )

    const loginResp = await fetchRequest(loginReq, options)
    if (loginResp.status !== 302) {
        return null;
    }

    const locMatch = loginResp.headers.get("location").match(LOGIN_SUCCESS_LOC_RE)
    if (!locMatch) {
        return null;
    }

    return {
        cookies: responseCookies(loginResp, cookies),
        siteId: locMatch.groups.siteId,
    }
}

// Return battery information
async function getBatteryInfo(session, options) {
    const req = new Request(
        `${BASE_URL}/pv/settings/${session.siteId}/battery_config?source=my_enlighten`,
        {
            headers: {
                Cookie: Array
                    .from(session.cookies)
                    .map(([k, v]) => { return `${k}=${v}` })
                    .join("; "),
            },
        },
    )

    const resp = await fetchRequest(req, options)
    if (resp.status !== 200) {
        throw new Error(`Failed with status ${resp.status}: ${resp.statusText}`)
    }

    return JSON.parse(await resp.text())
}

// Set battery information
//
// TODO: Option to block until the operation has been applied?
async function setBatteryInfo(session, settings, options) {
    const req = new Request(
        `${BASE_URL}/pv/settings/${session.siteId}/battery_config?source=my_enlighten`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Cookie: Array
                    .from(session.cookies)
                    .map(([k, v]) => { return `${k}=${v}` })
                    .join("; "),
                "e-auth-token": session.cookies.get("_enlighten_4_session"),
            },
            body: formUrlEncoded(settings),
        },
    )

    const resp = await fetchRequest(req, options)
    if (resp.status !== 200) {
        throw new Error(`Failed with status ${resp.status}: ${resp.statusText}`)
    }

    const respBody = JSON.parse(await resp.text())
    if (respBody.message !== "Battery config updated successfully") {
        throw new Error(`Failed with message ${respBody.message}`)
    }
}

export { fetchRequest, getBatteryInfo, setBatteryInfo, createSession }
