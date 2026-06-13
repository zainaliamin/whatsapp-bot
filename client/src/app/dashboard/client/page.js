"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { apiFetch } from "@/lib/api";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Status constants — must match backend CLIENT_STATUS enum exactly (uppercase)
const STATUS = {
  CREATED:      "CREATED",
  QR_READY:     "QR_READY",
  CONNECTED:    "CONNECTED",
  READY:        "READY",
  LOGOUT:       "LOGOUT",
  DISCONNECTED: "DISCONNECTED",
};

function statusColor(s) {
  if (s === STATUS.READY)        return "text-green-600";
  if (s === STATUS.LOGOUT)       return "text-orange-600";
  if (s === STATUS.DISCONNECTED) return "text-red-500";
  if (s === STATUS.QR_READY)     return "text-yellow-600";
  return "text-(--accent)";
}

function statusLabel(s) {
  if (s === STATUS.READY) return "Connected and ready to send messages";
  if (s === STATUS.QR_READY) return "Waiting for QR scan";
  if (s === STATUS.CONNECTED) return "Connecting to WhatsApp";
  if (s === STATUS.LOGOUT) return "Logged out from WhatsApp";
  if (s === STATUS.DISCONNECTED) return "Disconnected";
  if (s === STATUS.CREATED) return "Client created";
  return "Unknown status";
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function ClientPage() {
  const [apiToken,    setApiToken]    = useState(null);
  const [clientData,  setClientData]  = useState(null);   // null = no client
  const [qrDataUrl,   setQrDataUrl]   = useState(null);   // base64 QR image
  const [liveStatus,  setLiveStatus]  = useState(null);   // updated by socket
  const [loading,     setLoading]     = useState(true);
  const [actionMsg,   setActionMsg]   = useState({ text: "", ok: false });
  const [copyState,   setCopyState]   = useState("idle"); // idle | success | error
  const socketRef = useRef(null);

  // ── REST helpers ────────────────────────────────────────────────────────────
  const fetchApiToken = useCallback(() => {
    apiFetch("/api/users/api-token")
      .then((r) => r.json())
      .then((d) => { if (d.success) setApiToken(d.data?.token ?? null); })
      .catch(() => {});
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/client/status");
      const d = await r.json();
      const data = r.ok && d.success ? d.data : null;
      setClientData(data);
      if (data) setLiveStatus(data.status);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // ── Socket connection ────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("whatsapp_token");
    if (!token) return;

    const socket = io(BACKEND, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("client:qr", ({ qr, status }) => {
      setQrDataUrl(qr);
      setLiveStatus(status ?? STATUS.QR_READY);
    });

    socket.on("client:connected", ({ status }) => {
      setLiveStatus(status ?? STATUS.CONNECTED);
    });

    socket.on("client:ready", ({ status, apiToken: tok }) => {
      setLiveStatus(status ?? STATUS.READY);
      setQrDataUrl(null);           // QR no longer needed
      if (tok) setApiToken(tok);
      fetchApiToken();
      fetchStatus();
    });

    socket.on("client:disconnected", ({ status }) => {
      setLiveStatus(status ?? STATUS.DISCONNECTED);
      setQrDataUrl(null);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchApiToken, fetchStatus]);

  // ── Initial data load ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchApiToken();
    fetchStatus();
  }, [fetchApiToken, fetchStatus]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function clientAction(path, method, successMsg) {
    setActionMsg({ text: "", ok: false });
    const r = await apiFetch(path, { method });
    const d = await r.json();
    if (r.ok && d.success) {
      setActionMsg({ text: successMsg, ok: true });
      await fetchStatus();
      if (method === "POST") fetchApiToken();
    } else {
      setActionMsg({ text: d.message || "Action failed", ok: false });
    }
  }

  async function copyApiToken() {
    if (!apiToken) return;
    try {
      await navigator.clipboard.writeText(apiToken);
      setCopyState("success");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  // ── Derived booleans ─────────────────────────────────────────────────────────
  const hasClient    = clientData !== null;
  const currentStatus = liveStatus ?? clientData?.status;
  const isQrReady    = currentStatus === STATUS.QR_READY;
  const isReady      = currentStatus === STATUS.READY;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold tracking-tight">Client API Setup</h2>
      <p className="mt-1 text-sm text-(--muted)">Manage your WhatsApp client and API token.</p>

      {/* Info cards */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* API Token */}
        <div className="rounded-2xl border border-(--line) bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">API Token</p>
            {apiToken && (
              <button
                type="button"
                onClick={copyApiToken}
                className="rounded-full border border-(--line) px-3 py-1 text-xs font-semibold hover:bg-(--surface)"
              >
                {copyState === "success" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy"}
              </button>
            )}
          </div>
          {apiToken ? (
            <p className="mt-3 break-all rounded-xl bg-gray-50 px-3 py-2 font-mono text-xs">
              {apiToken}
            </p>
          ) : (
            <p className="mt-3 text-sm text-(--muted)">No API token yet. Create a client first.</p>
          )}
        </div>

        {/* Client Status */}
        <div className="rounded-2xl border border-(--line) bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">Client Status</p>
          {loading ? (
            <p className="mt-3 text-sm text-(--muted)">Loading…</p>
          ) : hasClient ? (
            <div className="mt-3 space-y-3 text-sm">
              <div className="grid gap-2 rounded-xl border border-(--line) bg-(--surface) p-3 text-xs">
                <p className="flex items-center justify-between gap-3">
                  <span className="text-(--muted)">Client Status</span>
                  <span className="font-semibold text-(--brand)">{currentStatus}</span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-(--muted)">API token</span>
                  <span className="font-semibold text-(--brand)">{apiToken ? "Available" : "Not available"}</span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-(--muted)">Created at</span>
                  <span className="font-semibold">{formatDateTime(clientData?.createdAt)}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-(--muted)">No client connected.</p>
          )}
        </div>
      </div>

      {/* ── QR Code Section ── only when status is qr_ready */}
      {hasClient && isQrReady && (
        <div className="mt-6 rounded-2xl border border-(--line) bg-white p-6 text-center">
          <p className="text-sm font-semibold text-(--brand)">Scan QR Code with WhatsApp</p>
          <p className="mt-1 text-xs text-(--muted)">
            Open WhatsApp → Linked Devices → Link a Device, then scan below.
          </p>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="WhatsApp QR Code"
              className="mx-auto mt-4 h-52 w-52 rounded-xl border border-(--line)"
            />
          ) : (
            <div className="mx-auto mt-4 flex h-52 w-52 items-center justify-center rounded-xl border border-(--line) bg-gray-50">
              <p className="text-xs text-(--muted)">Waiting for QR…</p>
            </div>
          )}
          <p className="mt-3 text-xs text-(--muted)">QR code refreshes automatically.</p>
        </div>
      )}

      {/* Action feedback */}
      {actionMsg.text && (
        <p className={`mt-4 rounded-xl px-4 py-2 text-sm ${
          actionMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
        }`}>
          {actionMsg.text}
        </p>
      )}

      {/* Action buttons */}
      <div className="mt-5 flex flex-wrap gap-3">
        {/* Create — only when no client */}
        {!loading && !hasClient && (
          <button
            onClick={() => clientAction("/api/client/create", "POST", "Client created. Scan the QR code to connect.")}
            className="rounded-full bg-(--brand) px-5 py-2.5 text-sm font-semibold text-white hover:bg-(--brand-strong)"
          >
            Create Client
          </button>
        )}

        {/* Logout — only when fully logged into WhatsApp (status = ready) */}
        {!loading && hasClient && isReady && (
          <button
            onClick={() => clientAction("/api/client/logout", "POST", "Client logged out successfully.")}
            className="rounded-full border border-(--line) px-5 py-2.5 text-sm font-semibold hover:bg-(--surface)"
          >
            Logout Client
          </button>
        )}

        {/* Delete — whenever a client record exists */}
        {!loading && hasClient && (
          <button
            onClick={() => clientAction("/api/client/delete", "DELETE", "Client deleted. You can now create a new one.")}
            className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Delete Client
          </button>
        )}
      </div>

      {!loading && !hasClient && (
        <p className="mt-4 text-xs text-(--muted)">
          Create a client, then scan the QR code to link your WhatsApp account.
        </p>
      )}
    </div>
  );
}
