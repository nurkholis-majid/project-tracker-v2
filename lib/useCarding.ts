"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import type { CardingProject, CardingStory } from "./types";

/**
 * Data hook khusus Carding — sengaja terpisah dari useTracker supaya fitur ini
 * berdiri sendiri dan tidak menambah beban query di halaman delivery lain.
 * Pola save/remove/patch-nya dibuat sama seperti useTracker biar konsisten.
 */
export function useCarding() {
  const sb = useMemo(() => supabase(), []);
  const [projects, setProjects] = useState<CardingProject[]>([]);
  const [stories, setStories] = useState<CardingStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s] = await Promise.all([
      sb.from("carding_projects").select("*").order("created_at", { ascending: false }),
      sb.from("carding_stories").select("*").order("sort_order", { ascending: true }),
    ]);
    const err = p.error || s.error;
    if (err) {
      setError("Data carding gagal dimuat: " + err.message);
      setLoading(false);
      return;
    }
    setError("");
    setProjects((p.data ?? []) as CardingProject[]);
    setStories((s.data ?? []) as CardingStory[]);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (table: "carding_projects" | "carding_stories", row: Record<string, unknown>) => {
      const { data, error } = row.id
        ? await sb.from(table).update(row).eq("id", row.id as string).select().single()
        : await sb.from(table).insert(row).select().single();
      if (error) {
        setError(`Gagal menyimpan: ${error.message}`);
        return null;
      }
      await load();
      return data;
    },
    [sb, load]
  );

  const remove = useCallback(
    async (table: "carding_projects" | "carding_stories", id: string) => {
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) {
        setError(`Gagal menghapus: ${error.message}`);
        return false;
      }
      await load();
      return true;
    },
    [sb, load]
  );

  /** Update in-place tanpa reload penuh — dipakai untuk edit poin/urutan yang sering. */
  const patchStory = useCallback(
    async (id: string, changes: Partial<CardingStory>) => {
      setStories((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));
      const { error } = await sb.from("carding_stories").update(changes).eq("id", id);
      if (error) {
        setError(`Perubahan tidak tersimpan: ${error.message}`);
        await load();
      }
    },
    [sb, load]
  );

  const patchProject = useCallback(
    async (id: string, changes: Partial<CardingProject>) => {
      setProjects((list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));
      const { error } = await sb.from("carding_projects").update(changes).eq("id", id);
      if (error) {
        setError(`Perubahan tidak tersimpan: ${error.message}`);
        await load();
      }
    },
    [sb, load]
  );

  return { projects, stories, loading, error, setError, reload: load, save, remove, patchStory, patchProject };
}
