// Synthesized sound: bells, pops, whooshes, a machine hum, and sleigh bells.
// Nothing to load; every sound is built with Web Audio when it plays.
(function (root) {
  "use strict";
  let ctx = null;
  let master = null;
  let muted = localStorage.getItem("draw.muted") === "1";
  let hum = null;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function env(gain, t, attack, peak, decay) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // A bell: a sine with inharmonic partials, each decaying on its own.
  function bell(freq, when = 0, volume = 0.25, length = 1.6) {
    const c = ensure();
    const t = c.currentTime + when;
    [[1, 1], [2.76, 0.42], [5.4, 0.2], [8.93, 0.08]].forEach(([ratio, amp]) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = freq * ratio;
      env(g, t, 0.004, volume * amp, length / ratio ** 0.4);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + length + 0.1);
    });
  }

  function noiseBuffer(c, seconds) {
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function whoosh(when = 0, length = 0.45, volume = 0.12, from = 400, to = 3200) {
    const c = ensure();
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, length + 0.05);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + length);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + length * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  function pop(when = 0, volume = 0.3) {
    const c = ensure();
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.09);
    env(g, t, 0.003, volume, 0.1);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.2);
  }

  function thump(when = 0, volume = 0.5) {
    const c = ensure();
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    env(g, t, 0.005, volume, 0.35);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.5);
  }

  // Sleigh bells: bursts of high, ringing noise.
  function jingle(when = 0, count = 8, volume = 0.08) {
    const c = ensure();
    for (let i = 0; i < count; i++) {
      const t = c.currentTime + when + i * 0.07 + Math.random() * 0.02;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 0.25);
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 6500 + Math.random() * 3000;
      f.Q.value = 12;
      const g = c.createGain();
      env(g, t, 0.002, volume * (1 - i / (count * 1.4)), 0.18);
      src.connect(f).connect(g).connect(master);
      src.start(t);
    }
  }

  // A low two-oscillator hum with a wobble, for the machine while it runs.
  function humStart() {
    const c = ensure();
    if (hum) return;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 1.2);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    const oscs = [55, 82.5].map((freq) => {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.connect(f);
      o.start();
      return o;
    });
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 5;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(f.frequency);
    lfo.start();
    f.connect(g).connect(master);
    hum = { g, oscs: [...oscs, lfo] };
  }

  function humStop() {
    if (!hum || !ctx) return;
    const { g, oscs } = hum;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    oscs.forEach((o) => o.stop(t + 0.9));
    hum = null;
  }

  // C major pentatonic, so reveals in a row always sound musical.
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];
  function revealBell(i) {
    bell(SCALE[i % SCALE.length], 0, 0.2, 1.2);
  }

  // A quiet high plink, one per name written on the list.
  function plink(i) {
    bell(SCALE[5 + (i % 5)], 0, 0.035, 0.4);
  }

  function fanfare(when = 0) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, when + i * 0.11, 0.22, 2.2));
    bell(1318.51, when + 0.5, 0.18, 2.6);
    jingle(when + 0.1, 14, 0.07);
  }

  function setMuted(value) {
    muted = value;
    localStorage.setItem("draw.muted", value ? "1" : "0");
    if (master) master.gain.value = muted ? 0 : 0.55;
  }

  root.Sound = {
    unlock: ensure,
    bell, whoosh, pop, thump, jingle, humStart, humStop, revealBell, plink, fanfare,
    setMuted,
    get muted() { return muted; },
  };
})(this);
