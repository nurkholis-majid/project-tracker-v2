import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/* --------------------------------------------------------------------
   Tarik issue dari Jira (read-only) ke Supabase.

   Yang DITIMPA dari Jira : judul, story point, sprint, tanggal sprint,
                            status Jira, relasi story -> epic,
                            dan (opsional) progress.
   Yang TIDAK DISENTUH    : task_group, release_id, release_status,
                            notes, tanggal & status epic, feature flag.
   Jadi kolom custom lu aman meski sync dijalankan berkali-kali.
-------------------------------------------------------------------- */

type JiraIssue = { key: string; fields: Record<string, any> };

const mapProgress = (statusCategoryKey?: string) => {
  if (statusCategoryKey === "done") return "Done";
  if (statusCategoryKey === "indeterminate") return "In Dev";
  return "Todo";
};

/** Epic = hierarchyLevel 1. Nama tipe bisa beda per instance, jadi jangan cuma andalkan "Epic". */
const isEpicType = (t: any) => t?.hierarchyLevel === 1 || t?.name === "Epic";

async function requireUser() {
  const store = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data } = await sb.auth.getUser();
  return data.user;
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Harus login dulu." }, { status: 401 });

  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY } = process.env;
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    const missing = Object.entries({ JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN })
      .filter(([, v]) => !v)
      .map(([k]) => k);
    return NextResponse.json(
      { error: `Environment variable belum terbaca: ${missing.join(", ")}. Kalau sudah diisi di Vercel, redeploy dulu.` },
      { status: 400 }
    );
  }

  const spField = process.env.JIRA_STORY_POINTS_FIELD || "customfield_10016";
  const sprintField = process.env.JIRA_SPRINT_FIELD || "customfield_10020";
  const epicLinkField = process.env.JIRA_EPIC_LINK_FIELD; // opsional: skema lama (Epic Link)

  const body = await req.json().catch(() => ({}));
  const jql: string =
    body.jql ||
    process.env.JIRA_DEFAULT_JQL ||
    `project = ${JIRA_PROJECT_KEY || "DLB"} ORDER BY updated DESC`;
  const overwriteProgress: boolean = body.overwriteProgress !== false;

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const authHeaders = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // Endpoint /rest/api/3/search sudah DIHAPUS Atlassian. Penggantinya /rest/api/3/search/jql:
  // paginasi pakai nextPageToken, dan `fields` WAJIB disebut (defaultnya cuma "id").
  const fieldList = ["summary", "status", "issuetype", "parent", "resolutiondate", spField, sprintField];
  if (epicLinkField) fieldList.push(epicLinkField);

  /** Ambil semua issue untuk satu JQL, ikuti nextPageToken sampai habis. */
  async function search(q: string): Promise<JiraIssue[]> {
    const out: JiraIssue[] = [];
    let token: string | undefined;
    const seenTokens = new Set<string>();

    for (let page = 0; page < 20; page++) {
      const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/search/jql`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          jql: q,
          fields: fieldList,
          maxResults: 100,
          // Recent edits may not be visible without this — Jira's read-after-write note.
          reconcileIssues: [] as number[],
          ...(token ? { nextPageToken: token } : {}),
        }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Jira menolak permintaan (${res.status}). ${(await res.text()).slice(0, 200)}`);

      const json = await res.json();
      const batch: JiraIssue[] = json.issues ?? [];
      out.push(...batch);

      token = json.nextPageToken;
      if (!token || json.isLast === true || batch.length === 0) break;
      // Pengaman: endpoint ini punya bug yang bisa mengulang token dan bikin loop tak berujung.
      if (seenTokens.has(token)) break;
      seenTokens.add(token);
    }

    const seen = new Set<string>();
    return out.filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)));
  }

  let issues: JiraIssue[];
  try {
    issues = await search(jql);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const db = adminClient();
  const storyIssues = issues.filter((i) => !isEpicType(i.fields.issuetype));

  /* ---------------------------------------------------------------
     Epic dikumpulkan dari DUA sumber:
     1. issue bertipe Epic yang kebetulan ikut di hasil JQL
     2. field `parent` milik tiap story — Jira ikut mengirim
        parent.fields.summary, jadi nama epic-nya sudah di tangan.
     Sumber kedua ini yang penting: JQL lu biasanya cuma narik story,
     jadi tanpa ini tabel epic bakal kosong dan story jadi yatim.
  --------------------------------------------------------------- */
  const epicNames = new Map<string, string>(); // jira_key -> nama

  issues.filter((i) => isEpicType(i.fields.issuetype)).forEach((i) => epicNames.set(i.key, i.fields.summary));

  const epicKeyOf = (f: Record<string, any>): string | undefined => {
    if (f.parent?.key && isEpicType(f.parent.fields?.issuetype)) return f.parent.key;
    if (epicLinkField && f[epicLinkField]) return String(f[epicLinkField]);
    return undefined;
  };

  const namelessKeys = new Set<string>();
  storyIssues.forEach((i) => {
    const key = epicKeyOf(i.fields);
    if (!key || epicNames.has(key)) return;
    const summary = i.fields.parent?.fields?.summary;
    if (summary) epicNames.set(key, summary);
    else namelessKeys.add(key); // dari Epic Link lama: cuma dapat key, namanya perlu diambil terpisah
  });

  // Satu request tambahan untuk mengambil nama epic yang belum ketahuan.
  if (namelessKeys.size) {
    try {
      const found = await search(`key in (${Array.from(namelessKeys).join(",")})`);
      found.forEach((i) => epicNames.set(i.key, i.fields.summary));
    } catch {
      namelessKeys.forEach((k) => epicNames.set(k, k)); // fallback: pakai key sebagai nama sementara
    }
  }

  let epicCount = 0;
  if (epicNames.size) {
    const rows = Array.from(epicNames, ([jira_key, name]) => ({ jira_key, name }));
    const { error } = await db.from("epics").upsert(rows, { onConflict: "jira_key" });
    if (error) return NextResponse.json({ error: "Gagal simpan epic: " + error.message }, { status: 500 });
    epicCount = rows.length;
  }

  // peta jira_key -> id, untuk menyambungkan story ke epic-nya
  const { data: allEpics } = await db.from("epics").select("id,jira_key");
  const epicIdByKey = new Map((allEpics ?? []).filter((e) => e.jira_key).map((e) => [e.jira_key!, e.id]));

  // story yang sudah ada: dipakai agar sync tidak menimpa field lokal
  const { data: existing } = await db.from("stories").select("id,jira_key,progress,epic_id");
  const existingByKey = new Map((existing ?? []).map((s) => [s.jira_key, s]));

  /* ---------- stories ---------- */
  let storyCount = 0;
  let unlinked = 0;

  if (storyIssues.length) {
    // Sprint bisa datang sebagai array of objek {id,name,...} ATAU (Jira lama)
    // array of string "com.atlassian...@[id=25254,name=LSS Sprint 66,...]".
    // Ambil nomor sprint dari name; kalau tak ada, pakai id. Jangan pernah NaN —
    // kolom sprint bertipe integer, dan satu NaN menolak seluruh batch.
    const sprintNumber = (raw: unknown): number | null => {
      if (raw == null) return null;
      if (typeof raw === "object") {
        const o = raw as any;
        const fromName = String(o.name ?? "").match(/(\d+)\s*$/)?.[1];
        const n = Number(fromName ?? o.id);
        return Number.isFinite(n) ? n : null;
      }
      const str = String(raw);
      const fromName = str.match(/name=[^,\]]*?(\d+)/)?.[1];
      const fromId = str.match(/id=(\d+)/)?.[1];
      const n = Number(fromName ?? fromId ?? str.match(/\d+/)?.[0]);
      return Number.isFinite(n) ? n : null;
    };
    const dateField = (raw: unknown, key: "startDate" | "endDate"): string | null => {
      if (raw && typeof raw === "object") {
        const v = (raw as any)[key];
        return v ? String(v).slice(0, 10) : null;
      }
      if (typeof raw === "string") {
        const m = raw.match(new RegExp(`${key}=([^,\\]]+)`));
        return m && m[1] !== "<null>" ? m[1].slice(0, 10) : null;
      }
      return null;
    };

    const rows = storyIssues.map((i) => {
      const f = i.fields;
      const sprints: any[] = Array.isArray(f[sprintField]) ? f[sprintField] : [];
      const last = sprints[sprints.length - 1];
      const prev = existingByKey.get(i.key);

      const pts = Number(f[spField]);
      const row: Record<string, unknown> = {
        jira_key: i.key,
        title: f.summary,
        story_points: Number.isFinite(pts) ? pts : 0,
        sprint: sprintNumber(last),
        jira_status: f.status?.name ?? "",
        synced_at: new Date().toISOString(),
      };

      const start = dateField(last, "startDate");
      const end = dateField(last, "endDate");
      if (start) row.start_date = start;
      if (end) row.end_date = end;

      const key = epicKeyOf(f);
      const epicId = key ? epicIdByKey.get(key) : undefined;
      if (epicId) row.epic_id = epicId;
      else if (prev?.epic_id) row.epic_id = prev.epic_id; // sudah di-assign manual, jangan dilepas
      else unlinked += 1;

      if (overwriteProgress) row.progress = mapProgress(f.status?.statusCategory?.key);
      else if (prev) row.progress = prev.progress;

      return row;
    });

    const { error } = await db.from("stories").upsert(rows, { onConflict: "jira_key" });
    if (error)
      return NextResponse.json(
        {
          error:
            "Gagal simpan story: " +
            error.message +
            (error.details ? ` — ${error.details}` : "") +
            (error.hint ? ` (${error.hint})` : ""),
        },
        { status: 500 }
      );
    storyCount = rows.length;
  }

  await db.from("sync_runs").insert({
    jql,
    epics_upsert: epicCount,
    stories_upsert: storyCount,
    status: "ok",
    message: `${issues.length} issue diproses, ${unlinked} story tanpa epic`,
  });

  // 0 issue biasanya bukan error kode: JQL-nya memang tidak match apa pun.
  // Beri petunjuk supaya jelas ini soal query, bukan bug sync.
  const hint =
    issues.length === 0
      ? "JQL ini tidak menghasilkan issue apa pun di Jira. Cek nama sprint/component, atau coba query paling sederhana: project = " +
        (JIRA_PROJECT_KEY || "DLB")
      : issues.length > 0 && storyCount === 0 && epicCount === 0
      ? `Jira mengembalikan ${issues.length} issue, tapi tidak ada yang tersimpan. ` +
        `Terklasifikasi sebagai epic: ${issues.length - storyIssues.length}, sebagai story: ${storyIssues.length}.`
      : undefined;

  return NextResponse.json({
    ok: true,
    epics: epicCount,
    stories: storyCount,
    total: issues.length,
    storyIssues: storyIssues.length,
    epicIssues: issues.length - storyIssues.length,
    unlinked,
    hint,
    jql,
  });
}
