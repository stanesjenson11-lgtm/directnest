// Proof that this session passed the staff second factor in the last 12 hours.
// Bound to the session id, so signing in again (or a stolen cookie on another session) must pass it again.
import { createHmac, timingSafeEqual } from "node:crypto";

export const MFA_COOKIE = "dn_admin_mfa";
export const MFA_TTL_MS = 12 * 60 * 60 * 1000;

const sign = (secret: string, sessionId: string, exp: number) => createHmac("sha256", secret).update(`${sessionId}.${exp}`).digest("base64url");

export function mfaToken(secret: string, sessionId: string, now = Date.now()) {
  const exp = now + MFA_TTL_MS;
  return `${exp}.${sign(secret, sessionId, exp)}`;
}

export function mfaValid(secret: string, sessionId: string, token: string | undefined, now = Date.now()) {
  const [exp, sig] = (token ?? "").split(".");
  if (!sig || !(Number(exp) > now)) return false;
  const want = Buffer.from(sign(secret, sessionId, Number(exp)));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want);
}
