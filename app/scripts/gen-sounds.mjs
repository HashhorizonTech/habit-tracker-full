// Synthesises every Tend sound as 16-bit mono WAV into assets/sounds/.
// No samples or licensed audio: everything is built from oscillators and
// shaped noise with a seeded RNG, so output is reproducible. Run: npm run gen:sounds
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../assets/sounds/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---------- primitives ----------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function wav(samples, rate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

function save(name, samples, rate, peak = 0.8) {
  // normalise to a consistent loudness
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  const g = max > 0 ? peak / max : 1;
  const out = samples.map((s) => s * g);
  writeFileSync(new URL(name, OUT), wav(out, rate));
  console.log(`${name.padEnd(18)} ${(out.length / rate).toFixed(2)}s  ${((44 + out.length * 2) / 1024).toFixed(0)} KB`);
}

const buffer = (sec, rate) => new Float32Array(Math.round(sec * rate));
const noteHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** Bell-ish partial stack with exponential decay. */
function bell(out, rate, t0, freq, { dur = 1, gain = 1, decay = 3, partials = [[1, 1], [2.01, 0.35], [3.02, 0.15], [4.2, 0.06]], attack = 0.004 } = {}) {
  const start = Math.round(t0 * rate);
  const len = Math.round(dur * rate);
  for (let i = 0; i < len && start + i < out.length; i++) {
    const t = i / rate;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t);
    let v = 0;
    for (const [mult, amp] of partials) v += amp * Math.sin(2 * Math.PI * freq * mult * t) * Math.exp(-decay * (mult - 1) * 0.35 * t);
    out[start + i] += gain * env * v;
  }
}

/** One-pole low-pass. */
function lowpass(x, rate, cutoff) {
  const a = Math.exp((-2 * Math.PI * cutoff) / rate);
  let y = 0;
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = y = (1 - a) * x[i] + a * y;
  return out;
}
const highpass = (x, rate, cutoff) => {
  const lp = lowpass(x, rate, cutoff);
  return x.map((v, i) => v - lp[i]);
};
function bandpass(x, rate, lo, hi) {
  return lowpass(highpass(x, rate, lo), rate, hi);
}

/** Crossfade the tail into the head so the loop is seamless. */
function makeLoop(x, rate, fadeSec = 1.5) {
  const f = Math.round(fadeSec * rate);
  const body = x.slice(0, x.length - f);
  for (let i = 0; i < f; i++) {
    const w = i / f;
    body[i] = body[i] * w + x[x.length - f + i] * (1 - w);
  }
  return body;
}

// ---------- UI sounds (44.1 kHz) ----------
const R = 44100;

{ // habit +1 step: soft wooden tick
  const o = buffer(0.12, R);
  const r = rng(7);
  for (let i = 0; i < o.length; i++) {
    const t = i / R;
    o[i] = (Math.sin(2 * Math.PI * 1320 * t) * 0.8 + (r() * 2 - 1) * 0.25) * Math.exp(-55 * t);
  }
  save('tick.wav', lowpass(o, R, 5000), R, 0.55);
}

{ // habit complete: bright rising two-note chime
  const o = buffer(1.1, R);
  bell(o, R, 0, noteHz(88), { dur: 1.1, decay: 4.5, gain: 0.8 }); // E6
  bell(o, R, 0.09, noteHz(95), { dur: 1.0, decay: 4, gain: 1 }); // B6
  save('complete.wav', o, R, 0.75);
}

{ // undo: gentle descending blip
  const o = buffer(0.16, R);
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / R;
    const f = 700 - 1800 * t;
    ph += (2 * Math.PI * f) / R;
    o[i] = Math.sin(ph) * Math.min(1, t / 0.005) * Math.exp(-22 * t);
  }
  save('undo.wav', o, R, 0.4);
}

{ // task done: bubbly pop
  const o = buffer(0.18, R);
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / R;
    const f = 380 + 1500 * (1 - Math.exp(-30 * t));
    ph += (2 * Math.PI * f) / R;
    o[i] = Math.sin(ph) * Math.min(1, t / 0.003) * Math.exp(-26 * t);
  }
  save('pop.wav', o, R, 0.6);
}

{ // mood logged: soft single chime
  const o = buffer(1.2, R);
  bell(o, R, 0, noteHz(84), { dur: 1.2, decay: 3.2, partials: [[1, 1], [2, 0.2], [3, 0.05]] }); // C6
  save('mood.wav', o, R, 0.5);
}

{ // focus start: two soft rising notes
  const o = buffer(0.9, R);
  bell(o, R, 0, noteHz(72), { dur: 0.8, decay: 5, partials: [[1, 1], [2, 0.25]] });
  bell(o, R, 0.14, noteHz(79), { dur: 0.75, decay: 5, partials: [[1, 1], [2, 0.25]] });
  save('focus-start.wav', o, R, 0.55);
}

{ // focus complete: singing-bowl bell with a gentle beat
  const o = buffer(3.6, R);
  const f = noteHz(69); // A4
  bell(o, R, 0, f, { dur: 3.6, decay: 1.1, attack: 0.012, partials: [[1, 1], [1.004, 0.8], [2.71, 0.45], [5.2, 0.18], [8.4, 0.06]] });
  bell(o, R, 0.35, f * 1.5, { dur: 3.2, decay: 1.4, gain: 0.35, attack: 0.02 });
  save('focus-bell.wav', o, R, 0.8);
}

{ // break over: three-note motif
  const o = buffer(1.5, R);
  [76, 79, 84].forEach((m, i) => bell(o, R, i * 0.16, noteHz(m), { dur: 1.2, decay: 3.5, gain: 0.9 }));
  save('break-over.wav', o, R, 0.7);
}

{ // achievement unlocked: arpeggio + shimmer
  const o = buffer(2.0, R);
  [72, 76, 79, 84].forEach((m, i) => bell(o, R, i * 0.1, noteHz(m), { dur: 1.6, decay: 2.6, gain: 0.8 }));
  const r = rng(11);
  for (let k = 0; k < 14; k++) bell(o, R, 0.45 + r() * 0.8, noteHz(96 + Math.floor(r() * 8)), { dur: 0.4, decay: 9, gain: 0.12 });
  save('achievement.wav', o, R, 0.8);
}

{ // perfect day: longer fanfare with a resolving chord
  const o = buffer(2.8, R);
  [67, 72, 76, 79].forEach((m, i) => bell(o, R, i * 0.12, noteHz(m), { dur: 1.2, decay: 3, gain: 0.7 }));
  [72, 76, 79, 84].forEach((m) => bell(o, R, 0.62, noteHz(m), { dur: 2.2, decay: 1.6, gain: 0.55 }));
  save('perfect-day.wav', o, R, 0.85);
}

{ // level up: quick upward sweep into a chord
  const o = buffer(1.8, R);
  let ph = 0;
  for (let i = 0; i < Math.round(0.35 * R); i++) {
    const t = i / R;
    ph += (2 * Math.PI * (400 + 2400 * t * t * 8)) / R;
    o[i] += 0.25 * Math.sin(ph) * Math.min(1, t / 0.01) * (1 - t / 0.35);
  }
  [74, 78, 81, 86].forEach((m) => bell(o, R, 0.32, noteHz(m), { dur: 1.4, decay: 2.2, gain: 0.6 }));
  save('level-up.wav', o, R, 0.8);
}

// ---------- ambient loops (22.05 kHz, 30 s) ----------
const A = 22050;
const LOOP = 31.5; // 1.5 s is consumed by the crossfade

{ // brown noise: integrated white noise, DC-blocked
  const r = rng(3);
  const x = buffer(LOOP, A);
  let b = 0;
  for (let i = 0; i < x.length; i++) {
    b = (b + (r() * 2 - 1) * 0.02) * 0.997;
    x[i] = b;
  }
  save('ambient-brown.wav', makeLoop(highpass(x, A, 20), A), A, 0.5);
}

{ // rain: band-limited hiss + scattered droplets
  const r = rng(5);
  const hiss = buffer(LOOP, A).map(() => r() * 2 - 1);
  const x = bandpass(hiss, A, 400, 6000).map((v) => v * 0.35);
  for (let k = 0; k < LOOP * 90; k++) {
    const t0 = r() * (LOOP - 0.05);
    const f = 1800 + r() * 3500;
    const g = 0.05 + r() * 0.18;
    const s = Math.round(t0 * A);
    for (let i = 0; i < 0.03 * A; i++) {
      const t = i / A;
      x[s + i] += g * Math.sin(2 * Math.PI * f * t) * Math.exp(-160 * t);
    }
  }
  save('ambient-rain.wav', makeLoop(x, A), A, 0.5);
}

{ // café: warm murmur (formant-ish bands) + occasional cup clinks
  const r = rng(9);
  const n = buffer(LOOP, A).map(() => r() * 2 - 1);
  const murmur = bandpass(n, A, 180, 900);
  const x = new Float32Array(murmur.length);
  // slow amplitude wobble so it reads as many voices, not a fan
  for (let i = 0; i < x.length; i++) {
    const t = i / A;
    x[i] = murmur[i] * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.23 * t) * Math.sin(2 * Math.PI * 0.071 * t + 1));
  }
  for (let k = 0; k < 18; k++) bell(x, A, r() * (LOOP - 1), 2200 + r() * 1800, { dur: 0.6, decay: 9, gain: 0.05 + r() * 0.05, partials: [[1, 1], [2.76, 0.5], [5.4, 0.25]] });
  save('ambient-cafe.wav', makeLoop(x, A), A, 0.45);
}

{ // forest: soft wind + bird chirps
  const r = rng(13);
  const n = buffer(LOOP, A).map(() => r() * 2 - 1);
  const wind = lowpass(n, A, 500);
  const x = new Float32Array(wind.length);
  for (let i = 0; i < x.length; i++) {
    const t = i / A;
    x[i] = wind[i] * 0.6 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.09 * t));
  }
  for (let k = 0; k < 26; k++) {
    const t0 = r() * (LOOP - 1.2);
    const base = 2600 + r() * 1800;
    const notes = 2 + Math.floor(r() * 4);
    for (let j = 0; j < notes; j++) {
      const s = Math.round((t0 + j * (0.09 + r() * 0.05)) * A);
      const len = Math.round((0.05 + r() * 0.05) * A);
      let ph = 0;
      const g = 0.06 + r() * 0.06;
      const sweep = (r() - 0.3) * 2500;
      for (let i = 0; i < len && s + i < x.length; i++) {
        const t = i / A;
        const env = Math.sin((Math.PI * i) / len);
        ph += (2 * Math.PI * (base + sweep * (i / len))) / A;
        x[s + i] += g * env * Math.sin(ph);
      }
    }
  }
  save('ambient-forest.wav', makeLoop(x, A), A, 0.45);
}
