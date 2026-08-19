"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCarding } from "@/lib/useCarding";
import { estimate, fmtDate } from "@/lib/carding";
import { CARDING_POINTS, type CardingProject, type CardingStory } from "@/lib/types";
import {
  Btn, Card, EmptyRow, ErrorBar, Field, FormActions, Label, Loading, Metric, Modal,
  PageHead, Progress, ROW, Select, Td, Th, inputCls,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { supabase } from "@/lib/supabase";

const SPRINT_LENGTHS = [
  { value: "7", label: "1 week (7 days)" },
  { value: "14", label: "2 weeks (14 days)" },
  { value: "21", label: "3 weeks (21 days)" },
];

const blankProject = (): Partial<CardingProject> => ({
  name: "", description: "", velocity: 20, sprint_length_days: 14, start_date: null, buffer_pct: 15,
});

/* Pemilih poin ala Fibonacci — satu klik, tanpa buka dropdown. */
function PointPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1">
      {CARDING_POINTS.map((p) => {
        const on = p === value;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`h-8 w-8 rounded-lg text-xs font-semibold tabular-nums transition ${
              on ? "bg-ocean-600 text-white shadow-sm" : "bg-white text-ink-700 ring-1 ring-inset ring-mist-200 hover:bg-mist-50"
            }`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

export default function CardingPage() {
  const { projects, stories, loading, error, save, remove, patchStory, patchProject } = useCarding();

  const [selectedId, setSelectedId] = useState<string>("");
  const [projForm, setProjForm] = useState<Partial<CardingProject> | null>(null);
  const [storyForm, setStoryForm] = useState<Partial<CardingStory> | null>(null);

  // Quick-add story
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPoints, setQuickPoints] = useState(3);
  const [quickGroup, setQuickGroup] = useState("");

  // Drag & drop state — hook WAJIB dideklarasikan sebelum early-return apa pun (mis. `if (loading)`).
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Requirements (from the Requirements board) offered as project-name suggestions.
  const [reqOptions, setReqOptions] = useState<{ code: string; title: string; description: string | null }[]>([]);
  useEffect(() => {
    supabase()
      .from("req_cards")
      .select("code,title,description")
      .order("code")
      .then(({ data }: { data: { code: string; title: string; description: string | null }[] | null }) => {
        if (data) setReqOptions(data);
      });
  }, []);

  // Pilih project pertama otomatis; kalau yang aktif terhapus, pindah ke yang ada.
  useEffect(() => {
    if (!projects.length) { setSelectedId(""); return; }
    if (!projects.some((p) => p.id === selectedId)) setSelectedId(projects[0].id);
  }, [projects, selectedId]);

  const project = projects.find((p) => p.id === selectedId) ?? null;
  const projStories = useMemo(
    () => stories.filter((s) => s.project_id === selectedId).sort((a, b) => a.sort_order - b.sort_order),
    [stories, selectedId]
  );
  const est = useMemo(
    () => (project ? estimate(project, projStories) : null),
    [project, projStories]
  );

  if (loading) return <Loading />;

  /* ---------------------------------------------------------------- actions */
  const submitProject = async () => {
    if (!projForm?.name) return;
    const row: Record<string, unknown> = {
      ...projForm,
      velocity: Number(projForm.velocity) || 1,
      sprint_length_days: Number(projForm.sprint_length_days) || 14,
      buffer_pct: Number(projForm.buffer_pct) || 0,
      start_date: projForm.start_date || null,
    };
    const saved = await save("carding_projects", row);
    if (saved) {
      setSelectedId((saved as CardingProject).id);
      setProjForm(null);
    }
  };

  const deleteProject = () => {
    if (!project) return;
    if (confirm(`Delete carding project "${project.name}"? All stories inside it will be deleted too.`))
      remove("carding_projects", project.id);
  };

  const addQuickStory = async () => {
    if (!quickTitle.trim() || !project) return;
    const nextOrder = projStories.length ? Math.max(...projStories.map((s) => s.sort_order)) + 1 : 1;
    const ok = await save("carding_stories", {
      project_id: project.id,
      title: quickTitle.trim(),
      points: quickPoints,
      epic_group: quickGroup.trim() || null,
      sort_order: nextOrder,
    });
    if (ok) { setQuickTitle(""); setQuickGroup(""); }
  };

  const submitStoryEdit = async () => {
    if (!storyForm?.title || !storyForm.id) return;
    await save("carding_stories", {
      id: storyForm.id,
      title: storyForm.title,
      points: Number(storyForm.points) || 0,
      epic_group: storyForm.epic_group || null,
    });
    setStoryForm(null);
  };

  // Naik/turun: tukar sort_order dengan tetangganya (urutan mengubah penempatan sprint).
  const move = (idx: number, dir: -1 | 1) => {
    const a = projStories[idx];
    const b = projStories[idx + dir];
    if (!a || !b) return;
    patchStory(a.id, { sort_order: b.sort_order });
    patchStory(b.id, { sort_order: a.sort_order });
  };

  // Drag & drop: pindahkan story ke posisi story tujuan, lalu tata ulang sort_order 1..n.
  const reorder = (targetId: string) => {
    const fromId = dragId.current;
    dragId.current = null;
    setDragOverId(null);
    if (!fromId || fromId === targetId) return;
    const list = [...projStories]; // sudah urut sort_order
    const from = list.findIndex((s) => s.id === fromId);
    const to = list.findIndex((s) => s.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    // Simpan hanya yang sort_order-nya berubah supaya tulisan ke DB minimal.
    list.forEach((s, i) => {
      if (s.sort_order !== i + 1) patchStory(s.id, { sort_order: i + 1 });
    });
  };

  const sprintCells = est ? Array.from({ length: est.sprintCount }, (_, i) => i + 1) : [];

  return (
    <div>
      <PageHead
        title="Carding"
        sub="Break a project into stories, estimate each story’s points, then see the projected number of sprints and the finish date."
      >
        {projects.length > 0 && (
          <Select
            w="w-64"
            value={selectedId}
            onChange={setSelectedId}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
        <Btn tone="accent" onClick={() => setProjForm(blankProject())}>+ Project</Btn>
      </PageHead>

      <ErrorBar msg={error} />

      {!project ? (
        <div className="rounded-xl border border-dashed border-mist-200 bg-white p-12 text-center">
          <div className="flex justify-center text-mist-400"><Icon name="carding" className="h-8 w-8" /></div>
          <p className="mt-3 text-sm font-medium text-ink-900">No carding projects yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-mist-600">
            Create a project to start breaking an initiative into stories and estimating the effort.
          </p>
          <div className="mt-4">
            <Btn tone="accent" onClick={() => setProjForm(blankProject())}>+ New project</Btn>
          </div>
        </div>
      ) : (
        <>
          {/* ---------- Parameter estimasi (diubah langsung tersimpan) ---------- */}
          <div className="mb-5 rounded-xl border border-mist-200 bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-ink-900">{project.name}</h2>
                {project.description && <p className="mt-0.5 text-sm text-mist-600">{project.description}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Btn onClick={() => setProjForm(project)}><span className="inline-flex items-center gap-1.5"><Icon name="edit" className="h-4 w-4" /> Edit</span></Btn>
                <Btn tone="danger" onClick={deleteProject}><span className="inline-flex items-center gap-1.5"><Icon name="trash" className="h-4 w-4" /> Delete</span></Btn>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Velocity (pt/sprint)" hint="Team capacity per sprint">
                <input type="number" min={1} className={inputCls} value={project.velocity}
                  onChange={(e) => patchProject(project.id, { velocity: Math.max(1, Number(e.target.value) || 1) })} />
              </Field>
              <Field label="Sprint length">
                <Select
                  full
                  value={String(project.sprint_length_days)}
                  onChange={(v) => patchProject(project.id, { sprint_length_days: Number(v) })}
                  options={SPRINT_LENGTHS}
                />
              </Field>
              <Field label="Start date" hint="Used to estimate the finish date">
                <input type="date" className={inputCls} value={project.start_date ?? ""}
                  onChange={(e) => patchProject(project.id, { start_date: e.target.value || null })} />
              </Field>
              <Field label="Buffer (%)" hint="Effort contingency">
                <input type="number" min={0} max={100} className={inputCls} value={project.buffer_pct}
                  onChange={(e) => patchProject(project.id, { buffer_pct: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
            </div>
          </div>

          {/* ---------- Ringkasan estimasi ---------- */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Metric v={est!.totalStories} k="Story" icon="📝" />
            <Metric v={est!.totalPoints} k="Total points" icon="🔢" />
            <Metric v={est!.bufferedPoints} k={`+buffer ${project.buffer_pct}%`} icon="🛡️" />
            <Metric v={est!.sprintCount} k="Est. sprints" icon="🏃" accent />
            <Metric v={est!.sprintCount ? Math.round(est!.durationDays / 7) : 0} k="Duration (weeks)" icon="🗓️" />
            <Metric v={fmtDate(est!.endDate)} k="Est. finish" icon="🎯" />
          </div>

          {est!.overflowStory && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-sun-300 bg-sun-100 px-3 py-2 text-sm text-sun-700">
              <Icon name="warn" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Story <b>{est!.overflowStory.title}</b> ({est!.overflowStory.points} pt) is larger than one full sprint
                ({project.velocity} pt). Consider splitting it so the estimate stays realistic.
              </span>
            </div>
          )}

          {/* ---------- Quick add story ---------- */}
          <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-mist-200 bg-white p-3 shadow-card">
            <div className="min-w-[16rem] flex-1">
              <Label>New story / task</Label>
              <input
                className={inputCls + " mt-1"}
                placeholder="e.g. Design the appraisal table schema"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addQuickStory()}
              />
            </div>
            <div className="w-40">
              <Label>Group (optional)</Label>
              <input
                className={inputCls + " mt-1"}
                placeholder="Backend"
                value={quickGroup}
                onChange={(e) => setQuickGroup(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addQuickStory()}
              />
            </div>
            <div>
              <Label>Point</Label>
              <div className="mt-1"><PointPicker value={quickPoints} onChange={setQuickPoints} /></div>
            </div>
            <Btn tone="accent" onClick={addQuickStory}>+ Add</Btn>
          </div>

          {/* ---------- Task list + gantt sprint ---------- */}
          <Card scroll offset="30rem">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th className="w-10 text-center">#</Th>
                  <Th>Story</Th>
                  <Th className="w-32">Group</Th>
                  <Th className="w-28 text-center">Point</Th>
                  <Th className="w-20 text-center">Sprint</Th>
                  {sprintCells.length > 0 && (
                    <Th className="min-w-[16rem]">
                      <div className="flex gap-1">
                        {sprintCells.map((n) => (
                          <span key={n} className="flex-1 text-center font-mono text-[10px] text-mist-400">S{n}</span>
                        ))}
                      </div>
                    </Th>
                  )}
                  <Th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {est!.packed.map((s, idx) => (
                  <tr
                    key={s.id}
                    draggable
                    onDragStart={(e) => { dragId.current = s.id; e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => { e.preventDefault(); if (dragOverId !== s.id) setDragOverId(s.id); }}
                    onDragLeave={() => setDragOverId((d) => (d === s.id ? null : d))}
                    onDrop={() => reorder(s.id)}
                    onDragEnd={() => { dragId.current = null; setDragOverId(null); }}
                    className={`group ${ROW} ${dragOverId === s.id ? "bg-ocean-50 outline outline-2 -outline-offset-2 outline-ocean-300" : ""}`}
                  >
                    <Td className="text-center font-mono text-xs text-mist-400">
                      <span className="inline-flex items-center gap-1" title="Drag to reorder">
                        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
                          className="h-3.5 w-3.5 cursor-grab text-mist-300 opacity-0 group-hover:opacity-100">
                          <circle cx="6" cy="4" r="1.2" /><circle cx="10" cy="4" r="1.2" />
                          <circle cx="6" cy="8" r="1.2" /><circle cx="10" cy="8" r="1.2" />
                          <circle cx="6" cy="12" r="1.2" /><circle cx="10" cy="12" r="1.2" />
                        </svg>
                        {idx + 1}
                      </span>
                    </Td>
                    <Td className="font-medium text-ink-900">{s.title}</Td>
                    <Td>
                      {s.epic_group
                        ? <span className="inline-flex rounded-full bg-mist-100 px-2 py-0.5 text-xs text-ink-700 ring-1 ring-inset ring-mist-200">{s.epic_group}</span>
                        : <span className="text-xs text-mist-400">—</span>}
                    </Td>
                    <Td>
                      <div className="flex justify-center">
                        <Select
                          value={String(s.points)}
                          onChange={(v) => patchStory(s.id, { points: Number(v) })}
                          options={CARDING_POINTS.map((p) => ({ value: String(p), label: `${p} pt` }))}
                        />
                      </div>
                    </Td>
                    <Td className="text-center">
                      <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-ocean-100 px-1.5 font-mono text-xs font-semibold text-ocean-600">
                        {s.sprint}
                      </span>
                    </Td>
                    {sprintCells.length > 0 && (
                      <Td>
                        {/* Sel sprint terisi = tempat story ini dijadwalkan (task list ala gantt). */}
                        <div className="flex gap-1">
                          {sprintCells.map((n) => (
                            <div key={n} className="flex-1">
                              <div
                                className={`h-4 rounded ${n === s.sprint ? "bg-ocean-500" : "bg-mist-100"}`}
                                title={n === s.sprint ? `Sprint ${n}` : undefined}
                              />
                            </div>
                          ))}
                        </div>
                      </Td>
                    )}
                    <Td>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => move(idx, -1)} disabled={idx === 0} title="Move up"
                          className="rounded px-1.5 py-1 text-mist-400 hover:bg-mist-50 hover:text-ink-700 disabled:opacity-30"><Icon name="up" className="h-4 w-4" /></button>
                        <button onClick={() => move(idx, 1)} disabled={idx === est!.packed.length - 1} title="Move down"
                          className="rounded px-1.5 py-1 text-mist-400 hover:bg-mist-50 hover:text-ink-700 disabled:opacity-30"><Icon name="down" className="h-4 w-4" /></button>
                        <button onClick={() => setStoryForm(s)} title="Edit"
                          className="rounded px-1.5 py-1 text-mist-600 hover:bg-mist-50 hover:text-ocean-600"><Icon name="edit" className="h-4 w-4" /></button>
                        <button onClick={() => confirm(`Delete story "${s.title}"?`) && remove("carding_stories", s.id)} title="Delete"
                          className="rounded px-1.5 py-1 text-mist-400 hover:bg-alert-100 hover:text-alert-600"><Icon name="trash" className="h-4 w-4" /></button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {est!.packed.length === 0 && (
                  <EmptyRow cols={sprintCells.length > 0 ? 7 : 6} icon="🃏"
                    msg="No stories yet. Add one using the fields above to start estimating." />
                )}
              </tbody>
            </table>
          </Card>

          {/* ---------- Beban per sprint ---------- */}
          {est!.loads.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-ink-900">Load per sprint</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {est!.loads.map((l) => {
                  const pct = Math.round((l.points / Math.max(1, project.velocity)) * 100);
                  const over = l.points > project.velocity;
                  return (
                    <div key={l.sprint} className="rounded-xl border border-mist-200 bg-white p-3 shadow-card">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-ink-900">Sprint {l.sprint}</span>
                        <span className={`font-mono text-xs ${over ? "text-alert-600" : "text-mist-600"}`}>
                          {l.points}/{project.velocity} pt
                        </span>
                      </div>
                      <div className="mt-2">
                        <Progress pct={pct} tone={over ? "bg-alert-500" : "bg-ocean-600"} />
                      </div>
                      <div className="mt-1.5 text-xs text-mist-400">{l.stories.length} stories</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ---------- Modal: project ---------- */}
      {projForm && (
        <Modal
          title={projForm.id ? "Edit carding project" : "New carding project"}
          subtitle="Velocity and sprint length drive the timeline estimate."
          onClose={() => setProjForm(null)}
        >
          <div className="space-y-4">
            <Field label="Project name" hint="Type a new name, or pick an existing requirement from the list.">
              <input
                className={inputCls}
                list="req-suggestions"
                value={projForm.name ?? ""}
                onChange={(e) => {
                  const name = e.target.value;
                  const match = reqOptions.find((r) => r.title === name);
                  setProjForm({
                    ...projForm,
                    name,
                    // Pulled a requirement in? Prefill its description if the field is still empty.
                    description: match && !projForm.description ? (match.description ?? "") : projForm.description,
                  });
                }}
                placeholder="Appraisal Web — Phase 1"
              />
              <datalist id="req-suggestions">
                {reqOptions.map((r) => (
                  <option key={r.code} value={r.title}>{r.code}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Description (optional)">
              <textarea rows={2} className={inputCls} value={projForm.description ?? ""}
                onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
                placeholder="Initiative / short context" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Velocity (pt/sprint)">
                <input type="number" min={1} className={inputCls} value={projForm.velocity ?? 20}
                  onChange={(e) => setProjForm({ ...projForm, velocity: Number(e.target.value) })} />
              </Field>
              <Field label="Sprint length">
                <Select
                  full
                  value={String(projForm.sprint_length_days ?? 14)}
                  onChange={(v) => setProjForm({ ...projForm, sprint_length_days: Number(v) })}
                  options={SPRINT_LENGTHS}
                />
              </Field>
              <Field label="Start date">
                <input type="date" className={inputCls} value={projForm.start_date ?? ""}
                  onChange={(e) => setProjForm({ ...projForm, start_date: e.target.value })} />
              </Field>
              <Field label="Buffer (%)">
                <input type="number" min={0} max={100} className={inputCls} value={projForm.buffer_pct ?? 15}
                  onChange={(e) => setProjForm({ ...projForm, buffer_pct: Number(e.target.value) })} />
              </Field>
            </div>
            <FormActions onClose={() => setProjForm(null)} onSave={submitProject} />
          </div>
        </Modal>
      )}

      {/* ---------- Modal: edit story ---------- */}
      {storyForm && (
        <Modal title="Edit story" onClose={() => setStoryForm(null)}>
          <div className="space-y-4">
            <Field label="Story title">
              <input className={inputCls} value={storyForm.title ?? ""}
                onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Group (opsional)">
                <input className={inputCls} value={storyForm.epic_group ?? ""}
                  onChange={(e) => setStoryForm({ ...storyForm, epic_group: e.target.value })} />
              </Field>
              <Field label="Point">
                <div className="mt-1">
                  <PointPicker value={Number(storyForm.points) || 0}
                    onChange={(v) => setStoryForm({ ...storyForm, points: v })} />
                </div>
              </Field>
            </div>
            <FormActions onClose={() => setStoryForm(null)} onSave={submitStoryEdit} />
          </div>
        </Modal>
      )}
    </div>
  );
}
