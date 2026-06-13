"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString();
}

function getExpiryState(expiryDate) {
  if (!expiryDate) return "Not Active";
  const expiry = new Date(expiryDate).getTime();
  if (Number.isNaN(expiry)) return "Not Active";
  return expiry < Date.now() ? "Not Active" : "Active";
}

export default function OverviewPage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ totalSent: 0, thisMonth: 0, today: 0 });
  const [clientStatus, setClientStatus] = useState("No client");

  useEffect(() => {
    const raw = localStorage.getItem("whatsapp_user");
    if (raw) { try { setUser(JSON.parse(raw)); } catch { /* ignore */ } }

    apiFetch("/api/users/profile")
      .then((r) => r.json())
      .then((d) => { if (d?.success) setUser(d.data); })
      .catch(() => {});

    apiFetch("/api/messages/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.data) {
          setStats({
            totalSent: Number(d.data.totalSent || 0),
            thisMonth: Number(d.data.thisMonth || 0),
            today: Number(d.data.today || 0)
          });
        }
      })
      .catch(() => {});

    apiFetch("/api/client/status")
      .then(async (r) => {
        if (r.status === 404) {
          setClientStatus("No client");
          return null;
        }
        const d = await r.json();
        if (r.ok && d?.success) {
          setClientStatus(d.data?.status || "Unknown");
        } else {
          setClientStatus("Unknown");
        }
        return null;
      })
      .catch(() => setClientStatus("Unknown"));
  }, []);

  const accountStatus = getExpiryState(user?.messageExpiryDate);
  const isActive = accountStatus === "Active";

  const details = [
    { label: "Account Status", value: accountStatus },
    { label: "Access Until", value: formatDate(user?.messageExpiryDate) },
    { label: "Member Since", value: formatDate(user?.createdAt) },
    { label: "Client Status", value: clientStatus },
  ];

  return (
    <div className="p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-(--accent)">Dashboard</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Welcome back{user?.name ? `, ${user.name}` : ""}!
      </h1>
      <p className="mt-2 text-sm text-(--muted)">
        Logged in as <span className="font-medium">{user?.email}</span>
      </p>

      {!isActive && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">Messaging access is not active</p>
          <p className="mt-1 text-xs text-amber-700">
            Contact admin to get access. You cannot send messages until access is activated.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Messages Sent", value: stats.totalSent },
          { label: "Sent This Month", value: stats.thisMonth },
          { label: "Sent Today", value: stats.today },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-(--line) bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted)">{stat.label}</p>
            <p className="mt-2 text-xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {details.map((item) => (
          <div key={item.label} className="rounded-2xl border border-(--line) bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted)">{item.label}</p>
            <p className="mt-2 text-base font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
