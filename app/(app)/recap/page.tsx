"use client";

import { useMemo, useState } from "react";
import { useTracker } from "@/lib/useTracker";
import {
  barGeom, computeKpi, csvOfStories, epicStats, fmt, isEpicDone, recapText, semesterOf, type RecapFormat,
} from "@/lib/kpi";
import {
  BAR_TONE, Badge, Btn, ErrorBar, Label, Loading, Metric, Progress, Segmented, Stepper,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { catColor } from "@/lib/category";

export default function RecapPage() {
  const { data, loading, error } = useTracker();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [half, setHalf] = useState<1 | 2>(now.getMonth() < 6 ? 1 : 2);
  const [format, setFormat] = useState<RecapFormat>("text");
  const [copied, setCopied] = useState(false);

  const sem = semesterOf(year, half);
  const kpi = useMemo(() => computeKpi(data, sem), [data, sem]);
  const stats = useMemo(() => epicStats(data), [data]);
  const text = useMemo(() => recapText(data, kpi, format), [data, kpi, format]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const downloadCsv = () => {
    const blob = new Blob([csvOfStories(data)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `project-tracker-s${half}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <Loading />;

  const ongoing = kpi.epicsRunning.filter((e) => !kpi.epicsDone.includes(e));
  const recapCats = (() => {
    const m = new Map<string, number>();
    kpi.epicsRunning.forEach((e) => { const c = (e.category ?? "").trim(); if (c) m.set(c, (m.get(c) ?? 0) + 1); });
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { arr, total: arr.reduce((s, [, n]) => s + n, 0) };
  })();
  const versionsOf = (epicId: string) =>
    Array.from(new Set(
      data.stories
        .filter((s) => s.epic_id === epicId && s.release_id)
        .map((s) => data.releases.find((r) => r.id === s.release_id)?.fix_version)
        .filter(Boolean)
    )) as string[];

  return (
    <div>
      <PageHeadRecap
        half={half} year={year} sem={sem}
        setHalf={setHalf} setYear={setYear} onCsv={downloadCsv} nowYear={now.getFullYear()}
      />

      <ErrorBar msg={error} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric v={kpi.epicsDone.length} k="Epics done" icon="🏆" accent />
        <Metric v={ongoing.length} k="Unfinished" icon="📦" />
        <Metric v={kpi.releases.length} k="Production releases" icon="🚀" />
        <Metric v={kpi.pointsDone} k={`Story points · ${kpi.storiesDone.length} stories`} icon="🔢" />
      </div>

      {/* Timeline epic */}
      <section className="mb-5 rounded-2xl border border-mist-200 bg-white shadow-card">
        <div className="border-b border-mist-100 px-5 py-4">
          <h2 className="text-base font-semibold">Epics this semester</h2>
          <p className="mt-0.5 text-sm text-mist-600">
            Epics without a manual start date are dated from their stories, so they still count.
          </p>
        </div>

        <div className="px-5 py-4">
          <div className="hidden grid-cols-12 gap-2 pb-2 lg:grid">
            <div className="col-span-5" />
            <div className="col-span-7 grid grid-cols-6">
              {sem.months.map((m) => (
                <div key={m} className="text-center font-mono text-[10px] uppercase tracking-widest text-mist-400">{m}</div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {kpi.epicsRunning.map((e) => {
              const g = barGeom(e.win, sem);
              const st = stats[e.id];
              const pct = st?.points ? Math.round((st.donePoints / st.points) * 100) : 0;
              const done = isEpicDone(e.status, st); // sumber yang sama dengan hitungan di kartu & rekap
              return (
                <div key={e.id} className="grid grid-cols-1 items-center gap-2 lg:grid-cols-12">
                  <div className="min-w-0 lg:col-span-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-ink-900">{e.name}</span>
                      <Badge v={e.status} />
                      {/* Done / in-progress marker — same source as the numbers in the cards and recap. */}
                      {done ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-600 ring-1 ring-inset ring-sky-200">
                          <Icon name="check" className="h-3 w-3" strokeWidth={2.5} /> Done
                        </span>
                      ) : (
                        <span className="rounded-full bg-sun-100 px-2 py-0.5 text-[10px] font-semibold text-sun-700 ring-1 ring-inset ring-sun-300">
                          In progress
                        </span>
                      )}
                      {versionsOf(e.id).map((v) => (
                        <span key={v} className="rounded-full bg-ocean-100 px-2 py-0.5 font-mono text-[10px] text-ocean-600">v{v}</span>
                      ))}
                      {e.win.derived && (
                        <span className="rounded-full bg-mist-100 px-2 py-0.5 text-[10px] text-mist-600" title="Dates derived from stories">
                          auto
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="w-28"><Progress pct={pct} /></div>
                      <span className="font-mono text-[10px] text-mist-400">
                        {st?.donePoints ?? 0}/{st?.points ?? 0} pt · {st?.done ?? 0}/{st?.total ?? 0} stories · {pct}%
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-7">
                    <div className="relative h-7 rounded-lg bg-mist-100">
                      <div className="pointer-events-none absolute inset-0 grid grid-cols-6">
                        {sem.months.map((m, i) => <div key={m} className={i ? "border-l border-white" : ""} />)}
                      </div>
                      <div
                        title={`${e.status} · ${fmt(e.win.start)} – ${fmt(e.win.end)}`}
                        className={`absolute inset-y-1 rounded-md ${BAR_TONE[e.status] ?? "bg-mist-400"}`}
                        style={{ left: `${g.left}%`, width: `${g.width}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {kpi.epicsRunning.length === 0 && (
              <div className="py-10 text-center">
                <div className="flex justify-center text-mist-400"><Icon name="calendar" className="h-7 w-7" /></div>
                <p className="mt-2 text-sm text-mist-600">
                  No epics in this period. Set a start date on the Epic page, or make sure their stories have dates.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {recapCats.total > 0 && (
        <section className="mb-5 rounded-2xl border border-mist-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-mist-100 px-5 py-4">
            <h2 className="text-base font-semibold">Epics by category</h2>
            <span className="font-mono text-[11px] text-mist-600">{recapCats.total} epics · {recapCats.arr.length} categories</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
            {recapCats.arr.map(([c, n]) => {
              const col = catColor(c);
              const pct = ((n / recapCats.total) * 100).toFixed(1);
              return (
                <div key={c} className="relative overflow-hidden rounded-xl border border-mist-200 p-3.5">
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: col.dot }} />
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-800">
                    <span className="h-2 w-2 rounded-full" style={{ background: col.dot }} />
                    <span className="truncate" title={c}>{c}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-semibold text-ink-900">{n}</span>
                    <span className="text-[12.5px] font-semibold text-mist-500">{pct}%</span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-mist-100">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: col.dot }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------------- Rekap siap kirim ---------------- */}
      <section className="rounded-2xl border border-mist-200 bg-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mist-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Recap ready to share</h2>
            <p className="mt-0.5 text-sm text-mist-600">
              A summary of this semester’s achievements — copy it straight into an email or deck.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={format}
              onChange={(v) => setFormat(v as RecapFormat)}
              options={[
                { value: "text", label: "Text" },
                { value: "markdown", label: "Markdown" },
              ]}
            />
            <Btn tone="accent" onClick={copy}>{copied ? "Copied" : "Copy"}</Btn>
          </div>
        </div>

        {/* Ringkasan visual — supaya isinya kebaca tanpa harus membaca blok teks */}
        <div className="grid gap-4 border-b border-mist-100 px-5 py-4 lg:grid-cols-3">
          <div className="rounded-xl border border-ocean-200 bg-ocean-100 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-ocean-700">Highlight</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-900">
              <b>{kpi.epicsDone.length}</b> of <b>{kpi.epicsRunning.length}</b> epics active this semester are done,
              producing <b>{kpi.pointsDone}</b> story points across <b>{kpi.storiesDone.length}</b> stories,
              and <b>{kpi.releases.length}</b> releases to production
              {kpi.sprints.length > 0 && <> over sprints <b>{kpi.sprints[0]}–{kpi.sprints[kpi.sprints.length - 1]}</b></>}.
            </p>
          </div>

          <div className="rounded-xl border border-mist-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-mist-600">
              Epics done ({kpi.epicsDone.length})
            </div>
            <ul className="mt-2 space-y-1">
              {kpi.epicsDone.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center gap-1.5 truncate text-sm text-ink-700"><Icon name="check" className="h-3.5 w-3.5 shrink-0 text-ocean-600" /> <span className="truncate">{e.name}</span></li>
              ))}
              {kpi.epicsDone.length === 0 && <li className="text-sm text-mist-400">None yet.</li>}
              {kpi.epicsDone.length > 6 && (
                <li className="text-xs text-mist-400">+{kpi.epicsDone.length - 6} more</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-mist-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-mist-600">
              Unfinished ({ongoing.length})
            </div>
            <ul className="mt-2 space-y-1">
              {ongoing.slice(0, 6).map((e) => {
                const st = stats[e.id];
                const pct = st?.points ? Math.round((st.donePoints / st.points) * 100) : 0;
                return (
                  <li key={e.id} className="flex items-center gap-2 text-sm text-ink-700">
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    <span className="font-mono text-[10px] text-mist-400">{pct}%</span>
                  </li>
                );
              })}
              {ongoing.length === 0 && <li className="text-sm text-mist-400">None.</li>}
              {ongoing.length > 6 && <li className="text-xs text-mist-400">+{ongoing.length - 6} more</li>}
            </ul>
          </div>
        </div>

        <pre className="max-h-80 overflow-auto whitespace-pre-wrap bg-mist-50 px-5 py-4 font-mono text-xs leading-relaxed text-ink-700">
          {text}
        </pre>
      </section>
    </div>
  );
}

/** Header rekap dipisah supaya kontrol periodenya tetap menempel saat di-scroll. */
function PageHeadRecap({
  half, year, sem, setHalf, setYear, onCsv, nowYear,
}: {
  half: 1 | 2; year: number; sem: { start: string; end: string };
  setHalf: (h: 1 | 2) => void; setYear: (y: number) => void; onCsv: () => void; nowYear: number;
}) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-mist-200 bg-paper/95 px-4 py-4 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Assessment period</Label>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Semester {half} · {year}</h1>
          <p className="mt-0.5 font-mono text-xs text-mist-600">{fmt(sem.start)} — {fmt(sem.end)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={String(half)}
            onChange={(v) => setHalf(Number(v) as 1 | 2)}
            options={[{ value: "1", label: "Semester 1" }, { value: "2", label: "Semester 2" }]}
          />
          <Stepper value={year} onChange={setYear} min={nowYear - 3} max={nowYear + 1} />
          <Btn onClick={onCsv}><span className="inline-flex items-center gap-1.5"><Icon name="download" className="h-4 w-4" /> Export CSV</span></Btn>
        </div>
      </div>
    </header>
  );
}
