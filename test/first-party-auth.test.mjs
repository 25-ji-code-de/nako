// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  FIRST_PARTY_CLIENT_IDS,
  isFirstPartyClient,
} from "../src/config/first-party-clients.ts";

const EXPECTED = [
  "25ji_client",
  "nightcord_client",
  "sekai_hub_client",
  "st_client",
  "client-pico-AC7D9279977E0954",
];

describe("SEKAI 第一方 OAuth client", () => {
  test("当前生态客户端清单逐项固定", () => {
    assert.deepEqual(FIRST_PARTY_CLIENT_IDS, EXPECTED);
  });

  for (const clientId of EXPECTED) {
    test(`${clientId} 被认作第一方`, () => {
      assert.equal(isFirstPartyClient(clientId), true);
    });
  }

  test("任意第三方 client 即使名字相近也不放行", () => {
    for (const clientId of [
      "some-third-party-client",
      "nightcord_client_evil",
      "prefix-nightcord_client",
      "",
      null,
      undefined,
    ]) {
      assert.equal(isFirstPartyClient(clientId), false, String(clientId));
    }
  });

  test("清单被冻结，运行时不能被污染", () => {
    assert.equal(Object.isFrozen(FIRST_PARTY_CLIENT_IDS), true);
    assert.throws(() => FIRST_PARTY_CLIENT_IDS.push("evil"), TypeError);
  });
});
