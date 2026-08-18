"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icon, type IconName } from "@/components/icons";

/** Nav grouped by phase of work so it's easy to scan. */
const NAV_GROUPS: { section: string; items: { href: string; icon: IconName; label: string }[] }[] = [
  {
    section: "Overview",
    items: [
      { href: "/",        icon: "home",   label: "Overview" },
      { href: "/recap",   icon: "trophy", label: "Recap Semester" },
    ],
  },
  {
    section: "Planning",
    items: [
      { href: "/requirements", icon: "requirements", label: "Requirements" },
      { href: "/carding", icon: "carding", label: "Carding" },
      { href: "/epics",   icon: "epic",   label: "Epic" },
      { href: "/stories", icon: "story",  label: "Story" },
    ],
  },
  {
    section: "Delivery",
    items: [
      { href: "/deploy",   icon: "deploy",  label: "Need to Deploy" },
      { href: "/releases", icon: "release", label: "Release" },
      { href: "/flags",    icon: "flag",    label: "Feature Flag" },
    ],
  },
  {
    section: "Reference",
    items: [
      { href: "/systems", icon: "systems", label: "Systems" },
      { href: "/sync",    icon: "sync",    label: "Jira Sync" },
    ],
  },
];

const COLLAPSE_KEY = "pt.sidebar.collapsed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  // Status ciutkan sidebar diingat antar-kunjungan (hanya berpengaruh di layar lebar).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);
  const toggleCollapse = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });

  const signOut = async () => {
    await supabase().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Label & judul-grup disembunyikan hanya di desktop saat diciutkan;
  // di mobile (nav horizontal) label selalu tampil.
  const hideOnCollapse = collapsed ? "lg:hidden" : "";

  return (
    <div className="min-h-screen lg:flex">
      {/* Di layar kecil ini jadi header yang menempel di atas; di desktop jadi sidebar putih penuh. */}
      <aside
        className={`z-30 border-mist-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:flex lg:flex-col lg:border-r ${
          collapsed ? "lg:w-[4.5rem]" : "lg:w-60"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-mist-100 px-4 py-3 lg:px-3 lg:py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ocean-600 text-white"><Icon name="dashboard" className="h-[18px] w-[18px]" /></span>
            <span className={`min-w-0 truncate text-[15px] font-semibold leading-tight text-ink-900 ${hideOnCollapse}`}>
              Project Tracker
            </span>
          </Link>
          {/* Keluar (mobile) — ikut di header supaya tidak perlu scroll. */}
          <button
            onClick={signOut}
            className="rounded-lg px-3 py-1.5 text-xs text-ocean-600 hover:bg-mist-50 lg:hidden"
          >
            Sign out
          </button>
        </div>

        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-2 lg:py-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.section} className="flex gap-1 lg:block lg:gap-0">
              {/* Judul grup: hanya desktop & saat tidak diciutkan. */}
              <div
                className={`hidden px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-mist-400 first:pt-1 ${
                  collapsed ? "" : "lg:block"
                }`}
              >
                {group.section}
              </div>
              {group.items.map((n) => {
                const active = path === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    title={collapsed ? n.label : undefined}
                    className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] transition-colors lg:mx-1 ${
                      collapsed ? "lg:justify-center lg:px-2" : ""
                    } ${
                      active
                        ? "bg-ocean-100 font-semibold text-ocean-600"
                        : "text-ink-500 hover:bg-mist-50 hover:text-ink-900"
                    }`}
                  >
                    <span className="grid place-items-center"><Icon name={n.icon} className="h-[18px] w-[18px]" /></span>
                    <span className={hideOnCollapse}>{n.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer (desktop): ciutkan/lebarkan + keluar. */}
        <div className="hidden border-t border-mist-100 p-2 lg:block">
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink-500 hover:bg-mist-50 hover:text-ink-900 ${
              collapsed ? "justify-center px-2" : ""
            }`}
          >
            <span className="grid place-items-center"><Icon name={collapsed ? "expand" : "collapse"} className="h-[18px] w-[18px]" /></span>
            <span className={hideOnCollapse}>Collapse</span>
          </button>
          <button
            onClick={signOut}
            title={collapsed ? "Sign out" : undefined}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink-500 hover:bg-mist-50 hover:text-ink-900 ${
              collapsed ? "justify-center px-2" : ""
            }`}
          >
            <span className="grid place-items-center"><Icon name="signout" className="h-[18px] w-[18px]" /></span>
            <span className={hideOnCollapse}>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
