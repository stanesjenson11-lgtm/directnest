import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins";
import { db } from "./db.ts";
import * as schema from "./schema.ts";

const INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  user: {
    additionalFields: {
      // "member" for everyone; "admin" is set by hand for the review team.
      role: { type: "string", defaultValue: "member", input: false },
    },
  },
  socialProviders: process.env.GOOGLE_CLIENT_ID
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
    : undefined,
  // SMS costs money and invites abuse: 3 codes per number per 10 minutes, counted in Postgres.
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/phone-number/send-otp": { window: 600, max: 3 },
      "/phone-number/verify": { window: 600, max: 10 },
    },
  },
  plugins: [
    phoneNumber({
      phoneNumberValidator: (n) => INDIAN_MOBILE.test(n),
      allowedAttempts: 3,
      signUpOnVerification: {
        getTempEmail: (n) => `${n.slice(1)}@phone.directnest.invalid`,
        getTempName: () => "",
      },
      sendOTP: async ({ phoneNumber, code }) => {
        // ponytail: MSG91 with the client's DLT-registered template goes here once their account exists.
        if (process.env.NODE_ENV === "production") throw new Error("SMS provider is not configured");
        console.log(`[dev] OTP for ${phoneNumber}: ${code}`);
      },
    }),
    nextCookies(), // keep last: lets server actions set the session cookie
  ],
});

export type Session = typeof auth.$Infer.Session;
