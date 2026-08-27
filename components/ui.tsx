"use client";

import { JIRA_BROWSE, META, labelOf } from "@/lib/types";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ic, Icon, iconFor } from "./icons";
import { useCanEdit } from "@/lib/permissions";
import { catColor } from "@/lib/category";

/* ---------------------------------------------------------------- badge */
export function Badge({ v }: { v?: string | null }) {
  const key = v ?? "-";
  const m = META[key] ?? { label: key, icon: "•", tone: "bg-mist-100 text-ink-700 ring-mist-200" };
  const I = iconFor(key);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${m.tone}`}>
      <I className="h-3 w-3" strokeWidth={2} /> {m.label}
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
  const canEdit = useCanEdit();
  return (
    <select
      value={value}
      disabled={!canEdit}
      title={canEdit ? undefined : "View-only access"}
      onChange={(e) => onChange(e.target.value)}
      className={`cursor-pointer appearance-none rounded-full py-1 pl-2 pr-6 text-xs font-medium ring-1 ring-inset transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-sun-500 disabled:cursor-not-allowed disabled:opacity-60 ${m.tone} ${className}`}
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
          {labelOf(o)}
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
  children, onClick, tone = "ghost", type = "button", disabled, title, className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "solid" | "accent" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
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
      title={title}
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
  values.map((v) => ({ value: v, label: labelOf(v) }));

/** Pilihan pendek (2–4 opsi) — satu klik, tanpa buka dropdown. */
export function Combobox({
  value, onChange, options, placeholder = "Search…", empty = "No matches", w = "w-52", full, creatable,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  empty?: string;
  w?: string;
  full?: boolean;
  creatable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : value || placeholder;
  const needle = q.trim().toLowerCase();
  const filtered = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  const canCreate = !!creatable && !!q.trim() && !options.some((o) => o.label.toLowerCase() === needle);

  // Anchor the menu to the trigger using viewport coordinates; it renders in a
  // portal on <body> so it is never clipped by a scrolling/overflow parent and
  // is unaffected by ancestor stacking or transforms. Flip up when short on space.
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, 240);
    const spaceBelow = window.innerHeight - r.bottom;
    if (spaceBelow < 300 && r.top > spaceBelow) setPos({ left: r.left, bottom: window.innerHeight - r.top + 4, width });
    else setPos({ left: r.left, top: r.bottom + 4, width });
  };

  useEffect(() => {
    if (!open) return;
    place();
    inputRef.current?.focus({ preventScroll: true });
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Keep the menu anchored while the page/modal behind scrolls — reposition
    // rather than close, and ignore scrolls that happen inside the menu list.
    const reposition = (e: Event) => { if (panelRef.current?.contains(e.target as Node)) return; place(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} className={`relative ${full ? "w-full" : w}`}>
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)}
        className={`${controlBase} flex w-full items-center justify-between gap-2`}>
        <span className={`truncate ${selected || value ? "" : "text-mist-400"}`}>{displayLabel}</span>
        <Icon name="caret" className="h-4 w-4 shrink-0 text-mist-400" />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={panelRef} className="fixed z-[60] rounded-xl border border-mist-200 bg-white p-1 shadow-lg"
          style={{ left: pos.left, width: pos.width, ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }) }}>
          <div className="p-1">
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
              className="w-full rounded-lg border border-mist-200 px-3 py-1.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ocean-500" />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && <div className="px-3 py-3 text-sm text-mist-400">{empty}</div>}
            {filtered.map((o) => {
              const on = o.value === value;
              return (
                <button key={o.value} type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm ${
                    on ? "bg-ocean-50 font-medium text-ocean-700" : "text-ink-700 hover:bg-mist-50"}`}>
                  <span className="truncate">{o.label}</span>
                  {on && <Icon name="check" className="ml-auto h-4 w-4 shrink-0 text-ocean-600" />}
                </button>
              );
            })}
            {canCreate && (
              <button type="button"
                onClick={() => { onChange(q.trim()); setOpen(false); }}
                className="mt-1 flex w-full items-center gap-2 border-t border-mist-100 px-3 py-2 text-left text-sm font-semibold text-ocean-700 hover:bg-mist-50">
                <span className="text-base leading-none">＋</span> Create “{q.trim()}”
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

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
        className="rounded-l-xl px-3 py-1.5 text-ink-500 hover:bg-mist-50 disabled:opacity-30" aria-label="Decrease">‹</button>
      <span className="min-w-[3.5rem] px-2 text-center font-mono text-sm font-semibold tabular-nums">{value}</span>
      <button onClick={() => value < max && onChange(value + 1)} disabled={value >= max}
        className="rounded-r-xl px-3 py-1.5 text-ink-500 hover:bg-mist-50 disabled:opacity-30" aria-label="Increase">›</button>
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
        className={`mt-4 flex max-h-[92vh] w-full flex-col ${wide ? "max-w-4xl" : "max-w-xl"} rounded-xl bg-white shadow-card`}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-mist-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-mist-600">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close"
            className="rounded-lg px-2 py-1 text-mist-400 hover:bg-mist-50 hover:text-ink-900"><Icon name="close" className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** Colored pill for a free-text category (color derived from the name). */
export function CatBadge({ name }: { name?: string | null }) {
  if (!name) return <span className="text-xs text-mist-400">—</span>;
  const c = catColor(name);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {name}
    </span>
  );
}

/** A mutating action button that disables itself for view-only roles. */
export function CreateBtn({
  children, onClick, tone = "accent", type = "button", disabled, className = "",
}: {
  children: ReactNode; onClick?: () => void; tone?: "solid" | "accent" | "ghost" | "danger";
  type?: "button" | "submit"; disabled?: boolean; className?: string;
}) {
  const canEdit = useCanEdit();
  return (
    <Btn tone={tone} type={type} onClick={canEdit ? onClick : undefined}
      disabled={disabled || !canEdit} title={canEdit ? undefined : "View-only access"} className={className}>
      {children}
    </Btn>
  );
}

export const FormActions = ({ onClose, onSave, saveLabel = "Save" }: {
  onClose: () => void; onSave: () => void; saveLabel?: string;
}) => {
  const canEdit = useCanEdit();
  return (
    <div className="flex justify-end gap-2 border-t border-mist-100 pt-4">
      <Btn onClick={onClose}>Cancel</Btn>
      <Btn tone="solid" onClick={onSave} disabled={!canEdit} title={canEdit ? undefined : "View-only access"}>{saveLabel}</Btn>
    </div>
  );
};

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
      <div className="flex justify-center text-mist-400"><Ic e={icon} className="h-8 w-8" strokeWidth={1.6} /></div>
      <p className="mt-2 text-sm text-mist-600">{msg}</p>
    </td>
  </tr>
);

export const RowActions = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => {
  const canEdit = useCanEdit();
  if (!canEdit)
    return (
      <div className="flex gap-1">
        <button disabled title="View-only access" className="cursor-not-allowed rounded-md px-2 py-1 text-mist-300"><Icon name="edit" className="h-4 w-4" /></button>
        <button disabled title="View-only access" className="cursor-not-allowed rounded-md px-2 py-1 text-mist-300"><Icon name="trash" className="h-4 w-4" /></button>
      </div>
    );
  return (
    <div className="flex gap-1">
      <button onClick={onEdit} title="Edit"
        className="rounded-md px-2 py-1 text-mist-600 hover:bg-mist-50 hover:text-ocean-600"><Icon name="edit" className="h-4 w-4" /></button>
      <button onClick={onDelete} title="Delete"
        className="rounded-md px-2 py-1 text-mist-400 hover:bg-alert-100 hover:text-alert-600"><Icon name="trash" className="h-4 w-4" /></button>
    </div>
  );
};

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
        {icon && <Ic e={icon} className={`h-5 w-5 self-center ${accent ? "text-sun-700" : "text-mist-400"}`} />}
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
      <Icon name="warn" className="mt-0.5 h-4 w-4 shrink-0" /><span>{msg}</span>
    </div>
  ) : null;

export const Loading = () => (
  <div className="flex h-64 flex-col items-center justify-center gap-2 text-mist-400">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-mist-200 border-t-ocean-600" />
    <p className="text-sm">Loading…</p>
  </div>
);
