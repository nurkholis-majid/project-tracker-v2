"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "./supabase";

export type Level = "none" | "view" | "edit";
export type MenuKey =
  | "overview" | "recap" | "requirements" | "carding" | "epics" | "stories"
  | "deploy" | "releases" | "flags" | "systems" | "sync" | "access";

export const MENU_LABELS: Record<MenuKey, string> = {
  overview: "Overview", recap: "Recap Semester", requirements: "Requirements",
  carding: "Carding", epics: "Epic", stories: "Story", deploy: "Need to Deploy",
  releases: "Release", flags: "Feature Flag", systems: "Systems", sync: "Jira Sync",
  access: "Access",
};

/** Menus shown in the permission matrix, in display order. */
export const MENU_ORDER: MenuKey[] = [
  "overview", "recap", "requirements", "carding", "epics", "stories",
  "deploy", "releases", "flags", "systems", "sync", "access",
];

/** Resolve the current route to a menu key (longest prefix first). */
export function menuForPath(path: string): MenuKey {
  const map: [string, MenuKey][] = [
    ["/recap", "recap"], ["/requirements", "requirements"], ["/carding", "carding"],
    ["/epics", "epics"], ["/stories", "stories"], ["/deploy", "deploy"],
    ["/releases", "releases"], ["/flags", "flags"], ["/systems", "systems"],
    ["/sync", "sync"], ["/access", "access"],
  ];
  for (const [prefix, menu] of map) if (path === prefix || path.startsWith(prefix + "/")) return menu;
  return "overview"; // "/"
}

type PermState = {
  levels: Partial<Record<MenuKey, Level>>;
  isAdmin: boolean;
  loading: boolean;
  /** true once RBAC is live in the DB (migration-008 run). When false we stay
   *  fully permissive so the app behaves exactly as before RBAC existed. */
  active: boolean;
};

const DEFAULT: PermState = { levels: {}, isAdmin: false, loading: true, active: false };
const PermCtx = createContext<PermState>(DEFAULT);

export function PermProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PermState>(DEFAULT);

  useEffect(() => {
    let alive = true;
    supabase()
      .rpc("my_access")
      .then(({ data, error }: { data: { is_admin?: boolean; permissions?: Record<string, Level> } | null; error: unknown }) => {
        if (!alive) return;
        if (error || !data) {
          // RPC missing (pre-migration) or a transient error → stay permissive.
          setState({ levels: {}, isAdmin: false, loading: false, active: false });
          return;
        }
        setState({
          levels: (data.permissions ?? {}) as Partial<Record<MenuKey, Level>>,
          isAdmin: !!data.is_admin,
          loading: false,
          active: true,
        });
      });
    return () => { alive = false; };
  }, []);

  return <PermCtx.Provider value={state}>{children}</PermCtx.Provider>;
}

export function usePerm() { return useContext(PermCtx); }

/** Effective level for a menu. Permissive (edit) until RBAC is active. */
export function useMenuLevel(menu: MenuKey): Level {
  const { levels, active, loading } = usePerm();
  if (loading || !active) return "edit";
  return levels[menu] ?? "none";
}

/** Can the current user edit the given menu (defaults to the current route)? */
export function useCanEdit(menu?: MenuKey): boolean {
  const path = usePathname();
  const { levels, active, loading } = usePerm();
  const key = menu ?? menuForPath(path);
  if (loading || !active) return true; // optimistic; the DB (RLS) is the real lock
  return (levels[key] ?? "none") === "edit";
}
