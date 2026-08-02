"use client";

import { JIRA_BROWSE, META, labelOf } from "@/lib/types";
import { useEffect, type ReactNode } from "react";

/* ---------------------------------------------------------------- badge */
export function Badge({ v }: { v?: string | null }) {
  const key = v ?? "-";
  const m = META[key] ?? { label: key, icon: "•", tone: "bg-mist-100 text-ink-700 ring-mist-200" };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${m.tone}`}>
      {m.icon} {m.label}
    </span>
  );
}

/**
 * Dropdown yang tampil seperti badge — bisa langsung pilih status apa pun,
 * tanpa harus klik berkali-kali untuk memutar nilainya.
 */
export function StatusSelect({
  value, options, onChange, className = "",
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const m = META[value] ?? { icon: "•", tone: "bg-mist-100 text-ink-700 ring-mist-200" };
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`cursor-pointer appearance-none rounded-full py-1 pl-2 pr-6 text-xs font-medium ring-1 ring-inset transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-sun-500 ${m.tone} ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath fill='%234B5190' d='M3 4.5 6 8l3-3.5z'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 4px center",
        backgroundSize: "12px",
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {META[o]?.icon} {labelOf(o)}
        </option>
      ))}
    </select>
  );
}

export const BAR_TONE: Record<string, string> = {
  Requirement: "bg-mist-400",
  Development: "bg-sun-500",
  "User Testing": "bg-sky-400",
  Deploy: "bg-ocean-600",
  Hold: "bg-alert-500",
};

/* ---------------------------------------------------------------- atoms */
export const Label = ({ children }: { children: ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-widest text-mist-600">{children}</div>
);

/** Dasar kontrol form. Lebar TIDAK dipaksa penuh — biar bisa diatur per pemakaian. */
const controlBase =
  "rounded-lg border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-mist-400 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-100";

/** Untuk field di dalam form (selalu selebar kolomnya). */
export const inputCls = `w-full ${controlBase}`;
/** Untuk filter di toolbar (lebar mengikuti isi, tidak melar). */
export const filterCls = controlBase;

export function Btn({
  children, onClick, tone = "ghost", type = "button", disabled, className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "solid" | "accent" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const tones = {
    solid:  "bg-ocean-600 text-white hover:bg-ocean-700 shadow-sm",
    // Aksi utama sekarang biru (mengikuti btn-primary referensi) — dulu oranye.
    accent: "bg-ocean-600 font-semibold text-white hover:bg-ocean-700 shadow-sm",
    ghost:  "bg-white text-ink-700 ring-1 ring-inset ring-mist-200 hover:bg-mist-50",
    danger: "bg-white text-alert-600 ring-1 ring-inset ring-alert-200 hover:bg-alert-100",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <Label>{label}</Label>
    {children}
    {hint && <p className="text-xs text-mist-600">{hint}</p>}
  </div>
);

/** Dropdown biasa. `w` mengatur lebarnya; default mengikuti isi. */
export function Select({
  value, onChange, options, w = "w-auto", full,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  w?: string;
  full?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${full ? "w-full" : w} ${controlBase}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export const optionsOf = (values: readonly string[]) =>
  values.map((v) => ({ value: v, label: `${META[v]?.icon ?? ""} ${labelOf(v)}`.trim() }));

/** Pilihan pendek (2–4 opsi) — satu klik, tanpa buka dropdown. */
export function Segmented({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-xl border border-mist-200 bg-white p-1 shadow-card">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              on ? "bg-ocean-600 font-semibold text-white shadow-sm" : "text-ink-700 hover:bg-mist-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value, onChange, min, max,
}: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-mist-200 bg-white shadow-card">
      <button onClick={() => value > min && onChange(value - 1)} disabled={value <= min}
        className="rounded-l-xl px-3 py-1.5 text-ink-500 hover:bg-mist-50 disabled:opacity-30" aria-label="Sebelumnya">‹</button>
      <span className="min-w-[3.5rem] px-2 text-center font-mono text-sm font-semibold tabular-nums">{value}</span>
      <button onClick={() => value < max && onChange(value + 1)} disabled={value >= max}
        className="rounded-r-xl px-3 py-1.5 text-ink-500 hover:bg-mist-50 disabled:opacity-30" aria-label="Berikutnya">›</button>
    </div>
  );
}

/* --------------------------------------------------------------- modal */
export function Modal({
  title, subtitle, onClose, children, wide,
}: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/50 p-3 sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={`mt-4 w-full ${wide ? "max-w-4xl" : "max-w-xl"} rounded-xl bg-white shadow-card`}>
        <div className="flex items-start justify-between gap-4 border-b border-mist-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-mist-600">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Tutup"
            className="rounded-lg px-2 py-1 text-mist-400 hover:bg-mist-50 hover:text-ink-900">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const FormActions = ({ onClose, onSave, saveLabel = "Simpan" }: {
  onClose: () => void; onSave: () => void; saveLabel?: string;
}) => (
  <div className="flex justify-end gap-2 border-t border-mist-100 pt-4">
    <Btn onClick={onClose}>Batal</Btn>
    <Btn tone="solid" onClick={onSave}>{saveLabel}</Btn>
  </div>
);

/* --------------------------------------------------------------- table */
export const Th = ({ children, className = "" }: { children?: ReactNode; className?: string }) => (
  <th className={`sticky top-0 z-10 border-b border-mist-200 bg-mist-50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-mist-600 ${className}`}>
    {children}
  </th>
);

export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => (
  <td className={`border-b border-mist-100 px-3 py-2.5 align-top text-sm text-ink-700 ${className}`}>
    {children}
  </td>
);

/**
 * `scroll` membuat isi tabel di-scroll sendiri, sehingga header tabel (yang sticky)
 * tetap terlihat. Tingginya mengikuti sisa layar — bukan 70vh — supaya tabel tidak
 * berhenti di tengah dan menyisakan ruang kosong di bawahnya.
 *
 * `offset` = perkiraan tinggi yang sudah terpakai di atas tabel (header halaman,
 * kartu metrik, dsb). Kartu tetap menyusut kalau isinya sedikit.
 */
export const Card = ({
  children, scroll, offset = "13rem",
}: { children: ReactNode; scroll?: boolean; offset?: string }) => (
  <div
    className={`rounded-xl border border-mist-200 bg-white shadow-card ${
      scroll ? "min-h-[16rem] overflow-auto" : "overflow-x-auto"
    }`}
    style={scroll ? { maxHeight: `calc(100dvh - ${offset})` } : undefined}
  >
    {children}
  </div>
);

/** Baris tabel: garis pemisah + sorotan halus saat kursor lewat (abu-abu netral). */
export const ROW = "transition-colors hover:bg-mist-50";

export const EmptyRow = ({ cols, msg, icon = "🗂️" }: { cols: number; msg: string; icon?: string }) => (
  <tr>
    <td colSpan={cols} className="px-3 py-14 text-center">
      <div className="text-2xl">{icon}</div>
      <p className="mt-2 text-sm text-mist-600">{msg}</p>
    </td>
  </tr>
);

export const RowActions = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
  <div className="flex gap-1">
    <button onClick={onEdit} title="Ubah"
      className="rounded-md px-2 py-1 text-xs text-mist-600 hover:bg-mist-50 hover:text-ocean-600">✏️</button>
    <button onClick={onDelete} title="Hapus"
      className="rounded-md px-2 py-1 text-xs text-mist-400 hover:bg-alert-100 hover:text-alert-600">🗑️</button>
  </div>
);

export function JiraLink({ k }: { k?: string | null }) {
  if (!k) return <span className="text-xs text-mist-400">—</span>;
  const keys = k.split(",").map((x) => x.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
      {keys.map((key) => (
        <a key={key} href={JIRA_BROWSE + key} target="_blank" rel="noreferrer"
          className="font-mono text-xs text-ocean-600 underline decoration-ocean-200 underline-offset-2 hover:decoration-ocean-600">
          {key}
        </a>
      ))}
    </div>
  );
}

/**
 * Header halaman yang menempel saat di-scroll: judul, subjudul, dan toolbar filter
 * tetap terlihat sampai ke baris terakhir tabel.
 */
export function PageHead({
  title, sub, children,
}: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-mist-200 bg-paper/95 px-4 py-4 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-[16rem] flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {sub && <p className="mt-1 max-w-3xl text-sm text-mist-600">{sub}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}

export function Metric({ v, k, icon, accent }: { v: number | string; k: string; icon?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-card ${accent ? "border-sun-300 bg-sun-100" : "border-mist-200 bg-white"}`}>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-semibold tabular-nums ${accent ? "text-sun-700" : "text-ink-900"}`}>{v}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className={`mt-1 text-[10px] font-semibold uppercase tracking-widest ${accent ? "text-sun-700" : "text-mist-600"}`}>{k}</div>
    </div>
  );
}

export const Progress = ({ pct, tone = "bg-ocean-600" }: { pct: number; tone?: string }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-mist-100">
    <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
  </div>
);

export const ErrorBar = ({ msg }: { msg: string }) =>
  msg ? (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-alert-200 bg-alert-100 px-3 py-2 text-sm text-alert-600">
      <span>⚠️</span><span>{msg}</span>
    </div>
  ) : null;

export const Loading = () => (
  <div className="flex h-64 flex-col items-center justify-center gap-2 text-mist-400">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-mist-200 border-t-ocean-600" />
    <p className="text-sm">Memuat data…</p>
  </div>
);
