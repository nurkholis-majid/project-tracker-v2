"use client";

import { useMemo, useState } from "react";
import { useTracker } from "@/lib/useTracker";
import {
  barGeom, computeKpi, csvOfStories, epicStats, fmt, recapText, semesterOf, type RecapFormat,
} from "@/lib/kpi";
import {
  BAR_TONE, Badge, Btn, ErrorBar, Label, Loading, Metric, Progress, Segmented, Stepper,
} from "@/components/ui";

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
        <Metric v={kpi.epicsDone.length} k="Epic selesai" icon="🏆" accent />
        <Metric v={kpi.epicsRunning.length} k="Epic berjalan" icon="📦" />
        <Metric v={kpi.releases.length} k="Release ke production" icon="🚀" />
        <Metric v={kpi.pointsDone} k={`Story point · ${kpi.storiesDone.length} story`} icon="🔢" />
      </div>

      {/* Timeline epic */}
      <section className="mb-5 rounded-2xl border border-mist-200 bg-white shadow-card">
        <div className="border-b border-mist-100 px-5 py-4">
          <h2 className="text-base font-semibold">📦 Epic di semester ini</h2>
          <p className="mt-0.5 text-sm text-mist-600">
            Epic tanpa start date manual dihitung dari tanggal story-nya, jadi tetap masuk rekap.
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
              return (
                <div key={e.id} className="grid grid-cols-1 items-center gap-2 lg:grid-cols-12">
                  <div className="min-w-0 lg:col-span-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-ink-900">{e.name}</span>
                      <Badge v={e.status} />
                      {versionsOf(e.id).map((v) => (
                        <span key={v} className="rounded-full bg-ocean-100 px-2 py-0.5 font-mono text-[10px] text-ocean-600">v{v}</span>
                      ))}
                      {e.win.derived && (
                        <span className="rounded-full bg-mist-100 px-2 py-0.5 text-[10px] text-mist-600" title="Tanggal diturunkan dari story">
                          auto
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="w-28"><Progress pct={pct} /></div>
                      <span className="font-mono text-[10px] text-mist-400">
                        {st?.donePoints ?? 0}/{st?.points ?? 0} pt · {pct}%
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
                <div className="text-2xl">🗓️</div>
                <p className="mt-2 text-sm text-mist-600">
                  Belum ada epic di periode ini. Isi start date di menu Epic, atau pastikan story-nya punya tanggal.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- Rekap siap kirim ---------------- */}
      <section className="rounded-2xl border border-mist-200 bg-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mist-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">📋 Rekap siap kirim</h2>
            <p className="mt-0.5 text-sm text-mist-600">
              Ringkasan pencapaian semester ini, tinggal disalin ke email atau deck.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={format}
              onChange={(v) => setFormat(v as RecapFormat)}
              options={[
                { value: "text", label: "Teks" },
                { value: "markdown", label: "Markdown" },
              ]}
            />
            <Btn tone="accent" onClick={copy}>{copied ? "✓ Tersalin" : "📋 Salin"}</Btn>
          </div>
        </div>

        {/* Ringkasan visual — supaya isinya kebaca tanpa harus membaca blok teks */}
        <div className="grid gap-4 border-b border-mist-100 px-5 py-4 lg:grid-cols-3">
          <div className="rounded-xl border border-ocean-200 bg-ocean-100 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-ocean-700">Highlight</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-900">
              <b>{kpi.epicsDone.length}</b> epic selesai dari <b>{kpi.epicsRunning.length}</b> yang berjalan,
              menghasilkan <b>{kpi.pointsDone}</b> story point lewat <b>{kpi.storiesDone.length}</b> story,
              dan <b>{kpi.releases.length}</b> release ke production
              {kpi.sprints.length > 0 && <> sepanjang sprint <b>{kpi.sprints[0]}–{kpi.sprints[kpi.sprints.length - 1]}</b></>}.
            </p>
          </div>

          <div className="rounded-xl border border-mist-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-mist-600">
              🏆 Epic selesai ({kpi.epicsDone.length})
            </div>
            <ul className="mt-2 space-y-1">
              {kpi.epicsDone.slice(0, 6).map((e) => (
                <li key={e.id} className="truncate text-sm text-ink-700">✅ {e.name}</li>
              ))}
              {kpi.epicsDone.length === 0 && <li className="text-sm text-mist-400">Belum ada.</li>}
              {kpi.epicsDone.length > 6 && (
                <li className="text-xs text-mist-400">+{kpi.epicsDone.length - 6} lagi</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-mist-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-mist-600">
              🔨 Masih berjalan ({ongoing.length})
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
              {ongoing.length === 0 && <li className="text-sm text-mist-400">Nggak ada.</li>}
              {ongoing.length > 6 && <li className="text-xs text-mist-400">+{ongoing.length - 6} lagi</li>}
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
          <Label>Periode penilaian</Label>
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
          <Btn onClick={onCsv}>⬇︎ Export CSV</Btn>
        </div>
      </div>
    </header>
  );
}
