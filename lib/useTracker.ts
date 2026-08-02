"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { EMPTY_TRACKER, type Tracker } from "./types";
import { compareVersionDesc } from "./kpi";

/**
 * Satu hook untuk seluruh data tracker.
 * Volume data kecil (ratusan baris), jadi ditarik sekaligus lalu difilter di client —
 * ini yang bikin angka epic (total story, point, progress) selalu konsisten
 * tanpa perlu diisi manual seperti di Excel.
 */
export function useTracker() {
  const sb = useMemo(() => supabase(), []);
  const [data, setData] = useState<Tracker>(EMPTY_TRACKER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [epics, stories, releases, docs, flags, systems] = await Promise.all([
      sb.from("epics").select("*").order("created_at", { ascending: false }),
      sb.from("stories").select("*").order("sprint", { ascending: false, nullsFirst: false }),
      sb.from("releases").select("*"),
      sb.from("release_documents").select("*"),
      sb.from("feature_flags").select("*").order("created_at", { ascending: true }),
      sb.from("systems").select("*").order("name", { ascending: true }),  // urutan env diselesaikan di halaman
    ]);

    const firstErr =
      epics.error || stories.error || releases.error || docs.error || flags.error || systems.error;
    if (firstErr) {
      setError("Data gagal dimuat: " + firstErr.message);
      setLoading(false);
      return;
    }

    setError("");
    setData({
      epics: (epics.data ?? []) as Tracker["epics"],
      stories: (stories.data ?? []) as Tracker["stories"],
      // Urutan versi tidak bisa diserahkan ke Postgres: kolomnya text, jadi
      // "1.9.0" akan dianggap > "1.13.0". Diurutkan di sini sekali, dipakai
      // oleh semua halaman dan dropdown.
      releases: ((releases.data ?? []) as Tracker["releases"]).sort((a, b) =>
        compareVersionDesc(a.fix_version, b.fix_version)
      ),
      docs: (docs.data ?? []) as Tracker["docs"],
      // baris lama bisa punya epic_ids null; normalkan jadi array kosong
      flags: ((flags.data ?? []) as Tracker["flags"]).map((f) => ({ ...f, epic_ids: f.epic_ids ?? [] })),
      systems: (systems.data ?? []) as Tracker["systems"],
    });
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    load();
  }, [load]);

  /** Simpan satu baris (insert kalau tanpa id, update kalau ada id), lalu muat ulang. */
  const save = useCallback(
    async (table: string, row: Record<string, unknown>) => {
      const { error } = row.id
        ? await sb.from(table).update(row).eq("id", row.id as string)
        : await sb.from(table).insert(row);
      if (error) {
        setError(`Gagal menyimpan ke ${table}: ${error.message}`);
        return false;
      }
      await load();
      return true;
    },
    [sb, load]
  );

  const remove = useCallback(
    async (table: string, id: string) => {
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) {
        setError(`Gagal menghapus dari ${table}: ${error.message}`);
        return false;
      }
      await load();
      return true;
    },
    [sb, load]
  );

  /** Update in-place tanpa reload penuh — dipakai untuk toggle cepat (progress, feature flag). */
  const patch = useCallback(
    async (table: string, id: string, changes: Record<string, unknown>) => {
      setData((d) => ({
        ...d,
        [tableKey(table)]: (d as any)[tableKey(table)].map((r: any) =>
          r.id === id ? { ...r, ...changes } : r
        ),
      }));
      const { error } = await sb.from(table).update(changes).eq("id", id);
      if (error) {
        setError(`Perubahan tidak tersimpan: ${error.message}`);
        await load();
      }
    },
    [sb, load]
  );

  return { data, loading, error, setError, reload: load, save, remove, patch };
}

const tableKey = (t: string) =>
  ({
    epics: "epics",
    stories: "stories",
    releases: "releases",
    release_documents: "docs",
    feature_flags: "flags",
    systems: "systems",
  }[t] ?? t);
