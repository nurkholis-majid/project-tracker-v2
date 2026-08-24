"use client";

import { useMemo, useRef, useState } from "react";
import { useRequirements } from "@/lib/useRequirements";
import { useCanEdit } from "@/lib/permissions";
import {
  REQ_PRIORITIES, REQ_PRIORITY_META, REQ_CATEGORIES,
  type ReqCard, type ReqCategory, type ReqCriterion, type ReqLink, type ReqPriority, type ReqStage,
} from "@/lib/types";
import { CreateBtn, Btn, ErrorBar, Label, Loading, Metric, Modal, PageHead, Segmented, inputCls } from "@/components/ui";
import { Icon } from "@/components/icons";

const STAGE_PALETTE = ["#98A2B3", "#6172F3", "#0E9384", "#F79009", "#DC6803", "#1A6AFF", "#2FC0AF", "#12B76A", "#F04438"];

const catTag = (c: ReqCategory) =>
  c === "PRD" ? "bg-ocean-100 text-ocean-700 ring-ocean-200" : "bg-sky-100 text-sky-600 ring-sky-200";
const prioTag: Record<ReqPriority, string> = {
  hi: "bg-alert-100 text-alert-600 ring-alert-200",
  med: "bg-sun-100 text-sun-700 ring-sun-300",
  lo: "bg-mist-100 text-mist-600 ring-mist-200",
};
const initials = (n?: string | null) =>
  (n || "?").split(/[\s–-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const fmtShort = (d?: string | null) => {
  if (!d) return "";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}/${m}/${y.slice(2)}`;
};

type Draft = {
  id?: string; code?: string; title: string; category: ReqCategory; priority: ReqPriority;
  stage_id: string; requester: string; target_date: string; description: string;
  criteria: ReqCriterion[]; links: ReqLink[];
};

export default function RequirementsPage() {
  const { stages, cards, loading, error, save, remove, patchCard, patchStage } = useRequirements();
  const canEdit = useCanEdit();

  const [cat, setCat] = useState<"All" | ReqCategory>("All");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [menuStage, setMenuStage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const lastStageId = stages.length ? stages[stages.length - 1].id : null;

  const visible = (c: ReqCard) =>
    (cat === "All" || c.category === cat) &&
    (!q || (c.title + " " + c.code + " " + (c.requester ?? "")).toLowerCase().includes(q.toLowerCase()));

  const cardsOf = (stage: ReqStage, isFirst: boolean) =>
    cards
      .filter((c) => (c.stage_id === stage.id || (isFirst && !c.stage_id)) && visible(c))
      // Prioritas menang duluan: High di atas, lalu Medium, lalu Low.
      .sort(
        (a, b) =>
          REQ_PRIORITY_META[a.priority].rank - REQ_PRIORITY_META[b.priority].rank ||
          a.sort_order - b.sort_order ||
          a.code.localeCompare(b.code)
      );

  const shown = useMemo(() => cards.filter(visible), [cards, cat, q]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loading />;

  /* ---------------------------------------------------------------- overview */
  const total = shown.length;
  const prd = shown.filter((c) => c.category === "PRD").length;
  const brd = shown.filter((c) => c.category === "BRD").length;
  const hiOpen = shown.filter((c) => c.priority === "hi" && c.stage_id !== lastStageId).length;
  const delivered = shown.filter((c) => c.stage_id === lastStageId).length;
  const dist = stages.map((s) => ({ s, n: shown.filter((c) => c.stage_id === s.id).length }));

  /* ---------------------------------------------------------------- actions */
  const openNew = (stageId?: string) =>
    setDraft({
      title: "", category: cat === "BRD" ? "BRD" : "PRD", priority: "med",
      stage_id: stageId ?? stages[0]?.id ?? "", requester: "", target_date: "", description: "",
      criteria: [], links: [],
    });

  const openEdit = (c: ReqCard) =>
    setDraft({
      id: c.id, code: c.code, title: c.title, category: c.category, priority: c.priority,
      stage_id: c.stage_id ?? stages[0]?.id ?? "", requester: c.requester ?? "",
      target_date: c.target_date ?? "", description: c.description ?? "",
      criteria: c.criteria ?? [], links: c.links ?? [],
    });

  const saveDraft = async () => {
    if (!draft || !draft.title.trim()) return;
    const row: Record<string, unknown> = {
      ...(draft.id ? { id: draft.id } : {}),
      title: draft.title.trim(),
      category: draft.category,
      priority: draft.priority,
      stage_id: draft.stage_id || null,
      requester: draft.requester.trim(),
      target_date: draft.target_date || null,
      description: draft.description.trim(),
      criteria: draft.criteria,
      links: draft.links,
    };
    if (!draft.id) row.sort_order = Date.now(); // urutan sekunder stabil untuk prioritas yang sama
    const ok = await save("req_cards", row);
    if (ok) setDraft(null);
  };

  const deleteDraft = async () => {
    if (draft?.id && confirm(`Delete requirement "${draft.title}"?`)) {
      await remove("req_cards", draft.id);
      setDraft(null);
    }
  };

  const onDrop = (stageId: string) => {
    const c = cards.find((x) => x.id === dragId.current);
    if (c && c.stage_id !== stageId) patchCard(c.id, { stage_id: stageId });
    setDragOver(null);
    dragId.current = null;
  };

  const addStage = async () => {
    const maxOrder = stages.length ? Math.max(...stages.map((s) => s.sort_order)) : 0;
    const saved = await save("req_stages", {
      name: "New stage",
      color: STAGE_PALETTE[stages.length % STAGE_PALETTE.length],
      sort_order: maxOrder + 1,
    });
    if (saved) setRenaming((saved as ReqStage).id);
  };

  const moveStage = (idx: number, dir: -1 | 1) => {
    const a = stages[idx], b = stages[idx + dir];
    if (!a || !b) return;
    patchStage(a.id, { sort_order: b.sort_order });
    patchStage(b.id, { sort_order: a.sort_order });
    setMenuStage(null);
  };

  const deleteStage = async (s: ReqStage) => {
    if (stages.length <= 1) { alert("Keep at least one stage."); return; }
    const fallback = stages.find((x) => x.id !== s.id)!;
    // Pindahkan kartunya dulu supaya tidak ada yang menggantung, baru hapus stage-nya.
    await Promise.all(cards.filter((c) => c.stage_id === s.id).map((c) => patchCard(c.id, { stage_id: fallback.id })));
    await remove("req_stages", s.id);
    setMenuStage(null);
  };

  return (
    <div>
      <PageHead
        title="Requirements"
        sub="Capture, review, and track product and business requirements from stakeholders — on a board you can shape to fit your intake process."
      >
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mist-400"><Icon name="search" className="h-4 w-4" /></span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search requirements…"
            className={inputCls + " w-56 pl-8"}
          />
        </div>
        <Segmented
          value={cat}
          onChange={(v) => setCat(v as "All" | ReqCategory)}
          options={[{ value: "All", label: "All" }, ...REQ_CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        <CreateBtn tone="ghost" onClick={addStage}><span className="inline-flex items-center gap-1.5"><Icon name="plus" className="h-4 w-4" /> Add stage</span></CreateBtn>
        <CreateBtn onClick={() => openNew()}><span className="inline-flex items-center gap-1.5"><Icon name="plus" className="h-4 w-4" /> New requirement</span></CreateBtn>
      </PageHead>

      <ErrorBar msg={error} />

      {/* ---------------- Overview panel ---------------- */}
      <div className="mb-4 rounded-xl border border-mist-200 bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <Label>Overview</Label>
          <span className="text-xs text-mist-400">{cat === "All" ? "all categories" : `${cat} only`}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric v={total} k="Total requirements" icon="📋" accent />
          <Metric v={prd} k="PRD" icon="🟣" />
          <Metric v={brd} k="BRD" icon="🟢" />
          <Metric v={hiOpen} k="High priority · open" icon="🔴" />
          <Metric v={delivered} k={stages[stages.length - 1]?.name ?? "Delivered"} icon="✅" />
        </div>

        {/* Distribusi kartu per stage */}
        <div className="mt-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-mist-100">
            {dist.map(({ s, n }) => (
              <span key={s.id} style={{ width: `${(n / (total || 1)) * 100}%`, background: s.color }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {dist.map(({ s, n }) => (
              <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-mist-600">
                <i className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.name} · <b className="text-ink-900">{n}</b>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- Board ---------------- */}
      <div className="flex items-start gap-3 overflow-x-auto pb-3">
        {stages.map((stage, idx) => {
          const list = cardsOf(stage, idx === 0);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
              onDragLeave={() => setDragOver((d) => (d === stage.id ? null : d))}
              onDrop={() => onDrop(stage.id)}
              className={`w-[288px] flex-shrink-0 rounded-xl border bg-[#FBFCFD] ${
                dragOver === stage.id ? "border-ocean-500 ring-2 ring-ocean-100" : "border-mist-200"
              }`}
            >
              <div className="relative flex items-center gap-2 border-b border-mist-100 px-3 py-2.5">
                <span className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ background: stage.color }} />
                {renaming === stage.id ? (
                  <input
                    autoFocus
                    defaultValue={stage.name}
                    onBlur={(e) => { patchStage(stage.id, { name: e.target.value.trim() || "Untitled" }); setRenaming(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="min-w-0 flex-1 rounded border border-ocean-500 px-1 py-0.5 text-sm font-semibold outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={() => setRenaming(stage.id)}
                    className="min-w-0 flex-1 truncate text-sm font-semibold"
                    title="Double-click to rename"
                  >
                    {stage.name}
                  </span>
                )}
                <span className="rounded-full bg-mist-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-mist-400">
                  {list.length}
                </span>
                <button
                  onClick={() => setMenuStage((m) => (m === stage.id ? null : stage.id))}
                  className="rounded px-1.5 text-mist-400 hover:bg-mist-100 hover:text-ink-900"
                >
                  <Icon name="more" className="h-4 w-4" />
                </button>

                {menuStage === stage.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuStage(null)} />
                    <div className="absolute right-2 top-10 z-50 w-44 rounded-lg border border-mist-200 bg-white p-1.5 shadow-lg">
                      <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-700 hover:bg-mist-50"
                        onClick={() => { setRenaming(stage.id); setMenuStage(null); }}>Rename</button>
                      <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-700 hover:bg-mist-50 disabled:opacity-40"
                        disabled={idx === 0} onClick={() => moveStage(idx, -1)}>Move left</button>
                      <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-700 hover:bg-mist-50 disabled:opacity-40"
                        disabled={idx === stages.length - 1} onClick={() => moveStage(idx, 1)}>Move right</button>
                      <div className="flex gap-1.5 px-2 py-1.5">
                        {STAGE_PALETTE.slice(0, 7).map((col) => (
                          <button key={col} onClick={() => { patchStage(stage.id, { color: col }); setMenuStage(null); }}
                            className="h-4 w-4 rounded ring-1 ring-inset ring-black/10" style={{ background: col }} />
                        ))}
                      </div>
                      <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-alert-600 hover:bg-alert-100"
                        onClick={() => deleteStage(stage)}>Delete stage</button>
                    </div>
                  </>
                )}
              </div>

              <div className="flex min-h-[56px] flex-col gap-2 p-2">
                {list.map((c) => {
                  const acDone = c.criteria.filter((a) => a.done).length;
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => (dragId.current = c.id)}
                      onDragEnd={() => (dragId.current = null)}
                      onClick={() => openEdit(c)}
                      className="cursor-pointer rounded-lg border border-mist-200 bg-white p-2.5 shadow-card transition hover:border-mist-400"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${catTag(c.category)}`}>
                          {c.category}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${prioTag[c.priority]}`}>
                          {REQ_PRIORITY_META[c.priority].label}
                        </span>
                      </div>
                      <div className="text-[13px] font-semibold leading-snug text-ink-900">{c.title}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-mist-400">{c.code}</span>
                        {c.criteria.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-mist-100 px-1.5 py-0.5 text-[10px] text-mist-600"><Icon name="check" className="h-3 w-3" />{acDone}/{c.criteria.length}</span>
                        )}
                        {c.links.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-mist-100 px-1.5 py-0.5 text-[10px] text-mist-600"><Icon name="link" className="h-3 w-3" />{c.links.length}</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-mist-100 pt-2">
                        <span className="flex items-center gap-1.5 text-[11px] text-mist-600">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-ocean-100 text-[9px] font-bold text-ocean-700">
                            {initials(c.requester)}
                          </span>
                          {c.requester || "Unassigned"}
                        </span>
                        {c.target_date && <span className="font-mono text-[10px] text-mist-400">{fmtShort(c.target_date)}</span>}
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && <div className="py-3 text-center text-[11px] text-mist-400">Drop a requirement here</div>}
              </div>

              {canEdit && (
              <button
                onClick={() => openNew(stage.id)}
                className="mx-2 mb-2 w-[calc(100%-1rem)] rounded-lg border border-dashed border-mist-200 py-1.5 text-left text-xs text-mist-600 hover:border-ocean-500 hover:bg-white hover:text-ocean-600"
              >
                + Add requirement
              </button>
              )}
            </div>
          );
        })}

        {canEdit && (
        <button
          onClick={addStage}
          title="Add stage"
          className="grid h-28 w-12 flex-shrink-0 place-items-center rounded-xl border border-dashed border-mist-200 text-xl text-mist-400 hover:border-ocean-500 hover:bg-white hover:text-ocean-600"
        >
          <Icon name="plus" className="h-5 w-5" />
        </button>
        )}
      </div>

      {draft && (
        <Drawer
          draft={draft}
          setDraft={setDraft}
          stages={stages}
          onClose={() => setDraft(null)}
          onSave={saveDraft}
          onDelete={deleteDraft}
        />
      )}
    </div>
  );
}

/* ==================================================================== drawer */
function Drawer({
  draft, setDraft, stages, onClose, onSave, onDelete,
}: {
  draft: Draft; setDraft: (d: Draft) => void; stages: ReqStage[];
  onClose: () => void; onSave: () => void; onDelete: () => void;
}) {
  const [acNew, setAcNew] = useState("");
  const [lkLabel, setLkLabel] = useState("");
  const [lkUrl, setLkUrl] = useState("");

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const addAc = () => { if (acNew.trim()) { set({ criteria: [...draft.criteria, { text: acNew.trim(), done: false }] }); setAcNew(""); } };
  const addLink = () => { if (lkLabel.trim()) { set({ links: [...draft.links, { label: lkLabel.trim(), url: lkUrl.trim() || "#" }] }); setLkLabel(""); setLkUrl(""); } };

  const chip = (on: boolean, extra: string) =>
    `rounded-full border px-3 py-1.5 text-xs font-medium ${on ? extra : "border-mist-200 bg-white text-ink-700 hover:bg-mist-50"}`;

  return (
    <Modal title={draft.id ? "Edit requirement" : "New requirement"} subtitle={draft.code} onClose={onClose}>
      <div>
          <Fld label="Summary">
            <input className={inputCls} value={draft.title} onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Appraisal Portal — Pool Request Routing" />
          </Fld>

          <div className="grid grid-cols-2 gap-3">
            <Fld label="Category">
              <div className="flex flex-wrap gap-1.5">
                {REQ_CATEGORIES.map((c) => (
                  <button key={c} onClick={() => set({ category: c })}
                    className={chip(draft.category === c, c === "PRD"
                      ? "border-ocean-500 bg-ocean-100 text-ocean-700"
                      : "border-sky-500 bg-sky-100 text-sky-600")}>
                    {c === "PRD" ? "PRD · Product" : "BRD · Business"}
                  </button>
                ))}
              </div>
            </Fld>
            <Fld label="Priority">
              <div className="flex flex-wrap gap-1.5">
                {REQ_PRIORITIES.map((p) => (
                  <button key={p} onClick={() => set({ priority: p })}
                    className={chip(draft.priority === p, p === "hi"
                      ? "border-alert-500 bg-alert-100 text-alert-600"
                      : p === "med" ? "border-sun-500 bg-sun-100 text-sun-700"
                      : "border-mist-400 bg-mist-100 text-ink-900")}>
                    {REQ_PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </Fld>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Fld label="Stage">
              <select className={inputCls} value={draft.stage_id} onChange={(e) => set({ stage_id: e.target.value })}>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Fld>
            <Fld label="Target date">
              <input type="date" className={inputCls} value={draft.target_date} onChange={(e) => set({ target_date: e.target.value })} />
            </Fld>
          </div>

          <Fld label="Requested by">
            <input className={inputCls} value={draft.requester} onChange={(e) => set({ requester: e.target.value })}
              placeholder="e.g. Ops – Credit, or a stakeholder name" />
          </Fld>

          <Fld label="Description">
            <textarea rows={4} className={inputCls} value={draft.description} onChange={(e) => set({ description: e.target.value })}
              placeholder="What does the user need, and why? Context, current pain point, expected outcome…" />
          </Fld>

          <Fld label="Acceptance criteria">
            {draft.criteria.length === 0 && <p className="mb-1 text-[11px] text-mist-400">No criteria yet.</p>}
            <div className="space-y-1">
              {draft.criteria.map((a, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-mist-100 py-1.5">
                  <input type="checkbox" checked={a.done} className="h-4 w-4 accent-ocean-600"
                    onChange={(e) => set({ criteria: draft.criteria.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} />
                  <span className={`flex-1 text-[13px] ${a.done ? "text-mist-400 line-through" : "text-ink-900"}`}>{a.text}</span>
                  <button onClick={() => set({ criteria: draft.criteria.filter((_, j) => j !== i) })}
                    className="text-mist-400 hover:text-alert-600"><Icon name="close" className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className={inputCls + " flex-1"} value={acNew} onChange={(e) => setAcNew(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAc()} placeholder="Add a criterion…" />
              <Btn onClick={addAc}>Add</Btn>
            </div>
          </Fld>

          <Fld label="Reference links">
            {draft.links.length === 0 && <p className="mb-1 text-[11px] text-mist-400">No links yet.</p>}
            <div className="space-y-1">
              {draft.links.map((l, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-[12px]">
                  <Icon name="link" className="h-3.5 w-3.5 text-mist-400" />
                  <a href={l.url} target="_blank" rel="noreferrer" className="text-ocean-600 hover:underline">{l.label}</a>
                  <button onClick={() => set({ links: draft.links.filter((_, j) => j !== i) })}
                    className="ml-auto text-mist-400 hover:text-alert-600"><Icon name="close" className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className={inputCls + " w-32"} value={lkLabel} onChange={(e) => setLkLabel(e.target.value)} placeholder="Label (DLB-…)" />
              <input className={inputCls + " flex-1"} value={lkUrl} onChange={(e) => setLkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLink()} placeholder="https://…" />
              <Btn onClick={addLink}>Add</Btn>
            </div>
          </Fld>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-mist-100 pt-4">
        {draft.id ? <Btn tone="danger" onClick={onDelete}>Delete</Btn> : <span />}
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-xs text-mist-400" title="Can be linked to the Epic page later"><Icon name="promote" className="h-4 w-4" /> Promote to Epic</span>
          <Btn tone="accent" onClick={onSave}>Save</Btn>
        </div>
      </div>
    </Modal>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-700">{label}</label>
      {children}
    </div>
  );
}
