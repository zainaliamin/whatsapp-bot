"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);

  function logout() {
    localStorage.removeItem("whatsapp_token");
    localStorage.removeItem("whatsapp_user");
    document.cookie = "whatsapp_token=; path=/; max-age=0; SameSite=Lax";
    router.replace("/login");
  }

  useEffect(() => {
    apiFetch("/api/users/profile")
      .then((r) => {
        if (r.status === 401) {
          logout();
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d?.success) return;
        if (d.data?.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setMe(d.data);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-(--line) bg-white">
        <div className="border-b border-(--line) px-5 py-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand)">Admin Panel</p>
          {me?.email && <p className="mt-1 truncate text-xs text-(--muted)">{me.email}</p>}
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-(--brand) text-white" : "text-(--muted) hover:bg-(--surface)"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-(--line) p-3">
          <button
            onClick={logout}
            className="w-full rounded-2xl px-4 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
