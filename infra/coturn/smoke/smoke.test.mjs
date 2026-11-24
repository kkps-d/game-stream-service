import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { chromium } from "playwright";

const turnUrl = `turn:${process.env.TURN_IP || "172.30.42.2"}:3478?transport=udp`;
const browserUrl = `ws://${process.env.SMOKE_PEER_IP || "172.30.42.3"}:3000/`;
const timeout = 15_000;

function turnCredentials(secret, peer, expiresInSeconds) {
  const expiration = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const username = `${expiration}:${peer}`;
  const credential = createHmac("sha1", secret)
    .update(username)
    .digest("base64");

  return { urls: turnUrl, username, credential };
}

async function createPeer(browser, iceServer, offerer) {
  const page = await browser.newPage();

  // Use a trustworthy browser origin without running a signaling server.
  const origin = "http://localhost/";
  await page.route(origin, (route) =>
    route.fulfill({ contentType: "text/html", body: "" }),
  );
  await page.goto(origin);

  await page.evaluate(
    ({ iceServer, offerer }) => {
      const connection = new RTCPeerConnection({
        iceServers: [iceServer],
        iceTransportPolicy: "relay",
      });
      const state = {
        connection,
        candidateTypes: [],
        candidateErrors: [],
        messages: [],
      };
      globalThis.relayTest = state;

      connection.onicecandidate = ({ candidate }) => {
        if (candidate?.type) state.candidateTypes.push(candidate.type);
      };
      connection.onicecandidateerror = ({ errorCode }) => {
        state.candidateErrors.push(errorCode);
      };

      function attachChannel(channel) {
        state.channel = channel;
        channel.onmessage = ({ data }) => state.messages.push(data);
      }

      connection.ondatachannel = ({ channel }) => attachChannel(channel);
      if (offerer) attachChannel(connection.createDataChannel("relay-smoke"));
    },
    { iceServer, offerer },
  );

  return page;
}

async function gatherCandidates(page) {
  await page.evaluate(() =>
    globalThis.relayTest.connection.setLocalDescription(),
  );
  await page.waitForFunction(
    () => globalThis.relayTest.connection.iceGatheringState === "complete",
    null,
    { timeout },
  );
  return page.evaluate(() => {
    const { connection, candidateTypes, candidateErrors } =
      globalThis.relayTest;
    return {
      description: connection.localDescription.toJSON(),
      candidateTypes,
      candidateErrors,
    };
  });
}

function setRemoteDescription(page, description) {
  return page.evaluate(
    (sdp) => globalThis.relayTest.connection.setRemoteDescription(sdp),
    description,
  );
}

function selectedCandidateTypes(page) {
  return page.evaluate(async () => {
    const stats = await globalThis.relayTest.connection.getStats();
    const transport = [...stats.values()].find(
      (record) => record.selectedCandidatePairId,
    );
    const pair = stats.get(transport?.selectedCandidatePairId);
    return [
      stats.get(pair?.localCandidateId)?.candidateType,
      stats.get(pair?.remoteCandidateId)?.candidateType,
    ];
  });
}

test("local coturn", { timeout: 120_000 }, async (t) => {
  const config = await readFile(
    new URL("../local/turnserver.conf", import.meta.url),
    "utf8",
  );
  const secret = config.match(/^static-auth-secret=([a-f0-9]{64})$/m)?.[1];
  assert.ok(
    secret,
    "Generate turnserver.conf with the secret described in the coturn README.",
  );

  const host = await chromium.launch();
  t.after(() => host.close());
  const container = await chromium.connect(browserUrl, { timeout });
  t.after(() => container.close());

  await t.test("relays data between the host and container", async (t) => {
    const hostPage = await createPeer(
      host,
      turnCredentials(secret, "host", 300),
      true,
    );
    t.after(() => hostPage.close());
    const containerPage = await createPeer(
      container,
      turnCredentials(secret, "container", 300),
      false,
    );
    t.after(() => containerPage.close());

    const offer = await gatherCandidates(hostPage);
    assert.ok(
      offer.candidateTypes.includes("relay"),
      "Host Chromium obtained a relay candidate.",
    );
    await setRemoteDescription(containerPage, offer.description);

    const answer = await gatherCandidates(containerPage);
    assert.ok(
      answer.candidateTypes.includes("relay"),
      "Container Chromium obtained a relay candidate.",
    );
    await setRemoteDescription(hostPage, answer.description);

    await Promise.all(
      [hostPage, containerPage].map((page) =>
        page.waitForFunction(
          () => globalThis.relayTest.channel?.readyState === "open",
          null,
          {
            timeout,
          },
        ),
      ),
    );

    await hostPage.evaluate(() =>
      globalThis.relayTest.channel.send("hello from host"),
    );
    await containerPage.waitForFunction(
      () => globalThis.relayTest.messages.includes("hello from host"),
      null,
      { timeout },
    );
    await containerPage.evaluate(() =>
      globalThis.relayTest.channel.send("hello from container"),
    );
    await hostPage.waitForFunction(
      () => globalThis.relayTest.messages.includes("hello from container"),
      null,
      { timeout },
    );

    assert.deepEqual(await selectedCandidateTypes(hostPage), [
      "relay",
      "relay",
    ]);
    assert.deepEqual(await selectedCandidateTypes(containerPage), [
      "relay",
      "relay",
    ]);
  });

  const invalidPassword = turnCredentials(secret, "invalid-password", 300);
  invalidPassword.credential = "wrong-password";

  for (const [label, credentials] of [
    ["an incorrect password", invalidPassword],
    ["an expired credential", turnCredentials(secret, "expired", -60)],
  ]) {
    await t.test(`rejects ${label}`, async (t) => {
      const page = await createPeer(host, credentials, true);
      t.after(() => page.close());

      const { candidateTypes, candidateErrors } = await gatherCandidates(page);
      assert.deepEqual(candidateTypes, []);
      assert.ok(
        candidateErrors.includes(401) || candidateErrors.includes(441),
        `Expected a TURN authentication error, received: ${candidateErrors.join(", ")}`,
      );
    });
  }
});
