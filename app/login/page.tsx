"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Btn, Field, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setError("");
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError("Email atau password salah.");
    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm rounded-xl border border-mist-200 bg-white p-8 shadow-card">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-ocean-600 text-base">📊</span>
          <h1 className="text-xl font-semibold tracking-tight">Project Tracker</h1>
        </div>
        <p className="mt-2 text-sm text-mist-600">
          Epic, story, release, dan dokumennya — dalam satu tempat.
        </p>

        <div className="mt-6 space-y-4">
          <Field label="Email">
            <input className={inputCls} type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()} />
          </Field>
          <Field label="Password">
            <input className={inputCls} type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()} />
          </Field>

          {error && <p className="rounded-lg bg-alert-100 px-3 py-2 text-sm text-alert-600">⚠️ {error}</p>}

          <Btn tone="accent" onClick={signIn} disabled={busy} className="w-full">
            {busy ? "Sebentar…" : "Masuk"}
          </Btn>

          <p className="text-xs text-mist-400">
            Belum punya akun? Minta admin nambahin lewat dashboard Supabase.
          </p>
        </div>
      </div>
    </main>
  );
}
