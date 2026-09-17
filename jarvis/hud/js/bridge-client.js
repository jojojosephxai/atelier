const BRIDGE = "http://127.0.0.1:8790";

let currentAudio = null;

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

/** Speak via bridge edge-tts. Returns true if audio played; false = use browser TTS. */
export async function speakViaBridge(text) {
  try {
    const res = await fetch(`${BRIDGE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (!blob.size) return false;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    await new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        reject(new Error("audio play failed"));
      };
      audio.play().catch(reject);
    });
    return true;
  } catch {
    return false;
  }
}

export function stopBridgeSpeech() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
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
