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
import { Icon } from "@/components/icons";

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
          options={[{ value: "all", label: "All releases" }, ...optionsOf(DEPLOY_STATUS)]}
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
                    {r.deploy_date ? `${r.status === "Deployed" ? "Deployed" : "Planned"} ${fmt(r.deploy_date)}` : "Deploy date not set"}
                    {" · "}{stories.length} stories · {pts} pt
                  </div>
                </div>
                <RowActions
                  onEdit={() => setForm(r)}
                  onDelete={() => confirm(`Delete release v${r.fix_version}?`) && remove("releases", r.id)}
                />
              </div>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <Label>Document folder (TAT, QCR, DR, etc.)</Label>
                  {r.folder_url ? (
                    <a href={r.folder_url} target="_blank" rel="noreferrer"
                      className="mt-1 block truncate text-xs text-ocean-600 underline underline-offset-2">
                      <span className="inline-flex items-center gap-1"><Icon name="link" className="h-3.5 w-3.5" /> {r.folder_url}</span>
                    </a>
                  ) : (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-sun-600"><Icon name="warn" className="h-3.5 w-3.5" /> SharePoint folder URL not set</p>
                  )}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Label>Stories in this release</Label>
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
                        No stories yet. Click <b>+ Story</b> to choose.
                      </p>
                    )}
                  </div>
                </div>

                {r.notes && <p className="flex items-start gap-2 rounded-xl bg-mist-50 px-3 py-2 text-xs text-ink-700"><Icon name="pin" className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{r.notes}</span></p>}
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-mist-200 bg-white p-10 text-center lg:col-span-2">
            <div className="flex justify-center text-mist-400"><Icon name="release" className="h-8 w-8" /></div>
            <p className="mt-2 text-sm text-mist-600">No fix versions in this filter.</p>
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
          title={form.id ? `Edit release v${form.fix_version}` : "New fix version"}
          subtitle="Documents stay in SharePoint — just one folder URL here."
          onClose={() => setForm(null)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Fix version">
                <input className={inputCls + " font-mono"} value={form.fix_version ?? ""}
                  onChange={(e) => setForm({ ...form, fix_version: e.target.value })} placeholder="1.13.0" />
              </Field>
              <Field label="Deploy date">
                <input type="date" className={inputCls} value={form.deploy_date ?? ""}
                  onChange={(e) => setForm({ ...form, deploy_date: e.target.value })} />
              </Field>
              <Field label="Status">
                <Select full value={form.status ?? "Planned"}
                  onChange={(v) => setForm({ ...form, status: v as Release["status"] })} options={optionsOf(DEPLOY_STATUS)} />
              </Field>
            </div>

            <Field label="SharePoint folder URL" hint="One folder holding all deployment documents for this version.">
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
      if (error) { setBusy(false); return onError("Failed to add stories: " + error.message); }
    }

    // Yang dilepas kembali jadi belum masuk release manapun.
    if (drop.length) {
      const { error } = await sb
        .from("stories")
        .update({ release_id: null, release_status: "-" })
        .in("id", drop);
      if (error) { setBusy(false); return onError("Failed to detach stories: " + error.message); }
    }

    setBusy(false);
    onDone();
  };

  return (
    <Modal
      wide
      title={`Stories for v${release.fix_version}`}
      subtitle="Check the stories that belong to this version. Uncheck to detach them."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input className={filterCls + " w-64"} placeholder="Search stories / DLB-…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <Select
            w="w-56"
            value={scope}
            onChange={setScope}
            options={[
              { value: "free", label: "Not in a release" },
              { value: "done", label: "Done & not in a release" },
              { value: "all", label: "All stories" },
            ]}
          />
          <span className="ml-auto text-sm text-mist-600">{picked.size} selected</span>
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
                  {on ? <Icon name="check" className="h-3 w-3" strokeWidth={3} /> : ""}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-900">{s.title}</span>
                  <span className="block truncate text-xs text-mist-400">
                    {epicName(s.epic_id) ?? "no epic"} · sprint {s.sprint ?? "—"} · {s.story_points ?? 0} pt
                    {elsewhere && " · already in another version"}
                  </span>
                </span>

                <Badge v={s.progress} />
                <JiraLink k={s.jira_key} />
              </button>
            );
          })}
          {list.length === 0 && (
            <p className="px-3 py-10 text-center text-sm text-mist-400">No stories match.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-mist-100 pt-4">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn tone="solid" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
