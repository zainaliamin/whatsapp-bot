"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

function formatDateLabel(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString();
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [report, setReport] = useState({
    totalMessages: 0,
    activeClients: 0,
    messageOverview: { totalSent: 0, sentThisMonth: 0, totalFailed: 0 },
    messagesPerUser: [],
    messagesPerDay: [],
  });

  useEffect(() => {
    setLoading(true);
    setMessage("");

    apiFetch("/api/admin/reports")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success || !d.data) {
          throw new Error(d?.message || "Failed to load report");
        }
        setReport({
          totalMessages: Number(d.data.totalMessages || 0),
          activeClients: Number(d.data.activeClients || 0),
          messageOverview: {
            totalSent: Number(d.data.messageOverview?.totalSent || 0),
            sentThisMonth: Number(d.data.messageOverview?.sentThisMonth || 0),
            totalFailed: Number(d.data.messageOverview?.totalFailed || 0),
          },
          messagesPerUser: Array.isArray(d.data.messagesPerUser) ? d.data.messagesPerUser : [],
          messagesPerDay: Array.isArray(d.data.messagesPerDay) ? d.data.messagesPerDay : [],
        });
      })
      .catch((err) => setMessage(err.message || "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Total Messages Sent", value: report.messageOverview.totalSent },
    { label: "Sent This Month", value: report.messageOverview.sentThisMonth },
    { label: "Total Failed Messages", value: report.messageOverview.totalFailed },
    { label: "Active Clients", value: report.activeClients },
  ];

  return (
    <div className="p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-(--accent)">Admin</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-(--muted)">Overview of global app messaging activity.</p>

      {message && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{message}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-(--line) bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted)">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{loading ? "..." : card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-(--line) bg-white p-5">
          <p className="text-sm font-semibold">Top Users by Message Volume</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-(--line)">
                  <th className="px-2 py-2 text-left text-xs font-semibold text-(--muted)">Name</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-(--muted)">Email</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-(--muted)">Total</th>
                </tr>
              </thead>
              <tbody>
                {!loading && report.messagesPerUser.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-3 text-xs text-(--muted)">No data found.</td>
                  </tr>
                ) : (
                  report.messagesPerUser.slice(0, 10).map((u) => (
                    <tr key={u.userId} className="border-b border-(--line)">
                      <td className="px-2 py-2">{u.name || "-"}</td>
                      <td className="px-2 py-2 text-(--muted)">{u.email}</td>
                      <td className="px-2 py-2 font-semibold">{u.totalMessages}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-(--line) bg-white p-5">
          <p className="text-sm font-semibold">Recent Daily Activity</p>
          <div className="mt-3 grid gap-2">
            {!loading && report.messagesPerDay.length === 0 && (
              <p className="text-xs text-(--muted)">No activity data.</p>
            )}
            {report.messagesPerDay.slice(0, 10).map((d) => (
              <div key={d.date} className="flex items-center justify-between rounded-lg border border-(--line) px-3 py-2 text-sm">
                <span className="text-(--muted)">{formatDateLabel(d.date)}</span>
                <span className="font-semibold">{d.totalMessages}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-(--muted)">Total logged messages: {report.totalMessages}</p>
        </div>
      </div>
    </div>
  );
}
