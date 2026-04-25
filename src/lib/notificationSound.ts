// Lightweight beep using WebAudio — no asset file needed.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function playNotificationSound(opts?: { freq?: number; durationMs?: number; volume?: number }) {
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume().catch(() => {});
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.value = opts?.freq ?? 880;
    g.gain.value = 0;
    o.connect(g);
    g.connect(ac.destination);
    const now = ac.currentTime;
    const dur = (opts?.durationMs ?? 220) / 1000;
    const vol = opts?.volume ?? 0.15;
    g.gain.linearRampToValueAtTime(vol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now);
    o.stop(now + dur + 0.05);

    // small second blip for distinctness
    setTimeout(() => {
      try {
        const o2 = ac.createOscillator();
        const g2 = ac.createGain();
        o2.type = "sine";
        o2.frequency.value = (opts?.freq ?? 880) * 1.25;
        o2.connect(g2);
        g2.connect(ac.destination);
        const t = ac.currentTime;
        g2.gain.linearRampToValueAtTime(vol, t + 0.01);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o2.start(t);
        o2.stop(t + dur + 0.05);
      } catch {
        /* noop */
      }
    }, 180);
  } catch {
    /* noop */
  }
}
