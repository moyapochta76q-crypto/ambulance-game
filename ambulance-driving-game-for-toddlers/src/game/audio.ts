// ─── Синтезированный звуковой движок (Web Audio API) ───────────────────────
// Ни одного внешнего файла: сирена, сигнал, «боинг», фанфары и музыка —
// всё генерируется осцилляторами, поэтому работает офлайн и мгновенно.

type AC = AudioContext;

export class AudioEngine {
  private ctx: AC | null = null;
  private master: GainNode | null = null;
  private muted = false;

  // Сирена
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenTimer: number | null = null;
  private sirenHigh = false;

  // Сигнал (удержание)
  private hornNodes: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode } | null = null;

  // Мотор
  private engOsc1: OscillatorNode | null = null;
  private engOsc2: OscillatorNode | null = null;
  private engGain: GainNode | null = null;

  // Музыка
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNextTime = 0;
  private musicOn = false;

  private lastBoing = 0;

  ensure() {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  // ── Мотор: тихое рокотание, зависящее от скорости ────────────────────────
  engineStart() {
    const ctx = this.ensure();
    if (this.engOsc1) return;
    this.engOsc1 = ctx.createOscillator();
    this.engOsc2 = ctx.createOscillator();
    this.engOsc1.type = 'sawtooth';
    this.engOsc2.type = 'triangle';
    this.engOsc1.frequency.value = 62;
    this.engOsc2.frequency.value = 93;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0.0;
    this.engOsc1.connect(lp);
    this.engOsc2.connect(lp);
    lp.connect(this.engGain);
    this.engGain.connect(this.master!);
    this.engOsc1.start();
    this.engOsc2.start();
  }

  engineSpeed(norm: number) {
    if (!this.ctx || !this.engGain || !this.engOsc1) return;
    const t = this.ctx.currentTime;
    this.engOsc1.frequency.setTargetAtTime(58 + norm * 46, t, 0.2);
    this.engOsc2!.frequency.setTargetAtTime(88 + norm * 62, t, 0.2);
    this.engGain.gain.setTargetAtTime(0.028 + norm * 0.035, t, 0.2);
  }

  // ── Сирена «ни-на-ни-на» ─────────────────────────────────────────────────
  setSiren(on: boolean) {
    const ctx = this.ensure();
    if (on) {
      if (this.sirenOsc) return;
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 640;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1600;
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0.14;
      this.sirenOsc.connect(lp);
      lp.connect(this.sirenGain);
      this.sirenGain.connect(this.master!);
      this.sirenOsc.start();
      this.sirenHigh = false;
      this.sirenTimer = window.setInterval(() => {
        if (!this.ctx || !this.sirenOsc) return;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 660 : 505, this.ctx.currentTime, 0.06);
      }, 430);
    } else {
      if (this.sirenTimer !== null) {
        clearInterval(this.sirenTimer);
        this.sirenTimer = null;
      }
      if (this.sirenOsc && this.ctx) {
        const osc = this.sirenOsc;
        const g = this.sirenGain!;
        g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
        window.setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
            g.disconnect();
          } catch {
            /* noop */
          }
        }, 400);
      }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  // ── Автомобильный сигнал (удержание) ─────────────────────────────────────
  hornStart() {
    if (this.hornNodes) return;
    const ctx = this.ensure();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'square';
    o2.type = 'triangle';
    o1.frequency.value = 392;
    o2.frequency.value = 494;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.16, ctx.currentTime, 0.015);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(this.master!);
    o1.start();
    o2.start();
    this.hornNodes = { o1, o2, g };
  }

  hornStop() {
    if (!this.hornNodes || !this.ctx) return;
    const { o1, o2, g } = this.hornNodes;
    g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
    window.setTimeout(() => {
      try {
        o1.stop();
        o2.stop();
      } catch {
        /* noop */
      }
    }, 250);
    this.hornNodes = null;
  }

  // ── Разовый гудок другой машинки ─────────────────────────────────────────
  honk(pitch = 1) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 340 * pitch;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setTargetAtTime(0.09, t, 0.01);
    g.gain.setTargetAtTime(0.0001, t + 0.14, 0.03);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    o.connect(lp);
    lp.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + 0.35);
  }

  // ── Мультяшный «боинг» при столкновении ──────────────────────────────────
  boing(strength = 1) {
    const now = performance.now();
    if (now - this.lastBoing < 110) return;
    this.lastBoing = now;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f0 = 300 + strength * 160;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.3);
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(f0 * 2.02, t);
    o2.frequency.exponentialRampToValueAtTime(160, t + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setTargetAtTime(0.28 * Math.min(1, 0.5 + strength), t, 0.008);
    g.gain.setTargetAtTime(0.0001, t + 0.26, 0.05);
    o.connect(g);
    o2.connect(g);
    g.connect(this.master!);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.6);
    o2.stop(t + 0.6);
  }

  // ── Мягкий «тюк» о стену ─────────────────────────────────────────────────
  pop() {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.setTargetAtTime(0.0001, t + 0.03, 0.03);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + 0.2);
  }

  // ── Свист ветра, когда машинка летит ─────────────────────────────────────
  whoosh() {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.32);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master!);
    src.start(t);
  }

  // ── Звёздочка: счастливый перезвон ───────────────────────────────────────
  chime() {
    const ctx = this.ensure();
    const notes = [659, 784, 988, 1319];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.055;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setTargetAtTime(0.16, t, 0.008);
      g.gain.setTargetAtTime(0.0001, t + 0.09, 0.06);
      o.connect(g);
      g.connect(this.master!);
      o.start(t);
      o.stop(t + 0.5);
    });
  }

  // ── Фанфары за серию звёзд ───────────────────────────────────────────────
  fanfare() {
    const ctx = this.ensure();
    const seq: [number, number][] = [
      [523, 0], [659, 0.09], [784, 0.18], [1047, 0.27],
      [784, 0.4], [1047, 0.49], [1319, 0.6], [1568, 0.78],
    ];
    seq.forEach(([f, dt]) => {
      const t = ctx.currentTime + dt;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setTargetAtTime(0.1, t, 0.01);
      g.gain.setTargetAtTime(0.0001, t + 0.14, 0.08);
      o.connect(lp);
      lp.connect(g);
      g.connect(this.master!);
      o.start(t);
      o.stop(t + 0.6);
    });
  }

  // ── Кряканье утки ────────────────────────────────────────────────────────
  quack() {
    const ctx = this.ensure();
    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + i * 0.16;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(195, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setTargetAtTime(0.12, t, 0.01);
      g.gain.setTargetAtTime(0.0001, t + 0.09, 0.03);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      o.connect(lp);
      lp.connect(g);
      g.connect(this.master!);
      o.start(t);
      o.stop(t + 0.25);
    }
  }

  // ── Гав! ─────────────────────────────────────────────────────────────────
  bark() {
    const ctx = this.ensure();
    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + i * 0.15;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(430 - i * 70, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1100;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setTargetAtTime(0.13, t, 0.008);
      g.gain.setTargetAtTime(0.0001, t + 0.06, 0.025);
      o.connect(lp);
      lp.connect(g);
      g.connect(this.master!);
      o.start(t);
      o.stop(t + 0.2);
    }
  }

  // ── Шорох листвы ─────────────────────────────────────────────────────────
  rustle() {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3400;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.1;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master!);
    src.start(t);
  }

  // ── Весёлая фоновая музыка (простой секвенсор) ───────────────────────────
  setMusic(on: boolean) {
    this.musicOn = on;
    if (on) {
      this.ensure();
      if (this.musicTimer !== null) return;
      this.musicStep = 0;
      this.musicNextTime = this.ctx!.currentTime + 0.1;
      this.musicTimer = window.setInterval(() => this.musicTick(), 180);
    } else if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private musicTick() {
    if (!this.musicOn || !this.ctx) return;
    const stepDur = 0.26;
    // Весёлая мелодия в до-мажорной пентатонике, 16 восьмых
    const melody: (number | null)[] = [
      523, 659, 784, 659, 880, 784, 659, 523,
      587, 698, 880, 698, 784, 1047, 988, 784,
    ];
    const bass: (number | null)[] = [
      131, null, null, null, 175, null, null, null,
      196, null, null, null, 131, null, 165, null,
    ];
    while (this.musicNextTime < this.ctx.currentTime + 0.4) {
      const i = this.musicStep % 16;
      const t = this.musicNextTime;
      const m = melody[i];
      if (m) this.pluck(m, t, 0.075, 'triangle');
      const b = bass[i];
      if (b) this.pluck(b, t, 0.07, 'sine', 0.5);
      if (i % 4 === 2) this.shaker(t);
      this.musicStep++;
      this.musicNextTime += stepDur;
    }
  }

  private pluck(freq: number, t: number, vol: number, type: OscillatorType, dur = 0.3) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setTargetAtTime(vol, t, 0.01);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.5, dur * 0.35);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + dur * 2);
  }

  private shaker(t: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.value = 0.035;
    src.connect(hp);
    hp.connect(g);
    g.connect(this.master!);
    src.start(t);
  }
}
