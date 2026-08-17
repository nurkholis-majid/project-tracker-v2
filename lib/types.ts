export const EPIC_STATUS = ["Requirement", "Development", "User Testing", "Deploy", "Hold"] as const;
export const STORY_PROGRESS = ["Todo", "In Dev", "Done"] as const;
export const RELEASE_STATUS = ["-", "Merging to UAT", "Deployed"] as const;
export const DOC_TYPES = ["TAT", "QCR", "DR", "Testing Result", "UAT Sign Off", "Lainnya"] as const;
export const DEPLOY_STATUS = ["Planned", "Deployed"] as const;
export const ENVIRONMENTS = ["dev", "uat", "prod"] as const;

export type EpicStatus = (typeof EPIC_STATUS)[number];
export type StoryProgress = (typeof STORY_PROGRESS)[number];
export type ReleaseStatus = (typeof RELEASE_STATUS)[number];
export type DocType = (typeof DOC_TYPES)[number];
export type DeployStatus = (typeof DEPLOY_STATUS)[number];
export type Environment = (typeof ENVIRONMENTS)[number];

/**
 * Terminologi tetap istilah agile/PM standar — tim sudah paham, dan "User Testing"
 * lebih presisi daripada terjemahan bebasnya. Simbol dipakai supaya status kebaca
 * sekilas, bukan untuk menggantikan istilahnya.
 */
export const META: Record<string, { label: string; icon: string; tone: string }> = {
  Requirement:      { label: "Requirement",     icon: "✏️", tone: "bg-mist-100 text-ink-700 ring-mist-200" },
  Development:      { label: "Development",     icon: "🔨", tone: "bg-sun-100 text-sun-700 ring-sun-300" },
  "User Testing":   { label: "User Testing",    icon: "🔍", tone: "bg-sky-100 text-sky-600 ring-sky-200" },
  Deploy:           { label: "Deploy",          icon: "🚀", tone: "bg-ocean-100 text-ocean-600 ring-ocean-200" },
  Hold:             { label: "Hold",            icon: "⏸️", tone: "bg-alert-100 text-alert-600 ring-alert-200" },

  Todo:             { label: "Todo",            icon: "⚪", tone: "bg-mist-100 text-mist-600 ring-mist-200" },
  "In Dev":         { label: "In Dev",          icon: "🔨", tone: "bg-sun-100 text-sun-700 ring-sun-300" },
  Done:             { label: "Done",            icon: "✅", tone: "bg-ocean-100 text-ocean-600 ring-ocean-200" },

  "-":              { label: "Not released",    icon: "·",  tone: "bg-mist-50 text-mist-400 ring-mist-200" },
  Planned:          { label: "Planned",          icon: "🗓️", tone: "bg-sun-100 text-sun-700 ring-sun-300" },
  dev:              { label: "DEV",              icon: "🧪", tone: "bg-mist-100 text-ink-700 ring-mist-200" },
  uat:              { label: "UAT",              icon: "🔍", tone: "bg-sky-100 text-sky-600 ring-sky-200" },
  prod:             { label: "PROD",             icon: "🚀", tone: "bg-ocean-100 text-ocean-600 ring-ocean-200" },
  "Merging to UAT": { label: "Merging to UAT",  icon: "🔀", tone: "bg-sky-100 text-sky-600 ring-sky-200" },
  Deployed:         { label: "Deployed",        icon: "🚀", tone: "bg-ocean-100 text-ocean-600 ring-ocean-200" },
};

export const labelOf = (v?: string | null) => META[v ?? "-"]?.label ?? v ?? "—";

export type Epic = {
  id: string;
  name: string;
  jira_key: string | null;
  status: EpicStatus;
  start_date: string | null;
  end_date: string | null;
  est_deploy: string | null;
  notes: string | null;
  created_at: string;
};

export type Story = {
  id: string;
  epic_id: string | null;
  task_group: string | null;
  title: string;
  jira_key: string | null;
  story_points: number | null;
  sprint: number | null;
  start_date: string | null;
  end_date: string | null;
  progress: StoryProgress;
  release_id: string | null;
  release_status: ReleaseStatus;
  jira_status: string | null;
  synced_at: string | null;
};

export type Release = {
  id: string;
  fix_version: string;
  deploy_date: string | null;
  folder_url: string | null;   // satu URL folder SharePoint, tidak per dokumen
  status: DeployStatus;
  notes: string | null;
};

export type ReleaseDoc = {
  id: string;
  release_id: string;
  doc_type: DocType;
  url: string;
};

export type Flag = {
  id: string;
  name: string;
  epic_ids: string[];      // satu flag bisa dipakai beberapa epic
  epic_id: string | null;  // kolom lama, tidak ditulis lagi
  description: string | null;
  dev: boolean | null;
  uat: boolean | null;
  prod: boolean | null;
  jira_key: string | null; // boleh berisi beberapa key, dipisah koma
};

export type SyncRun = {
  id: string;
  ran_at: string;
  jql: string | null;
  epics_upsert: number;
  stories_upsert: number;
  status: string;
  message: string | null;
};

export type Tracker = {
  epics: Epic[];
  stories: Story[];
  releases: Release[];
  docs: ReleaseDoc[];
  flags: Flag[];
  systems: System[];
};

export const EMPTY_TRACKER: Tracker = { epics: [], stories: [], releases: [], docs: [], flags: [], systems: [] };

export const JIRA_BROWSE =
  (process.env.NEXT_PUBLIC_JIRA_BASE_URL || "https://incubation.atlassian.net") + "/browse/";

export type System = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  environments: Environment[];
  username: string | null;
  password: string | null;
  created_at: string;
};

/* =====================================================================
   Carding — breakdown project jadi story, estimasi point & sprint.
   Berdiri sendiri (tabel carding_*), tidak mengubah data delivery di atas.
   ===================================================================== */

/** Skala poin ala Fibonacci — tombol cepat saat menaksir effort. */
export const CARDING_POINTS = [1, 2, 3, 5, 8, 13, 21] as const;

export type CardingProject = {
  id: string;
  name: string;
  description: string | null;
  velocity: number;          // story point yang bisa diselesaikan tim per sprint
  sprint_length_days: number; // durasi 1 sprint (mis. 14 hari)
  start_date: string | null; // tanggal mulai untuk menaksir tanggal selesai
  buffer_pct: number;        // cadangan effort (%) untuk ketidakpastian
  created_at: string;
};

export type CardingStory = {
  id: string;
  project_id: string;
  epic_group: string | null; // pengelompokan opsional (mini-epic / modul)
  title: string;
  points: number;
  sort_order: number;        // urutan menentukan story masuk sprint yang mana
  created_at: string;
};

/* =====================================================================
   Requirements — kanban board PRD/BRD untuk mencatat kebutuhan user.
   Stage bisa dikustom (tabel req_stages); kartu urut per prioritas.
   ===================================================================== */

export const REQ_CATEGORIES = ["PRD", "BRD"] as const;
export const REQ_PRIORITIES = ["hi", "med", "lo"] as const;
export type ReqCategory = (typeof REQ_CATEGORIES)[number];
export type ReqPriority = (typeof REQ_PRIORITIES)[number];

/** rank menentukan urutan kartu dalam satu kolom: High (0) di atas, Low (2) di bawah. */
export const REQ_PRIORITY_META: Record<ReqPriority, { label: string; rank: number }> = {
  hi:  { label: "High",   rank: 0 },
  med: { label: "Medium", rank: 1 },
  lo:  { label: "Low",    rank: 2 },
};

export const REQ_CATEGORY_META: Record<ReqCategory, { label: string }> = {
  PRD: { label: "PRD · Product" },
  BRD: { label: "BRD · Business" },
};

export type ReqCriterion = { text: string; done: boolean };
export type ReqLink = { label: string; url: string };

export type ReqStage = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type ReqCard = {
  id: string;
  code: string;
  stage_id: string | null;
  category: ReqCategory;
  priority: ReqPriority;
  title: string;
  requester: string | null;
  target_date: string | null;
  description: string | null;
  criteria: ReqCriterion[];
  links: ReqLink[];
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};
