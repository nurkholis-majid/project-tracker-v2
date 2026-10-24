"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTracker } from "@/lib/useTracker";
import type { Epic, EpicService, EpicVault, Flag } from "@/lib/types";
import { catColorMap, catList } from "@/lib/category";
import {
  Btn, CatBadge, Card, Combobox, CreateBtn, ErrorBar, Loading, Modal,
  PageHead, Select, Td, Th, filterCls, inputCls,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { useCanEdit } from "@/lib/permissions";

type SvcDraft = { id?: string; name: string; is_new: boolean };
type VaultDraft = { id?: string; vault_key: string; vault_value: string };

export default function TechnicalImpactPage() {
  const { data, loading, error, save, reload } = useTracker();
  const sb = useMemo(() => supabase(), []);
  const canEdit = useCanEdit("impact");

  const [services, setServices] = useState<EpicService[]>([]);
  const [vault, setVault] = useState<EpicVault[]>([]);
  const [impactLoading, setImpactLoading] = useState(true);
  const [impactErr, setImpactErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [editEpic, setEditEpic] = useState<Epic | null>(null);

  const loadImpact = async () => {
    setImpactLoading(true);
    const [s, v] = await Promise.all([
      sb.from("epic_services").select("*").order("sort_order"),
      sb.from("epic_vault").select("*").order("sort_order"),
    ]);
    if (s.error || v.error) setImpactErr("Technical Impact gagal dimuat — jalankan migration-010 di Supabase.");
    else setImpactErr(null);
    setServices((s.data ?? []) as EpicService[]);
    setVault((v.data ?? []) as EpicVault[]);
    setImpactLoading(false);
  };
  useEffect(() => { loadImpact(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const catMap = useMemo(() => catColorMap(catList(data.epics)), [data.epics]);
  // Saran nama service = yang sudah pernah ada di Technical Impact (bukan dari menu Systems).
  const svcSuggest = useMemo(
    () => Array.from(new Set(services.map((s) => s.name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [services]
  );
  const svcOf = (id: string) => services.filter((s) => s.epic_id === id);
  const vaultOf = (id: string) => vault.filter((v) => v.epic_id === id);
  const flagsOf = (id: string) => data.flags.filter((f) => (f.epic_ids ?? []).includes(id));

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.epics.filter((e) => {
      if (cat !== "all" && (e.category ?? "") !== cat) return false;
      if (!needle) return true;
      const hay = [
        e.name, e.jira_key ?? "",
        ...svcOf(e.id).map((s) => s.name),
        ...flagsOf(e.id).map((f) => f.name),
        ...vaultOf(e.id).map((v) => v.vault_key),
      ].join(" ").toLowerCase();
      return hay.includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.epics, services, vault, data.flags, q, cat]);

  if (loading || impactLoading) return <Loading />;

  return (
    <div>
      <PageHead title="Technical Impact" sub="Microservices, feature flag, dan Vault config yang terdampak tiap epic.">
        <input className={filterCls + " w-56"} placeholder="Search epic / service / flag…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select w="w-44" value={cat} onChange={setCat}
          options={[{ value: "all", label: "All categories" }, ...catList(data.epics).map((c) => ({ value: c, label: c }))]} />
      </PageHead>

      {error && <ErrorBar msg={error} />}
      {impactErr && <div className="mb-4"><ErrorBar msg={impactErr} /></div>}

      <Card scroll offset="12rem">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th className="w-[28%]">Epic</Th>
              <Th className="w-[24%]">Microservices</Th>
              <Th className="w-[24%]">Feature flag</Th>
              <Th className="w-[24%]">Vault</Th>
              <Th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const svc = svcOf(e.id);
              const flags = flagsOf(e.id);
              const vks = vaultOf(e.id);
              return (
                <tr key={e.id} className="border-b border-mist-100 align-top last:border-0 hover:bg-mist-50/60">
                  <Td>
                    <div className="font-medium text-ink-900">{e.name}</div>
                    <div className="mt-1 flex items-center gap-2">
                      {e.jira_key && <span className="font-mono text-[11px] text-ocean-600">{e.jira_key}</span>}
                      <CatBadge name={e.category} color={e.category ? catMap.get(e.category) : undefined} />
                    </div>
                  </Td>
                  <Td>
                    {svc.length ? (
                      <div className="flex flex-col gap-1.5">
                        {svc.map((s) => (
                          <div key={s.id} className="flex items-center gap-1.5 font-mono text-xs text-ink-800">
                            {s.name}
                            {s.is_new && <span className="rounded bg-sun-100 px-1 py-0.5 text-[9px] font-bold text-sun-700">NEW</span>}
                            {s.source === "jira" && <span className="rounded bg-ocean-50 px-1 py-0.5 text-[9px] font-bold text-ocean-600" title="Dari Jira sync">JIRA</span>}
                          </div>
                        ))}
                      </div>
                    ) : <span className="text-xs text-mist-400">—</span>}
                  </Td>
                  <Td>
                    {flags.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {flags.map((f) => (
                          <span key={f.id} className="inline-flex items-center gap-1.5 rounded-md bg-ocean-50 px-2 py-1 font-mono text-[11px] font-semibold text-ocean-700" title={`PROD ${f.prod ? "on" : "off"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${f.prod ? "bg-teal-500" : "bg-mist-300"}`} />{f.name}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-xs text-mist-400">—</span>}
                  </Td>
                  <Td>
                    {vks.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {vks.map((v) => (
                          <span key={v.id} className="rounded-md bg-mist-100 px-2 py-1 font-mono text-[11px] text-ink-700" title={v.vault_value ? `${v.vault_key} = ${v.vault_value}` : v.vault_key}>{v.vault_key}</span>
                        ))}
                      </div>
                    ) : <span className="text-xs text-mist-400">—</span>}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <button
                        onClick={() => canEdit && setEditEpic(e)}
                        disabled={!canEdit}
                        title={canEdit ? "Edit impact" : "View-only access"}
                        className={`rounded-md px-2 py-1 ${canEdit ? "text-mist-600 hover:bg-mist-50 hover:text-ocean-600" : "cursor-not-allowed text-mist-300"}`}>
                        <Icon name="edit" className="h-4 w-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-14 text-center text-sm text-mist-500">No epics match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {editEpic && (
        <ImpactModal
          epic={editEpic}
          svcSuggest={svcSuggest}
          flags={flagsOf(editEpic.id)}
          services={svcOf(editEpic.id)}
          vault={vaultOf(editEpic.id)}
          onClose={() => setEditEpic(null)}
          onSaveFlag={async (name, jira) => {
            await save("feature_flags", { name, jira_key: jira || null, epic_ids: [editEpic.id], dev: false, uat: false, prod: false });
            await reload();
          }}
          onUnlinkFlag={async (f) => {
            await save("feature_flags", { id: f.id, epic_ids: (f.epic_ids ?? []).filter((x) => x !== editEpic.id) });
            await reload();
          }}
          onSave={async (svc, vlt) => {
            const eid = editEpic.id;
            // Hanya ganti baris MANUAL — baris dari Jira sync (source='jira') dibiarkan.
            await sb.from("epic_services").delete().eq("epic_id", eid).eq("source", "manual");
            await sb.from("epic_vault").delete().eq("epic_id", eid).eq("source", "manual");
            const svcRows = svc.filter((s) => s.name.trim()).map((s, i) => ({
              epic_id: eid, name: s.name.trim(), is_new: s.is_new, source: "manual", sort_order: i,
            }));
            const vltRows = vlt.filter((v) => v.vault_key.trim()).map((v, i) => ({
              epic_id: eid, vault_key: v.vault_key.trim(), vault_value: v.vault_value.trim() || null, source: "manual", sort_order: i,
            }));
            if (svcRows.length) await sb.from("epic_services").insert(svcRows);
            if (vltRows.length) await sb.from("epic_vault").insert(vltRows);
            await loadImpact();
            setEditEpic(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */
function ImpactModal({
  epic, svcSuggest, flags, services, vault, onClose, onSave, onSaveFlag, onUnlinkFlag,
}: {
  epic: Epic;
  svcSuggest: string[];
  flags: Flag[];
  services: EpicService[];
  vault: EpicVault[];
  onClose: () => void;
  onSave: (svc: SvcDraft[], vlt: VaultDraft[]) => void;
  onSaveFlag: (name: string, jira: string) => void;
  onUnlinkFlag: (f: Flag) => void;
}) {
  // Baris dari Jira dikelola oleh sync (read-only di sini); yang bisa diedit hanya manual.
  const jiraSvc = services.filter((s) => s.source === "jira");
  const jiraVlt = vault.filter((v) => v.source === "jira");

  const [svc, setSvc] = useState<SvcDraft[]>(
    services.filter((s) => s.source !== "jira").map((s) => ({ id: s.id, name: s.name, is_new: s.is_new }))
  );
  const [vlt, setVlt] = useState<VaultDraft[]>(
    vault.filter((v) => v.source !== "jira").map((v) => ({ id: v.id, vault_key: v.vault_key, vault_value: v.vault_value ?? "" }))
  );
  const [flagName, setFlagName] = useState("");
  const [flagJira, setFlagJira] = useState("");

  const svcOptions = svcSuggest.map((n) => ({ value: n, label: n }));

  const addSvc = () => setSvc((a) => [...a, { name: "", is_new: false }]);
  const addVlt = () => setVlt((a) => [...a, { vault_key: "", vault_value: "" }]);

  return (
    <Modal wide title={epic.name} subtitle="Catat microservices, feature flag, dan Vault config yang terdampak." onClose={onClose}>
      <div className="space-y-6">
        {/* Microservices */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900"><Icon name="systems" className="h-4 w-4 text-mist-500" /> Microservices</h3>
            <Btn onClick={addSvc}><span className="inline-flex items-center gap-1.5"><Icon name="plus" className="h-4 w-4" /> Add service</span></Btn>
          </div>
          {jiraSvc.length > 0 && (
            <div className="mb-2 space-y-1 rounded-lg border border-mist-100 bg-mist-50/60 p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-mist-400">Dari Jira sync (read-only)</div>
              {jiraSvc.map((s) => (
                <div key={s.id} className="flex items-center gap-2 font-mono text-xs text-ink-700">
                  {s.name}
                  {s.is_new && <span className="rounded bg-sun-100 px-1 py-0.5 text-[9px] font-bold text-sun-700">NEW</span>}
                </div>
              ))}
            </div>
          )}
          {svc.length === 0 && jiraSvc.length === 0 && <p className="text-xs text-mist-400">Belum ada service.</p>}
          <div className="space-y-2">
            {svc.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox full creatable value={row.name}
                    onChange={(v) => setSvc((a) => a.map((r, j) => j === i ? { ...r, name: v } : r))}
                    placeholder="Search / add service…"
                    options={svcOptions} />
                </div>
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-700" title="Service belum pernah ke production">
                  <input type="checkbox" checked={row.is_new}
                    onChange={(e) => setSvc((a) => a.map((r, j) => j === i ? { ...r, is_new: e.target.checked } : r))} />
                  New
                </label>
                <button onClick={() => setSvc((a) => a.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-md px-2 py-1 text-mist-400 hover:bg-alert-100 hover:text-alert-600"><Icon name="trash" className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>

        {/* Feature flags (reuse feature_flags) */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900"><Icon name="flag" className="h-4 w-4 text-mist-500" /> Feature flags</h3>
          </div>
          <div className="space-y-1.5">
            {flags.length === 0 && <p className="text-xs text-mist-400">Epic ini belum punya feature flag.</p>}
            {flags.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-ocean-50 px-2 py-1 font-mono text-[11px] font-semibold text-ocean-700">
                  <span className={`h-1.5 w-1.5 rounded-full ${f.prod ? "bg-teal-500" : "bg-mist-300"}`} />{f.name}
                </span>
                {f.jira_key && <span className="font-mono text-[11px] text-mist-500">{f.jira_key}</span>}
                <button onClick={() => onUnlinkFlag(f)} className="ml-auto text-mist-400 hover:text-alert-600" title="Lepas dari epic ini"><Icon name="close" className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input className={inputCls + " min-w-0 flex-1 font-mono"} value={flagName} onChange={(e) => setFlagName(e.target.value)} placeholder="Flag name (FF_...)" />
            <input className={inputCls + " w-32 shrink-0 font-mono"} value={flagJira} onChange={(e) => setFlagJira(e.target.value.toUpperCase())} placeholder="DLB-…" />
            <Btn onClick={() => { if (flagName.trim()) { onSaveFlag(flagName.trim(), flagJira.trim()); setFlagName(""); setFlagJira(""); } }} className="shrink-0">Add</Btn>
          </div>
          <p className="mt-1.5 text-[11px] text-mist-400">Tersimpan di menu Feature Flag (sumber data sama). Juga terisi otomatis dari Jira sync (field label Feature Flag).</p>
        </section>

        {/* Vault */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900"><Icon name="lock" className="h-4 w-4 text-mist-500" /> Vault / config</h3>
            <Btn onClick={addVlt}><span className="inline-flex items-center gap-1.5"><Icon name="plus" className="h-4 w-4" /> Add key</span></Btn>
          </div>
          {jiraVlt.length > 0 && (
            <div className="mb-2 space-y-1 rounded-lg border border-mist-100 bg-mist-50/60 p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-mist-400">Dari Jira sync (read-only)</div>
              {jiraVlt.map((v) => (
                <div key={v.id} className="font-mono text-xs text-ink-700">{v.vault_key}{v.vault_value ? <span className="text-mist-500"> = {v.vault_value}</span> : null}</div>
              ))}
            </div>
          )}
          {vlt.length === 0 && jiraVlt.length === 0 && <p className="text-xs text-mist-400">Tidak ada perubahan Vault.</p>}
          <div className="space-y-2">
            {vlt.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inputCls + " min-w-0 flex-1 font-mono"} value={row.vault_key}
                  onChange={(e) => setVlt((a) => a.map((r, j) => j === i ? { ...r, vault_key: e.target.value } : r))}
                  placeholder="Vault key" />
                <input className={inputCls + " min-w-0 flex-1 font-mono"} value={row.vault_value}
                  onChange={(e) => setVlt((a) => a.map((r, j) => j === i ? { ...r, vault_value: e.target.value } : r))}
                  placeholder="Value" />
                <button onClick={() => setVlt((a) => a.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-md px-2 py-1 text-mist-400 hover:bg-alert-100 hover:text-alert-600"><Icon name="trash" className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-mist-100 pt-4">
          <Btn onClick={onClose}>Cancel</Btn>
          <CreateBtn tone="solid" onClick={() => onSave(svc, vlt)}>Save</CreateBtn>
        </div>
      </div>
    </Modal>
  );
}
