"use client";

import { useMemo, useState } from "react";
import { useTracker } from "@/lib/useTracker";
import { fmt, num } from "@/lib/kpi";
import { RELEASE_STATUS, type Story } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import {
  Badge, Btn, Card, EmptyRow, ErrorBar, JiraLink, Loading, Metric, PageHead, ROW, Select,
  StatusSelect, Td, Th, filterCls,
} from "@/components/ui";

/**
 * Story yang development-nya sudah selesai tapi belum sampai production.
 * Ini "utang deploy" — hal yang paling sering hilang jejaknya di Excel,
 * karena tidak ada satu tempat pun yang menjawab: apa saja yang siap rilis?
 */
export default function DeployPage() {
  const { data, loading, error, setError, patch, reload } = useTracker();
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const base = data.stories.filter((s) => s.progress === "Done" && s.release_status !== "Deployed");
    return base
      .filter((s) => {
        if (bucket === "unassigned") return !s.release_id;
        if (bucket === "uat") return s.release_status === "Merging to UAT";
        return true;
      })
      .filter((s) => !q || `${s.title} ${s.jira_key ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => num(b.sprint) - num(a.sprint));
  }, [data.stories, bucket, q]);

  if (loading) return <Loading />;

  const all = data.stories.filter((s) => s.progress === "Done" && s.release_status !== "Deployed");
  const unassigned = all.filter((s) => !s.release_id);
  const points = all.reduce((a, s) => a + num(s.story_points), 0);
  const epicOf = (s: Story) => data.epics.find((e) => e.id === s.epic_id)?.name;
  const relOf = (id: string | null) => data.releases.find((r) => r.id === id)?.fix_version;

  const toggle = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };
  const toggleAll = () =>
    setPicked(picked.size === rows.length ? new Set() : new Set(rows.map((s) => s.id)));

  /** Assign banyak story sekaligus ke satu fix version — inti dari halaman ini. */
  const bulkAssign = async () => {
    if (!target || picked.size === 0) return;
    setBusy(true);
    const { error } = await supabase()
      .from("stories")
      .update({ release_id: target, release_status: "Merging to UAT" })
      .in("id", Array.from(picked));
    setBusy(false);
    if (error) return setError("Gagal assign: " + error.message);
    setPicked(new Set());
    setTarget("");
    await reload();
  };

  const bulkDeployed = async () => {
    if (picked.size === 0) return;
    setBusy(true);
    const { error } = await supabase()
      .from("stories")
      .update({ release_status: "Deployed" })
      .in("id", Array.from(picked));
    setBusy(false);
    if (error) return setError("Gagal update: " + error.message);
    setPicked(new Set());
    await reload();
  };

  return (
    <div>
      <PageHead
        title="Need to Deploy"
      >
        <input className={filterCls + " w-52"} placeholder="🔍 Cari story…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select
          w="w-56"
          value={bucket}
          onChange={setBucket}
          options={[
            { value: "all", label: "Semua yang belum deploy" },
            { value: "unassigned", label: "⚠️ Belum punya fix version" },
            { value: "uat", label: "🔀 Sedang di UAT" },
          ]}
        />
      </PageHead>

      <ErrorBar msg={error} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric v={all.length} k="Story menunggu deploy" icon="🚢" accent />
        <Metric v={points} k="Story point tertahan" icon="🔢" />
        <Metric v={unassigned.length} k="Belum punya fix version" icon="⚠️" />
        <Metric v={data.releases.filter((r) => r.status === "Planned").length} k="Release direncanakan" icon="🗓️" />
      </div>

      {/* Toolbar aksi massal muncul begitu ada yang dicentang */}
      {picked.size > 0 && (
        <div className="sticky top-[104px] z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ocean-200 bg-ocean-100 px-4 py-3">
          <span className="text-sm font-semibold text-ocean-700">{picked.size} story dipilih</span>
          <Select
            w="w-52"
            value={target}
            onChange={setTarget}
            options={[
              { value: "", label: "Pilih fix version…" },
              ...data.releases.map((r) => ({ value: r.id, label: `v${r.fix_version}` })),
            ]}
          />
          <Btn tone="solid" onClick={bulkAssign} disabled={!target || busy}>
            Assign ke release
          </Btn>
          <Btn onClick={bulkDeployed} disabled={busy}>✅ Tandai Deployed</Btn>
          <Btn onClick={() => setPicked(new Set())}>Batal</Btn>
        </div>
      )}

      <Card scroll offset="22rem">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th className="w-10">
                <input type="checkbox" checked={rows.length > 0 && picked.size === rows.length}
                  onChange={toggleAll} className="h-4 w-4 accent-ocean-600" />
              </Th>
              <Th>Story</Th>
              <Th className="w-24">Jira</Th>
              <Th className="w-48">Epic</Th>
              <Th className="w-16 text-right">Point</Th>
              <Th className="w-20 text-right">Sprint</Th>
              <Th className="w-28">End date</Th>
              <Th className="w-24">Fix ver.</Th>
              <Th className="w-44">Status release</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className={picked.has(s.id) ? "bg-sky-200/70" : ROW}>
                <Td>
                  <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)}
                    className="h-4 w-4 accent-ocean-600" />
                </Td>
                <Td className="text-ink-900">{s.title}</Td>
                <Td><JiraLink k={s.jira_key} /></Td>
                <Td className="text-xs text-mist-600">{epicOf(s) ?? "—"}</Td>
                <Td className="text-right font-mono text-xs">{s.story_points || "—"}</Td>
                <Td className="text-right font-mono text-xs">{s.sprint ?? "—"}</Td>
                <Td className="font-mono text-xs">{fmt(s.end_date)}</Td>
                <Td className="font-mono text-xs">
                  {relOf(s.release_id) ?? <span className="text-sun-600">⚠️ kosong</span>}
                </Td>
                <Td>
                  <StatusSelect value={s.release_status} options={RELEASE_STATUS}
                    onChange={(v) => patch("stories", s.id, { release_status: v })} />
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <EmptyRow cols={9} icon="🎉" msg="Nggak ada utang deploy. Semua story Done sudah sampai production." />
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
