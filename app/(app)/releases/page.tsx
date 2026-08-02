"use client";

import { useMemo, useState } from "react";
import { useTracker } from "@/lib/useTracker";
import { fmt, num } from "@/lib/kpi";
import { DEPLOY_STATUS, type Release, type Story } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import {
  Badge, Btn, ErrorBar, Field, FormActions, JiraLink, Label, Loading, Modal, PageHead,
  RowActions, Select, StatusSelect, filterCls, inputCls, optionsOf,
} from "@/components/ui";

const blank = (): Partial<Release> => ({
  fix_version: "", deploy_date: null, folder_url: "", status: "Planned", notes: "",
});

export default function ReleasesPage() {
  const { data, loading, error, setError, save, remove, patch, reload } = useTracker();
  const [form, setForm] = useState<Partial<Release> | null>(null);
  const [picker, setPicker] = useState<Release | null>(null);
  const [filter, setFilter] = useState("all");

  if (loading) return <Loading />;

  const rows = data.releases.filter((r) => filter === "all" || r.status === filter);

  const submit = async () => {
    if (!form?.fix_version) return;
    const row: Record<string, unknown> = { ...form };
    if (!row.deploy_date) row.deploy_date = null;
    if (await save("releases", row)) setForm(null);
  };

  return (
    <div>
      <PageHead
        title="Release"
      >
        <Select
          w="w-48"
          value={filter}
          onChange={setFilter}
          options={[{ value: "all", label: "Semua release" }, ...optionsOf(DEPLOY_STATUS)]}
        />
        <Btn tone="accent" onClick={() => setForm(blank())}>+ Fix version</Btn>
      </PageHead>

      <ErrorBar msg={error} />

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => {
          const stories = data.stories.filter((s) => s.release_id === r.id);
          const pts = stories.reduce((a, s) => a + num(s.story_points), 0);
          const deployed = stories.filter((s) => s.release_status === "Deployed").length;

          return (
            <div key={r.id} className="flex flex-col rounded-2xl border border-mist-200 bg-white shadow-card">
              <div className="flex items-start justify-between gap-3 border-b border-mist-100 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xl font-semibold">v{r.fix_version}</span>
                    <StatusSelect
                      value={r.status}
                      options={DEPLOY_STATUS}
                      onChange={(v) => patch("releases", r.id, { status: v })}
                    />
                  </div>
                  <div className="mt-1 font-mono text-xs text-mist-600">
                    {r.deploy_date ? `${r.status === "Deployed" ? "Deployed" : "Rencana"} ${fmt(r.deploy_date)}` : "Tanggal deploy belum diisi"}
                    {" · "}{stories.length} story · {pts} pt
                  </div>
                </div>
                <RowActions
                  onEdit={() => setForm(r)}
                  onDelete={() => confirm(`Hapus release v${r.fix_version}?`) && remove("releases", r.id)}
                />
              </div>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <Label>Folder dokumen (TAT, QCR, DR, dll.)</Label>
                  {r.folder_url ? (
                    <a href={r.folder_url} target="_blank" rel="noreferrer"
                      className="mt-1 block truncate text-xs text-ocean-600 underline underline-offset-2">
                      🔗 {r.folder_url}
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-sun-600">⚠️ URL folder SharePoint belum diisi</p>
                  )}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Label>Story di release ini</Label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-mist-400">{deployed}/{stories.length} deployed</span>
                      <button
                        onClick={() => setPicker(r)}
                        className="rounded-lg bg-mist-100 px-2 py-1 text-xs font-medium text-ink-700 hover:bg-sky-200"
                      >
                        + Story
                      </button>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-xl border border-mist-100">
                    {stories.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 border-b border-mist-100 px-3 py-2 last:border-0">
                        <span className="min-w-0 flex-1 truncate text-xs text-ink-700">{s.title}</span>
                        <JiraLink k={s.jira_key} />
                        <Badge v={s.release_status} />
                      </div>
                    ))}
                    {stories.length === 0 && (
                      <p className="px-3 py-6 text-center text-xs text-mist-400">
                        Belum ada story. Klik <b>+ Story</b> untuk memilih.
                      </p>
                    )}
                  </div>
                </div>

                {r.notes && <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-ink-700">📌 {r.notes}</p>}
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-mist-200 bg-white p-10 text-center lg:col-span-2">
            <div className="text-3xl">🚀</div>
            <p className="mt-2 text-sm text-mist-600">Belum ada fix version di filter ini.</p>
          </div>
        )}
      </div>

      {picker && (
        <StoryPicker
          release={picker}
          stories={data.stories}
          epics={data.epics}
          onClose={() => setPicker(null)}
          onError={setError}
          onDone={async () => {
            setPicker(null);
            await reload();
          }}
        />
      )}

      {form && (
        <Modal
          title={form.id ? `Ubah release v${form.fix_version}` : "Fix version baru"}
          subtitle="Dokumen tetap di SharePoint — di sini cukup satu URL folder-nya."
          onClose={() => setForm(null)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Fix version">
                <input className={inputCls + " font-mono"} value={form.fix_version ?? ""}
                  onChange={(e) => setForm({ ...form, fix_version: e.target.value })} placeholder="1.13.0" />
              </Field>
              <Field label="Tanggal deploy">
                <input type="date" className={inputCls} value={form.deploy_date ?? ""}
                  onChange={(e) => setForm({ ...form, deploy_date: e.target.value })} />
              </Field>
              <Field label="Status">
                <Select full value={form.status ?? "Planned"}
                  onChange={(v) => setForm({ ...form, status: v as Release["status"] })} options={optionsOf(DEPLOY_STATUS)} />
              </Field>
            </div>

            <Field label="URL folder SharePoint" hint="Satu folder berisi semua dokumen deployment versi ini.">
              <input className={inputCls} value={form.folder_url ?? ""}
                onChange={(e) => setForm({ ...form, folder_url: e.target.value })}
                placeholder="https://…/00. Done Deploy/1.13.0" />
            </Field>

            <Field label="Notes">
              <textarea rows={3} className={inputCls} value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>

            <FormActions onClose={() => setForm(null)} onSave={submit} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Pilih story untuk sebuah fix version — langsung dari kartu release.

   Menu Need to Deploy hanya menampilkan story yang sudah Done dan belum
   Deployed, jadi untuk release bugfix (yang story-nya belum Done, atau
   sudah pernah rilis) tidak ada jalan masuk sama sekali. Picker ini yang
   menutup celah itu: semua story bisa dipilih, apa pun progress-nya.
--------------------------------------------------------------------- */
function StoryPicker({
  release, stories, epics, onClose, onDone, onError,
}: {
  release: Release;
  stories: Story[];
  epics: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("free");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(
    new Set(stories.filter((s) => s.release_id === release.id).map((s) => s.id))
  );

  const before = useMemo(
    () => new Set(stories.filter((s) => s.release_id === release.id).map((s) => s.id)),
    [stories, release.id]
  );

  const epicName = (id: string | null) => epics.find((e) => e.id === id)?.name;

  const list = useMemo(() => {
    return stories
      .filter((s) => {
        if (scope === "free") return !s.release_id || s.release_id === release.id;
        if (scope === "done") return s.progress === "Done" && (!s.release_id || s.release_id === release.id);
        return true; // semua story, termasuk yang sudah masuk versi lain
      })
      .filter((s) => !q || `${s.title} ${s.jira_key ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => num(b.sprint) - num(a.sprint))
      .slice(0, 200);
  }, [stories, scope, q, release.id]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };

  const submit = async () => {
    const add = Array.from(picked).filter((id) => !before.has(id));
    const drop = Array.from(before).filter((id) => !picked.has(id));
    if (!add.length && !drop.length) return onClose();

    setBusy(true);
    const sb = supabase();

    // Story yang ditambahkan ke release yang sudah Deployed langsung ikut Deployed.
    if (add.length) {
      const { error } = await sb
        .from("stories")
        .update({
          release_id: release.id,
          release_status: release.status === "Deployed" ? "Deployed" : "Merging to UAT",
        })
        .in("id", add);
      if (error) { setBusy(false); return onError("Gagal menambahkan story: " + error.message); }
    }

    // Yang dilepas kembali jadi belum masuk release manapun.
    if (drop.length) {
      const { error } = await sb
        .from("stories")
        .update({ release_id: null, release_status: "-" })
        .in("id", drop);
      if (error) { setBusy(false); return onError("Gagal melepas story: " + error.message); }
    }

    setBusy(false);
    onDone();
  };

  return (
    <Modal
      wide
      title={`Story untuk v${release.fix_version}`}
      subtitle="Centang story yang masuk versi ini. Hilangkan centang untuk melepasnya."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input className={filterCls + " w-64"} placeholder="🔍 Cari story / DLB-…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <Select
            w="w-56"
            value={scope}
            onChange={setScope}
            options={[
              { value: "free", label: "Belum masuk release" },
              { value: "done", label: "✅ Done & belum masuk release" },
              { value: "all", label: "Semua story" },
            ]}
          />
          <span className="ml-auto text-sm text-mist-600">{picked.size} dipilih</span>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-mist-200">
          {list.map((s) => {
            const on = picked.has(s.id);
            const elsewhere = s.release_id && s.release_id !== release.id;
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`flex w-full items-center gap-3 border-b border-mist-100 px-3 py-2 text-left last:border-0 ${
                  on ? "bg-sky-100" : "hover:bg-mist-50"
                }`}
              >
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                  on ? "border-ocean-600 bg-ocean-600 text-white" : "border-mist-200"
                }`}>
                  {on ? "✓" : ""}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-900">{s.title}</span>
                  <span className="block truncate text-xs text-mist-400">
                    {epicName(s.epic_id) ?? "tanpa epic"} · sprint {s.sprint ?? "—"} · {s.story_points ?? 0} pt
                    {elsewhere && " · sudah di versi lain"}
                  </span>
                </span>

                <Badge v={s.progress} />
                <JiraLink k={s.jira_key} />
              </button>
            );
          })}
          {list.length === 0 && (
            <p className="px-3 py-10 text-center text-sm text-mist-400">Nggak ada story yang cocok.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-mist-100 pt-4">
          <Btn onClick={onClose}>Batal</Btn>
          <Btn tone="solid" onClick={submit} disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
