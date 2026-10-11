import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

const DAY = 60 * 60 * 24;

export const auth = betterAuth({
  // Stay signed in: a session lasts 90 days and is renewed (at most once a day)
  // whenever it is used, so an active device never has to sign in again.
  session: {
    expiresIn: 90 * DAY,
    updateAge: DAY,
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  plugins: [
    twoFactor({
      issuer: "FitTrack",
      // A device that passed 2FA with "trust this device" skips the code on later
      // sign-ins; the trust is renewed on every sign-in, so it keeps rolling.
      trustDeviceMaxAge: 90 * DAY,
    }),
    passkey({
      rpID: process.env.NODE_ENV === "production" ? "fittrackme.com" : "localhost",
      rpName: "FitTrack",
    }),
  ],
  trustedOrigins: [
    "http://localhost:3000",
    "https://fittrack-ten-umber.vercel.app",
    "https://fittrackme.com",
  ],
});