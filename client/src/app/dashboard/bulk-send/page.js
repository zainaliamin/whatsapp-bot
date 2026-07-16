"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import * as XLSX from "xlsx";

export default function BulkSendPage() {
  const [file, setFile] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [statusMessages, setStatusMessages] = useState([]);
  const [statusMessagesLoading, setStatusMessagesLoading] = useState(false);
  const [statusMessagesError, setStatusMessagesError] = useState("");
  const [retryingFailed, setRetryingFailed] = useState(false);
  
  const [stats, setStats] = useState({
    PENDING: 0,
    SENT: 0,
    FAILED: 0,
    queueStatus: "PAUSED",
    nextSendTime: null
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await apiFetch("/api/bulk/stats");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats(data.data);
        }
      }
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      // Use header:1 to get raw rows as arrays
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Check if the first row looks like a header row (non-numeric first cell)
      const firstCell = data[0]?.[0]?.toString().trim() || "";
      const hasHeader = isNaN(firstCell.replace(/[^0-9]/g, "")) || firstCell.replace(/[^0-9]/g, "").length < 10;
      const rows = hasHeader ? data.slice(1) : data;

      const parsed = rows
        .filter(row => row && row[0] != null && row[0].toString().trim() !== "")
        .map(row => ({
          phone: row[0]?.toString().replace(/[^0-9]/g, ""),
          messageText: row[1]?.toString().trim() || "",
          mediaUrl: row[2]?.toString().trim() || "",
          caption: row[3]?.toString().trim() || ""
        }))
        .filter(r => r.phone.length >= 10);

      // Remove duplicate phone numbers (keep first occurrence)
      const seen = new Set();
      const unique = parsed.filter(r => {
        if (seen.has(r.phone)) return false;
        seen.add(r.phone);
        return true;
      });

      setNumbers(unique);
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const downloadSampleTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Phone Number", "Message Text", "Media URL", "Caption"],
      ["1234567890", "Hello! This is a custom message for you.", "", ""],
      ["9876543210", "Hi there!", "https://example.com/image.jpg", "Check this out!"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contacts");
    XLSX.writeFile(wb, "bulk_send_template.xlsx");
  };

  const handleEnqueue = async () => {
    if (numbers.length === 0) {
      setFeedback("Please upload an Excel file with phone numbers.");
      return;
    }

    // Pass if global fallback fields are filled OR if any Excel row has its own content
    const anyRowHasContent = numbers.some(r => r.messageText || r.mediaUrl);
    if (!messageText && !mediaUrl && !anyRowHasContent) {
      setFeedback("Please enter a fallback message or provide a media URL — or include Message Text / Media URL columns in your Excel file.");
      return;
    }

    setLoading(true);
    setFeedback("");

    // Per-row Excel values take priority; global form fields are the fallback
    const messages = numbers.map(row => ({
      recipientNumber: row.phone,
      messageText: row.messageText || messageText,
      mediaUrl: row.mediaUrl || mediaUrl,
      caption: row.caption || caption
    }));

    try {
      const res = await apiFetch("/api/bulk/enqueue", {
        method: "POST",
        body: JSON.stringify({ messages })
      });
      const data = await res.json();

      if (data.success) {
        setFeedback(`Successfully queued ${messages.length} messages.`);
        setNumbers([]);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchStats();
      } else {
        setFeedback("Failed to queue messages: " + (data.message || "Unknown error"));
      }
    } catch (e) {
      setFeedback("Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  const changeStatus = async (status) => {
    try {
      await apiFetch("/api/bulk/status", {
        method: "POST",
        body: JSON.stringify({ status })
      });
      fetchStats();
    } catch (e) {
      console.error("Failed to change status", e);
    }
  };

  const clearQueue = async () => {
    if (!confirm("Are you sure you want to clear all pending messages?")) return;
    try {
      await apiFetch("/api/bulk/pending", { method: "DELETE" });
      fetchStats();
    } catch (e) {
      console.error("Failed to clear queue", e);
    }
  };

  const openStatusMessages = async (status) => {
    setSelectedStatus(status);
    setStatusMessages([]);
    setStatusMessagesError("");
    setStatusMessagesLoading(true);

    try {
      const res = await apiFetch(`/api/bulk/messages?status=${encodeURIComponent(status)}&limit=200`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Unable to load messages.");
      }
      setStatusMessages(Array.isArray(data.data?.messages) ? data.data.messages : []);
    } catch (e) {
      setStatusMessagesError(e.message || "Unable to load messages.");
    } finally {
      setStatusMessagesLoading(false);
    }
  };

  const closeStatusMessages = () => {
    setSelectedStatus(null);
    setStatusMessages([]);
    setStatusMessagesError("");
  };

  const requeueFailedMessages = async () => {
    if (!confirm("Queue all failed messages for one more send attempt?")) return;

    setRetryingFailed(true);
    setFeedback("");
    try {
      const res = await apiFetch("/api/bulk/failed/requeue", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Unable to requeue failed messages.");
      }

      const count = Number(data.data?.count || 0);
      setFeedback(`${count} failed message${count === 1 ? "" : "s"} queued for resend.`);
      closeStatusMessages();
      fetchStats();
    } catch (e) {
      setStatusMessagesError(e.message || "Unable to requeue failed messages.");
    } finally {
      setRetryingFailed(false);
    }
  };

  const formatDate = (value) => value ? new Date(value).toLocaleString() : "-";

  return (
    <div className="p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-(--accent)">Dashboard</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Bulk Send</h1>
      <p className="mt-2 text-sm text-(--muted)">
        Upload an Excel file to send messages automatically in the background. 
      </p>

      {/* Queue Stats Panel */}
      <div className="mt-8 rounded-2xl border border-(--line) bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-xl font-semibold">Live Queue Status</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${stats.queueStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {stats.queueStatus}
              </span>
              {stats.queueStatus === 'ACTIVE' && stats.nextSendTime && (
                <span className="text-xs text-gray-500">
                  Next send approx: {new Date(stats.nextSendTime).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {stats.queueStatus === 'PAUSED' ? (
              <button onClick={() => changeStatus('ACTIVE')} className="rounded-xl bg-(--brand) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black">Resume Queue</button>
            ) : (
              <button onClick={() => changeStatus('PAUSED')} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100">Pause Queue</button>
            )}
            <button onClick={clearQueue} className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100">Clear Pending</button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <button type="button" onClick={() => openStatusMessages("PENDING")} className="rounded-xl border border-(--line) bg-gray-50 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pending</p>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{stats.PENDING}</p>
            <p className="mt-2 text-xs text-gray-500">View messages</p>
          </button>
          <button type="button" onClick={() => openStatusMessages("SENT")} className="rounded-xl border border-(--line) bg-gray-50 p-4 text-left transition-colors hover:border-green-300 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-400">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sent</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{stats.SENT}</p>
            <p className="mt-2 text-xs text-gray-500">View messages</p>
          </button>
          <button type="button" onClick={() => openStatusMessages("FAILED")} className="rounded-xl border border-(--line) bg-gray-50 p-4 text-left transition-colors hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Failed</p>
            <p className="mt-1 text-2xl font-semibold text-red-600">{stats.FAILED}</p>
            <p className="mt-2 text-xs text-gray-500">View messages</p>
          </button>
        </div>
      </div>

      {selectedStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-status-modal-title" onMouseDown={(e) => { if (e.target === e.currentTarget) closeStatusMessages(); }}>
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-(--line) px-6 py-4">
              <div>
                <h2 id="bulk-status-modal-title" className="text-xl font-semibold">{selectedStatus[0] + selectedStatus.slice(1).toLowerCase()} bulk messages</h2>
                <p className="mt-1 text-sm text-(--muted)">Showing up to the latest 200 messages.</p>
              </div>
              <div className="flex items-center gap-3">
                {selectedStatus === "FAILED" && statusMessages.length > 0 && (
                  <button type="button" onClick={requeueFailedMessages} disabled={retryingFailed} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60">
                    {retryingFailed ? "Queueing..." : "Resend All Failed"}
                  </button>
                )}
                <button type="button" onClick={closeStatusMessages} className="rounded-lg px-3 py-1 text-2xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800" aria-label="Close message list">&times;</button>
              </div>
            </div>
            <div className="max-h-[calc(85vh-88px)] overflow-auto p-6">
              {statusMessagesLoading && <p className="text-sm text-(--muted)">Loading messages...</p>}
              {statusMessagesError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{statusMessagesError}</p>}
              {!statusMessagesLoading && !statusMessagesError && statusMessages.length === 0 && <p className="text-sm text-(--muted)">No {selectedStatus.toLowerCase()} bulk messages.</p>}
              {!statusMessagesLoading && !statusMessagesError && statusMessages.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-(--line) text-xs uppercase tracking-wide text-gray-500">
                      <tr><th className="px-3 py-2">Recipient</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">Updated</th>{selectedStatus === "FAILED" && <th className="px-3 py-2">Error</th>}</tr>
                    </thead>
                    <tbody>
                      {statusMessages.map((message) => (
                        <tr key={message.id} className="border-b border-gray-100 align-top">
                          <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-800">{message.recipient_number}</td>
                          <td className="min-w-56 px-3 py-3 text-gray-600"><p className="line-clamp-2">{message.message_text || message.caption || (message.media_url ? "Media message" : "-")}</p>{message.media_url && <a href={message.media_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-(--brand) hover:underline">Open media</a>}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-gray-500">{formatDate(message.updated_at)}</td>
                          {selectedStatus === "FAILED" && <td className="min-w-48 px-3 py-3 text-red-600">{message.error_message || "No error details available."}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <div className="mt-6 rounded-2xl border border-(--line) bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">Add Messages to Queue</h2>
        
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Upload Excel / CSV</label>
                <button 
                  onClick={downloadSampleTemplate} 
                  className="text-xs font-semibold text-(--brand) hover:underline"
                >
                  Download Sample Template
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">Columns: <span className="font-medium text-gray-500">Phone Number, Message Text, Media URL, Caption</span>. Excel values override the fields below.</p>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                ref={fileInputRef}
                onChange={handleFileUpload} 
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-(--brand) file:text-white hover:file:bg-black cursor-pointer"
              />
              {numbers.length > 0 && (
                <p className="mt-2 text-sm text-green-600 font-medium">
                  Found {numbers.length} valid numbers. {numbers.filter(r => r.messageText || r.mediaUrl).length > 0 && `(${numbers.filter(r => r.messageText || r.mediaUrl).length} have custom messages)`}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fallback Message Text</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-(--line) p-3 text-sm focus:border-(--brand) focus:outline-none"
                placeholder="Hello! This is a bulk message."
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fallback Media URL (Optional)</label>
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-full rounded-xl border border-(--line) px-3 py-2 text-sm focus:border-(--brand) focus:outline-none"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fallback Caption (Optional)</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full rounded-xl border border-(--line) px-3 py-2 text-sm focus:border-(--brand) focus:outline-none"
                placeholder="Caption for your image..."
              />
            </div>

            <div className="pt-2">
              <button 
                onClick={handleEnqueue}
                disabled={loading || numbers.length === 0}
                className="w-full rounded-xl bg-(--brand) px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Queueing..." : "Send to Background Queue"}
              </button>
              {feedback && (
                <p className="mt-2 text-sm font-medium text-center text-(--brand)">{feedback}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
