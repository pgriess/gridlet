// Interact with Enphase devices.

"use strict";

import { parse as parseCookie, splitCookiesString } from "set-cookie-parser"
import { fetch, Request } from "cross-fetch"
import { DOMParser } from "@xmldom/xmldom"
import formUrlEncoded from "form-urlencoded"

const BASE_URL = "https://enlighten.enphaseenergy.com"
const LOGIN_SUCCESS_LOC_RE = /^https:\/\/enlighten.enphaseenergy.com\/web\/(?<siteId>[0-9]+)\?v=.*$/

// Turn an HTMLCollection into an ES6 iterator
function* html_collection_iter(hc) {
    for (let i = 0; i < hc.length; ++i) {
        yield hc.item(i)
    }
}

// Return a copy of the cookie map with cookies parsed from the given Response applied
function cookie_map_update(resp, prev_cookies) {
    const next_cookies = (prev_cookies) ? new Map(prev_cookies.entries()) : new Map()

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
        next_cookies.set(cookie.name, cookie.value)
    }

    return next_cookies
}

// Create an authenticated session to the Enphase Enlighten system
async function session_create(username, password) {
    const bootstrapResp = await fetch(`${BASE_URL}/`)
    const cookies = cookie_map_update(bootstrapResp)

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
    for (const form of html_collection_iter(doc.getElementsByTagName("form"))) {
        if (form.getAttribute("action") !== "/login/login") {
            continue
        }

        for (const input of html_collection_iter(form.getElementsByTagName("input"))) {
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

    const loginResp = await fetch(loginReq)
    if (loginResp.status !== 302) {
        return null;
    }

    const locMatch = loginResp.headers.get("location").match(LOGIN_SUCCESS_LOC_RE)
    if (!locMatch) {
        return null;
    }

    return {
        cookies: cookie_map_update(loginResp, cookies),
        siteId: locMatch.groups.siteId,
    }
}

// Return battery information
async function battery_info_get(session) {
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
    const resp = await fetch(req)
    return JSON.parse(await resp.text())
}

export { battery_info_get, session_create }
