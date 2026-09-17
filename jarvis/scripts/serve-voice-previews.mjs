#!/usr/bin/env node
/**
 * Serve jarvis/voice-previews so Joseph can click Play on Ryan/Thomas samples.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "voice-previews");
const PORT = Number(process.env.JARVIS_VOICE_PORT || 8788);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".css": "text/css",
  ".js": "text/javascript",
  ".md": "text/plain; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  try {
    const data = await readFile(file);
    const ext = path.extname(file);
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`Jarvis voice previews → ${url}`);
  console.log("Click Play on Ryan / Thomas. Ctrl+C to stop.");
  const open =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  spawn(open, [url], { stdio: "ignore", shell: process.platform === "win32" }).on(
    "error",
    () => {
      console.log(`Open this in your browser: ${url}`);
    },
  );
});
