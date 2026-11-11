
"use client";

import { useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError("No fue posible iniciar sesión. Revisa tus credenciales.");
      setLoading(false);
      return;
    }

    window.location.assign("/admin");
  }

  return (
    <main className="flex min-h-[75vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#181720] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400">
            Risas RM
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">
            Administración
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Ingresa con tu cuenta autorizada.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-zinc-300">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0d0d15] px-4 py-3 text-white outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-zinc-300">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0d0d15] px-4 py-3 text-white outline-none focus:border-purple-400"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-purple-400 px-5 py-3 font-bold text-purple-950 transition hover:bg-purple-300 disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </main>
  );
}
