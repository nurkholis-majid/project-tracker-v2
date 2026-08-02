# LSS Delivery Tracker

Dokumentasi delivery squad LSS dalam satu tempat: **Epic → Story → Release → Feature Flag**, dengan
**Rekap Semester** yang langsung jadi bahan KPI.

Stack: Next.js 14 (App Router) · Supabase (Postgres + Auth + RLS) · Tailwind · deploy di Vercel.

---

## Kenapa begini

| Masalah di Excel | Solusi di sini |
|---|---|
| Total story & story point diketik manual per epic | Dihitung otomatis dari tabel story |
| Sheet deploy terpisah dari sheet story | Story punya kolom `fix_version`; rekap release muncul sendiri |
| Dokumen deploy tersebar di SharePoint | 1 fix version = 1 folder URL + checklist TAT/QCR/DR/Testing Result/UAT Sign Off |
| "Semester ini gue ngapain aja?" | Menu Rekap Semester → metrik + timeline + teks siap tempel |
| Data cuma di laptop lu | Supabase, tim bisa akses barengan |

---

## Setup (± 20 menit)

### 1. Supabase

1. Bikin project di [supabase.com](https://supabase.com) (region Singapore).
2. **SQL Editor** → tempel isi `supabase/schema.sql` → **Run**.
   Lalu jalankan juga file migrasi di folder `supabase/` secara berurutan
   (`migration-002` … `migration-006`) — `migration-006-carding.sql` yang bikin
   tabel untuk menu **Carding**.
3. **Authentication → Users → Add user** → bikin akun buat lu dan tim (email + password, centang *Auto Confirm*).
   Nggak ada halaman sign-up publik; user dibuat dari dashboard biar tools ini nggak bisa diakses orang luar.
4. **Project Settings → API** → catat `Project URL`, `anon public key`, dan `service_role key`.

### 2. Jalanin lokal

```bash
npm install
cp .env.example .env.local     # isi nilainya
npm run dev                    # http://localhost:3000
```

### 3. Deploy ke Vercel

```bash
git init && git add -A && git commit -m "init"
gh repo create lss-delivery-tracker --private --source=. --push
```

Di Vercel: **Add New → Project → import repo** → isi semua environment variable dari `.env.example`
(**Production + Preview**) → Deploy.

> `SUPABASE_SERVICE_ROLE_KEY` **jangan** dikasih prefix `NEXT_PUBLIC_`. Key itu cuma dipakai di
> route server `/api/jira/sync` dan tidak pernah dikirim ke browser.

---

## Jira sync (opsional, tapi ini yang bikin hemat waktu)

Lu **nggak perlu jadi admin Jira**. Cukup API token pribadi:
[id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

Cari ID custom field lu di `{JIRA_BASE_URL}/rest/api/3/field` — cari `Story Points` dan `Sprint`,
lalu isi `JIRA_STORY_POINTS_FIELD` dan `JIRA_SPRINT_FIELD`.

Menu **Jira Sync** → isi JQL (mis. `project = DLB AND Sprint in (64,65)`) → **Tarik dari Jira**.

**Ditarik dari Jira:** judul story, story point, sprint, tanggal (dari jendela sprint), status, dan
relasi story → epic (lewat `parent`).

**Nggak pernah ditimpa:** task list (grup), fix version, status release, URL dokumen, catatan epic,
tanggal & status epic, feature flag. Itu semua data yang Jira nggak punya — makanya tools ini ada.

---

## Cara pakai harian

0. **Sebelum mulai project** → menu **Carding**, pecah inisiatif jadi story, taksir poin tiap story,
   dan lihat perkiraan jumlah sprint + tanggal selesai (atur velocity, panjang sprint, dan buffer).
1. **Sprint planning** → Jira Sync, tarik sprint baru. Story masuk otomatis.
2. **Sepanjang sprint** → menu Story, klik badge progress buat ganti Todo → In Dev → Done.
3. **Mau deploy** → menu Release, bikin fix version, tempel URL folder SharePoint + URL tiap dokumen.
   Balik ke Story, assign story ke fix version itu.
4. **Pakai feature flag?** → menu Feature Flag, klik sel DEV/UAT/PROD buat toggle.
5. **Tutup semester** → menu Rekap Semester, pilih periode, **Salin rekap**. Selesai.

Menu **Overview** nunjukin yang biasanya kelewat: dokumen release yang belum lengkap, flag yang sudah
TRUE di UAT tapi belum di PROD, epic tanpa tanggal (yang berarti nggak akan kehitung di semester manapun).

---

## Struktur

```
app/(app)/          halaman aplikasi (butuh login)
  page.tsx          Overview
  recap/            Rekap Semester — KPI
  epics/ stories/ releases/ flags/ sync/
app/api/jira/sync/  route server: tarik data Jira (pakai service role)
app/login/          sign in
lib/kpi.ts          semua logika semester, agregasi, dan teks rekap
lib/useTracker.ts   satu hook, satu sumber data
supabase/schema.sql tabel + RLS + view epic_stats
```

Nambah kolom baru? Ubah `supabase/schema.sql`, jalankan di SQL Editor, tambahin field-nya di
`lib/types.ts`, lalu di halaman terkait. Nggak ada layer ORM yang perlu diikutin.
