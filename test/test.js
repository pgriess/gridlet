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

"use strict";

import { strict as assert, deepEqual as weakDeepEqual } from "node:assert"
import { execSync } from "node:child_process"
import { URL } from "node:url"
import { fetch, Request, Response } from "cross-fetch"
import { DateTime } from "luxon"
import { nextState, State } from "../src/state.js"
import { parseWeatherCode, WeatherCode } from "../src/tomorrow.js"
import { configDefault, configMerge, main } from "../src/engine.js"
import * as td from "testdouble"

// A testdouble matcher for Fetch API Request objects
const RequestMatcher = td.matchers.create({
    "matches": (matcherArgs, actual) => {
        const [matcherArgsQueryParams] = matcherArgs
        const actualSearchParams = new URL(actual.url).searchParams

        for (const [pn, pv] of Object.entries(matcherArgsQueryParams || {})) {
            if (actualSearchParams.get(pn) !== pv) {
                return false
            }
        }

        return true
    }
})

describe("engine", () => {
    describe("#configMerge", () => {
        it("should handle no configs", () => {
            weakDeepEqual(
                configMerge(),
                {})
        })
        it("should handle one config", () => {
            weakDeepEqual(
                configMerge({ a: 1 }),
                { a: 1 })
        })
        it("should propagate overwrite with set values", () => {
            weakDeepEqual(
                configMerge({ a: 1, b: 2 }, { a: 99 }),
                { a: 99, b: 2 })
        })
        it("should not overwrite with undefined values", () => {
            weakDeepEqual(
                configMerge({ a: 1, b: 2 }, { a: 99, b: undefined }),
                { a: 99, b: 2 })
        })
        it("should set unset values", () => {
            weakDeepEqual(
                configMerge({ a: 1, b: 2 }, { c: 99 }),
                { a: 1, b: 2, c: 99 })
        })
    })

    describe("#main", () => {
        // Use `function()` here so that we get access to `this.timeout()`,
        // which we need because the default 2s timeout is too short for all of
        // this heavyweight Docker setup
        before(function () {
            this.timeout(60000)

            // Container with a fake Enphase server
            execSync("docker image build --tag=gridlet_fake_enphase_server:latest -f test/fake/enphase_server.Dockerfile .", { stdio: [null, null, null] })
            execSync("docker container rm -f gridlet_fake_enphase_server", { stdio: [null, null, null] })
            execSync("docker container create --name=gridlet_fake_enphase_server -p 20233:8001 gridlet_fake_enphase_server:latest")
            execSync("docker container start gridlet_fake_enphase_server")

            // HACK: Force wait for the containers to come up. Surely there is a
            //       better way! Maybe http://testcontainers.com?
            execSync("sleep 1")
        })

        after(() => {
            execSync("docker container rm -f gridlet_fake_enphase_server", { stdio: [null, null, null] })
        })

        it("should be able to run at all", async () => {
            const config = configMerge(configDefault(), { enphase_url_base: "http://localhost:20233", dry_run: true })
            await main(config)
        })
    })
})

describe("state", () => {
    describe("#nextState", () => {
        it("should self-power", () => {
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T12:00:00")),
                State.SELF_POWER)
        })
        it("should charge from grid", () => {
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T02:00:00")),
                State.CHARGE_BATTERY_FROM_GRID)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T22:00:00")),
                State.CHARGE_BATTERY_FROM_GRID)
        })
        it("should handle running at the exact expected time", () => {
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T06:00:00")),
                State.SELF_POWER)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T20:00:00")),
                State.CHARGE_BATTERY_FROM_GRID)
        })
        it("should handle slop", () => {
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T05:55:00")),
                State.SELF_POWER)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T06:05:00")),
                State.SELF_POWER)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T19:55:00")),
                State.CHARGE_BATTERY_FROM_GRID)
            assert.equal(
                nextState(DateTime.fromISO("2022-01-01T20:05:00")),
                State.CHARGE_BATTERY_FROM_GRID)
        })
    })
})

describe("tomorrow", () => {
    describe("#getForecast", () => {
        let enphaseModule = null
        let tomorrowModule = null

        beforeEach(async () => {
            enphaseModule = await td.replaceEsm("../src/enphase.js")
            tomorrowModule = await import("../src/tomorrow.js")
        })

        afterEach(() => {
            tomorrowModule = null
            enphaseModule = null
            td.reset()
        })

        it("should merge query params from arguments", async () => {
            const resp = td.object(new Response())
            td.replace(resp, "status", 200)
            td.replace(resp, "statusText", "This is a test")
            td.replace(resp, "text", () => '{"a": 13}')

            // TODO: When tests fail we get weird errors related to the matcher not matching
            //       and tripping over default behavior (return undefined)
            td.when(enphaseModule.fetchRequest(
                RequestMatcher({
                    apikey: "INVALID_API_KEY",
                    location: "123,456",
                    fields: "foo,bar",
                    extraParam1: "fark",
                }),
                td.matchers.anything()))
                .thenResolve(resp)
            const result = await tomorrowModule.getForecast(
                "INVALID_API_KEY",
                [123, 456],
                ["foo", "bar"],
                { extraParam1: "fark" }
            )
            weakDeepEqual(result, { "a": 13 })
        })

        it("should handle non-2xx status codes", async () => {
            const resp = td.object(new Response())
            td.replace(resp, "status", 500)
            td.replace(resp, "statusText", "This is a test")

            td.when(enphaseModule.fetchRequest(td.matchers.anything(), td.matchers.anything()))
                .thenResolve(resp)
            await assert.rejects(
                tomorrowModule.getForecast("AN_INVALID_API_KEY", [123, 456]),
                /^Error: Forecast request failed: statusCode=500;.*$/)
        })
    })

    describe("#parseWeatherCode", () => {
        it("should recognize existing codes", () => {
            assert.equal(
                parseWeatherCode(WeatherCode.LIGHT_FOG.value),
                WeatherCode.LIGHT_FOG)
        })
        it("should reject unknown codes", () => {
            assert.throws(
                () => { parseWeatherCode(99123123) },
                /^Error: Unexpected weather code value 99123123$/)
        })
    })
})

describe("lambda", () => {
    // Use `function()` here so that we get access to `this.timeout()`,
    // which we need because the default 2s timeout is too short for all of
    // this heavyweight Docker setup
    before(function () {
        this.timeout(60000)

        // Create a network for these containers to share so that the Docker DNS
        // resolver will allow the Lambda container to resolve the hostname of
        // the fake Enphase server
        execSync("docker network inspect gridlet_test_network && docker network rm gridlet_test_network || true", { stdio: [null, null, null] })
        execSync("docker network create gridlet_test_network")

        // Container with a fake Enphase server
        execSync("docker image build --tag=gridlet_fake_enphase_server:latest -f test/fake/enphase_server.Dockerfile .", { stdio: [null, null, null] })
        execSync("docker container rm -f gridlet_fake_enphase_server", { stdio: [null, null, null] })
        execSync("docker container create --network=gridlet_test_network --name=gridlet_fake_enphase_server -p 20233:8001 gridlet_fake_enphase_server:latest")
        execSync("docker container start gridlet_fake_enphase_server")

        // Container with a fake Lambda server
        execSync("docker image build --tag=gridlet_lambda:latest -f docker/lambda/Dockerfile .", { stdio: [null, null, null] })
        execSync("docker container rm -f gridlet_lambda", { stdio: [null, null, null] })
        execSync("docker container create --network=gridlet_test_network --name=gridlet_lambda -p 20234:8080 -e GRIDLET_DRY_RUN=true gridlet_lambda:latest")
        execSync("docker container start gridlet_lambda")

        // HACK: Force wait for the containers to come up. Surely there is a
        //       better way! Maybe http://testcontainers.com?
        execSync("sleep 1")
    })

    after(() => {
        execSync("docker container rm -f gridlet_fake_enphase_server", { stdio: [null, null, null] })
        execSync("docker container rm -f gridlet_lambda", { stdio: [null, null, null] })
        execSync("docker network rm gridlet_test_network")
    })

    it("should be able to run at all", async () => {
        const req = new Request(
            "http://localhost:20234/2015-03-31/functions/function/invocations",
            {
                method: "POST",
                body: JSON.stringify({
                    enphase_url_base: "http://gridlet_fake_enphase_server:8001",
                }),
            }
        )
        const resp = await fetch(req)
        assert.equal(200, resp.status)

        const respBody = await resp.json()
        assert.equal("Ok", respBody)
    })
})
