// Thin fetch wrapper for the backend. Every page talks to the API through
// this module.
//
// On failure it throws an Error carrying the server's message (e.g. "Wrong
// passcode") and the HTTP status as err.status.

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    const message = error || `${method} ${path} failed: ${res.status}`;
    throw Object.assign(new Error(message), { status: res.status });
  }
  return res.status === 204 ? null : res.json();
}
