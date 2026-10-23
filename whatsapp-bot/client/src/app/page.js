import Link from "next/link";

const features = [
  {
    title: "Broadcast Campaigns",
    description: "Schedule and send WhatsApp campaigns to segmented audiences with fast delivery.",
  },
  {
    title: "Unified Inbox",
    description: "Track incoming messages and respond quickly using a clean operator workflow.",
  },
  {
    title: "Webhook Automations",
    description: "Connect events to your systems and trigger workflows from bot interactions.",
  },
  {
    title: "Role-based Access",
    description: "Give each team member the exact permissions they need, without sharing credentials.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="sticky top-4 z-20 flex items-center justify-between rounded-full border border-(--line) bg-white/80 px-5 py-3 shadow-[0_12px_30px_rgba(34,25,16,0.08)] backdrop-blur">
          <p className="text-lg font-semibold tracking-tight">WhatsApp Bot</p>
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link href="/" className="rounded-full px-4 py-2 hover:bg-white">Home</Link>
            <Link href="/login" className="rounded-full px-4 py-2 hover:bg-white">Login</Link>
            <Link href="/signup" className="rounded-full bg-(--brand) px-4 py-2 text-white hover:bg-(--brand-strong)">Signup</Link>
          </nav>
        </header>

        <section className="relative overflow-hidden rounded-[34px] border border-(--line) bg-[linear-gradient(140deg,rgba(255,249,242,0.95),rgba(255,229,205,0.85))] p-7 shadow-[0_24px_80px_rgba(34,25,16,0.14)] sm:p-12">
          <div className="absolute -right-12 top-3 h-40 w-40 rounded-full bg-[rgba(23,98,79,0.16)] blur-3xl" />
          <div className="absolute bottom-4 left-8 h-32 w-32 rounded-full bg-[rgba(217,129,47,0.2)] blur-3xl" />

          <h1 className="relative mt-5 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Build, automate, and scale your WhatsApp bot experience from one modern platform.
          </h1>
          <p className="relative mt-5 max-w-2xl text-base leading-7 text-(--muted) sm:text-lg">
            Manage conversations, campaigns, and integrations with a frontend designed for speed and clarity.
          </p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-full bg-(--brand) px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(23,98,79,0.32)] hover:bg-(--brand-strong)">
              Get Started Free
            </Link>
            <Link href="/login" className="rounded-full border border-(--line) bg-white px-6 py-3 text-sm font-semibold hover:bg-(--surface)">
              Login
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-3xl border border-(--line) bg-white/80 p-5">
            <h2 className="text-2xl font-semibold">Fast Onboarding</h2>
            <p className="mt-2 text-sm leading-7 text-(--muted)">Connect your WhatsApp account and start automations in minutes.</p>
          </article>
          <article className="rounded-3xl border border-(--line) bg-white/80 p-5">
            <h2 className="text-2xl font-semibold">Reliable Delivery</h2>
            <p className="mt-2 text-sm leading-7 text-(--muted)">Track message status, retries, and campaign performance from one dashboard.</p>
          </article>
          <article className="rounded-3xl border border-(--line) bg-white/80 p-5">
            <h2 className="text-2xl font-semibold">Secure Access</h2>
            <p className="mt-2 text-sm leading-7 text-(--muted)">Protect operations with token-based auth and user-level control.</p>
          </article>
        </section>

        <section className="rounded-3xl border border-(--line) bg-(--surface) p-7">
          <h2 className="text-3xl font-semibold">Platform Highlights</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-(--line) bg-white p-5">
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-7 text-(--muted)">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="rounded-3xl border border-(--line) bg-white/70 p-6 text-sm text-(--muted)">
          WhatsApp Bot Platform. Built for teams that want faster communication automation.
        </footer>
      </div>
    </main>
  );
}

