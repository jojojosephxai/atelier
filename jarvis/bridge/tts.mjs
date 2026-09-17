/**
 * Free Jarvis-ish TTS via Microsoft edge-tts (en-GB-RyanNeural).
 * Spawns the edge-tts CLI; returns MP3 bytes or null if unavailable.
 *
 * Note: rate must be passed as `--rate=-8%` (one argv). Separate `--rate` `-8%`
 * makes argparse treat `-8%` as a flag and fails.
 */
import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_VOICE = process.env.JARVIS_TTS_VOICE || "en-GB-RyanNeural";
const DEFAULT_RATE = process.env.JARVIS_TTS_RATE || "-8%";

function isExecutable(file) {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Prefer EDGE_TTS_BIN, then PATH name, then ~/.local/bin (pip --user). */
function edgeBin() {
  if (process.env.EDGE_TTS_BIN) return process.env.EDGE_TTS_BIN;
  const local = join(homedir(), ".local", "bin", "edge-tts");
  if (isExecutable(local)) return local;
  return "edge-tts";
}

/**
 * @param {string} text
 * @param {{ voice?: string, rate?: string }} [opts]
 * @returns {Promise<Buffer | null>}
 */
export async function synthesizeMp3(text, opts = {}) {
  const cleaned = String(text || "").trim().slice(0, 2000);
  if (!cleaned) return null;

  const voice = opts.voice || DEFAULT_VOICE;
  const rate = opts.rate || DEFAULT_RATE;
  const dir = await mkdtemp(join(tmpdir(), "jarvis-tts-"));
  const out = join(dir, "out.mp3");

  try {
    await new Promise((resolve, reject) => {
      const args = [
        "--voice",
        voice,
        `--rate=${rate}`,
        "--text",
        cleaned,
        "--write-media",
        out,
      ];
      const child = spawn(edgeBin(), args, { stdio: ["ignore", "pipe", "pipe"] });
      let err = "";
      child.stderr.on("data", (chunk) => {
        err += chunk.toString();
      });
      child.on("error", (e) => reject(e));
      child.on("close", (code) => {
        if (code === 0) resolve(undefined);
        else reject(new Error(err || `edge-tts exited ${code}`));
      });
    });
    return await readFile(out);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function ttsConfig() {
  return {
    provider: "edge-tts",
    voice: DEFAULT_VOICE,
    rate: DEFAULT_RATE,
  };
}
