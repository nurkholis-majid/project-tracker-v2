"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SyncRun } from "@/lib/types";
import { CreateBtn, Btn, Card, EmptyRow, ErrorBar, Field, Label, Loading, PageHead, Td, Th, inputCls } from "@/components/ui";
import { Icon } from "@/components/icons";

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
      if (!res.ok) setError(json.error ?? "Sync failed.");
      else if (json.total === 0)
        setError(json.hint ?? "This JQL returned no issues.");
      else if (json.stories === 0 && json.epics === 0)
        // Issue datang tapi tak ada yang tersimpan — tampilkan rinciannya.
        setError(json.hint ?? `Jira returned ${json.total} issues but none were saved.`);
      else
        setResult(
          `Done — ${json.epics} epics and ${json.stories} stories updated from ${json.total} issues.` +
            (json.unlinked ? ` ${json.unlinked} stories could not be matched to an epic.` : "")
        );
    } catch (e: any) {
      setError("Sync failed: " + e.message);
    }
    setBusy(false);
    loadRuns();
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Jira Sync"
        sub="Pulls epics and stories from Jira. Read-only — nothing in Jira is changed."
      />

      <ErrorBar msg={error} />

      <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="space-y-5 p-5">
          <Field label="JQL" hint="Leave empty to use the default query. Example: project = DLB AND Sprint in (64, 65)">
            <input className={inputCls + " font-mono"} value={jql} onChange={(e) => setJql(e.target.value)}
              placeholder="project = DLB ORDER BY updated DESC" />
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-mist-50 p-3">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-ocean-600" />
            <span className="text-sm text-ink-700">
              Overwrite progress from Jira status
              <span className="block text-xs text-mist-600">
                Issues Done in Jira become Done here. Turn this off to manage progress manually.
              </span>
            </span>
          </label>

          <div className="rounded-xl border border-sky-200 bg-sky-100 p-3 text-xs text-ink-700">
            <div className="mb-1 flex items-center gap-1.5 font-semibold"><Icon name="lock" className="h-3.5 w-3.5" /> Safe — never overwritten:</div>
            task list (group), fix version, release status, document URLs, notes, epic start &amp; end dates,
            epic status, and feature flags. None of these exist in Jira.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CreateBtn tone="accent" onClick={run} disabled={busy}>
              {busy ? "Pulling data…" : <span className="inline-flex items-center gap-1.5"><Icon name="sync" className="h-4 w-4" /> Pull now</span>}
            </CreateBtn>
            {result && <span className="text-sm text-ocean-600">{result}</span>}
          </div>
        </div>
      </Card>

      <section>
        <Label>History</Label>
        <div className="mt-2">
          <Card>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th className="w-44">When</Th>
                  <Th>JQL</Th>
                  <Th className="w-20 text-right">Epic</Th>
                  <Th className="w-20 text-right">Story</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-mono text-xs">{new Date(r.ran_at).toLocaleString("en-GB")}</Td>
                    <Td className="font-mono text-xs text-mist-600">{r.jql}</Td>
                    <Td className="text-right font-mono text-xs">{r.epics_upsert}</Td>
                    <Td className="text-right font-mono text-xs">{r.stories_upsert}</Td>
                  </tr>
                ))}
                {runs.length === 0 && <EmptyRow cols={4} icon="🔄" msg="No syncs yet." />}
              </tbody>
            </table>
          </Card>
        </div>
      </section>
      </div>
    </div>
  );
}
