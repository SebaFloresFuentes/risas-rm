
"use client";

import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LogoutButton() {
  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("No se pudo cerrar la sesión. Inténtalo nuevamente.");
      return;
    }

    window.location.replace("/admin/login");
  }

  return (
    <button
      onClick={logout}
      className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-purple-400 hover:text-white"
    >
      Cerrar sesión
    </button>
  );
}
