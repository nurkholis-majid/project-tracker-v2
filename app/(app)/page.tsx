"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTracker } from "@/lib/useTracker";
import { computeKpi, currentSemester, epicStats, epicWindow, fmt, num } from "@/lib/kpi";
import type { Story } from "@/lib/types";
import {
  Badge, Card, EmptyRow, ErrorBar, JiraLink, Label, Loading, Metric, PageHead, Progress, ROW, Td, Th,
} from "@/components/ui";

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

  const active = data.epics.filter((e) => e.status !== "Hold" && !e.end_date);
  const inDev = data.stories.filter((s) => s.progress === "In Dev");

  /* ---------- backlog hygiene: yang biasanya baru ketahuan pas tutup semester ---------- */
  const todo: { what: string; why: string; href: string; icon: string }[] = [];

  data.releases.forEach((r) => {
    if (!r.folder_url)
      todo.push({
        icon: "🔗",
        what: `v${r.fix_version} — URL folder SharePoint kosong`,
        why: "Folder ini yang jadi bukti dokumen deployment waktu review KPI.",
        href: "/releases",
      });
    if (r.status === "Planned" && r.deploy_date && r.deploy_date < new Date().toISOString().slice(0, 10))
      todo.push({
        icon: "🗓️",
        what: `v${r.fix_version} — tanggal deploy sudah lewat, status masih Planned`,
        why: "Kalau sudah rilis, ubah statusnya jadi Deployed supaya masuk hitungan semester.",
        href: "/releases",
      });
  });

  data.flags
    .filter((f) => f.uat === true && f.prod !== true)
    .forEach((f) =>
      todo.push({
        icon: "🎚️",
        what: `${f.name} — TRUE di UAT, belum di PROD`,
        why: "Nyalakan saat release, atau catat alasan kalau memang ditahan.",
        href: "/flags",
      })
    );

  data.epics
    .filter((e) => epicWindow(e, data.stories).noDate)
    .forEach((e) =>
      todo.push({
        icon: "🗓️",
        what: `${e.name} — belum punya tanggal sama sekali`,
        why: "Epic tanpa start date dan tanpa story bertanggal nggak masuk hitungan semester manapun.",
        href: "/epics",
      })
    );

  const orphan = data.stories.filter((s) => !s.epic_id).length;
  if (orphan)
    todo.push({
      icon: "🧩",
      what: `${orphan} story belum punya epic`,
      why: "Story point-nya nggak kehitung ke epic manapun.",
      href: "/stories",
    });

  const waiting = data.stories.filter((s) => s.progress === "Done" && s.release_status !== "Deployed").length;
  if (waiting)
    todo.push({
      icon: "🚢",
      what: `${waiting} story Done tapi belum sampai production`,
      why: "Assign ke fix version dan tandai Deployed setelah rilis.",
      href: "/deploy",
    });

  return (
    <div>
      <PageHead
        title="Overview"
        sub={`Ringkasan delivery hari ini — sprint berjalan, velocity, dan hal yang perlu ditindaklanjuti.`}
      />

      <ErrorBar msg={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric v={active.length} k="Epic aktif" icon="📦" />
        <Metric v={inDev.length} k="Story in dev" icon="🔨" />
        <Metric v={velocity.avg} k="Avg velocity" icon="⚡" />
        <Metric v={kpi.epicsDone.length} k={`Epic done · S${sem.half}`} icon="🏆" accent />
        <Metric v={data.stories.filter((s) => s.progress === "Done" && s.release_status !== "Deployed").length}
          k="Menunggu deploy" icon="🚢" />
      </div>

      {/* Sprint aktif + velocity: dua hal yang paling sering ditanya waktu standup */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-mist-200 bg-white p-5 shadow-card">
          <Label>Sprint berjalan</Label>
          {sprintInfo ? (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">Sprint {sprintInfo.current}</span>
              </div>
              <div className="mt-3">
                <Progress pct={sprintInfo.pts ? (sprintInfo.donePts / sprintInfo.pts) * 100 : 0} />
                <div className="mt-1.5 font-mono text-[11px] text-mist-600">
                  {sprintInfo.donePts}/{sprintInfo.pts} point selesai
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-700">
                <span>⚪ Todo <b className="font-mono">{sprintInfo.todo}</b></span>
                <span>🔨 In Dev <b className="font-mono">{sprintInfo.dev}</b></span>
                <span>✅ Done <b className="font-mono">{sprintInfo.done}</b></span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-mist-600">Belum ada story yang punya nomor sprint.</p>
          )}
        </section>

        <section className="rounded-2xl border border-mist-200 bg-white p-5 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <Label>Velocity — story point done per sprint</Label>
            <span className="font-mono text-[11px] text-mist-600">rata-rata {velocity.avg} pt</span>
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
              Belum ada story Done dengan nomor sprint. Tarik dari Jira dulu.
            </p>
          )}
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-5">
          <div>
            <h2 className="mb-2 text-base font-semibold">📦 Epic yang belum selesai</h2>
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
                  {active.map((e) => {
                    const st = stats[e.id];
                    const pct = st?.points ? Math.round((st.donePoints / st.points) * 100) : 0;
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
                  {active.length === 0 && (
                    <EmptyRow cols={5} icon="🎉" msg="Semua epic sudah punya end date." />
                  )}
                </tbody>
              </table>
            </Card>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold">🚀 Antre release</h2>
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
                    <EmptyRow cols={5} icon="🚀" msg="Nggak ada story yang lagi nunggu release." />
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">
            🧹 Perlu dibereskan {todo.length > 0 && <span className="text-mist-400">({todo.length})</span>}
          </h2>
          <div className="space-y-2">
            {todo.slice(0, 12).map((t, i) => (
              <Link
                key={i}
                href={t.href}
                className="block rounded-xl border border-mist-200 bg-white p-3 shadow-card transition hover:border-sun-300"
              >
                <div className="flex gap-2">
                  <span>{t.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-ink-900">{t.what}</div>
                    <div className="mt-0.5 text-xs text-mist-600">{t.why}</div>
                  </div>
                </div>
              </Link>
            ))}
            {todo.length === 0 && (
              <div className="rounded-xl border border-dashed border-mist-200 bg-white p-6 text-center">
                <div className="text-2xl">✨</div>
                <p className="mt-2 text-sm text-mist-600">Bersih — dokumen lengkap, tanggal terisi, flag konsisten.</p>
              </div>
            )}
            {todo.length > 12 && <p className="px-1 text-xs text-mist-400">+{todo.length - 12} lagi</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
