-- =====================================================================
-- migration-008-rbac.sql  —  Role-based access control (RBAC)
--
-- Adds roles + per-menu permissions (none / view / edit) on top of the
-- existing Supabase Auth. Users are still created in Authentication;
-- here we only map each user to a role.
--
-- SAFE TO RUN ONCE on an existing database:
--  * every current auth user is seeded as Admin, so nobody is locked out
--  * the old permissive "team_all" policies are replaced by permission
--    checks — Admin/Editor keep full access, Viewer becomes read-only
--  * run this in a NON-PROD project first if you can.
-- =====================================================================

-- ---------- tables ----------------------------------------------------
create table if not exists roles (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  is_admin   boolean not null default false,   -- may open the Access page
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  menu    text not null,
  level   text not null default 'none' check (level in ('none','view','edit')),
  primary key (role_id, menu)
);

create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role_id    uuid references roles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- seed roles ------------------------------------------------
insert into roles (name, is_admin) values
  ('Admin', true), ('Editor', false), ('Viewer', false)
on conflict (name) do nothing;

-- ---------- seed permissions for the built-in roles -------------------
-- Menu keys mirror the sidebar. 'access' is the admin-only Access page.
do $$
declare
  m text;
  r_admin  uuid; r_editor uuid; r_viewer uuid;
  menus text[] := array[
    'overview','recap','requirements','carding','epics','stories',
    'deploy','releases','flags','systems','sync','access'
  ];
begin
  select id into r_admin  from roles where name = 'Admin';
  select id into r_editor from roles where name = 'Editor';
  select id into r_viewer from roles where name = 'Viewer';

  foreach m in array menus loop
    insert into role_permissions (role_id, menu, level)
      values (r_admin, m, 'edit')
      on conflict (role_id, menu) do nothing;
    insert into role_permissions (role_id, menu, level)
      values (r_editor, m, case when m = 'access' then 'none' else 'edit' end)
      on conflict (role_id, menu) do nothing;
    insert into role_permissions (role_id, menu, level)
      values (r_viewer, m, case when m = 'access' then 'none' else 'view' end)
      on conflict (role_id, menu) do nothing;
  end loop;
end $$;

-- ---------- seed profiles: every EXISTING user becomes Admin ----------
-- Non-breaking: current users keep full access. New users get no profile
-- (no access) until an admin assigns them a role on the Access page.
insert into profiles (user_id, role_id)
select u.id, (select id from roles where name = 'Admin')
from auth.users u
on conflict (user_id) do nothing;

-- ---------- helper functions (SECURITY DEFINER) -----------------------
-- Definer = these read the rbac tables regardless of the caller's RLS,
-- which also prevents recursion when policies call them.

create or replace function menu_level(p_menu text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rp.level
       from profiles p
       join role_permissions rp on rp.role_id = p.role_id
      where p.user_id = auth.uid() and rp.menu = p_menu),
    'none');
$$;

create or replace function is_app_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select r.is_admin from profiles p join roles r on r.id = p.role_id
      where p.user_id = auth.uid()),
    false);
$$;

-- What the app calls on load to gate the UI for the current user.
create or replace function my_access()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'is_admin', is_app_admin(),
    'permissions', coalesce(
      (select json_object_agg(rp.menu, rp.level)
         from profiles p
         join role_permissions rp on rp.role_id = p.role_id
        where p.user_id = auth.uid()),
      '{}'::json)
  );
$$;

-- Admin-only: list users with their role (joins auth.users for email).
create or replace function admin_list_users()
returns table (user_id uuid, email text, role_id uuid, role_name text, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email::text, p.role_id, r.name, u.last_sign_in_at
  from auth.users u
  left join profiles p on p.user_id = u.id
  left join roles r    on r.id = p.role_id
  where is_app_admin()
  order by u.email;
$$;

-- Admin-only: assign / change a user's role.
create or replace function admin_set_user_role(p_user uuid, p_role uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_app_admin() then raise exception 'not authorized'; end if;
  insert into profiles (user_id, role_id) values (p_user, p_role)
  on conflict (user_id) do update set role_id = excluded.role_id;
end $$;

grant execute on function menu_level(text)              to authenticated;
grant execute on function is_app_admin()                to authenticated;
grant execute on function my_access()                   to authenticated;
grant execute on function admin_list_users()            to authenticated;
grant execute on function admin_set_user_role(uuid,uuid) to authenticated;

-- ---------- RLS on the rbac tables themselves -------------------------
alter table roles            enable row level security;
alter table role_permissions enable row level security;
alter table profiles         enable row level security;

drop policy if exists roles_admin on roles;
create policy roles_admin on roles
  for all to authenticated using (is_app_admin()) with check (is_app_admin());

drop policy if exists role_perms_admin on role_permissions;
create policy role_perms_admin on role_permissions
  for all to authenticated using (is_app_admin()) with check (is_app_admin());

drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles
  for select to authenticated using (user_id = auth.uid() or is_app_admin());

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles
  for all to authenticated using (is_app_admin()) with check (is_app_admin());

-- ---------- replace team_all with permission checks on data tables ----
-- read  -> level in (view, edit) ;  write -> level = edit
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('epics','epics'), ('stories','stories'), ('releases','releases'),
      ('release_documents','releases'), ('feature_flags','flags'),
      ('sync_runs','sync'), ('systems','systems'),
      ('carding_projects','carding'), ('carding_stories','carding'),
      ('req_stages','requirements'), ('req_cards','requirements')
    ) as t(tbl, menu)
  loop
    if to_regclass('public.' || rec.tbl) is null then continue; end if;

    execute format('alter table %I enable row level security', rec.tbl);
    execute format('drop policy if exists team_all    on %I', rec.tbl);
    execute format('drop policy if exists rbac_select on %I', rec.tbl);
    execute format('drop policy if exists rbac_insert on %I', rec.tbl);
    execute format('drop policy if exists rbac_update on %I', rec.tbl);
    execute format('drop policy if exists rbac_delete on %I', rec.tbl);

    execute format(
      'create policy rbac_select on %I for select to authenticated using (menu_level(%L) in (''view'',''edit''))',
      rec.tbl, rec.menu);
    execute format(
      'create policy rbac_insert on %I for insert to authenticated with check (menu_level(%L) = ''edit'')',
      rec.tbl, rec.menu);
    execute format(
      'create policy rbac_update on %I for update to authenticated using (menu_level(%L) = ''edit'') with check (menu_level(%L) = ''edit'')',
      rec.tbl, rec.menu, rec.menu);
    execute format(
      'create policy rbac_delete on %I for delete to authenticated using (menu_level(%L) = ''edit'')',
      rec.tbl, rec.menu);
  end loop;
end $$;
