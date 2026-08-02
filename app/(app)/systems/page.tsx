"use client";

import { useMemo, useState } from "react";
import { useTracker } from "@/lib/useTracker";
import { ENVIRONMENTS, type Environment, type System } from "@/lib/types";
import {
  Badge, Btn, Card, EmptyRow, ErrorBar, Field, FormActions, Loading, Modal,
  PageHead, ROW, RowActions, Select, Td, Th, filterCls, inputCls,
} from "@/components/ui";

const shortUrl = (url: string) => {
  try {
    const u = new URL(url);
    return u.host + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
};

/** Peringkat environment terendah yang dimiliki sistem: dev(0) < uat(1) < prod(2). */
const ENV_RANK: Record<Environment, number> = { dev: 0, uat: 1, prod: 2 };
const envRankOf = (envs: Environment[]) =>
  envs.length ? Math.min(...envs.map((e) => ENV_RANK[e])) : 99;

const blank = (): Partial<System> => ({
  name: "", description: "", url: "", environments: [], username: "", password: "",
});

export default function SystemsPage() {
  const { data, loading, error, save, remove } = useTracker();
  const [q, setQ] = useState("");
  const [envF, setEnvF] = useState("all");
  const [form, setForm] = useState<Partial<System> | null>(null);
  const [formPwVisible, setFormPwVisible] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set()); // id baris yang password-nya ditampilkan

  const rows = useMemo(() => {
    return data.systems
      .filter(
        (s) =>
          (envF === "all" || (s.environments ?? []).includes(envF as Environment)) &&
          (!q || `${s.name} ${s.description ?? ""} ${s.url ?? ""} ${s.username ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      )
      // urut: nama (A–Z), lalu environment terendah (dev sebelum uat sebelum prod)
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          envRankOf(a.environments ?? []) - envRankOf(b.environments ?? [])
      );
  }, [data.systems, q, envF]);

  if (loading) return <Loading />;

  const submit = async () => {
    if (!form?.name) return;
    const row: Record<string, unknown> = {
      id: form.id,
      name: form.name,
      description: form.description ?? "",
      url: form.url ?? "",
      environments: form.environments ?? [],
      username: form.username ?? "",
      password: form.password ?? "",
    };
    if (!row.id) delete row.id;
    if (await save("systems", row)) {
      setForm(null);
      setFormPwVisible(false);
    }
  };

  const toggleEnv = (env: Environment) => {
    const cur = form?.environments ?? [];
    setForm({ ...form, environments: cur.includes(env) ? cur.filter((e) => e !== env) : [...cur, env] });
  };

  const toggleShow = (id: string) => {
    const next = new Set(shown);
    next.has(id) ? next.delete(id) : next.add(id);
    setShown(next);
  };

  return (
    <div>
      <PageHead
        title="Sistem"
        sub="Daftar website/sistem yang dikembangkan atau berhubungan dengan project, beserta environment, URL, dan kredensialnya."
      >
        <input className={filterCls + " w-56"} placeholder="🔍 Cari sistem…" value={q}
          onChange={(e) => setQ(e.target.value)} />
        <Select
          w="w-44"
          value={envF}
          onChange={setEnvF}
          options={[
            { value: "all", label: "Semua environment" },
            ...ENVIRONMENTS.map((e) => ({ value: e, label: e.toUpperCase() })),
          ]}
        />
        <Btn tone="accent" onClick={() => setForm(blank())}>+ Sistem</Btn>
      </PageHead>

      <ErrorBar msg={error} />

      <Card scroll offset="12rem">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th className="w-52">Nama</Th>
              <Th>Deskripsi</Th>
              <Th className="w-36">Environment</Th>
              <Th className="w-56">URL</Th>
              <Th className="w-40">Username</Th>
              <Th className="w-48">Password</Th>
              <Th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const visible = shown.has(s.id);
              return (
                <tr key={s.id} className={ROW}>
                  <Td className="font-medium text-ink-900">{s.name}</Td>
                  <Td className="whitespace-pre-wrap text-xs text-mist-600">{s.description}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(s.environments ?? []).length ? (
                        (s.environments ?? []).map((e) => <Badge key={e} v={e} />)
                      ) : (
                        <span className="text-xs text-mist-400">—</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer"
                        className="block max-w-[14rem] truncate text-xs text-ocean-600 underline underline-offset-2"
                        title={s.url}>
                        🔗 {shortUrl(s.url)}
                      </a>
                    ) : (
                      <span className="text-xs text-mist-400">—</span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{s.username || <span className="text-mist-400">—</span>}</Td>
                  <Td>
                    {s.password ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{visible ? s.password : "••••••••"}</span>
                        <button
                          onClick={() => toggleShow(s.id)}
                          className="text-mist-400 hover:text-ocean-600"
                          title={visible ? "Sembunyikan" : "Tampilkan"}
                          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
                        >
                          {visible ? "🙈" : "👁️"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-mist-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <RowActions
                      onEdit={() => { setForm(s); setFormPwVisible(false); }}
                      onDelete={() => confirm(`Hapus "${s.name}" dari daftar sistem?`) && remove("systems", s.id)}
                    />
                  </Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <EmptyRow cols={7} icon="🖥️" msg="Belum ada sistem yang cocok. Tambahkan lewat + Sistem." />
            )}
          </tbody>
        </table>
      </Card>

      {form && (
        <Modal
          title={form.id ? "Ubah sistem" : "Sistem baru"}
          subtitle="Catat website/sistem beserta environment dan kredensialnya."
          onClose={() => { setForm(null); setFormPwVisible(false); }}
        >
          <div className="space-y-4">
            <Field label="Nama sistem">
              <input className={inputCls} value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Admin Portal DLB" />
            </Field>

            <Field label="Deskripsi">
              <textarea rows={3} className={inputCls} value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Portal internal untuk traffic controller dan assign taksasor." />
            </Field>

            <Field label="URL">
              <input className={inputCls} value={form.url ?? ""}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://admin.dlb.internal" />
            </Field>

            <Field label="Environment" hint="Boleh pilih lebih dari satu.">
              <div className="flex gap-2">
                {ENVIRONMENTS.map((env) => {
                  const on = (form.environments ?? []).includes(env);
                  return (
                    <button
                      key={env}
                      onClick={() => toggleEnv(env)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        on
                          ? "border-ocean-300 bg-ocean-100 text-ocean-700"
                          : "border-mist-200 bg-white text-mist-600 hover:bg-mist-50"
                      }`}
                    >
                      {on ? "✓ " : ""}{env.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Username">
                <input className={inputCls + " font-mono"} value={form.username ?? ""}
                  onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
              </Field>
              <Field label="Password">
                <div className="relative">
                  <input
                    className={inputCls + " pr-10 font-mono"}
                    type={formPwVisible ? "text" : "password"}
                    value={form.password ?? ""}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setFormPwVisible((v) => !v)}
                    className="absolute inset-y-0 right-2 flex items-center text-mist-400 hover:text-ocean-600"
                    aria-label={formPwVisible ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {formPwVisible ? "🙈" : "👁️"}
                  </button>
                </div>
              </Field>
            </div>

            <FormActions onClose={() => { setForm(null); setFormPwVisible(false); }} onSave={submit} />
          </div>
        </Modal>
      )}
    </div>
  );
}
