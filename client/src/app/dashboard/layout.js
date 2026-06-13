"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

const NAV = [
  { href: "/dashboard",               label: "Overview",         icon: "⊞" },
  { href: "/dashboard/messages",      label: "Messages",         icon: "✉" },
  { href: "/dashboard/client",        label: "Client API Setup", icon: "⚙" },
  { href: "/dashboard/api-reference", label: "API Reference",    icon: "⟨/⟩" },
  { href: "/dashboard/profile",       label: "Profile",          icon: "◎" },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser]   = useState(null);

  useEffect(() => {
    // Show cached user immediately
    const raw = localStorage.getItem("whatsapp_user");
    if (raw) { try { setUser(JSON.parse(raw)); } catch { /* ignore */ } }

    // Refresh from backend
    apiFetch("/api/users/profile")
      .then((r) => {
        if (r.status === 401) { logout(); return null; }
        return r.json();
      })
      .then((d) => {
        if (d?.success) {
          setUser(d.data);
          localStorage.setItem("whatsapp_user", JSON.stringify(d.data));
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function logout() {
    localStorage.removeItem("whatsapp_token");
    localStorage.removeItem("whatsapp_user");
    document.cookie = "whatsapp_token=; path=/; max-age=0; SameSite=Lax";
    router.replace("/login");
  }

  function isActive(href) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Sidebar */}
      <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-(--line) bg-white">
        <div className="border-b border-(--line) px-5 py-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand)">
            WhatsApp Bot
          </p>
          {user && (
            <p className="mt-1 truncate text-xs text-(--muted)">{user.email}</p>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors
                ${isActive(item.href)
                  ? "bg-(--brand) text-white"
                  : "text-(--muted) hover:bg-(--surface)"}`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-(--line) p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <span className="text-base">→</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
