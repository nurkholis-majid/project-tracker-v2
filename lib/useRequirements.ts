"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import type { ReqCard, ReqStage } from "./types";

/**
 * Data hook menu Requirements — terpisah dari useTracker/useCarding supaya
 * fitur ini berdiri sendiri. Stage & kartu dimuat berbarengan; save/remove
 * generik untuk kedua tabel, plus patch optimistic untuk perubahan yang sering
 * (geser stage, ganti prioritas, centang acceptance criteria).
 */
export function useRequirements() {
  const sb = useMemo(() => supabase(), []);
  const [stages, setStages] = useState<ReqStage[]>([]);
  const [cards, setCards] = useState<ReqCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [st, cd] = await Promise.all([
      sb.from("req_stages").select("*").order("sort_order", { ascending: true }),
      sb.from("req_cards").select("*").order("sort_order", { ascending: true }),
    ]);
    const err = st.error || cd.error;
    if (err) {
      setError("Data requirements gagal dimuat: " + err.message);
      setLoading(false);
      return;
    }
    setError("");
    setStages((st.data ?? []) as ReqStage[]);
    setCards((cd.data ?? []) as ReqCard[]);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (table: "req_stages" | "req_cards", row: Record<string, unknown>) => {
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
    async (table: "req_stages" | "req_cards", id: string) => {
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

  const patchCard = useCallback(
    async (id: string, changes: Partial<ReqCard>) => {
      setCards((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));
      const { error } = await sb.from("req_cards").update(changes).eq("id", id);
      if (error) {
        setError(`Perubahan tidak tersimpan: ${error.message}`);
        await load();
      }
    },
    [sb, load]
  );

  const patchStage = useCallback(
    async (id: string, changes: Partial<ReqStage>) => {
      setStages((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));
      const { error } = await sb.from("req_stages").update(changes).eq("id", id);
      if (error) {
        setError(`Perubahan tidak tersimpan: ${error.message}`);
        await load();
      }
    },
    [sb, load]
  );

  return { stages, cards, loading, error, setError, reload: load, save, remove, patchCard, patchStage };
}
