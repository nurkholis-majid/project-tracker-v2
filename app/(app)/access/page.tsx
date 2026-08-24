"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Btn, Card, ErrorBar, Field, Loading, Modal, PageHead, Select, Td, Th, inputCls,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { usePerm, MENU_ORDER, MENU_LABELS, type Level, type MenuKey } from "@/lib/permissions";

type Role = { id: string; name: string; is_admin: boolean };
type UserRow = {
  user_id: string; email: string; role_id: string | null;
  role_name: string | null; last_sign_in_at: string | null;
};

const LEVELS: [Level, string][] = [["none", "No access"], ["view", "View"], ["edit", "Edit"]];

function LevelPicker({ value, onChange }: { value: Level; onChange: (l: Level) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-mist-200 bg-mist-50 p-0.5">
      {LEVELS.map(([l, lbl]) => {
        const on = value === l;
        const tone = !on
          ? "text-mist-500 hover:text-ink-700"
          : l === "none" ? "bg-white text-ink-700 shadow-sm"
          : l === "view" ? "bg-ocean-600 text-white"
          : "bg-[#0E9384] text-white";
        return (
          <button key={l} onClick={() => onChange(l)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition ${tone}`}>{lbl}</button>
        );
      })}
    </div>
  );
}

export default function AccessPage() {
  const { isAdmin, loading: permLoading, active } = usePerm();
  const sb = useMemo(() => supabase(), []);

  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Record<string, Partial<Record<MenuKey, Level>>>>({});
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selRole, setSelRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async () => {
    setLoading(true);
    setErr(null);
    const [rolesRes, permsRes, usersRes] = await Promise.all([
      sb.from("roles").select("*").order("name"),
      sb.from("role_permissions").select("role_id,menu,level"),
      sb.rpc("admin_list_users"),
    ]);
    const rolesArr = (rolesRes.data ?? []) as Role[];
    setRoles(rolesArr);
    const pmap: Record<string, Partial<Record<MenuKey, Level>>> = {};
    ((permsRes.data ?? []) as { role_id: string; menu: MenuKey; level: Level }[])
      .forEach((r) => { (pmap[r.role_id] ||= {})[r.menu] = r.level; });
    setPerms(pmap);
    setUsers((usersRes.data ?? []) as UserRow[]);
    setSelRole((cur) => cur || rolesArr[0]?.id || "");
    if (rolesRes.error || usersRes.error) setErr("Couldn't load everything — check that you're signed in as an admin.");
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isAdmin]);

  const setLevel = async (roleId: string, menu: MenuKey, level: Level) => {
    setPerms((p) => ({ ...p, [roleId]: { ...(p[roleId] ?? {}), [menu]: level } }));
    const { error } = await sb.from("role_permissions").upsert({ role_id: roleId, menu, level });
    if (error) { setErr("Couldn't save that change."); load(); }
  };

  const createRole = async () => {
    const name = newName.trim();
    if (!name) return;
    const { data, error } = await sb.from("roles").insert({ name }).select().single();
    if (error || !data) { setErr("Couldn't create the role (name may already exist)."); return; }
    await sb.from("role_permissions").insert(MENU_ORDER.map((m) => ({ role_id: (data as Role).id, menu: m, level: "none" })));
    setNewName(""); setShowNew(false);
    await load();
    setSelRole((data as Role).id);
  };

  const setUserRole = async (userId: string, roleId: string) => {
    setUsers((us) => us.map((u) => u.user_id === userId
      ? { ...u, role_id: roleId, role_name: roles.find((r) => r.id === roleId)?.name ?? null } : u));
    const { error } = await sb.rpc("admin_set_user_role", { p_user: userId, p_role: roleId });
    if (error) { setErr("Couldn't change that user's role."); load(); }
  };

  const summary = (roleId: string) => {
    const p = perms[roleId] ?? {};
    const vals = MENU_ORDER.map((m) => p[m] ?? "none");
    const e = vals.filter((v) => v === "edit").length;
    const v = vals.filter((v) => v === "view").length;
    if (e === MENU_ORDER.length) return "Full access";
    if (v === MENU_ORDER.length) return "View only";
    return `${e} edit · ${v} view`;
  };

  if (permLoading) return <Loading />;

  if (!active)
    return (
      <>
        <PageHead title="Access" sub="Roles and permissions." />
        <Card><div className="p-12 text-center text-sm text-mist-600">
          Access control isn't set up on this database yet. Run <span className="font-mono">migration-008-rbac.sql</span> in the Supabase SQL editor first.
        </div></Card>
      </>
    );

  if (!isAdmin)
    return (
      <>
        <PageHead title="Access" sub="Roles and permissions." />
        <Card><div className="p-12 text-center text-sm text-mist-600">You don't have access to this page.</div></Card>
      </>
    );

  const selected = roles.find((r) => r.id === selRole);

  return (
    <>
      <PageHead title="Access" sub="Roles decide what each person can do. Every menu is No access, View, or Edit (full create / update / delete).">
        <Btn tone="accent" onClick={() => setShowNew(true)}>+ New role</Btn>
      </PageHead>

      {err && <div className="mb-4"><ErrorBar msg={err} /></div>}
      {loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
            {/* roles */}
            <Card>
              <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-mist-400">Roles</div>
              <div className="px-2 pb-2">
                {roles.map((r) => (
                  <button key={r.id} onClick={() => setSelRole(r.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${
                      r.id === selRole ? "bg-ocean-50" : "hover:bg-mist-50"}`}>
                    <span className={`text-[13px] font-medium ${r.id === selRole ? "text-ocean-700" : "text-ink-700"}`}>{r.name}</span>
                    {r.is_admin && <span className="rounded-full bg-ocean-100 px-2 py-0.5 text-[10px] font-semibold text-ocean-700">admin</span>}
                    <span className="ml-auto text-[11px] text-mist-400">{summary(r.id)}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* matrix */}
            <Card>
              <div className="flex items-center justify-between border-b border-mist-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{selected?.name ?? "—"}</h2>
                  {selected?.is_admin && <span className="rounded-full bg-ocean-100 px-2 py-0.5 text-[10px] font-semibold text-ocean-700">can manage access</span>}
                </div>
                <span className="text-xs text-mist-400">Set the level for each menu</span>
              </div>
              <table className="w-full">
                <tbody>
                  {MENU_ORDER.map((m) => (
                    <tr key={m} className="border-b border-mist-100 last:border-0">
                      <td className="px-4 py-2.5 text-sm font-medium text-ink-700">{MENU_LABELS[m]}</td>
                      <td className="px-4 py-2.5 text-right">
                        <LevelPicker
                          value={selRole ? (perms[selRole]?.[m] ?? "none") : "none"}
                          onChange={(l) => selRole && setLevel(selRole, m, l)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-mist-100 bg-mist-50/60 px-4 py-3 text-xs text-mist-500">
                <span className="font-semibold">No access</span> hides the menu · <span className="font-semibold">View</span> shows it but disables Add / Edit / Delete · <span className="font-semibold">Edit</span> is full access. The database (RLS) enforces the same rules.
              </div>
            </Card>
          </div>

          {/* people */}
          <div className="mt-4">
            <Card>
              <div className="flex items-center justify-between border-b border-mist-100 px-4 py-3">
                <h2 className="text-sm font-semibold">People</h2>
                <span className="text-xs text-mist-400">Users are created in Supabase Authentication — set their role here</span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Email</Th><Th className="w-56">Role</Th><Th>Access</Th><Th className="w-40">Last sign-in</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="hover:bg-mist-50">
                      <Td className="font-medium text-ink-800">{u.email}</Td>
                      <Td>
                        <Select
                          value={u.role_id ?? ""}
                          onChange={(v) => setUserRole(u.user_id, v)}
                          options={[
                            { value: "", label: "— no role —" },
                            ...roles.map((r) => ({ value: r.id, label: r.name })),
                          ]}
                        />
                      </Td>
                      <Td className="text-mist-500">{u.role_id ? summary(u.role_id) : "No access"}</Td>
                      <Td className="text-mist-400">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("en-GB") : "—"}</Td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-mist-400">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}

      {showNew && (
        <Modal title="New role" subtitle="Starts with No access on every menu — set the levels after creating it." onClose={() => setShowNew(false)}>
          <Field label="Role name">
            <input className={inputCls} value={newName} autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createRole()}
              placeholder="e.g. Delivery Lead" />
          </Field>
          <div className="mt-2 flex justify-end gap-2 border-t border-mist-100 pt-4">
            <Btn onClick={() => setShowNew(false)}>Cancel</Btn>
            <Btn tone="accent" onClick={createRole}>Create role</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
