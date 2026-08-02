"use client";

import { Fragment, useMemo, useState } from "react";
import { useTracker } from "@/lib/useTracker";
import { fmt, num } from "@/lib/kpi";
import { RELEASE_STATUS, STORY_PROGRESS, type Story } from "@/lib/types";
import {
  Badge, Btn, Card, EmptyRow, ErrorBar, Field, FormActions, JiraLink, Loading, Modal,
  PageHead, Progress, ROW, RowActions, Select, StatusSelect, Td, Th, filterCls, inputCls, optionsOf,
} from "@/components/ui";

type SortKey = "epic" | "sprint" | "point" | "judul";

const SORTS = [
  { value: "epic",   label: "📦 Epic" },
  { value: "sprint", label: "🏃 Sprint" },
  { value: "judul",  label: "🔤 Judul" },
];

/** Story yang belum kelar naik ke atas; yang Done turun ke bawah. */
const RANK: Record<Story["progress"], number> = { "In Dev": 0, Todo: 1, Done: 2 };

/** Story tanpa sprint selalu di paling bawah saat diurutkan per sprint. */
const bySprintDesc = (a: Story, b: Story) => {
  const na = a.sprint == null, nb = b.sprint == null;
  if (na !== nb) return na ? 1 : -1;
  return num(b.sprint) - num(a.sprint) || RANK[a.progress] - RANK[b.progress];
};

/** DLB-6867 sebelum DLB-24511: dibandingkan sebagai angka, bukan teks. */
const keyNo = (s: Story) => num(s.jira_key?.split("-")[1]) || Number.MAX_SAFE_INTEGER;
const byJiraKey = (a: Story, b: Story) => keyNo(a) - keyNo(b);

const blank = (): Partial<Story> => ({
  epic_id: null, task_group: "", title: "", jira_key: "", story_points: 0,
  sprint: null, start_date: null, end_date: null, progress: "Todo",
  release_id: null, release_status: "-",
});

export default function StoriesPage() {
  const { data, loading, error, save, remove, patch } = useTracker();
  const [epicF, setEpicF] = useState("all");
  const [progF, setProgF] = useState("all");
  const [sort, setSort] = useState<SortKey>("sprint");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Partial<Story> | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const epicById = useMemo(() => Object.fromEntries(data.epics.map((e) => [e.id, e])), [data.epics]);

  /** true kalau sedang difilter ke satu epic tertentu. */
  const single = epicF !== "all" && epicF !== "none";

  const filtered = useMemo(
    () =>
      data.stories.filter(
        (s) =>
          (epicF === "all" || (epicF === "none" ? !s.epic_id : s.epic_id === epicF)) &&
          (progF === "all" || s.progress === progF) &&
          (!q || `${s.title} ${s.jira_key ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      ),
    [data.stories, epicF, progF, q]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Story[]>();
    filtered.forEach((s) => {
      const k = s.epic_id ?? "none";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    });
    return Array.from(map.entries())
      .sort((a, b) => {
        const ea = epicById[a[0]], eb = epicById[b[0]];
        if (!ea) return 1;
        if (!eb) return -1;
        return eb.created_at.localeCompare(ea.created_at);
      })
      .map(([id, list]) => ({
        id,
        epic: epicById[id],
        // Saat sudah difilter ke satu epic, urutan nomor tiket lebih berguna
        // daripada urutan progress — story-nya memang dibaca berurutan.
        stories: [...list].sort(
          single ? byJiraKey : (a, b) => RANK[a.progress] - RANK[b.progress] || bySprintDesc(a, b)
        ),
      }));
  }, [filtered, epicById, single]);

  const flat = useMemo(() => {
    const list = [...filtered];
    if (single) return list.sort(byJiraKey);
    if (sort === "sprint") list.sort(bySprintDesc);
    if (sort === "point") list.sort((a, b) => RANK[a.progress] - RANK[b.progress] || num(b.story_points) - num(a.story_points));
    if (sort === "judul") list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [filtered, sort, single]);

  if (loading) return <Loading />;

  const relOf = (id: string | null) => data.releases.find((r) => r.id === id)?.fix_version;

  const submit = async () => {
    if (!form?.title) return;
    const row: Record<string, unknown> = { ...form };
    (["start_date", "end_date", "jira_key", "epic_id", "release_id"] as const).forEach((k) => {
      if (!row[k]) row[k] = null;
    });
    row.story_points = num(form.story_points);
    row.sprint = form.sprint ? num(form.sprint) : null;
    if (await save("stories", row)) setForm(null);
  };

  const toggleGroup = (id: string) => {
    const next = new Set(closed);
    next.has(id) ? next.delete(id) : next.add(id);
    setClosed(next);
  };

  const Row = ({ s }: { s: Story }) => (
    <tr className={`${ROW} ${s.progress === "Done" ? "bg-mist-50/60" : ""}`}>
      <Td className={s.progress === "Done" ? "text-mist-600" : "text-ink-900"}>{s.title}</Td>
      <Td><JiraLink k={s.jira_key} /></Td>
      <Td className="text-right font-mono text-xs">{s.story_points || "—"}</Td>
      <Td className="text-right font-mono text-xs">{s.sprint ?? "—"}</Td>
      <Td className="font-mono text-xs">{fmt(s.end_date)}</Td>
      <Td>
        <StatusSelect
          value={s.progress}
          options={STORY_PROGRESS}
          onChange={(v) => patch("stories", s.id, { progress: v })}
        />
      </Td>
      <Td className="font-mono text-xs">{relOf(s.release_id) ?? "—"}</Td>
      <Td>
        <StatusSelect
          value={s.release_status}
          options={RELEASE_STATUS}
          onChange={(v) => patch("stories", s.id, { release_status: v })}
        />
      </Td>
      <Td>
        <RowActions onEdit={() => setForm(s)} onDelete={() => confirm(`Hapus story "${s.title}"?`) && remove("stories", s.id)} />
      </Td>
    </tr>
  );

  const HEAD = (
    <tr>
      <Th>Story</Th>
      <Th className="w-24">Jira</Th>
      <Th className="w-16 text-right">Point</Th>
      <Th className="w-20 text-right">Sprint</Th>
      <Th className="w-28">End date</Th>
      <Th className="w-36">Progress</Th>
      <Th className="w-24">Fix ver.</Th>
      <Th className="w-44">Status release</Th>
      <Th className="w-20" />
    </tr>
  );

  return (
    <div>
      <PageHead
        title="Story"
      >
        <input className={filterCls + " w-52"} placeholder="🔍 Cari story / DLB-…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select w="w-52" value={epicF} onChange={setEpicF}
          options={[
            { value: "all", label: "Semua epic" },
            { value: "none", label: "⚠️ Belum punya epic" },
            ...data.epics.map((e) => ({ value: e.id, label: e.name })),
          ]} />
        <Select w="w-40" value={progF} onChange={setProgF}
          options={[{ value: "all", label: "Semua progress" }, ...optionsOf(STORY_PROGRESS)]} />
        <Select w="w-48" value={sort} onChange={(v) => setSort(v as SortKey)} options={SORTS} />
        <Btn tone="accent" onClick={() => setForm(blank())}>+ Story</Btn>
      </PageHead>

      <ErrorBar msg={error} />

      <Card scroll offset="12rem">
        <table className="w-full border-collapse">
          <thead>{HEAD}</thead>
          <tbody>
            {sort === "epic" &&
              grouped.map((g) => {
                const pts = g.stories.reduce((a, s) => a + num(s.story_points), 0);
                const done = g.stories.filter((s) => s.progress === "Done").reduce((a, s) => a + num(s.story_points), 0);
                const open = !closed.has(g.id);
                return (
                  <Fragment key={g.id}>
                    <tr>
                      <td colSpan={9} className="border-b border-mist-200 bg-ink-900 p-0">
                        <button onClick={() => toggleGroup(g.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-800">
                          <span className="font-mono text-xs text-sky-400">{open ? "▾" : "▸"}</span>
                          <span className="text-sm font-semibold text-white">
                            {g.epic ? `📦 ${g.epic.name}` : "⚠️ Belum punya epic"}
                          </span>
                          <span className="font-mono text-[10px] text-sky-200/70">
                            {g.stories.length} story · {done}/{pts} pt
                          </span>
                          <span className="ml-auto w-32">
                            <Progress pct={pts ? (done / pts) * 100 : 0} tone="bg-sun-500" />
                          </span>
                        </button>
                      </td>
                    </tr>
                    {open && g.stories.map((s) => <Row key={s.id} s={s} />)}
                  </Fragment>
                );
              })}

            {sort !== "epic" && flat.map((s) => <Row key={s.id} s={s} />)}

            {filtered.length === 0 && <EmptyRow cols={9} icon="📝" msg="Nggak ada story yang cocok dengan filter ini." />}
          </tbody>
        </table>
      </Card>

      {form && (
        <Modal title={form.id ? "Ubah story" : "Story baru"} onClose={() => setForm(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Epic">
                <Select full value={form.epic_id ?? ""} onChange={(v) => setForm({ ...form, epic_id: v || null })}
                  options={[{ value: "", label: "— belum di-set —" }, ...data.epics.map((e) => ({ value: e.id, label: e.name }))]} />
              </Field>
              <Field label="Task list (grup)" hint="Opsional. Contoh: Appraisal Portal Phase 0: Base Feature">
                <input className={inputCls} value={form.task_group ?? ""} onChange={(e) => setForm({ ...form, task_group: e.target.value })} />
              </Field>
            </div>

            <Field label="Judul story">
              <input className={inputCls} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Jira key">
                <input className={inputCls + " font-mono"} value={form.jira_key ?? ""}
                  onChange={(e) => setForm({ ...form, jira_key: e.target.value.toUpperCase() })} placeholder="DLB-13758" />
              </Field>
              <Field label="Story point">
                <input type="number" className={inputCls} value={form.story_points ?? 0}
                  onChange={(e) => setForm({ ...form, story_points: Number(e.target.value) })} />
              </Field>
              <Field label="Sprint">
                <input type="number" className={inputCls} value={form.sprint ?? ""}
                  onChange={(e) => setForm({ ...form, sprint: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <Field label="Progress">
                <Select full value={form.progress ?? "Todo"}
                  onChange={(v) => setForm({ ...form, progress: v as Story["progress"] })} options={optionsOf(STORY_PROGRESS)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date">
                <input type="date" className={inputCls} value={form.start_date ?? ""}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </Field>
              <Field label="End date" hint="Tanggal ini yang dipakai untuk hitung KPI semester.">
                <input type="date" className={inputCls} value={form.end_date ?? ""}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Fix version">
                <Select full value={form.release_id ?? ""} onChange={(v) => setForm({ ...form, release_id: v || null })}
                  options={[{ value: "", label: "— belum masuk release —" }, ...data.releases.map((r) => ({ value: r.id, label: `v${r.fix_version}` }))]} />
              </Field>
              <Field label="Status release">
                <Select full value={form.release_status ?? "-"}
                  onChange={(v) => setForm({ ...form, release_status: v as Story["release_status"] })} options={optionsOf(RELEASE_STATUS)} />
              </Field>
            </div>

            <FormActions onClose={() => setForm(null)} onSave={submit} />
          </div>
        </Modal>
      )}
    </div>
  );
}
