"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
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
      setError("Erreur login. Vérifiez l'email, le mot de passe ou l'API backend.");
    }
  }

  return (
    <AuthShell
      title="Connexion manager"
      description="Accès interne SLAIVIO pour les managers et opérateurs cargo."
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <label className="block">
          <div className="text-sm font-bold text-slate-700">Email</div>
          <input
            className="slaivo-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@slaivio.com"
            type="email"
          />
        </label>

        <label className="block">
          <div className="text-sm font-bold text-slate-700">Mot de passe</div>
          <input
            className="slaivo-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            type="password"
          />
        </label>

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
        >
          Se connecter
          <ArrowRight size={16} />
        </button>

        <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Vous utilisez Clerk ? Passez par{" "}
          <Link href="/sign-in" className="font-bold text-emerald-700">
            l’authentification sécurisée
          </Link>
          .
        </div>
      </form>
    </AuthShell>
  );
}
