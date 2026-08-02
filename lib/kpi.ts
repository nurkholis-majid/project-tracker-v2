import type { Epic, Release, Story, Tracker } from "./types";

export type Semester = {
  half: 1 | 2;
  year: number;
  label: string;
  start: string;
  end: string;
  months: string[];
};

export function semesterOf(year: number, half: 1 | 2): Semester {
  return {
    half,
    year,
    label: `Semester ${half} · ${year}`,
    start: half === 1 ? `${year}-01-01` : `${year}-07-01`,
    end: half === 1 ? `${year}-06-30` : `${year}-12-31`,
    months:
      half === 1
        ? ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"]
        : ["Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  };
}

export function currentSemester(): Semester {
  const d = new Date();
  return semesterOf(d.getFullYear(), d.getMonth() < 6 ? 1 : 2);
}

export const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const inSemester = (iso: string | null, s: Semester) => !!iso && iso >= s.start && iso <= s.end;

/**
 * Bandingkan fix version sebagai deret angka, bukan teks.
 * Sebagai teks, "1.9.0" akan dianggap lebih besar dari "1.13.0" karena '9' > '1'.
 * Segmen non-angka (mis. "1.13.0-rc1") diabaikan nilainya, tapi tidak bikin error.
 */
export function compareVersionDesc(a: string, b: string) {
  const parts = (v: string) => v.split(/[.\-_]/).map((x) => parseInt(x, 10) || 0);
  const pa = parts(a), pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (d !== 0) return d;
  }
  return b.localeCompare(a);
}

/**
 * Rentang waktu efektif sebuah epic.
 *
 * Kalau start/end date epic belum diisi manual, tanggalnya diturunkan dari story-nya:
 * mulai = story paling awal, selesai = story terakhir (hanya kalau semua story sudah Done).
 * Tanpa ini, epic hasil sync Jira (yang tidak punya tanggal) tidak akan pernah
 * muncul di rekap semester — persis masalah "0 project berjalan" padahal kerjaan banyak.
 */
export function epicWindow(e: Epic, stories: Story[]) {
  const own = stories.filter((s) => s.epic_id === e.id);
  const pick = (arr: (string | null)[]) => arr.filter(Boolean).sort() as string[];
  const starts = pick(own.map((s) => s.start_date));
  const ends = pick(own.map((s) => s.end_date));
  const allDone = own.length > 0 && own.every((s) => s.progress === "Done");

  const start = e.start_date ?? starts[0] ?? null;
  const end = e.end_date ?? (allDone ? ends[ends.length - 1] ?? null : null);

  return {
    start,
    end,
    derived: (!e.start_date && !!start) || (!e.end_date && !!end),
    noDate: !start,
  };
}

export const overlapsSemester = (w: { start: string | null; end: string | null }, s: Semester) => {
  if (!w.start) return false;
  const end = w.end || "9999-12-31";
  return w.start <= s.end && end >= s.start;
};

export type EpicStat = { total: number; points: number; done: number; donePoints: number };

export function epicStats(t: Tracker): Record<string, EpicStat> {
  const m: Record<string, EpicStat> = {};
  t.epics.forEach((e) => (m[e.id] = { total: 0, points: 0, done: 0, donePoints: 0 }));
  t.stories.forEach((s) => {
    if (!s.epic_id) return;
    const x = m[s.epic_id];
    if (!x) return;
    x.total += 1;
    x.points += num(s.story_points);
    if (s.progress === "Done") {
      x.done += 1;
      x.donePoints += num(s.story_points);
    }
  });
  return m;
}

export type EpicWithWindow = Epic & { win: ReturnType<typeof epicWindow> };

export type Kpi = {
  sem: Semester;
  epicsRunning: EpicWithWindow[];
  epicsDone: EpicWithWindow[];
  storiesDone: Story[];
  pointsDone: number;
  releases: Release[];
  sprints: number[];
};

export function computeKpi(t: Tracker, sem: Semester): Kpi {
  const withWin: EpicWithWindow[] = t.epics.map((e) => ({ ...e, win: epicWindow(e, t.stories) }));

  const epicsRunning = withWin
    .filter((e) => overlapsSemester(e.win, sem))
    .sort((a, b) => (a.win.start || "").localeCompare(b.win.start || ""));
  const epicsDone = epicsRunning.filter((e) => inSemester(e.win.end, sem));

  const storiesDone = t.stories.filter((s) => s.progress === "Done" && inSemester(s.end_date, sem));
  const pointsDone = storiesDone.reduce((a, s) => a + num(s.story_points), 0);
  const releases = t.releases.filter((r) => r.status === "Deployed" && inSemester(r.deploy_date, sem));
  const sprints = Array.from(
    new Set(storiesDone.map((s) => s.sprint).filter((x): x is number => x != null))
  ).sort((a, b) => a - b);

  return { sem, epicsRunning, epicsDone, storiesDone, pointsDone, releases, sprints };
}

/** Story yang sudah Done tapi belum ter-deploy — bahan menu "Need to Deploy". */
export function needDeploy(t: Tracker): Story[] {
  return t.stories.filter((s) => s.progress === "Done" && s.release_status !== "Deployed");
}

/* ------------------------------------------------------------------ rekap */
export type RecapFormat = "text" | "markdown";

export function recapText(t: Tracker, kpi: Kpi, format: RecapFormat = "text"): string {
  const stats = epicStats(t);
  const relById = Object.fromEntries(t.releases.map((r) => [r.id, r]));
  const md = format === "markdown";
  const L: string[] = [];

  const h1 = (s: string) => (md ? `# ${s}` : s.toUpperCase());
  const h2 = (s: string) => (md ? `\n## ${s}` : `\n${s.toUpperCase()}`);
  const b = (s: string) => (md ? `**${s}**` : s);
  const li = (s: string) => (md ? `- ${s}` : `• ${s}`);

  const versionsOf = (epicId: string) =>
    Array.from(
      new Set(
        t.stories
          .filter((s) => s.epic_id === epicId && s.release_id && relById[s.release_id])
          .map((s) => relById[s.release_id!].fix_version)
      )
    );

  L.push(h1(`Rekap ${kpi.sem.label.replace(" · ", " ")}`), "");
  L.push(
    `${b("Ringkasan")}: ${kpi.epicsDone.length} epic selesai dari ${kpi.epicsRunning.length} epic yang berjalan · ` +
      `${kpi.pointsDone} story point delivered (${kpi.storiesDone.length} story) · ` +
      `${kpi.releases.length} release ke production` +
      (kpi.sprints.length ? ` · sprint ${kpi.sprints[0]}–${kpi.sprints[kpi.sprints.length - 1]}` : "")
  );

  const done = kpi.epicsDone;
  const ongoing = kpi.epicsRunning.filter((e) => !done.includes(e));

  const block = (e: EpicWithWindow) => {
    const st = stats[e.id] ?? { total: 0, points: 0, done: 0, donePoints: 0 };
    const vers = versionsOf(e.id);
    const parts = [
      `${st.done}/${st.total} story`,
      `${st.donePoints}/${st.points} pt`,
      `${fmt(e.win.start)}–${fmt(e.win.end)}`,
    ];
    if (vers.length) parts.push(`release ${vers.map((v) => `v${v}`).join(", ")}`);
    L.push(li(`${b(e.name)}${e.jira_key ? ` (${e.jira_key})` : ""} — ${e.status} · ${parts.join(" · ")}`));
    if (e.notes) L.push(md ? `  - _${e.notes.replace(/\n/g, " · ")}_` : `    ${e.notes.replace(/\n/g, " · ")}`);
  };

  if (done.length) {
    L.push(h2(`Epic selesai (${done.length})`), "");
    done.forEach(block);
  }
  if (ongoing.length) {
    L.push(h2(`Epic masih berjalan (${ongoing.length})`), "");
    ongoing.forEach(block);
  }
  if (kpi.releases.length) {
    L.push(h2(`Release ke production (${kpi.releases.length})`), "");
    kpi.releases.forEach((r) => {
      const n = t.stories.filter((s) => s.release_id === r.id).length;
      L.push(li(`v${r.fix_version} — ${fmt(r.deploy_date)} · ${n} story`));
    });
  }

  return L.join("\n");
}

export function barGeom(win: { start: string | null; end: string | null }, s: Semester) {
  const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;
  const span = days(s.start, s.end) || 1;
  const from = win.start && win.start > s.start ? win.start : s.start;
  const to = win.end && win.end < s.end ? win.end : s.end;
  const left = Math.max(0, (days(s.start, from) / span) * 100);
  const width = Math.max(2, Math.min(100 - left, (days(from, to) / span) * 100));
  return { left, width };
}

export function csvOfStories(t: Tracker): string {
  const epicName = (id: string | null) => t.epics.find((e) => e.id === id)?.name ?? "";
  const relName = (id: string | null) => t.releases.find((r) => r.id === id)?.fix_version ?? "";
  const head = ["Epic", "Task List", "Story", "Jira", "Point", "Sprint", "Start", "End", "Progress", "Fix Version", "Status Release"];
  const rows = t.stories.map((s) => [
    epicName(s.epic_id), s.task_group ?? "", s.title, s.jira_key ?? "",
    s.story_points ?? "", s.sprint ?? "", s.start_date ?? "", s.end_date ?? "",
    s.progress, relName(s.release_id), s.release_status,
  ]);
  return [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
