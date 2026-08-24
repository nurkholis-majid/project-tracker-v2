"use client";

import {
  AlertTriangle, ArrowDown, ArrowDownAZ, ArrowRight, ArrowUp, ArrowUpRight, Briefcase,
  Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Circle,
  CircleCheck, Clock, Download, Eye, EyeOff, FileText, Flag, Flame, FlaskConical,
  Hammer, Hash, House, Inbox, Layers, LayoutDashboard, Link2, ListChecks, Lock, LogOut, GripVertical,
  MoreHorizontal, Package, PartyPopper, Pencil, Pin, Plus, Puzzle, RefreshCw, Rocket, Search,
  Server, Shield, Ship, Shuffle, SlidersHorizontal, Sparkles, Target, Timer, Trash2,
  Trophy, Wrench, X, Zap, type LucideIcon,
} from "lucide-react";

/** Ikon bernama untuk pemakaian langsung (struktur/tombol). */
export const ICONS = {
  dashboard: LayoutDashboard, home: House, trophy: Trophy, requirements: ListChecks,
  carding: Layers, epic: Package, story: FileText, deploy: Ship, release: Rocket,
  flag: Flag, systems: Server, sync: RefreshCw, signout: LogOut,
  collapse: ChevronsLeft, expand: ChevronsRight, left: ChevronLeft, right: ChevronRight, caret: ChevronDown,
  search: Search, edit: Pencil, trash: Trash2, close: X, check: Check, more: MoreHorizontal,
  calendar: Calendar, link: Link2, download: Download, pin: Pin, clock: Clock,
  eye: Eye, eyeOff: EyeOff, lock: Lock, warn: AlertTriangle, done: CircleCheck,
  hammer: Hammer, velocity: Zap, points: Hash, shield: Shield, sprint: Timer, target: Target,
  cleanup: Wrench, puzzle: Puzzle, merge: Shuffle, sortAlpha: ArrowDownAZ, recent: Clock,
  party: PartyPopper, sparkles: Sparkles, up: ArrowUp, down: ArrowDown, promote: ArrowUpRight,
  circle: Circle, testing: FlaskConical, toggle: SlidersHorizontal, flame: Flame,
  prd: FileText, brd: Briefcase, inbox: Inbox, plus: Plus, grip: GripVertical,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name, className = "h-4 w-4", strokeWidth = 1.9,
}: { name: IconName; className?: string; strokeWidth?: number }) {
  const C = ICONS[name];
  if (!C) return null; // jangan pernah render <undefined/> — cukup kosong daripada crash
  return <C className={className} strokeWidth={strokeWidth} />;
}

/**
 * Peta emoji → ikon garis. Dipakai komponen bersama (Metric, EmptyRow, nav, dll.)
 * supaya properti yang dulu berisi emoji otomatis dirender sebagai ikon —
 * tanpa perlu mengubah setiap pemanggilnya.
 */
const EMOJI: Record<string, LucideIcon> = {
  "🏠": House, "🏆": Trophy, "📋": ListChecks, "🃏": Layers, "📦": Package, "📝": FileText,
  "🚢": Ship, "🚀": Rocket, "🚩": Flag, "🖥": Server, "🔄": RefreshCw, "📊": LayoutDashboard,
  "🔨": Hammer, "⚡": Zap, "🔢": Hash, "🛡": Shield, "🏃": Timer, "🎯": Target, "🗓": Calendar,
  "🔗": Link2, "🧩": Puzzle, "🧹": Wrench, "🎉": PartyPopper, "✨": Sparkles, "⚪": Circle,
  "✅": CircleCheck, "✓": Check, "✕": X, "✎": Pencil, "✏": Pencil, "⚠": AlertTriangle,
  "⬇": Download, "📌": Pin, "🕘": Clock, "🔍": Search, "🔤": ArrowDownAZ, "🔒": Lock,
  "👁": Eye, "🙈": EyeOff, "🔀": Shuffle, "🧪": FlaskConical, "🎚": SlidersHorizontal,
  "🔴": Flame, "🟣": FileText, "🟢": Briefcase, "🗑": Trash2, "🗂": Inbox, "⚲": Search,
  "↑": ArrowUp, "↓": ArrowDown, "→": ArrowRight, "↗": ArrowUpRight, "↩": LogOut,
  "＋": ListChecks /* unused fallback */, "◀": ChevronLeft, "▶": ChevronRight,
  "«": ChevronsLeft, "»": ChevronsRight, "⋯": MoreHorizontal,
};

/** Render ikon dari sebuah string emoji (variation-selector & spasi diabaikan). */
export function Ic({ e, className = "h-4 w-4", strokeWidth = 1.9 }: { e?: string; className?: string; strokeWidth?: number }) {
  if (!e) return null;
  const key = e.replace(/[\uFE0F\s]/g, "");
  const C = EMOJI[key];
  return C ? <C className={className} strokeWidth={strokeWidth} /> : null;
}

/** Ikon untuk status (badge Epic/Story/Release). */
const STATUS: Record<string, LucideIcon> = {
  Requirement: Search, Development: Hammer, "User Testing": FlaskConical, Deploy: Rocket, Hold: Circle,
  Todo: Circle, "In Dev": Hammer, Done: CircleCheck,
  "Merging to UAT": Shuffle, Deployed: CircleCheck, "Not released": Circle, Planned: Calendar,
};
export function iconFor(status?: string | null): LucideIcon {
  return (status && STATUS[status]) || Circle;
}
