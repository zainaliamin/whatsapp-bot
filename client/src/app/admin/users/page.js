"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const ROLE_OPTIONS = ["user", "admin"];

function formatDateValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function AdminUsersPage() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", ok: false });
  const [search, setSearch] = useState("");
  const [savingUserId, setSavingUserId] = useState(null);
  const [updatedUserId, setUpdatedUserId] = useState(null);

  async function loadData() {
    setLoading(true);
    setMessage({ text: "", ok: false });

    try {
      const [meRes, usersRes] = await Promise.all([
        apiFetch("/api/users/profile"),
        apiFetch("/api/admin/users"),
      ]);

      const meJson = await meRes.json();
      const usersJson = await usersRes.json();

      if (meRes.ok && meJson.success) {
        setMe(meJson.data);
      }

      if (!usersRes.ok || !usersJson.success) {
        throw new Error(usersJson.message || "Failed to load users");
      }

      const list = Array.isArray(usersJson.data) ? usersJson.data : [];
      setUsers(
        list.map((u) => ({
          ...u,
          messageExpiryDate: u.messageExpiryDate || null,
        }))
      );
    } catch (err) {
      setMessage({ text: err.message || "Load failed", ok: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateLocalUser(id, patch) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  async function saveUser(user) {
    setMessage({ text: "", ok: false });
    setSavingUserId(user.id);
    setUpdatedUserId(null);
    try {
      const payload = {
        name: user.name,
        role: user.role,
        messageExpiryDate: user.messageExpiryDate || null,
      };

      const res = await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Update failed");
      }

      setMessage({ text: `Updated ${user.email}`, ok: true });
      setUpdatedUserId(user.id);
      setTimeout(() => setUpdatedUserId((current) => (current === user.id ? null : current)), 1800);
      await loadData();
    } catch (err) {
      setMessage({ text: err.message || "Update failed", ok: false });
    } finally {
      setSavingUserId((current) => (current === user.id ? null : current));
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!normalizedSearch) return true;
    const haystack = [
      String(user.id || ""),
      String(user.name || ""),
      String(user.email || ""),
      String(user.role || ""),
    ].join(" ").toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  return (
    <div className="p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-(--accent)">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-(--muted)">Manage users, roles and message expiry settings. User deletion is disabled.</p>
      </div>

      <div className="mt-4 max-w-md">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, name, email, or role"
          className="w-full rounded-xl border border-(--line) bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-(--brand)"
        />
      </div>

      {message.text && (
        <p className={`mt-4 rounded-xl px-4 py-2 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {message.text}
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-(--line) bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-(--line) bg-(--surface)">
                <th className="px-4 py-3 text-left font-semibold">User ID</th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Joined</th>
                <th className="px-4 py-3 text-left font-semibold">Total Messages</th>
                <th className="px-4 py-3 text-left font-semibold">Expiry</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-(--muted)" colSpan={8}>Loading users...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-(--muted)" colSpan={8}>No users found.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSelf = user.id === me?.id;
                  return (
                    <tr key={user.id} className="border-b border-(--line)">
                      <td className="px-4 py-3 font-mono text-xs text-(--muted)">{user.id}</td>
                      <td className="px-4 py-3">
                        <input
                          value={user.name || ""}
                          onChange={(e) => updateLocalUser(user.id, { name: e.target.value })}
                          className="w-44 rounded-lg border border-(--line) px-2 py-1.5 outline-none focus:border-(--brand)"
                        />
                      </td>
                      <td className="px-4 py-3 text-(--muted)">{user.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={user.role || "user"}
                          onChange={(e) => updateLocalUser(user.id, { role: e.target.value })}
                          disabled={isSelf}
                          className="rounded-lg border border-(--line) px-2 py-1.5 outline-none focus:border-(--brand) disabled:opacity-60"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-(--muted)">{formatDateTime(user.createdAt)}</td>
                      <td className="px-4 py-3 font-semibold">{Number(user.totalMessages || 0)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={formatDateValue(user.messageExpiryDate)}
                          onChange={(e) => updateLocalUser(user.id, {
                            messageExpiryDate: e.target.value ? new Date(`${e.target.value}T00:00:00.000Z`).toISOString() : null,
                          })}
                          className="rounded-lg border border-(--line) px-2 py-1.5 outline-none focus:border-(--brand)"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveUser(user)}
                            disabled={savingUserId === user.id}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors ${
                              updatedUserId === user.id
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-(--brand) hover:bg-(--brand-strong)"
                            } disabled:opacity-60`}
                          >
                            {savingUserId === user.id ? "Saving..." : updatedUserId === user.id ? "Updated" : "Save"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
