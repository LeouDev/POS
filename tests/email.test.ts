import { test } from "node:test";
import assert from "node:assert/strict";
import { sendWelcomeEmail, welcomeEmail, type Welcome } from "../lib/email";

const welcome: Welcome = {
  businessName: `Kape <Kanto> & "Co"`,
  ownerName: "Leou",
  trialEndsAt: "2026-11-28T02:00:00.000Z",
  timezone: "Asia/Manila",
  origin: "https://kassix.test",
};

test("welcome email: how-to video, user guide, trial end date, escaped shop name", () => {
  const { subject, html, text } = welcomeEmail(welcome);
  assert.equal(subject, `Welcome to KASSIX, Kape <Kanto> & "Co"!`);
  for (const body of [html, text]) {
    assert.ok(body.includes("https://www.youtube.com/watch?v=I3XOQMoq2ag"));
    assert.ok(body.includes("https://kassix.test/user-guide.html"));
    assert.ok(body.includes("https://kassix.test/dashboard"));
    assert.ok(body.includes("Nov 28, 2026"));
    assert.ok(body.includes("Hi Leou,"));
  }
  assert.ok(html.includes("Kape &lt;Kanto&gt; &amp; &quot;Co&quot;"));
  assert.ok(!html.includes("<Kanto>")); // a shop name can't inject HTML
  assert.ok(welcomeEmail({ ...welcome, ownerName: "" }).text.startsWith("Hi there,"));
});

test("welcome email goes out through Brevo and never breaks signing up", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  let reply = () => Response.json({ messageId: "<1@smtp-relay.brevo.com>" }, { status: 201 });
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return reply();
  }) as typeof fetch;
  const logs: unknown[][] = [];
  console.warn = console.error = (...args: unknown[]) => void logs.push(args);

  delete process.env.BREVO_API_KEY;
  await sendWelcomeEmail("owner@kassix.test", welcome);
  assert.equal(calls.length, 0); // not configured: skipped, sign-up carries on

  process.env.BREVO_API_KEY = "xkeysib-fake";
  process.env.EMAIL_FROM = "hello@kassix.test";
  await sendWelcomeEmail("owner@kassix.test", welcome);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(new Headers(calls[0].init?.headers).get("api-key"), "xkeysib-fake");
  const body = JSON.parse(String(calls[0].init?.body));
  assert.deepEqual(body.sender, { name: "KASSIX", email: "hello@kassix.test" });
  assert.deepEqual(body.to, [{ email: "owner@kassix.test", name: "Leou" }]);
  assert.equal(body.subject, welcomeEmail(welcome).subject);
  assert.ok(body.htmlContent.includes("user-guide.html") && body.textContent.includes("I3XOQMoq2ag"));

  reply = () => Response.json({ code: "invalid_parameter", message: "sender not valid" }, { status: 400 });
  await sendWelcomeEmail("owner@kassix.test", welcome); // resolves; the error is logged
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  await sendWelcomeEmail("owner@kassix.test", welcome);
  assert.ok(logs.some((args) => String(args[0]).includes("Brevo rejected")));
  assert.ok(logs.some((args) => String(args[0]).includes("welcome email failed")));
});
