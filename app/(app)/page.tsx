"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTracker } from "@/lib/useTracker";
import { catColor } from "@/lib/category";
import { computeKpi, currentSemester, epicPct, epicStats, epicWindow, fmt, isEpicDone, num } from "@/lib/kpi";
import type { Story } from "@/lib/types";
import {
  Badge, Card, EmptyRow, ErrorBar, JiraLink, Label, Loading, Metric, PageHead, Progress, ROW, Td, Th,
} from "@/components/ui";
import { Ic, Icon } from "@/components/icons";

export default function OverviewPage() {
  const { data, loading, error } = useTracker();
  const sem = currentSemester();
  const kpi = useMemo(() => computeKpi(data, sem), [data, sem]);
  const stats = useMemo(() => epicStats(data), [data]);

  /* ---------- sprint aktif = sprint tertinggi yang masih punya story belum Done ---------- */
  const sprintInfo = useMemo(() => {
    const withSprint = data.stories.filter((s) => s.sprint != null);
    if (!withSprint.length) return null;
    const open = withSprint.filter((s) => s.progress !== "Done");
    const current = Math.max(...(open.length ? open : withSprint).map((s) => s.sprint!));
    const inSprint = withSprint.filter((s) => s.sprint === current);
    const count = (p: Story["progress"]) => inSprint.filter((s) => s.progress === p).length;
    const pts = inSprint.reduce((a, s) => a + num(s.story_points), 0);
    const donePts = inSprint.filter((s) => s.progress === "Done").reduce((a, s) => a + num(s.story_points), 0);
    return { current, todo: count("Todo"), dev: count("In Dev"), done: count("Done"), pts, donePts };
  }, [data.stories]);

  /* ---------- velocity: story point Done per sprint, 6 sprint terakhir ---------- */
  const velocity = useMemo(() => {
    const byS = new Map<number, number>();
    data.stories
      .filter((s) => s.sprint != null && s.progress === "Done")
      .forEach((s) => byS.set(s.sprint!, (byS.get(s.sprint!) ?? 0) + num(s.story_points)));
    const rows = Array.from(byS.entries()).sort((a, b) => a[0] - b[0]).slice(-6);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r[1], 0) / rows.length) : 0;
    return { rows, max, avg };
  }, [data.stories]);

  /* ---------- pipeline release: story yang nunggu rilis, dikelompokkan per fix version ---------- */
  const pipeline = useMemo(() => {
    const map = new Map<string, { version: string; deploy: string | null; stories: Story[] }>();
    data.stories
      .filter((s) => s.release_id && s.release_status !== "Deployed")
      .forEach((s) => {
        const r = data.releases.find((x) => x.id === s.release_id);
        if (!r) return;
        if (!map.has(r.id)) map.set(r.id, { version: r.fix_version, deploy: r.deploy_date, stories: [] });
        map.get(r.id)!.stories.push(s);
      });
    return Array.from(map.values()).sort((a, b) => b.version.localeCompare(a.version));
  }, [data.stories, data.releases]);

  if (loading) return <Loading />;

  // "Belum selesai" = epic yang aktif di semester ini tapi pekerjaannya belum rampung
  // (lihat isEpicDone). Ini yang dulu keliru dipakai !end_date, bikin metriknya 0.
  const ongoingEpics = kpi.epicsRunning.filter((e) => !isEpicDone(e.status, stats[e.id]));
  const inDev = data.stories.filter((s) => s.progress === "In Dev");

  /* ---------- backlog hygiene: dikelompokkan per kategori + prioritas ----------
     prio 1 = risiko rilis (paling kritikal) · 2 = kebersihan data · 3 = dokumentasi/audit.
     Daftar diurutkan naik supaya yang kritikal selalu di atas.                       */
  type Todo = { what: string; why: string; href: string; icon: string; cat: string; prio: 1 | 2 | 3 };
  const todo: Todo[] = [];

  data.flags
    .filter((f) => f.uat === true && f.prod !== true)
    .forEach((f) =>
      todo.push({
        icon: "🚩",
        cat: "Feature Flag",
        prio: 1,
        what: `${f.name} — TRUE in UAT, not yet in PROD`,
        why: "Turn it on at release, or note why it is being held.",
        href: "/flags",
      })
    );

  const waiting = data.stories.filter((s) => s.progress === "Done" && s.release_status !== "Deployed").length;
  if (waiting)
    todo.push({
      icon: "🚢",
      cat: "Release",
      prio: 1,
      what: `${waiting} Done stories not yet in production`,
      why: "Assign a fix version and mark Deployed once shipped.",
      href: "/deploy",
    });

  data.releases.forEach((r) => {
    if (r.status === "Planned" && r.deploy_date && r.deploy_date < new Date().toISOString().slice(0, 10))
      todo.push({
        icon: "🗓️",
        cat: "Release",
        prio: 1,
        what: `v${r.fix_version} — deploy date has passed, still marked Planned`,
        why: "If it is shipped, set the status to Deployed so it counts toward the semester.",
        href: "/releases",
      });
  });

  const orphan = data.stories.filter((s) => !s.epic_id).length;
  if (orphan)
    todo.push({
      icon: "🧩",
      cat: "Data",
      prio: 2,
      what: `${orphan} stories without an epic`,
      why: "Their story points are not counted toward any epic.",
      href: "/stories",
    });

  data.epics
    .filter((e) => epicWindow(e, data.stories).noDate)
    .forEach((e) =>
      todo.push({
        icon: "🗓️",
        cat: "Data",
        prio: 2,
        what: `${e.name} — has no dates at all`,
        why: "An epic with no start date and no dated stories will not count toward any semester.",
        href: "/epics",
      })
    );

  data.releases.forEach((r) => {
    if (!r.folder_url)
      todo.push({
        icon: "🔗",
        cat: "Documentation",
        prio: 3,
        what: `v${r.fix_version} — SharePoint folder URL is empty`,
        why: "This folder is the deployment-document evidence during KPI review.",
        href: "/releases",
      });
  });

  todo.sort((a, b) => a.prio - b.prio); // kritikal (rilis/flag) selalu di atas

  // Warna kategori: merah = risiko rilis, kuning = data, abu = dokumentasi.
  const catTone: Record<number, { pill: string; edge: string }> = {
    1: { pill: "bg-alert-100 text-alert-600 ring-alert-200", edge: "border-l-alert-500" },
    2: { pill: "bg-sun-100 text-sun-700 ring-sun-300", edge: "border-l-sun-500" },
    3: { pill: "bg-mist-100 text-mist-600 ring-mist-200", edge: "border-l-mist-200" },
  };

  const epicCats = (() => {
    const m = new Map<string, number>();
    data.epics.forEach((e) => { const c = (e.category ?? "").trim(); if (c) m.set(c, (m.get(c) ?? 0) + 1); });
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { arr, total: arr.reduce((s, [, n]) => s + n, 0) };
  })();
  const donutBg = (() => {
    let acc = 0;
    return epicCats.arr
      .map(([c, n]) => { const f = (n / epicCats.total) * 100; const seg = `${catColor(c).dot} ${acc}% ${acc + f}%`; acc += f; return seg; })
      .join(", ");
  })();

  return (
    <div>
      <PageHead
        title="Overview"
        sub={`Today’s delivery snapshot — active sprint, velocity, and what needs follow-up.`}
      />

      <ErrorBar msg={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric v={ongoingEpics.length} k={`Unfinished · S${sem.half}`} icon="📦" />
        <Metric v={inDev.length} k="Story in dev" icon="🔨" />
        <Metric v={velocity.avg} k="Avg velocity" icon="⚡" />
        <Metric v={kpi.epicsDone.length} k={`Epics done · S${sem.half}`} icon="🏆" accent />
        <Metric v={data.stories.filter((s) => s.progress === "Done" && s.release_status !== "Deployed").length}
          k="Awaiting deploy" icon="🚢" />
      </div>

      {/* Sprint aktif + velocity: dua hal yang paling sering ditanya waktu standup */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-mist-200 bg-white p-5 shadow-card">
          <Label>Active sprint</Label>
          {sprintInfo ? (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">Sprint {sprintInfo.current}</span>
              </div>
              <div className="mt-3">
                <Progress pct={sprintInfo.pts ? (sprintInfo.donePts / sprintInfo.pts) * 100 : 0} />
                <div className="mt-1.5 font-mono text-[11px] text-mist-600">
                  {sprintInfo.donePts}/{sprintInfo.pts} points done
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-700">
                <span className="inline-flex items-center gap-1"><Icon name="circle" className="h-3.5 w-3.5 text-mist-400" />Todo <b className="font-mono">{sprintInfo.todo}</b></span>
                <span className="inline-flex items-center gap-1"><Icon name="hammer" className="h-3.5 w-3.5 text-sun-600" />In Dev <b className="font-mono">{sprintInfo.dev}</b></span>
                <span className="inline-flex items-center gap-1"><Icon name="done" className="h-3.5 w-3.5 text-ocean-600" />Done <b className="font-mono">{sprintInfo.done}</b></span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-mist-600">No stories have a sprint number yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-mist-200 bg-white p-5 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <Label>Velocity — story point done per sprint</Label>
            <span className="font-mono text-[11px] text-mist-600">avg {velocity.avg} pt</span>
          </div>

          {velocity.rows.length ? (
            <div className="relative mt-5 h-44">
              {/* Garis rata-rata: bikin sprint di atas/bawah target langsung kelihatan */}
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-sun-500"
                style={{ bottom: `calc(1.75rem + ${(velocity.avg / velocity.max) * 100}% * 0.78)` }}
              >
                <span className="absolute -top-4 right-0 rounded bg-sun-100 px-1.5 py-0.5 font-mono text-[10px] text-sun-700">
                  avg {velocity.avg}
                </span>
              </div>

              <div className="flex h-full items-end gap-2 sm:gap-3">
                {velocity.rows.map(([sprint, pts]) => (
                  <div key={sprint} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="font-mono text-[11px] font-semibold text-ink-700">{pts}</span>
                    {/* Tinggi bar dihitung dari sisa ruang kolom (kolomnya h-full, jadi persen valid) */}
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        pts >= velocity.avg ? "bg-ocean-600 hover:bg-ocean-500" : "bg-sky-400 hover:bg-sky-500"
                      }`}
                      style={{ height: `${Math.max(4, (pts / velocity.max) * 78)}%` }}
                      title={`Sprint ${sprint}: ${pts} point`}
                    />
                    <span className="font-mono text-[10px] text-mist-400">S{sprint}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-mist-600">
              No Done stories with a sprint number yet. Pull from Jira first.
            </p>
          )}
        </section>
      </div>

      {epicCats.total > 0 && (
        <section className="mt-5 rounded-2xl border border-mist-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <Label>Epics by category</Label>
            <span className="font-mono text-[11px] text-mist-600">{epicCats.total} epics · {epicCats.arr.length} categories</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-8">
            <div className="relative h-44 w-44 shrink-0 rounded-full" style={{ background: `conic-gradient(${donutBg})` }}>
              <div className="absolute inset-8 grid place-items-center rounded-full bg-white text-center">
                <div>
                  <div className="font-mono text-2xl font-semibold text-ink-900">{epicCats.total}</div>
                  <div className="text-[10px] uppercase tracking-wide text-mist-400">epics</div>
                </div>
              </div>
            </div>
            <div className="flex min-w-[280px] flex-1 flex-col gap-2.5">
              {epicCats.arr.map(([c, n]) => {
                const share = (n / epicCats.total) * 100;
                return (
                  <div key={c} className="flex items-center gap-3 text-[13px]">
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: catColor(c).dot }} />
                    <span className="w-40 shrink-0 truncate text-ink-700" title={c}>{c}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-mist-100">
                      <span className="block h-full rounded-full" style={{ width: `${share}%`, background: catColor(c).dot }} />
                    </div>
                    <span className="w-24 shrink-0 text-right font-mono text-mist-500"><b className="text-ink-800">{n}</b> · {share.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-5">
          <div>
            <h2 className="mb-2 text-base font-semibold">Unfinished epics</h2>
            <Card scroll offset="26rem">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Epic</Th>
                    <Th className="w-24">Jira</Th>
                    <Th className="w-36">Status</Th>
                    <Th className="w-36">Progress</Th>
                    <Th className="w-32">Est. deploy</Th>
                  </tr>
                </thead>
                <tbody>
                  {ongoingEpics.map((e) => {
                    const st = stats[e.id];
                    const pct = epicPct(st);
                    return (
                      <tr key={e.id} className={ROW}>
                        <Td>
                          <Link href="/epics" className="font-medium text-ink-900 hover:text-ocean-600 hover:underline">
                            {e.name}
                          </Link>
                          <div className="text-xs text-mist-400">
                            {num(st?.done)}/{num(st?.total)} story · {num(st?.donePoints)}/{num(st?.points)} pt
                          </div>
                        </Td>
                        <Td><JiraLink k={e.jira_key} /></Td>
                        <Td><Badge v={e.status} /></Td>
                        <Td>
                          <Progress pct={pct} />
                          <div className="mt-1 font-mono text-[10px] text-mist-400">{pct}%</div>
                        </Td>
                        <Td className="font-mono text-xs">{fmt(e.est_deploy)}</Td>
                      </tr>
                    );
                  })}
                  {ongoingEpics.length === 0 && (
                    <EmptyRow cols={5} icon="🎉" msg="All epics this semester are done." />
                  )}
                </tbody>
              </table>
            </Card>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold">Release queue</h2>
            <Card scroll offset="26rem">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th className="w-28">Fix version</Th>
                    <Th className="w-32">Target deploy</Th>
                    <Th className="w-24 text-right">Story</Th>
                    <Th className="w-24 text-right">Point</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map((p) => (
                    <tr key={p.version} className={ROW}>
                      <Td className="font-mono font-semibold text-ink-900">v{p.version}</Td>
                      <Td className="font-mono text-xs">{fmt(p.deploy)}</Td>
                      <Td className="text-right font-mono text-xs">{p.stories.length}</Td>
                      <Td className="text-right font-mono text-xs">
                        {p.stories.reduce((a, s) => a + num(s.story_points), 0)}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(new Set(p.stories.map((s) => s.release_status))).map((st) => (
                            <Badge key={st} v={st} />
                          ))}
                        </div>
                      </Td>
                    </tr>
                  ))}
                  {pipeline.length === 0 && (
                    <EmptyRow cols={5} icon="🚀" msg="No stories waiting for release." />
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">
            Needs attention {todo.length > 0 && <span className="text-mist-400">({todo.length})</span>}
          </h2>
          <div className="space-y-2">
            {todo.slice(0, 12).map((t, i) => (
              <Link
                key={i}
                href={t.href}
                className={`block rounded-xl border border-l-4 border-mist-200 bg-white p-3 shadow-card transition hover:border-mist-400 ${catTone[t.prio].edge}`}
              >
                <div className="flex gap-2">
                  <span className="mt-0.5 text-mist-500"><Ic e={t.icon} className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${catTone[t.prio].pill}`}>
                        {t.cat}
                      </span>
                      <span className="text-sm font-medium text-ink-900">{t.what}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-mist-600">{t.why}</div>
                  </div>
                </div>
              </Link>
            ))}
            {todo.length === 0 && (
              <div className="rounded-xl border border-dashed border-mist-200 bg-white p-6 text-center">
                <div className="flex justify-center text-mist-400"><Icon name="sparkles" className="h-7 w-7" /></div>
                <p className="mt-2 text-sm text-mist-600">All clear — docs complete, dates filled, flags consistent.</p>
              </div>
            )}
            {todo.length > 12 && <p className="px-1 text-xs text-mist-400">+{todo.length - 12} more</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
