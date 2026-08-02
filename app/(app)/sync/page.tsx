"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SyncRun } from "@/lib/types";
import { Btn, Card, EmptyRow, ErrorBar, Field, Label, Loading, PageHead, Td, Th, inputCls } from "@/components/ui";

export default function SyncPage() {
  const sb = useMemo(() => supabase(), []);
  const [jql, setJql] = useState("");
  const [overwrite, setOverwrite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [runs, setRuns] = useState<SyncRun[]>([]);

  const loadRuns = async () => {
    const { data } = await sb.from("sync_runs").select("*").order("ran_at", { ascending: false }).limit(10);
    setRuns((data ?? []) as SyncRun[]);
  };

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    setBusy(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/api/jira/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jql: jql.trim() || undefined, overwriteProgress: overwrite }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Sync gagal.");
      else if (json.total === 0)
        setError(json.hint ?? "JQL ini tidak menghasilkan issue apa pun.");
      else if (json.stories === 0 && json.epics === 0)
        // Issue datang tapi tak ada yang tersimpan — tampilkan rinciannya.
        setError(json.hint ?? `Jira mengembalikan ${json.total} issue tapi tidak ada yang tersimpan.`);
      else
        setResult(
          `✅ Beres — ${json.epics} epic dan ${json.stories} story diperbarui dari ${json.total} issue.` +
            (json.unlinked ? ` ${json.unlinked} story belum ketemu epic-nya.` : "")
        );
    } catch (e: any) {
      setError("Sync gagal: " + e.message);
    }
    setBusy(false);
    loadRuns();
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Jira Sync"
        sub="Menarik epic dan story dari Jira. Bersifat read-only — tidak ada data di Jira yang diubah."
      />

      <ErrorBar msg={error} />

      <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="space-y-5 p-5">
          <Field label="JQL" hint="Kosongkan untuk pakai query default. Contoh: project = DLB AND Sprint in (64, 65)">
            <input className={inputCls + " font-mono"} value={jql} onChange={(e) => setJql(e.target.value)}
              placeholder="project = DLB ORDER BY updated DESC" />
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-mist-50 p-3">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-ocean-600" />
            <span className="text-sm text-ink-700">
              Timpa progress dari status Jira
              <span className="block text-xs text-mist-600">
                Issue yang Done di Jira jadi Done di sini. Matikan kalau progress mau diatur manual.
              </span>
            </span>
          </label>

          <div className="rounded-xl border border-sky-200 bg-sky-100 p-3 text-xs text-ink-700">
            <div className="mb-1 font-semibold">🔒 Yang aman, nggak akan ketimpa:</div>
            task list (grup), fix version, status release, URL dokumen, notes, start &amp; end date epic,
            status epic, dan feature flag. Semua itu data yang Jira nggak punya.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Btn tone="accent" onClick={run} disabled={busy}>
              {busy ? "⏳ Lagi narik data…" : "🔄 Tarik sekarang"}
            </Btn>
            {result && <span className="text-sm text-ocean-600">{result}</span>}
          </div>
        </div>
      </Card>

      <section>
        <Label>Riwayat</Label>
        <div className="mt-2">
          <Card>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th className="w-44">Kapan</Th>
                  <Th>JQL</Th>
                  <Th className="w-20 text-right">Epic</Th>
                  <Th className="w-20 text-right">Story</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-mono text-xs">{new Date(r.ran_at).toLocaleString("id-ID")}</Td>
                    <Td className="font-mono text-xs text-mist-600">{r.jql}</Td>
                    <Td className="text-right font-mono text-xs">{r.epics_upsert}</Td>
                    <Td className="text-right font-mono text-xs">{r.stories_upsert}</Td>
                  </tr>
                ))}
                {runs.length === 0 && <EmptyRow cols={4} icon="🔄" msg="Belum pernah sync." />}
              </tbody>
            </table>
          </Card>
        </div>
      </section>
      </div>
    </div>
  );
}
