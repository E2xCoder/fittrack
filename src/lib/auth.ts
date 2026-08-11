import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export const auth = betterAuth({
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