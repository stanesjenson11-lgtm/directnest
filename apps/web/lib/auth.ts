import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber, twoFactor } from "better-auth/plugins";
import { db } from "./db.ts";
import { isStaffRole } from "./roles.ts";
import * as schema from "./schema.ts";
import { sendOtpSms, smsConfigured } from "./sms.ts";
import { DAY_COOKIE, dayToken } from "./staff-day.ts";
import { dayCookieOptions, staffDay } from "./staff-day-plugin.ts";

const INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  user: {
    additionalFields: {
      // "member" for everyone; "admin" is set by hand for the review team.
      role: { type: "string", defaultValue: "member", input: false },
      banned: { type: "boolean", defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Banning also deletes a person's sessions (admin action); this stops them signing back in.
        before: async (s) => {
          const [u] = await db.select({ banned: schema.user.banned }).from(schema.user).where(eq(schema.user.id, s.userId));
          if (u?.banned) throw new APIError("FORBIDDEN", { message: "This account has been suspended. Call us if you think this is a mistake." });
        },
      },
    },
  },
  // Google and Apple are how most people sign in. Each shows up on the sign-in page only once its keys are set; both then
  // send people on to confirm their mobile number (/verify-phone), which owners and staff rely on.
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }),
    // APPLE_CLIENT_SECRET is a signed token that lasts six months: pnpm apple-secret prints a fresh one.
    ...(process.env.APPLE_CLIENT_ID && {
      apple: { clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET!, appBundleIdentifier: process.env.APPLE_APP_BUNDLE_ID },
    }),
  },
  // Apple sends people back by posting to our callback from its own site.
  trustedOrigins: process.env.APPLE_CLIENT_ID ? ["https://appleid.apple.com"] : [],
  // SMS costs money and invites abuse. Limits are per client IP, counted in Postgres; 5 sends leaves room for
  // carrier-grade NAT, where many Jio/Airtel users share one IP.
  // ponytail: per-number throttling arrives with Cloudflare Turnstile on the send step (week 1 security task).
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/phone-number/send-otp": { window: 600, max: 5 },
      "/phone-number/verify": { window: 600, max: 10 },
    },
  },
  // Behind Cloudflare and Caddy the socket IP is the proxy's; without this every visitor would share one limit.
  // Only trust these once the VPS firewall accepts web traffic from Cloudflare alone.
  advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] } },
  // Staff second factor. The plugin's HTTP routes count wrong codes only at sign-in, which our phone-OTP sign-in never
  // passes through, so they are closed; admin/mfa-actions.ts calls the same code server-side with its own lockout.
  disabledPaths: [
    "/two-factor/enable",
    "/two-factor/disable",
    "/two-factor/get-totp-uri",
    "/two-factor/verify-totp",
    "/two-factor/verify-backup-code",
    "/two-factor/generate-backup-codes",
    "/two-factor/send-otp",
    "/two-factor/verify-otp",
  ],
  plugins: [
    twoFactor({ issuer: "DirectNest", allowPasswordless: true }), // phone sign-in has no password to ask for
    staffDay(),
    phoneNumber({
      phoneNumberValidator: (n) => INDIAN_MOBILE.test(n),
      allowedAttempts: 3,
      // A staff member's text-message code, checked here, is what lets them sign in with the authenticator alone for the
      // rest of the day (lib/staff-day.ts). Clients get no such cookie. Runs for sign-in and for confirming a number alike.
      callbackOnVerification: async ({ user }, ctx) => {
        if (ctx && isStaffRole((user as { role?: unknown }).role)) ctx.setCookie(DAY_COOKIE, dayToken(ctx.context.secret, user.id), dayCookieOptions());
      },
      signUpOnVerification: {
        getTempEmail: (n) => `${n.slice(1)}@phone.directnest.invalid`,
        getTempName: () => "",
      },
      sendOTP: async ({ phoneNumber, code }) => {
        if (smsConfigured()) return sendOtpSms(phoneNumber, code);
        if (process.env.NODE_ENV === "production") throw new Error("SMS provider is not configured: set MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID");
        console.log(`[dev] OTP for ${phoneNumber}: ${code}`);
      },
    }),
    nextCookies(), // keep last: lets server actions set the session cookie
  ],
});

export type Session = typeof auth.$Infer.Session;
