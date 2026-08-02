"use client";

import { useMemo, useState } from "react";
import { useTracker } from "@/lib/useTracker";
import type { Epic, Flag } from "@/lib/types";
import {
  Badge, Btn, Card, EmptyRow, ErrorBar, Field, FormActions, JiraLink, Loading, Modal,
  PageHead, ROW, RowActions, Select, Td, Th, inputCls,
} from "@/components/ui";

/** TRUE → FALSE → belum dipasang (null) → TRUE … */
const cycle = (v: boolean | null) => (v === true ? false : v === false ? null : true);
const show = (v: boolean | null) => (v === true ? "TRUE" : v === false ? "FALSE" : "—");
const cellCls = (v: boolean | null) =>
  v === true
    ? "bg-ocean-100 text-ocean-600 hover:bg-ocean-200"
    : v === false
    ? "bg-alert-100 text-alert-600 hover:bg-alert-200"
    : "text-mist-400 hover:bg-mist-50";

const blank = (): Partial<Flag> => ({
  name: "", epic_ids: [], description: "", dev: null, uat: null, prod: null, jira_key: "",
});

export default function FlagsPage() {
  const { data, loading, error, save, remove, patch } = useTracker();
  const [form, setForm] = useState<Partial<Flag> | null>(null);
  const [env, setEnv] = useState("all");

  const epicById = useMemo(() => Object.fromEntries(data.epics.map((e) => [e.id, e])), [data.epics]);

  const rows = useMemo(() => {
    if (env === "all") return data.flags;
    if (env === "prod_off") return data.flags.filter((f) => f.uat === true && f.prod !== true);
    if (env === "on") return data.flags.filter((f) => f.prod === true);
    return data.flags;
  }, [data.flags, env]);

  if (loading) return <Loading />;

  const submit = async () => {
    if (!form?.name) return;
    const row: Record<string, unknown> = {
      id: form.id,
      name: form.name,
      epic_ids: form.epic_ids ?? [],
      description: form.description ?? "",
      dev: form.dev ?? null,
      uat: form.uat ?? null,
      prod: form.prod ?? null,
      jira_key: form.jira_key || null,
    };
    if (!row.id) delete row.id;
    if (await save("feature_flags", row)) setForm(null);
  };

  /** Jira key ikut terisi dari epic yang dipilih — tetap bisa diedit manual. */
  const pickEpics = (ids: string[]) => {
    const keys = ids.map((id) => epicById[id]?.jira_key).filter(Boolean).join(", ");
    setForm((f) => ({ ...f, epic_ids: ids, jira_key: keys || f?.jira_key || "" }));
  };

  return (
    <div>
      <PageHead
        title="Feature Flag"
      >
        <Select
          w="w-56"
          value={env}
          onChange={setEnv}
          options={[
            { value: "all", label: "Semua flag" },
            { value: "prod_off", label: "⚠️ TRUE di UAT, belum PROD" },
            { value: "on", label: "✅ TRUE di PROD" },
          ]}
        />
        <Btn tone="accent" onClick={() => setForm(blank())}>+ Feature flag</Btn>
      </PageHead>

      <ErrorBar msg={error} />

      <Card scroll offset="12rem">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th className="w-64">Nama flag</Th>
              <Th className="w-56">Epic</Th>
              <Th>Deskripsi</Th>
              <Th className="w-20 text-center">DEV</Th>
              <Th className="w-20 text-center">UAT</Th>
              <Th className="w-20 text-center">PROD</Th>
              <Th className="w-28">Jira</Th>
              <Th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className={ROW}>
                <Td className="font-mono text-xs font-medium text-ink-900">{f.name}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {(f.epic_ids ?? []).map((id) =>
                      epicById[id] ? (
                        <span key={id} className="rounded-full bg-mist-100 px-2 py-0.5 text-xs text-ink-700">
                          {epicById[id].name}
                        </span>
                      ) : null
                    )}
                    {(f.epic_ids ?? []).length === 0 && <span className="text-xs text-mist-400">—</span>}
                  </div>
                </Td>
                <Td className="whitespace-pre-wrap text-xs text-mist-600">{f.description}</Td>
                {(["dev", "uat", "prod"] as const).map((k) => (
                  <td key={k} className="border-b border-mist-100 p-0 text-center">
                    <button
                      onClick={() => patch("feature_flags", f.id, { [k]: cycle(f[k]) })}
                      className={`h-full w-full px-3 py-2.5 font-mono text-xs font-semibold ${cellCls(f[k])}`}
                    >
                      {show(f[k])}
                    </button>
                  </td>
                ))}
                <Td><JiraLink k={f.jira_key} /></Td>
                <Td>
                  <RowActions
                    onEdit={() => setForm(f)}
                    onDelete={() => confirm(`Hapus flag ${f.name}?`) && remove("feature_flags", f.id)}
                  />
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <EmptyRow cols={8} icon="🎚️" msg="Belum ada flag di filter ini." />
            )}
          </tbody>
        </table>
      </Card>

      {form && (
        <Modal
          title={form.id ? "Ubah feature flag" : "Feature flag baru"}
          subtitle="Satu flag bisa dipakai di beberapa epic sekaligus."
          onClose={() => setForm(null)}
          wide
        >
          <div className="space-y-4">
            <Field label="Nama flag">
              <input className={inputCls + " font-mono"} value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="FF_BE_V1_transferHybridMode" />
            </Field>

            <Field
              label="Epic yang pakai flag ini"
              hint="Bisa pilih lebih dari satu. Jira key ikut terisi otomatis dari epic yang dicentang."
            >
              <EpicPicker
                epics={data.epics}
                selected={form.epic_ids ?? []}
                onChange={pickEpics}
              />
            </Field>

            <Field label="Jira key" hint="Boleh lebih dari satu, pisahkan dengan koma.">
              <input className={inputCls + " font-mono"} value={form.jira_key ?? ""}
                onChange={(e) => setForm({ ...form, jira_key: e.target.value.toUpperCase() })}
                placeholder="DLB-8833, DLB-9931" />
            </Field>

            <Field label="Deskripsi">
              <textarea rows={4} className={inputCls} value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ketika flag = true: transfer < 100 juta pakai RTOL, ≥ 100 juta pakai BI-FAST." />
            </Field>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-mist-600">
                Konfigurasi per environment
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([["dev", "DEV"], ["uat", "UAT"], ["prod", "PROD"]] as const).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setForm({ ...form, [k]: cycle(form[k] ?? null) })}
                    className={`rounded-xl border px-3 py-3 font-mono text-sm font-semibold transition ${
                      form[k] === true
                        ? "border-ocean-200 bg-ocean-100 text-ocean-600"
                        : form[k] === false
                        ? "border-alert-200 bg-alert-100 text-alert-600"
                        : "border-mist-200 bg-white text-mist-400"
                    }`}
                  >
                    {l}: {show(form[k] ?? null)}
                  </button>
                ))}
              </div>
            </div>

            <FormActions onClose={() => setForm(null)} onSave={submit} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Daftar epic dengan centang — ada kolom cari, cukup untuk puluhan epic. */
function EpicPicker({
  epics, selected, onChange,
}: {
  epics: Epic[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const list = epics.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="rounded-xl border border-mist-200 bg-white">
      <div className="border-b border-mist-100 p-2">
        <input className={inputCls} placeholder="🔍 Cari epic…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-52 overflow-y-auto p-1">
        {list.map((e) => {
          const on = selected.includes(e.id);
          return (
            <button
              key={e.id}
              onClick={() => toggle(e.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                on ? "bg-sky-100 text-ink-900" : "text-ink-700 hover:bg-mist-50"
              }`}
            >
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                on ? "border-ocean-600 bg-ocean-600 text-white" : "border-mist-200"
              }`}>
                {on ? "✓" : ""}
              </span>
              <span className="truncate">{e.name}</span>
              {e.jira_key && <span className="ml-auto font-mono text-[10px] text-mist-400">{e.jira_key}</span>}
            </button>
          );
        })}
        {list.length === 0 && <p className="p-3 text-center text-xs text-mist-400">Epic nggak ketemu.</p>}
      </div>
      {selected.length > 0 && (
        <div className="border-t border-mist-100 px-3 py-2 text-xs text-mist-600">
          {selected.length} epic dipilih
        </div>
      )}
    </div>
  );
}
