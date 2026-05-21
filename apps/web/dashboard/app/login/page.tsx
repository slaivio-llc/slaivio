"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { loginManager } from "@/services/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@slaivo.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();

    setError("");

    try {
      const result = await loginManager(email, password);

      localStorage.setItem("slaivo_token", result.access_token);
      localStorage.setItem("slaivo_manager", JSON.stringify(result.manager));

      router.push("/");
    } catch (error) {
      console.error("LOGIN_ERROR", error);
      setError("Erreur login. Regarde la console navigateur.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-2xl border bg-background p-8 shadow-sm"
      >
        <h1 className="text-3xl font-bold">
          SLAIVO
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Connectez-vous à votre espace agence.
        </p>

        <div className="mt-6 space-y-4">
          <input
            className="w-full rounded-xl border px-4 py-3"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            type="email"
          />

          <input
            className="w-full rounded-xl border px-4 py-3"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            type="password"
          />

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white"
          >
            Se connecter
          </button>
        </div>
      </form>
    </main>
  );
}
