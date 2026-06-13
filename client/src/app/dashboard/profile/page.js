"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function ProfilePage() {
  const [user, setUser] = useState(null);

  // Name form
  const [name, setName]           = useState("");
  const [nameMsg, setNameMsg]     = useState({ text: "", ok: false });
  const [nameLoading, setNameLoading] = useState(false);

  // Password form
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg]         = useState({ text: "", ok: false });
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("whatsapp_user");
    if (raw) {
      try { const u = JSON.parse(raw); setUser(u); setName(u.name || ""); } catch { /* ignore */ }
    }
    apiFetch("/api/users/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) { setUser(d.data); setName(d.data.name || ""); }
      })
      .catch(() => {});
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setNameMsg({ text: "", ok: false });
    setNameLoading(true);
    try {
      const r = await apiFetch("/api/users/profile", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || "Update failed");
      setNameMsg({ text: "Name updated successfully.", ok: true });
      setUser(d.data);
      localStorage.setItem("whatsapp_user", JSON.stringify(d.data));
    } catch (err) {
      setNameMsg({ text: err.message, ok: false });
    } finally {
      setNameLoading(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwMsg({ text: "", ok: false });
    if (passwords.next !== passwords.confirm) {
      setPwMsg({ text: "New passwords do not match.", ok: false });
      return;
    }
    setPwLoading(true);
    try {
      const r = await apiFetch("/api/users/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.next,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || "Password change failed");
      setPwMsg({ text: "Password changed successfully.", ok: true });
      setPasswords({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwMsg({ text: err.message, ok: false });
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold tracking-tight">Profile</h2>
      <p className="mt-1 text-sm text-(--muted)">Update your name or change your password.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ── Name ── */}
        <div className="rounded-2xl border border-(--line) bg-white p-6">
          <p className="text-sm font-semibold">Display Name</p>
          <form className="mt-4 grid gap-3" onSubmit={saveProfile}>
            <div>
              <label className="mb-1 block text-xs font-medium text-(--muted)">
                Email (read-only)
              </label>
              <input
                value={user?.email || ""}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-(--line) bg-gray-50 px-4 py-2.5 text-sm text-(--muted)"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-(--muted)">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={120}
                required
                className="w-full rounded-xl border border-(--line) bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-(--brand)"
              />
            </div>
            {nameMsg.text && (
              <p
                className={`rounded-xl px-3 py-2 text-sm ${
                  nameMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}
              >
                {nameMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={nameLoading}
              className="rounded-xl bg-(--brand) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--brand-strong) disabled:opacity-60"
            >
              {nameLoading ? "Saving…" : "Save Name"}
            </button>
          </form>
        </div>

        {/* ── Password ── */}
        <div className="rounded-2xl border border-(--line) bg-white p-6">
          <p className="text-sm font-semibold">Change Password</p>
          <form className="mt-4 grid gap-3" onSubmit={savePassword}>
            {[
              { key: "current", label: "Current Password",           minLen: undefined },
              { key: "next",    label: "New Password (min. 8 chars)", minLen: 8 },
              { key: "confirm", label: "Confirm New Password",        minLen: 8 },
            ].map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-xs font-medium text-(--muted)">
                  {field.label}
                </label>
                <input
                  type="password"
                  value={passwords[field.key]}
                  onChange={(e) =>
                    setPasswords((p) => ({ ...p, [field.key]: e.target.value }))
                  }
                  minLength={field.minLen}
                  required
                  className="w-full rounded-xl border border-(--line) bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-(--brand)"
                />
              </div>
            ))}
            {pwMsg.text && (
              <p
                className={`rounded-xl px-3 py-2 text-sm ${
                  pwMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}
              >
                {pwMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={pwLoading}
              className="rounded-xl bg-(--accent) px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pwLoading ? "Changing…" : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
