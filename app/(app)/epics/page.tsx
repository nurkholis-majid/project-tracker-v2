"use client";

import { useMemo, useState } from "react";
import { useTracker } from "@/lib/useTracker";
import { epicStats, fmt, num } from "@/lib/kpi";
import { EPIC_STATUS, STORY_PROGRESS, labelOf, type Epic, type Story } from "@/lib/types";
import { epicWindow } from "@/lib/kpi";
import {
  Badge, Btn, Card, EmptyRow, ErrorBar, Field, FormActions, JiraLink, Loading, Modal,
  PageHead, Progress, ROW, RowActions, Select, StatusSelect, Td, Th, filterCls, inputCls, optionsOf,
} from "@/components/ui";

type SortKey = "baru" | "nama" | "point" | "deadline";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "baru",     label: "🕘 Terbaru dibuat" },
  { value: "deadline", label: "⏰ End date terdekat" },
  { value: "point",    label: "🔢 Story point terbanyak" },
  { value: "nama",     label: "🔤 Nama A–Z" },
];

const blank = (): Partial<Epic> => ({
  name: "", jira_key: "", status: "Requirement",
  start_date: null, end_date: null, est_deploy: null, notes: "",
});

export default function EpicsPage() {
  const { data, loading, error, save, remove, patch } = useTracker();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("baru");
  const [form, setForm] = useState<Partial<Epic> | null>(null);
  const [detail, setDetail] = useState<Epic | null>(null);

  const stats = useMemo(() => epicStats(data), [data]);

  const rows = useMemo(() => {
    const list = data.epics.filter(
      (e) =>
        (status === "all" || e.status === status) &&
        (!q || `${e.name} ${e.jira_key ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    );
    const sorted = [...list];
    if (sort === "baru") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === "nama") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "point") sorted.sort((a, b) => num(stats[b.id]?.points) - num(stats[a.id]?.points));
    if (sort === "deadline")
      sorted.sort((a, b) => (a.end_date || "9999").localeCompare(b.end_date || "9999"));
    return sorted;
  }, [data.epics, status, sort, stats, q]);

  if (loading) return <Loading />;

  const submit = async () => {
    if (!form?.name) return;
    const row: Record<string, unknown> = { ...form };
    (["start_date", "end_date", "est_deploy", "jira_key"] as const).forEach((k) => {
      if (!row[k]) row[k] = null;
    });
    if (await save("epics", row)) setForm(null);
  };

  return (
    <div>
      <PageHead
        title="Epic"
      >
        <input
          className={filterCls + " w-56"}
          placeholder="🔍 Cari epic / DLB-…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          w="w-44"
          value={status}
          onChange={setStatus}
          options={[{ value: "all", label: "Semua status" }, ...optionsOf(EPIC_STATUS)]}
        />
        <Select
          w="w-52"
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
        />
        <Btn tone="accent" onClick={() => setForm(blank())}>+ Epic</Btn>
      </PageHead>

      <ErrorBar msg={error} />

      <Card scroll offset="12rem">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>Epic</Th>
              <Th className="w-28">Jira</Th>
              <Th className="w-40">Progress</Th>
              <Th className="w-40">Status</Th>
              <Th className="w-28">Start</Th>
              <Th className="w-28">End</Th>
              <Th className="w-32">Est. deploy</Th>
              <Th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const st = stats[e.id] ?? { total: 0, points: 0, done: 0, donePoints: 0 };
              const pct = st.points ? Math.round((st.donePoints / st.points) * 100) : 0;
              const win = epicWindow(e, data.stories);
              return (
                <tr key={e.id} className={`group ${ROW}`}>
                  <Td>
                    <button
                      onClick={() => setDetail(e)}
                      className="text-left font-medium text-ink-900 hover:text-ocean-600 hover:underline"
                    >
                      {e.name}
                    </button>
                    <div className="mt-0.5 text-xs text-mist-400">
                      {st.done}/{st.total} story · {st.donePoints}/{st.points} pt · klik untuk lihat story-nya
                    </div>
                  </Td>
                  <Td><JiraLink k={e.jira_key} /></Td>
                  <Td>
                    <Progress pct={pct} />
                    <div className="mt-1 font-mono text-[10px] text-mist-400">{pct}%</div>
                  </Td>
                  <Td>
                    <StatusSelect
                      value={e.status}
                      options={EPIC_STATUS}
                      onChange={(v) => patch("epics", e.id, { status: v })}
                    />
                  </Td>
                  <Td className="font-mono text-xs">
                    {e.start_date ? (
                      fmt(e.start_date)
                    ) : win.start ? (
                      <span className="text-mist-400" title="Diturunkan dari tanggal story">{fmt(win.start)} · auto</span>
                    ) : (
                      <span className="text-sun-600">⚠️ kosong</span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">
                    {e.end_date ? fmt(e.end_date)
                      : win.end ? <span className="text-mist-400" title="Diturunkan dari tanggal story">{fmt(win.end)} · auto</span>
                      : "—"}
                  </Td>
                  <Td className="font-mono text-xs">{fmt(e.est_deploy)}</Td>
                  <Td>
                    <RowActions
                      onEdit={() => setForm(e)}
                      onDelete={() =>
                        confirm(`Hapus epic "${e.name}"? Story-nya tetap ada, cuma lepas dari epic ini.`) &&
                        remove("epics", e.id)
                      }
                    />
                  </Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <EmptyRow cols={8} icon="📦" msg="Nggak ada epic yang cocok. Coba ubah kata kunci atau filternya." />
            )}
          </tbody>
        </table>
      </Card>

      {detail && (
        <EpicDetail
          epic={detail}
          stories={data.stories.filter((s) => s.epic_id === detail.id)}
          releases={data.releases}
          onClose={() => setDetail(null)}
          onEdit={() => { setForm(detail); setDetail(null); }}
          onPatch={(id, changes) => patch("stories", id, changes)}
        />
      )}

      {form && (
        <Modal
          title={form.id ? "Ubah epic" : "Epic baru"}
          subtitle="Start & end date menentukan epic ini masuk hitungan semester yang mana."
          onClose={() => setForm(null)}
        >
          <div className="space-y-4">
            <Field label="Nama epic">
              <input className={inputCls} value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="[New Customer] Appraisal Web - Phase 0 : Base Feature" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Jira key">
                <input className={inputCls + " font-mono"} value={form.jira_key ?? ""}
                  onChange={(e) => setForm({ ...form, jira_key: e.target.value.toUpperCase() })}
                  placeholder="DLB-13753" />
              </Field>
              <Field label="Status">
                <Select
                  value={form.status ?? "Requirement"}
                  onChange={(v) => setForm({ ...form, status: v as Epic["status"] })}
                  options={optionsOf(EPIC_STATUS)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Start date">
                <input type="date" className={inputCls} value={form.start_date ?? ""}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </Field>
              <Field label="End date">
                <input type="date" className={inputCls} value={form.end_date ?? ""}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </Field>
              <Field label="Est. deploy">
                <input type="date" className={inputCls} value={form.est_deploy ?? ""}
                  onChange={(e) => setForm({ ...form, est_deploy: e.target.value })} />
              </Field>
            </div>

            <Field label="Notes" hint="Perubahan scope, keputusan rapat — hal yang bakal lupa 3 bulan lagi.">
              <textarea rows={3} className={inputCls} value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder='21 Jan: nama menu diubah jadi "Customer Claim"' />
            </Field>

            <FormActions onClose={() => setForm(null)} onSave={submit} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Modal detail: semua story milik satu project.
   Yang belum selesai ditaruh di atas — itu yang butuh perhatian.
--------------------------------------------------------------------- */
function EpicDetail({
  epic, stories, releases, onClose, onEdit, onPatch,
}: {
  epic: Epic;
  stories: Story[];
  releases: { id: string; fix_version: string }[];
  onClose: () => void;
  onEdit: () => void;
  onPatch: (id: string, changes: Record<string, unknown>) => void;
}) {
  const rank = { "In Dev": 0, Todo: 1, Done: 2 } as const;
  const sorted = [...stories].sort(
    (a, b) => rank[a.progress] - rank[b.progress] || num(b.sprint) - num(a.sprint)
  );
  const points = stories.reduce((a, s) => a + num(s.story_points), 0);
  const donePoints = stories.filter((s) => s.progress === "Done").reduce((a, s) => a + num(s.story_points), 0);
  const relOf = (id: string | null) => releases.find((r) => r.id === id)?.fix_version;

  return (
    <Modal
      wide
      title={epic.name}
      subtitle={`${labelOf(epic.status)} · ${fmt(epic.start_date)} – ${fmt(epic.end_date)} · ${donePoints}/${points} pt done`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge v={epic.status} />
          <JiraLink k={epic.jira_key} />
          <div className="ml-auto flex gap-2">
            <Btn onClick={onEdit}>✏️ Ubah epic</Btn>
          </div>
        </div>

        {epic.notes && (
          <div className="rounded-xl bg-sun-100 px-3 py-2 text-sm text-ink-700">📌 {epic.notes}</div>
        )}

        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-mist-200">
          <table className="w-full border-collapse">
            <thead className="sticky top-0">
              <tr>
                <Th>Story</Th>
                <Th className="w-24">Jira</Th>
                <Th className="w-16 text-right">Point</Th>
                <Th className="w-20 text-right">Sprint</Th>
                <Th className="w-36">Progress</Th>
                <Th className="w-24">Fix version</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className={`${ROW} ${s.progress === "Done" ? "bg-mist-50/60" : ""}`}>
                  <Td className="text-ink-900">{s.title}</Td>
                  <Td><JiraLink k={s.jira_key} /></Td>
                  <Td className="text-right font-mono text-xs">{s.story_points || "—"}</Td>
                  <Td className="text-right font-mono text-xs">{s.sprint ?? "—"}</Td>
                  <Td>
                    <StatusSelect value={s.progress} options={STORY_PROGRESS}
                      onChange={(v) => onPatch(s.id, { progress: v })} />
                  </Td>
                  <Td className="font-mono text-xs">{relOf(s.release_id) ?? "—"}</Td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <EmptyRow cols={6} icon="📝" msg="Epic ini belum punya story." />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
