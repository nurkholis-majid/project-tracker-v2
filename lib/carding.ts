import type { CardingProject, CardingStory } from "./types";

/**
 * Estimasi timeline dari hasil carding.
 *
 * Idenya: setelah project dipecah jadi story dan tiap story ditaksir poinnya,
 * kita bisa menurunkan berapa sprint yang dibutuhkan dan kira-kira selesai kapan —
 * tanpa nebak. Story ditempatkan ke sprint secara berurutan (greedy bin-packing):
 * diisi sampai kapasitas sprint (velocity) penuh, lalu lanjut ke sprint berikutnya.
 * Urutan story (sort_order) menentukan siapa masuk sprint mana, jadi cukup
 * naik/turunkan story untuk mengatur rencana.
 */

export type PackedStory = CardingStory & { sprint: number }; // sprint 1-based

export type SprintLoad = { sprint: number; points: number; stories: PackedStory[] };

export type CardingEstimate = {
  totalStories: number;
  totalPoints: number;
  bufferedPoints: number;   // total + cadangan, dibulatkan ke atas
  sprintCount: number;      // jumlah sprint hasil penempatan
  durationDays: number;     // sprintCount * panjang sprint
  endDate: string | null;   // start_date + durationDays (kalau start diisi)
  packed: PackedStory[];
  loads: SprintLoad[];      // ringkasan beban tiap sprint
  overflowStory: PackedStory | null; // story yang poinnya > velocity (butuh dipecah)
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

/** Tempatkan story berurutan ke dalam sprint sesuai kapasitas velocity. */
export function packSprints(stories: CardingStory[], velocity: number): PackedStory[] {
  const cap = Math.max(1, num(velocity));
  const ordered = [...stories].sort((a, b) => a.sort_order - b.sort_order);

  let sprint = 1;
  let used = 0;
  const packed: PackedStory[] = [];

  for (const s of ordered) {
    const pts = Math.max(0, num(s.points));
    // Story yang tidak muat di sisa sprint dipindah ke sprint berikutnya —
    // kecuali sprint saat ini memang masih kosong (story besar berdiri sendiri).
    if (used > 0 && used + pts > cap) {
      sprint += 1;
      used = 0;
    }
    packed.push({ ...s, sprint });
    used += pts;
    // Story lebih besar dari 1 sprint penuh: tetap 1 baris, tapi ditandai overflow di estimate().
    if (used >= cap) {
      sprint += 1;
      used = 0;
    }
  }
  return packed;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function estimate(project: CardingProject, stories: CardingStory[]): CardingEstimate {
  const velocity = Math.max(1, num(project.velocity));
  const totalPoints = stories.reduce((a, s) => a + num(s.points), 0);
  const bufferedPoints = Math.ceil(totalPoints * (1 + num(project.buffer_pct) / 100));

  const packed = packSprints(stories, velocity);
  const sprintCount = packed.length ? Math.max(...packed.map((p) => p.sprint)) : 0;

  const loads: SprintLoad[] = [];
  for (let i = 1; i <= sprintCount; i++) {
    const inSprint = packed.filter((p) => p.sprint === i);
    loads.push({ sprint: i, points: inSprint.reduce((a, s) => a + num(s.points), 0), stories: inSprint });
  }

  const durationDays = sprintCount * Math.max(1, num(project.sprint_length_days));
  const endDate = project.start_date && sprintCount > 0 ? addDays(project.start_date, durationDays) : null;

  const overflowStory = packed.find((p) => num(p.points) > velocity) ?? null;

  return {
    totalStories: stories.length,
    totalPoints,
    bufferedPoints,
    sprintCount,
    durationDays,
    endDate,
    packed,
    loads,
    overflowStory,
  };
}

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
