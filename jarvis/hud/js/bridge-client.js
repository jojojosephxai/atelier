const BRIDGE = "http://127.0.0.1:8790";

export async function askBridge(message) {
  try {
    const res = await fetch(`${BRIDGE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (res.status === 501) return null; // stub not wired
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.reply === "string" ? data.reply : null;
  } catch {
    return null; // bridge offline — local brain handles it
  }
}

export async function bridgeHealth() {
  try {
    const res = await fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(800) });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.ok);
  } catch {
    return false;
  }
}
