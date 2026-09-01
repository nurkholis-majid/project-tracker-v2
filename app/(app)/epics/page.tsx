"use client";

import { useMemo, useState } from "react";
import { useTracker } from "@/lib/useTracker";
import { epicStats, fmt, num } from "@/lib/kpi";
import { EPIC_STATUS, STORY_PROGRESS, type Epic, type Story, type Flag } from "@/lib/types";
import { epicWindow } from "@/lib/kpi";
import { catList } from "@/lib/category";
import { CreateBtn, CatBadge, Combobox,
  Badge, Btn, Card, EmptyRow, ErrorBar, Field, FormActions, JiraLink, Loading, Modal,
  PageHead, Progress, ROW, RowActions, Select, StatusSelect, Td, Th, filterCls, inputCls, optionsOf,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

type SortKey = "baru" | "nama" | "point" | "deadline" | "start";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "baru",     label: "Newest" },
  { value: "deadline", label: "Nearest end date" },
  { value: "point",    label: "Most story points" },
  { value: "nama",     label: "Name A–Z" },
  { value: "start",    label: "Start date, then Jira" },
];

const blank = (): Partial<Epic> => ({
  name: "", jira_key: "", category: null, status: "Requirement",
  start_date: null, end_date: null, est_deploy: null, notes: "",
});

// Numeric part of a Jira key (DLB-25997 -> 25997); missing keys sort last.
const jiraNo = (k: string | null) => { const m = (k ?? "").match(/(\d+)/); return m ? parseInt(m[1], 10) : Infinity; };

export default function EpicsPage() {
  const { data, loading, error, save, remove, patch } = useTracker();
  const [status, setStatus] = useState("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("baru");
  const [form, setForm] = useState<Partial<Epic> | null>(null);
  const [detail, setDetail] = useState<Epic | null>(null);

  const stats = useMemo(() => epicStats(data), [data]);

  const rows = useMemo(() => {
    const list = data.epics.filter(
      (e) =>
        (status === "all" || e.status === status) &&
        (cat === "all" || (e.category ?? "") === cat) &&
        (!q || `${e.name} ${e.jira_key ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    );
    const sorted = [...list];
    if (sort === "baru") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === "nama") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "point") sorted.sort((a, b) => num(stats[b.id]?.points) - num(stats[a.id]?.points));
    if (sort === "deadline")
      sorted.sort((a, b) => (a.end_date || "9999").localeCompare(b.end_date || "9999"));
    if (sort === "start")
      sorted.sort((a, b) =>
        (a.start_date || "9999").localeCompare(b.start_date || "9999") ||
        jiraNo(a.jira_key) - jiraNo(b.jira_key)
      );
    return sorted;
  }, [data.epics, status, cat, sort, stats, q]);

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
          placeholder="Search epics / DLB-…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          w="w-44"
          value={status}
          onChange={setStatus}
          options={[{ value: "all", label: "All statuses" }, ...optionsOf(EPIC_STATUS)]}
        />
        <Select
          w="w-44"
          value={cat}
          onChange={setCat}
          options={[{ value: "all", label: "All categories" }, ...catList(data.epics).map((c) => ({ value: c, label: c }))]}
        />
        <Select
          w="w-52"
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
        />
        <CreateBtn onClick={() => setForm(blank())}>+ Epic</CreateBtn>
      </PageHead>

      <ErrorBar msg={error} />

      <Card scroll offset="12rem">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>Epic</Th>
              <Th className="w-40">Category</Th>
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
                      {st.done}/{st.total} stories · {st.donePoints}/{st.points} pt · click to see its stories
                    </div>
                  </Td>
                  <Td><CatBadge name={e.category} /></Td>
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
                      <span className="text-mist-400" title="Derived from story dates">{fmt(win.start)} · auto</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sun-600"><Icon name="warn" className="h-3.5 w-3.5" /> none</span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">
                    {e.end_date ? fmt(e.end_date)
                      : win.end ? <span className="text-mist-400" title="Derived from story dates">{fmt(win.end)} · auto</span>
                      : "—"}
                  </Td>
                  <Td className="font-mono text-xs">{fmt(e.est_deploy)}</Td>
                  <Td>
                    <RowActions
                      onEdit={() => setForm(e)}
                      onDelete={() =>
                        confirm(`Delete epic "${e.name}"? Its stories stay, they just detach from this epic.`) &&
                        remove("epics", e.id)
                      }
                    />
                  </Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <EmptyRow cols={8} icon="📦" msg="No epics match. Try changing the keyword or filter." />
            )}
          </tbody>
        </table>
      </Card>

      {detail && (
        <EpicDetail
          epic={detail}
          stories={data.stories.filter((s) => s.epic_id === detail.id)}
          releases={data.releases}
          flags={data.flags.filter((f) => (f.epic_ids ?? []).includes(detail.id))}
          onClose={() => setDetail(null)}
          onEdit={() => { setForm(detail); setDetail(null); }}
          onPatch={(id, changes) => patch("stories", id, changes)}
        />
      )}

      {form && (
        <Modal
          title={form.id ? "Edit epic" : "New epic"}
          subtitle="Start and end dates decide which semester this epic counts toward."
          onClose={() => setForm(null)}
        >
          <div className="space-y-4">
            <Field label="Epic name">
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

            <Field label="Category" hint="Pick an existing category or type a new one to create it.">
              <Combobox full creatable
                value={form.category ?? ""}
                onChange={(v) => setForm({ ...form, category: v || null })}
                placeholder="Search or add a category…"
                options={[{ value: "", label: "— no category —" }, ...catList(data.epics).map((c) => ({ value: c, label: c }))]}
              />
            </Field>

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

            <Field label="Notes" hint="Scope changes, meeting decisions — things you’ll forget in 3 months.">
              <textarea rows={3} className={inputCls} value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder='Jan 21: menu renamed to "Customer Claim"' />
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
  epic, stories, releases, flags, onClose, onEdit, onPatch,
}: {
  epic: Epic;
  stories: Story[];
  releases: { id: string; fix_version: string; deploy_date?: string | null }[];
  flags: Flag[];
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
  const doneCount = stories.filter((s) => s.progress === "Done").length;
  const relOf = (id: string | null) => releases.find((r) => r.id === id)?.fix_version;

  // Releases actually used by this epic's stories carry the real deploy dates.
  const usedReleases = releases.filter((r) => stories.some((s) => s.release_id === r.id));
  const deployDates = usedReleases.map((r) => r.deploy_date).filter(Boolean) as string[];
  const actualDeploy = deployDates.length ? fmt([...deployDates].sort().at(-1)) : "—";

  return (
    <Modal
      wide
      title={epic.name}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge v={epic.status} />
          <JiraLink k={epic.jira_key} />
          <div className="ml-auto flex gap-2">
            <Btn onClick={onEdit}><span className="inline-flex items-center gap-1.5"><Icon name="edit" className="h-4 w-4" /> Edit epic</span></Btn>
          </div>
        </div>

        {/* key dates */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetaCell icon="calendar" label="Start" value={fmt(epic.start_date)} />
          <MetaCell icon="target" label="End" value={fmt(epic.end_date)} />
          <MetaCell icon="clock" label="Est. deploy" value={fmt(epic.est_deploy)} />
          <MetaCell icon="deploy" label="Actual deploy" value={actualDeploy} />
        </div>

        {/* progress + releases */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mist-600">
          <span><span className="font-semibold text-ink-800">{doneCount}/{stories.length}</span> stories done</span>
          <span><span className="font-semibold text-ink-800">{donePoints}/{points}</span> points done</span>
          {usedReleases.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1">
              <span className="text-mist-500">Releases:</span>
              {usedReleases.map((r) => (
                <span key={r.id} className="rounded-full bg-mist-100 px-2 py-0.5 font-mono text-[11px] text-ink-700">
                  v{r.fix_version}{r.deploy_date ? ` · ${fmt(r.deploy_date)}` : ""}
                </span>
              ))}
            </span>
          )}
        </div>

        {/* feature flags */}
        {flags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-mist-500">Feature flags</span>
            {flags.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-2 rounded-full border border-mist-200 bg-white px-2.5 py-1 text-xs">
                <Icon name="flag" className="h-3.5 w-3.5 text-mist-400" />
                <span className="font-medium text-ink-800">{f.name}</span>
                <span className="flex items-center gap-1">
                  {(["dev", "uat", "prod"] as const).map((env) => (
                    <span key={env} title={env.toUpperCase()}
                      className={`rounded px-1 text-[9px] font-semibold uppercase ${f[env] ? "bg-ocean-100 text-ocean-700" : "bg-mist-100 text-mist-400"}`}>{env}</span>
                  ))}
                </span>
              </span>
            ))}
          </div>
        )}

        {epic.notes && (
          <div className="flex items-start gap-2 rounded-xl bg-sun-100 px-3 py-2 text-sm text-ink-700"><Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0" /> <span>{epic.notes}</span></div>
        )}

        {/* development timeline */}
        <StoryTimeline stories={stories} epic={epic} />

        {/* stories */}
        <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-mist-200">
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
                <EmptyRow cols={6} icon="📝" msg="This epic has no stories yet." />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function MetaCell({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-mist-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-mist-400">
        <Icon name={icon} className="h-3.5 w-3.5" />{label}
      </div>
      <div className="mt-0.5 font-mono text-sm text-ink-900">{value}</div>
    </div>
  );
}

const PROG_BAR: Record<string, string> = { Done: "bg-ocean-500", "In Dev": "bg-sun-500", Todo: "bg-mist-300" };

function StoryTimeline({ stories, epic }: { stories: Story[]; epic: Epic }) {
  const [open, setOpen] = useState(true);
  if (!stories.length) return null;
  const toT = (d: string) => new Date(d + "T00:00:00").getTime();
  const dated = stories.filter((s) => s.start_date && s.end_date);
  const mode: "date" | "sprint" = dated.length > 0 ? "date" : "sprint";

  type Item = { s: Story; a: number | null; b: number | null };
  let items: Item[];
  let axisMin: number;
  let axisMax: number;

  if (mode === "date") {
    items = stories.map((s) => ({
      s,
      a: s.start_date ? toT(s.start_date) : null,
      b: s.end_date ? toT(s.end_date) : s.start_date ? toT(s.start_date) : null,
    }));
    const times = items.flatMap((i) => (i.a != null && i.b != null ? [i.a, i.b] : []));
    if (epic.start_date) times.push(toT(epic.start_date));
    if (epic.end_date) times.push(toT(epic.end_date));
    axisMin = Math.min(...times);
    axisMax = Math.max(...times);
  } else {
    const sps = stories.map((s) => s.sprint).filter((n): n is number => n != null);
    if (!sps.length) return null;
    axisMin = Math.min(...sps);
    axisMax = Math.max(...sps) + 1;
    items = stories.map((s) => ({ s, a: s.sprint, b: s.sprint != null ? s.sprint + 1 : null }));
  }
  if (axisMax <= axisMin) axisMax = axisMin + 1;
  const pos = (v: number) => ((v - axisMin) / (axisMax - axisMin)) * 100;

  const now = Date.now();
  const showToday = mode === "date" && now >= axisMin && now <= axisMax;
  const estT = mode === "date" && epic.est_deploy ? toT(epic.est_deploy) : null;
  const showEst = estT != null && estT >= axisMin && estT <= axisMax;

  // sprint metadata — distinct sprints + where each begins on the axis.
  const sprintNums = Array.from(
    new Set(stories.map((s) => s.sprint).filter((n): n is number => n != null))
  ).sort((a, b) => a - b);
  const sprintCount = sprintNums.length;

  const boundaries =
    mode === "date"
      ? sprintNums
          .map((n) => {
            const starts = stories
              .filter((s) => s.sprint === n && s.start_date)
              .map((s) => toT(s.start_date!));
            return { n, x: starts.length ? pos(Math.min(...starts)) : NaN };
          })
          .filter((b) => Number.isFinite(b.x))
      : sprintNums.map((n) => ({ n, x: pos(n) }));

  const fmtD = (t: number) => {
    const d = new Date(t);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  };
  const axisLabel = (t: number) => (mode === "date" ? fmtD(t) : `Sprint ${t}`);
  const rows = [...items].sort((x, y) => (x.a ?? Infinity) - (y.a ?? Infinity));
  const sprintOf = (s: Story) => (s.sprint != null ? `S${s.sprint}` : "—");

  return (
    <div className="rounded-xl border border-mist-200">
      <button onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mist-500">
          <Icon name="caret" className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
          Development timeline
          {sprintCount > 0 && (
            <span className="rounded-full bg-mist-100 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-mist-600">
              {sprintCount} sprint{sprintCount > 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span className="flex items-center gap-3 text-[10px] text-mist-500">
          {Object.entries(PROG_BAR).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${c}`} />{k}</span>
          ))}
        </span>
      </button>

      {open && (
        <div className="border-t border-mist-100 p-3">
          {/* axis dates (top row) + sprint labels (row below), kept separate so they never overlap */}
          <div className="mb-1 space-y-0.5">
            <div className="flex gap-3">
              <div className="w-44 shrink-0" />
              <div className="w-9 shrink-0" />
              <div className="relative h-3 flex-1">
                <span className="absolute left-0 font-mono text-[10px] text-mist-400">{axisLabel(axisMin)}</span>
                <span className="absolute right-0 font-mono text-[10px] text-mist-400">{axisLabel(axisMax)}</span>
              </div>
            </div>
            {boundaries.length > 0 && (
              <div className="flex gap-3">
                <div className="w-44 shrink-0" />
                <div className="w-9 shrink-0" />
                <div className="relative h-3 flex-1">
                  {boundaries.map((b) => (
                    <span key={b.n} className="absolute -translate-x-1/2 font-mono text-[9px] text-ocean-500"
                      style={{ left: `${Math.min(Math.max(b.x, 2), 98)}%` }}>S{b.n}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {/* story titles */}
            <div className="w-44 shrink-0 space-y-1.5">
              {rows.map(({ s }) => (
                <div key={s.id} className="flex h-4 items-center truncate text-[11px] text-ink-700" title={s.title}>{s.title}</div>
              ))}
            </div>
            {/* sprint per story */}
            <div className="w-9 shrink-0 space-y-1.5">
              {rows.map(({ s }) => (
                <div key={s.id} className="flex h-4 items-center font-mono text-[10px] text-mist-500">{sprintOf(s)}</div>
              ))}
            </div>
            {/* tracks */}
            <div className="relative flex-1 space-y-1.5">
              {/* sprint gridlines */}
              {boundaries.map((b) => (
                <div key={b.n} className="pointer-events-none absolute inset-y-0 z-0 w-px bg-mist-200" style={{ left: `${b.x}%` }} />
              ))}
              {showToday && <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-alert-500" style={{ left: `${pos(now)}%` }} title="Today" />}
              {showEst && <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-ocean-400" style={{ left: `${pos(estT!)}%` }} title="Est. deploy" />}
              {rows.map(({ s, a, b }) => (
                <div key={s.id} className="relative z-[1] h-4 rounded bg-mist-100">
                  {a != null && b != null ? (
                    <div className={`absolute inset-y-0 rounded ${PROG_BAR[s.progress] ?? "bg-mist-300"}`}
                      style={{ left: `${pos(a)}%`, width: `${Math.max(pos(b) - pos(a), 2)}%` }}
                      title={`${mode === "date" ? `${fmt(s.start_date)} – ${fmt(s.end_date)}` : ""}${s.sprint != null ? `  ·  Sprint ${s.sprint}` : ""}`} />
                  ) : (
                    <span className="absolute inset-y-0 left-1 flex items-center text-[9px] text-mist-400">no dates</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {mode === "sprint" && <p className="mt-2 text-[10px] text-mist-400">Stories don't have start/end dates yet — showing by sprint number.</p>}
          {showToday && (
            <p className="mt-2 flex items-center gap-3 text-[10px] text-mist-400">
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-px bg-alert-500" /> today</span>
              {showEst && <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-px bg-ocean-400" /> est. deploy</span>}
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-px bg-mist-300" /> sprint start</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
