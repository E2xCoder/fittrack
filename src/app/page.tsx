"use client";

import { authClient } from "@/lib/auth-client";

export default function Home() {
  const signUp = async () => {
    console.log("register clicked");

    try {
      const result = await authClient.signUp.email({
        email: "emre123@test.com",
        password: "12345678",
        name: "Emre",
      });

      console.log("REGISTER:", result);
    } catch (error) {
      console.error("REGISTER ERROR:", error);
    }
  };

  const signIn = async () => {
    console.log("login clicked");

    try {
      const result = await authClient.signIn.email({
        email: "emre123@test.com",
        password: "12345678",
      });

      console.log("LOGIN:", result);
    } catch (error) {
      console.error("LOGIN ERROR:", error);
    }
  };

  const signOut = async () => {
    try {
      await authClient.signOut();
      console.log("logout success");
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-center text-4xl font-bold">
          FitTrack
        </h1>

        <button
          onClick={signUp}
          className="rounded bg-green-600 px-4 py-2 text-white"
        >
          Test Register
        </button>

        <button
          onClick={signIn}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Test Login
        </button>

        <button
          onClick={signOut}
          className="rounded bg-red-600 px-4 py-2 text-white"
        >
          Logout
        </button>
      </div>
    </main>
  );
}