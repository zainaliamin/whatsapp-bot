"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justRegistered = params.get("registered") === "1";
  const [form, setForm] = useState({ email: "", password: "" });
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
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Login failed");
      }
      const token = data.data.accessToken;
      const role = data?.data?.user?.role;
      localStorage.setItem("whatsapp_token", token);
      localStorage.setItem("whatsapp_user", JSON.stringify(data.data.user));
      // Write cookie so middleware can protect routes server-side
      document.cookie = `whatsapp_token=${token}; path=/; max-age=86400; SameSite=Lax`;
      router.push(role === "admin" ? "/admin" : "/dashboard");
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
          <Link href="/login" className="rounded-full bg-(--brand) px-4 py-2 text-white">Login</Link>
          <Link href="/signup" className="rounded-full px-4 py-2 hover:bg-(--surface)">Signup</Link>
        </nav>

        <h1 className="text-4xl font-semibold tracking-tight">Login</h1>
        <p className="mt-2 text-sm text-(--muted)">Access your WhatsApp bot dashboard.</p>

        {justRegistered && (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-2 text-sm text-green-700">
            Account created! You can now log in.
          </p>
        )}

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
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
            placeholder="Password"
            value={form.password}
            onChange={update("password")}
            required
            className="rounded-2xl border border-(--line) bg-white px-4 py-3 outline-none focus:border-(--brand) transition-colors"
          />

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-(--brand) px-5 py-3 font-semibold text-white hover:bg-(--brand-strong) disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="mt-5 text-sm text-(--muted)">
          No account yet?{" "}
          <Link href="/signup" className="font-semibold text-(--brand) hover:underline">Sign up</Link>
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
