import assert from "node:assert/strict";
import { test } from "node:test";
import { MFA_TTL_MS, mfaToken, mfaValid } from "./admin-mfa.ts";

test("second-factor cookie is valid only for its session, before expiry, untampered", () => {
  const now = 1_000_000;
  const t = mfaToken("s3cret", "sess-1", now);
  assert.ok(mfaValid("s3cret", "sess-1", t, now + 1));
  assert.ok(!mfaValid("s3cret", "sess-2", t, now + 1), "another session");
  assert.ok(!mfaValid("other", "sess-1", t, now + 1), "another secret");
  assert.ok(!mfaValid("s3cret", "sess-1", t, now + MFA_TTL_MS), "expired");
  assert.ok(!mfaValid("s3cret", "sess-1", `${now + 2 * MFA_TTL_MS}.${t.split(".")[1]}`, now + 1), "expiry edited");
  assert.ok(!mfaValid("s3cret", "sess-1", undefined, now));
  assert.ok(!mfaValid("s3cret", "sess-1", "garbage", now));
});
