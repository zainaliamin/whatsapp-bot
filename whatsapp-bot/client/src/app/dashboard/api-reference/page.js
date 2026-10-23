"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      className="rounded-lg border border-(--line) px-3 py-1 text-xs font-medium hover:bg-(--surface) transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ children }) {
  return (
    <div className="relative mt-2 rounded-xl bg-gray-950 px-4 py-3">
      <pre className="overflow-x-auto text-xs text-gray-100 whitespace-pre">{children}</pre>
      <div className="absolute right-3 top-3">
        <CopyButton text={children} />
      </div>
    </div>
  );
}

function Field({ name, type, required, desc }) {
  return (
    <tr className="border-t border-(--line)">
      <td className="py-2 pr-4 font-mono text-xs text-(--brand)">{name}</td>
      <td className="py-2 pr-4 text-xs text-(--muted)">{type}</td>
      <td className="py-2 pr-4 text-xs">
        {required
          ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">required</span>
          : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">optional</span>}
      </td>
      <td className="py-2 text-xs text-(--muted)">{desc}</td>
    </tr>
  );
}

export default function ApiReferencePage() {
  const [apiToken, setApiToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const base = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000")
    : "http://localhost:4000";

  useEffect(() => {
    apiFetch("/api/users/api-token")
      .then((r) => r.json())
      .then((d) => { if (d.success) setApiToken(d.data?.token ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const token = apiToken || "<YOUR_API_TOKEN>";
  const authHeader = `Authorization: Bearer ${token}`;
  const textEndpoint = `${base}/api/messages/send-text`;
  const imageEndpoint = `${base}/api/messages/send-image`;
  const textBodyTemplate = `{
  "recipientNumber": "923001234567",
  "messageText": "Hello from my app!",
  "sourceApplication": "my-app"
}`;
  const imageBodyTemplate = `{
  "recipientNumber": "923001234567",
  "imageUrl": "https://example.com/image.jpg",
  "caption": "Optional caption",
  "sourceApplication": "my-app"
}`;

  const textCurl = `curl -X POST ${base}/api/messages/send-text \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipientNumber": "923001234567",
    "messageText": "Hello from my app!",
    "sourceApplication": "my-app"
  }'`;

  const imageCurl = `curl -X POST ${base}/api/messages/send-image \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipientNumber": "923001234567",
    "imageUrl": "https://example.com/image.jpg",
    "caption": "Check this out!",
    "sourceApplication": "my-app"
  }'`;

  const textJs = `const response = await fetch("${base}/api/messages/send-text", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    recipientNumber: "923001234567",
    messageText: "Hello from my app!",
    sourceApplication: "my-app"
  })
});
const data = await response.json();
console.log(data);`;

  const imageJs = `const response = await fetch("${base}/api/messages/send-image", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    recipientNumber: "923001234567",
    imageUrl: "https://example.com/image.jpg",
    caption: "Check this out!",
    sourceApplication: "my-app"
  })
});
const data = await response.json();
console.log(data);`;

  const successResponse = `{
  "success": true,
  "message": "Text message sent",
  "data": {
    "id": 42,
    "recipientNumber": "923001234567",
    "messageText": "Hello from my app!",
    "status": "SENT",
    "sourceApplication": "my-app",
    "createdAt": "2026-03-12T10:00:00.000Z"
  }
}`;

  const errorResponse = `{
  "success": false,
  "message": "Validation error: recipientNumber is required"
}`;

  return (
    <div className="p-8 max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-(--accent)">Documentation</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">API Reference</h2>
      <p className="mt-1 text-sm text-(--muted)">
        Use these endpoints to send WhatsApp messages from any external application.
      </p>

      {/* API Token banner */}
      <div className="mt-6 rounded-2xl border border-(--line) bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">Your API Token</p>
        {loading ? (
          <p className="mt-2 text-sm text-(--muted)">Loading…</p>
        ) : apiToken ? (
          <div className="mt-2 flex items-center gap-3">
            <p className="break-all rounded-xl bg-gray-50 px-3 py-2 font-mono text-xs flex-1">{apiToken}</p>
            <CopyButton text={apiToken} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-red-500">
            No API token found. Go to <strong>Client API Setup</strong> and create a client first.
          </p>
        )}
        <p className="mt-2 text-xs text-(--muted)">
          Pass this token as <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> on every request.
        </p>
      </div>

      {/* Base URL */}
      <div className="mt-6 rounded-2xl border border-(--line) bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">Base URL</p>
        <CodeBlock>{base}</CodeBlock>
        <p className="mt-2 text-xs text-(--muted)">All endpoints are prefixed with <code className="font-mono">/api/messages</code>.</p>
      </div>

      {/* Quick Start */}
      <div className="mt-6 rounded-2xl border border-(--line) bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">Quick Start</p>
        <ol className="mt-3 grid gap-2 text-xs text-(--muted)">
          <li>1. Create and connect your WhatsApp client from Client API Setup.</li>
          <li>2. Copy your API token and include it in the Authorization header.</li>
          <li>3. Send requests to send-text or send-image endpoint.</li>
          <li>4. Check Recent Messages in dashboard for delivery status.</li>
        </ol>
        <div className="mt-4">
          <p className="text-xs font-semibold text-(--muted)">Authorization Header</p>
          <CodeBlock>{authHeader}</CodeBlock>
        </div>
      </div>

      {/* ── Send Text ── */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">POST</span>
          <code className="font-mono text-sm">/api/messages/send-text</code>
          <CopyButton text={textEndpoint} />
        </div>
        <p className="mt-1 text-sm text-(--muted)">Send a plain-text WhatsApp message to a phone number.</p>

        <div className="mt-4 rounded-2xl border border-(--line) bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">Request Body</p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2 text-xs font-semibold text-(--muted) pr-4">Field</th>
                <th className="pb-2 text-xs font-semibold text-(--muted) pr-4">Type</th>
                <th className="pb-2 text-xs font-semibold text-(--muted) pr-4">Required</th>
                <th className="pb-2 text-xs font-semibold text-(--muted)">Description</th>
              </tr>
            </thead>
            <tbody>
              <Field name="recipientNumber" type="string" required desc="Phone number with country code, no + or spaces. Min 8, max 20 chars. e.g. 923001234567" />
              <Field name="messageText" type="string" required desc="The text message to send. Max 4096 characters." />
              <Field name="sourceApplication" type="string" required desc="Name of your app sending the message. Min 2, max 120 chars." />
            </tbody>
          </table>
          <p className="mt-4 text-xs font-semibold text-(--muted)">JSON Template</p>
          <CodeBlock>{textBodyTemplate}</CodeBlock>
        </div>

        <div className="mt-4 rounded-2xl border border-(--line) bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">cURL Example</p>
          <CodeBlock>{textCurl}</CodeBlock>
        </div>

        <div className="mt-4 rounded-2xl border border-(--line) bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">JavaScript (fetch)</p>
          <CodeBlock>{textJs}</CodeBlock>
        </div>
      </section>

      {/* ── Send Image ── */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">POST</span>
          <code className="font-mono text-sm">/api/messages/send-image</code>
          <CopyButton text={imageEndpoint} />
        </div>
        <p className="mt-1 text-sm text-(--muted)">Send an image with an optional caption.</p>

        <div className="mt-4 rounded-2xl border border-(--line) bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">Request Body</p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2 text-xs font-semibold text-(--muted) pr-4">Field</th>
                <th className="pb-2 text-xs font-semibold text-(--muted) pr-4">Type</th>
                <th className="pb-2 text-xs font-semibold text-(--muted) pr-4">Required</th>
                <th className="pb-2 text-xs font-semibold text-(--muted)">Description</th>
              </tr>
            </thead>
            <tbody>
              <Field name="recipientNumber" type="string" required desc="Phone number with country code, no + or spaces. e.g. 923001234567" />
              <Field name="imageUrl" type="string (URL)" required desc="Publicly accessible URL of the image to send." />
              <Field name="caption" type="string" required={false} desc="Optional caption shown below the image. Max 1024 chars." />
              <Field name="sourceApplication" type="string" required desc="Name of your app. Min 2, max 120 chars." />
            </tbody>
          </table>
          <p className="mt-4 text-xs font-semibold text-(--muted)">JSON Template</p>
          <CodeBlock>{imageBodyTemplate}</CodeBlock>
        </div>

        <div className="mt-4 rounded-2xl border border-(--line) bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">cURL Example</p>
          <CodeBlock>{imageCurl}</CodeBlock>
        </div>

        <div className="mt-4 rounded-2xl border border-(--line) bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">JavaScript (fetch)</p>
          <CodeBlock>{imageJs}</CodeBlock>
        </div>
      </section>

      {/* ── Responses ── */}
      <section className="mt-10">
        <h3 className="text-base font-semibold">Responses</h3>

        <div className="mt-4 rounded-2xl border border-(--line) bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-600">201 — Success</p>
          <CodeBlock>{successResponse}</CodeBlock>
        </div>

        <div className="mt-4 rounded-2xl border border-(--line) bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">4xx — Error</p>
            <CopyButton text={errorResponse} />
          </div>
          <CodeBlock>{errorResponse}</CodeBlock>
          <div className="mt-4 grid gap-2">
            {[
              ["400", "Validation error — missing or invalid fields"],
              ["401", "Missing or invalid API token"],
              ["403", "Message expiry date reached or rate limit exceeded"],
              ["429", "Too many requests — slow down"],
            ].map(([code, desc]) => (
              <div key={code} className="flex items-start gap-3 text-sm">
                <span className="shrink-0 rounded-lg bg-red-50 px-2 py-0.5 font-mono text-xs font-bold text-red-600">{code}</span>
                <span className="text-xs text-(--muted)">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Delivery Notes */}
      <section className="mt-10 rounded-2xl border border-(--line) bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">Delivery Checklist</p>
        <ul className="mt-3 grid gap-2 text-xs text-(--muted) list-disc list-inside">
          <li>Client status must be <strong className="text-(--brand)">READY</strong>.</li>
          <li>Recipient number must include country code with digits only.</li>
          <li>Image URLs must be publicly reachable over HTTP/HTTPS.</li>
          <li>Respect rate limit and account expiry rules.</li>
        </ul>
      </section>

      {/* ── Notes ── */}
      <section className="mt-10 rounded-2xl border border-(--line) bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--muted)">Notes</p>
        <ul className="mt-3 grid gap-2 text-xs text-(--muted) list-disc list-inside">
          <li>The API token is tied to your WhatsApp client. If you delete the client, the token is revoked.</li>
          <li>Phone numbers must include the country code without <code className="font-mono">+</code> or spaces (e.g. <code className="font-mono">923001234567</code> for Pakistan).</li>
          <li>Your WhatsApp client must be in <strong className="text-(--brand)">READY</strong> status for messages to be delivered.</li>
          <li>Rate limiting and message expiry rules apply per your account configuration.</li>
        </ul>
      </section>
    </div>
  );
}
