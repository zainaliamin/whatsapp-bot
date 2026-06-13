"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Registration failed");
      }
      router.push("/login?registered=1");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
      <section className="w-full max-w-xl rounded-3xl border border-(--line) bg-white/85 p-8 shadow-[0_18px_50px_rgba(34,25,16,0.1)]">
        <nav className="mb-6 flex gap-2 text-sm font-semibold">
          <Link href="/" className="rounded-full px-4 py-2 hover:bg-(--surface)">Home</Link>
          <Link href="/login" className="rounded-full px-4 py-2 hover:bg-(--surface)">Login</Link>
          <Link href="/signup" className="rounded-full bg-(--brand) px-4 py-2 text-white">Signup</Link>
        </nav>

        <h1 className="text-4xl font-semibold tracking-tight">Signup</h1>
        <p className="mt-2 text-sm text-(--muted)">Create your account and launch your first WhatsApp bot.</p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Full name (min. 2 characters)"
            value={form.name}
            onChange={update("name")}
            minLength={2}
            maxLength={120}
            required
            className="rounded-2xl border border-(--line) bg-white px-4 py-3 outline-none focus:border-(--brand) transition-colors"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={update("email")}
            required
            className="rounded-2xl border border-(--line) bg-white px-4 py-3 outline-none focus:border-(--brand) transition-colors"
          />
          <input
            type="password"
            placeholder="Password (min. 8 characters)"
            value={form.password}
            onChange={update("password")}
            minLength={8}
            maxLength={64}
            required
            className="rounded-2xl border border-(--line) bg-white px-4 py-3 outline-none focus:border-(--brand) transition-colors"
          />

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-(--accent) px-5 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-sm text-(--muted)">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-(--brand) hover:underline">Login</Link>
        </p>
      </section>
    </main>
  );
}
