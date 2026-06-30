"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const MESSAGE_SEND_WAIT_SECONDS = getPositiveInteger(
  process.env.NEXT_PUBLIC_MESSAGE_SEND_WAIT_SECONDS,
  30
);

function getPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitBeforeSend(setCountdown) {
  for (let seconds = MESSAGE_SEND_WAIT_SECONDS; seconds > 0; seconds -= 1) {
    setCountdown(seconds);
    await sleep(1000);
  }
  setCountdown(0);
}

function TextMessageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 5h16v10H7l-3 3V5z" />
    </svg>
  );
}

function ImageMessageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-6 6-3-3-4 4" />
    </svg>
  );
}

function MessageImagePreview({ src, alt }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src) return null;

  if (failed) {
    return (
      <p className="mt-2 text-xs text-(--muted)">Image preview unavailable.</p>
    );
  }

  return (
    <div className="mt-2 w-full max-w-xs overflow-hidden rounded-xl border border-(--line) bg-(--surface) sm:max-w-sm md:max-w-md">
      <div className={`aspect-video w-full ${loaded ? "" : "animate-pulse"}`}>
        <img
          src={src}
          alt={alt}
          className={`h-full w-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}

// Sends using the API token (not the JWT) â€” required by requireApiToken middleware
function apiSend(path, body, apiToken) {
  return fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ ...body, sourceApplication: "front-source" }),
  });
}

// â”€â”€ Send Text Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SendTextForm({ apiToken, onSent }) {
  const [form, setForm] = useState({ recipientNumber: "", messageText: "" });
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [msg, setMsg] = useState({ text: "", ok: false });

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: "", ok: false });
    setSending(true);
    try {
      await waitBeforeSend(setCountdown);
      const r = await apiSend("/api/messages/send-text", form, apiToken);
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || "Failed to send");
      setMsg({ text: "Message sent successfully!", ok: true });
      setForm({ recipientNumber: "", messageText: "" });
      onSent();
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setCountdown(0);
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-(--muted)">Recipient Number</label>
        <input
          value={form.recipientNumber}
          onChange={(e) => setForm((p) => ({ ...p, recipientNumber: e.target.value }))}
          placeholder="923001234567"
          required minLength={8} maxLength={20}
          className="w-full rounded-xl border border-(--line) bg-white px-4 py-2.5 text-sm outline-none focus:border-(--brand) transition-colors"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-(--muted)">Message</label>
        <textarea
          value={form.messageText}
          onChange={(e) => setForm((p) => ({ ...p, messageText: e.target.value }))}
          placeholder="Type your message..."
          required minLength={1} maxLength={4096} rows={3}
          className="w-full rounded-xl border border-(--line) bg-white px-4 py-2.5 text-sm outline-none focus:border-(--brand) transition-colors resize-none"
        />
      </div>
      {msg.text && (
        <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}
      <button type="submit" disabled={sending}
        className="justify-self-start rounded-full bg-(--brand) px-6 py-2.5 text-sm font-semibold text-white hover:bg-(--brand-strong) disabled:opacity-60 transition-colors">
        {countdown > 0 ? `Sending in ${countdown}s...` : sending ? "Sending..." : "Send Text"}
      </button>
    </form>
  );
}

// â”€â”€ Send Image Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SendImageForm({ apiToken, onSent }) {
  const [form, setForm] = useState({ recipientNumber: "", imageUrl: "", caption: "" });
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [msg, setMsg] = useState({ text: "", ok: false });

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: "", ok: false });
    setSending(true);
    try {
      await waitBeforeSend(setCountdown);
      const r = await apiSend("/api/messages/send-image", form, apiToken);
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || "Failed to send");
      setMsg({ text: "Image sent successfully!", ok: true });
      setForm({ recipientNumber: "", imageUrl: "", caption: "" });
      onSent();
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setCountdown(0);
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-(--muted)">Recipient Number</label>
        <input
          value={form.recipientNumber}
          onChange={(e) => setForm((p) => ({ ...p, recipientNumber: e.target.value }))}
          placeholder="923001234567"
          required minLength={8} maxLength={20}
          className="w-full rounded-xl border border-(--line) bg-white px-4 py-2.5 text-sm outline-none focus:border-(--brand) transition-colors"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-(--muted)">Image URL</label>
        <input
          type="url"
          value={form.imageUrl}
          onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
          placeholder="https://example.com/image.jpg"
          required
          className="w-full rounded-xl border border-(--line) bg-white px-4 py-2.5 text-sm outline-none focus:border-(--brand) transition-colors"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-(--muted)">Caption (optional)</label>
        <input
          value={form.caption}
          onChange={(e) => setForm((p) => ({ ...p, caption: e.target.value }))}
          placeholder="Caption for the image..."
          maxLength={1024}
          className="w-full rounded-xl border border-(--line) bg-white px-4 py-2.5 text-sm outline-none focus:border-(--brand) transition-colors"
        />
      </div>
      {msg.text && (
        <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}
      <button type="submit" disabled={sending}
        className="justify-self-start rounded-full bg-(--accent) px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
        {countdown > 0 ? `Sending in ${countdown}s...` : sending ? "Sending..." : "Send Image"}
      </button>
    </form>
  );
}

// â”€â”€ Status Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatusBadge({ status }) {
  const s = (status || "").toUpperCase();
  const cls =
    s === "SENT"    ? "bg-green-100 text-green-700"   :
    s === "FAILED"  ? "bg-red-100 text-red-600"       :
    s === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {s || "-"}
    </span>
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function MessagesPage() {
  const [messages,     setMessages]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [activeTab,    setActiveTab]    = useState("text");
  const [clientStatus, setClientStatus] = useState(null);  // "READY" | other | null
  const [apiToken,     setApiToken]     = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Fetch client status + API token on mount
  useEffect(() => {
    Promise.all([
      apiFetch("/api/client/status").then((r) => r.json()),
      apiFetch("/api/users/api-token").then((r) => r.json()),
    ]).then(([statusRes, tokenRes]) => {
      setClientStatus(statusRes.success ? statusRes.data?.status ?? null : null);
      setApiToken(tokenRes.success ? tokenRes.data?.token ?? null : null);
    }).catch(() => {}).finally(() => setStatusLoading(false));
  }, []);

  const fetchMessages = useCallback(() => {
    setLoading(true);
    apiFetch("/api/messages/my?limit=50")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMessages(Array.isArray(d.data) ? d.data : []);
        else setError(d.message || "Failed to load messages");
      })
      .catch(() => setError("Failed to load messages"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const isReady = clientStatus === "READY";

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold tracking-tight">Messages</h2>
      <p className="mt-1 text-sm text-(--muted)">Send messages and view your recent history.</p>

      {/* â”€â”€ Send Section â”€â”€ */}
      {statusLoading ? (
        <div className="mt-6 rounded-2xl border border-(--line) bg-white p-6">
          <p className="text-sm text-(--muted)">Checking client status...</p>
        </div>
      ) : !isReady ? (
        /* Client not ready: prompt to set it up */
        <div className="mt-6 rounded-2xl border border-(--line) bg-white p-6 text-center">
          <p className="text-2xl">[!]</p>
          <p className="mt-2 text-sm font-semibold">WhatsApp client is not ready</p>
          <p className="mt-1 text-xs text-(--muted)">
            Current status:{" "}
            <span className="font-medium">{clientStatus ?? "No client"}</span>.
            You need to create a client and scan the QR code before sending messages.
          </p>
          <Link href="/dashboard/client"
            className="mt-4 inline-block rounded-full bg-(--brand) px-6 py-2.5 text-sm font-semibold text-white hover:bg-(--brand-strong) transition-colors">
            Go to Client API Setup
          </Link>
        </div>
      ) : (
        /* Client is READY: show send forms */
        <div className="mt-6 rounded-2xl border border-(--line) bg-white p-6">
          <div className="flex gap-2 border-b border-(--line) pb-4 mb-5">
            <button
              onClick={() => setActiveTab("text")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors
                ${activeTab === "text" ? "bg-(--brand) text-white" : "text-(--muted) hover:bg-(--surface)"}`}
            >
              <span className="inline-flex items-center gap-1.5"><TextMessageIcon />Text Message</span>
            </button>
            <button
              onClick={() => setActiveTab("image")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors
                ${activeTab === "image" ? "bg-(--accent) text-white" : "text-(--muted) hover:bg-(--surface)"}`}
            >
              <span className="inline-flex items-center gap-1.5"><ImageMessageIcon />Image Message</span>
            </button>
          </div>
          {activeTab === "text"  && <SendTextForm  apiToken={apiToken} onSent={fetchMessages} />}
          {activeTab === "image" && <SendImageForm apiToken={apiToken} onSent={fetchMessages} />}
        </div>
      )}

      {/* â”€â”€ Message History â”€â”€ */}
      <div className="mt-8 overflow-x-hidden">
        <h3 className="text-base font-semibold">Recent Messages</h3>
        <p className="mt-0.5 text-xs text-(--muted)">Last 50 outbound messages.</p>

        <div className="mt-4">
          {loading && <p className="text-sm text-(--muted)">Loading...</p>}
          {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
          {!loading && !error && messages.length === 0 && (
            <p className="text-sm text-(--muted)">No messages yet.</p>
          )}

          <div className="grid gap-3 overflow-x-hidden">
            {messages.map((msg, i) => {
              const messageType = (msg.messageType || "").toUpperCase();
              const isImage = messageType === "IMAGE";
              const imageUrl = isImage
                ? (msg.content?.imageUrl ?? msg.content?.url ?? msg.imageUrl ?? "")
                : "";
              const text = msg.content?.text ?? imageUrl ?? "-";
              const caption = msg.content?.caption ?? msg.caption ?? "";
              const sourceApp = msg.sourceApplication || "front-source";
              return (
                <div key={msg.id ?? i} className="overflow-hidden rounded-2xl border border-(--line) bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-(--muted)">{isImage ? <ImageMessageIcon /> : <TextMessageIcon />}</span>
                        <p className="text-sm font-medium truncate">{msg.recipientNumber}</p>
                      </div>
                      <p className="mt-0.5 break-all text-xs text-(--muted)">Source: {sourceApp}</p>
                      <p className="mt-1 wrap-break-word text-sm text-(--muted)">{text}</p>
                      {isImage && imageUrl && (
                        <>
                          <MessageImagePreview src={imageUrl} alt="Sent preview" />
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs font-medium text-(--brand) hover:underline"
                          >
                            Open full image
                          </a>
                        </>
                      )}
                      {caption && <p className="mt-0.5 truncate text-xs text-(--muted)">Caption: {caption}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                      <StatusBadge status={msg.messageStatus} />
                      <p className="text-xs text-(--muted)">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
