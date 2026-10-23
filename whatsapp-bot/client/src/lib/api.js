const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function buildApiUrl(path) {
  const base = String(API || "").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (base.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath.slice(4)}`;
  }

  return `${base}${normalizedPath}`;
}

export function apiFetch(path, options = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("whatsapp_token") : "";
  return fetch(buildApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}
