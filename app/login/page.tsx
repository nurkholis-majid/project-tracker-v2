"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Btn, Field, inputCls } from "@/components/ui";
import { Icon } from "@/components/icons";

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
    if (error) return setError("Incorrect email or password.");
    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm rounded-xl border border-mist-200 bg-white p-8 shadow-card">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-ocean-600 text-white"><Icon name="dashboard" className="h-5 w-5" /></span>
          <h1 className="text-xl font-semibold tracking-tight">Project Tracker</h1>
        </div>
        <p className="mt-2 text-sm text-mist-600">
          Epics, stories, releases, and their docs \u2014 all in one place.
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

          {error && <p className="flex items-center gap-1.5 rounded-lg bg-alert-100 px-3 py-2 text-sm text-alert-600"><Icon name="warn" className="h-4 w-4 shrink-0" /> {error}</p>}

          <Btn tone="accent" onClick={signIn} disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Btn>

          <p className="text-xs text-mist-400">
            No account yet? Ask an admin to add you from the Supabase dashboard.
          </p>
        </div>
      </div>
    </main>
  );
}
