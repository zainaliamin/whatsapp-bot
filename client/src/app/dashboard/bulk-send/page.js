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
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      const extractedNumbers = data
        .flat()
        .filter(cell => cell != null && cell.toString().trim() !== "")
        .map(cell => cell.toString().replace(/[^0-9]/g, ""))
        .filter(num => num.length >= 10);
      
      setNumbers([...new Set(extractedNumbers)]); // Remove duplicates
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleEnqueue = async () => {
    if (numbers.length === 0) {
      setFeedback("Please upload an Excel file with phone numbers.");
      return;
    }
    if (!messageText && !mediaUrl) {
      setFeedback("Please enter a message or provide a media URL.");
      return;
    }

    setLoading(true);
    setFeedback("");

    const messages = numbers.map(num => ({
      recipientNumber: num,
      messageText,
      mediaUrl,
      caption
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
          <div className="rounded-xl border border-(--line) bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pending</p>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{stats.PENDING}</p>
          </div>
          <div className="rounded-xl border border-(--line) bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sent</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{stats.SENT}</p>
          </div>
          <div className="rounded-xl border border-(--line) bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Failed</p>
            <p className="mt-1 text-2xl font-semibold text-red-600">{stats.FAILED}</p>
          </div>
        </div>
      </div>

      {/* Upload Form */}
      <div className="mt-6 rounded-2xl border border-(--line) bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">Add Messages to Queue</h2>
        
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Excel / CSV</label>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                ref={fileInputRef}
                onChange={handleFileUpload} 
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-(--brand) file:text-white hover:file:bg-black cursor-pointer"
              />
              {numbers.length > 0 && (
                <p className="mt-2 text-sm text-green-600 font-medium">Found {numbers.length} valid numbers.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message Text</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Media URL (Optional)</label>
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-full rounded-xl border border-(--line) px-3 py-2 text-sm focus:border-(--brand) focus:outline-none"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caption for Media (Optional)</label>
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
