/** Subtle Stark-style boot / speak tones (no external audio files). */
export function playBootChirp() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const now = ctx.currentTime;
  const tones = [220, 330, 440];
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.05 + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + i * 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.08);
    osc.stop(now + 0.45 + i * 0.08);
  });
  setTimeout(() => ctx.close().catch(() => {}), 1200);
}

export function playAckBlip() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 520;
  gain.gain.value = 0.03;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
  osc.stop(ctx.currentTime + 0.14);
  setTimeout(() => ctx.close().catch(() => {}), 400);
}
