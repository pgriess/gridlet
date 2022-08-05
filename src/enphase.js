// Interact with Enphase devices.
//
// For debugging you can run through Charles as follows
//
// 1. Set up Charles in Reverse Proxy mode (Proxy -> Reverse Proxies) and add a
//    mapping to enlighten.enphaseenergy.com:443.
//
// 2. Override ENPHASE_BASE_URL to the Charles URL, e.g.
//    https://localhost:54532
//
// 3. Run with the NODE_TLS_REJECT_UNAUTHORIZED=0 environment variable set,
//    which will disable TLS validation

"use strict";

import { parse as parseCookie, splitCookiesString } from "set-cookie-parser"
import { fetch, Request } from "cross-fetch"
import { DOMParser } from "@xmldom/xmldom"
import formUrlEncoded from "form-urlencoded"

const BASE_URL = "https://enlighten.enphaseenergy.com"
const LOGIN_SUCCESS_LOC_RE = /^https:\/\/enlighten.enphaseenergy.com\/web\/[0-9]+\?v=.*$/

// Turn an HTMLCollection into an ES6 iterator
function* html_collection_iter(hc) {
    for (let i = 0; i < hc.length; ++i) {
        yield hc.item(i)
    }
}

// Create an authenticated session to the Enphase Enlighten system
async function session_create(username, password) {
    const bootstrapResp = await fetch(`${BASE_URL}/`)

    // Collect cookies
    //
    // The Enphase server can return multiple cookies, which the Fetch library
    // merges into a single ','-seprated header value. This is reasonable
    // behavior for headers that are ','-separated, which does NOT include
    // 'Set-Cookie'. See https://github.com/whatwg/fetch/issues/506. As a
    // workaround, use a special helper that knows how this header is special
    // and can split it correctly.
    const cookies = new Map()
    for (const cs of splitCookiesString(bootstrapResp.headers.get("set-cookie"))) {
        // This returns an array, but we know that it will only have one element
        // since we're feeding it the results of splitCookieString().
        const cookie = parseCookie(cs)[0]
        cookies.set(cookie.name, cookie.value)
    }

    // Collect form elements
    //
    // We start with the username and password, then overlay hidden form
    // elements fetched from the bootstrap response. We use DOMParser for this
    // because it is a WHATWG standard that is supported by browsers.
    // Unfortunately the non-Browser port of this doesn't support any nice query
    // selectors, so we walk the DOM by hand. We could use jsdom, but it's
    // really heavy. Just live with it.
    //
    // XXX: formUrlEncoded() requires that this be an Object so we can't use
    //      the newer Map. Alas.
    let formInputs = {
        "user[email]": username,
        "user[password]": password,
    }
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

            formInputs[input.getAttribute("name")] = input.getAttribute("value")
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
            body: formUrlEncoded(formInputs),
            redirect: "manual",
        }
    )

    const loginResp = await fetch(loginReq)
    if (loginResp.status !== 302) {
        return null;
    }

    if (!loginResp.headers.get("location").match(LOGIN_SUCCESS_LOC_RE)) {
        return null;
    }

    return {}
}

export { session_create }
