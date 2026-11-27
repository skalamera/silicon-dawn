const PREF_KEY = 'silicon-dawn-audio-v1';

interface AudioPrefs {
  sfx: boolean;
  music: boolean;
  voice: boolean;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicTimer: number | null = null;
  private stepIdx = 0;
  private battleIntensity = 0; // 0..1
  private lastVoiceAt = 0;
  private lastSfxAt: Record<string, number> = {};
  public prefs: AudioPrefs = { sfx: true, music: true, voice: true };

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(PREF_KEY);
        if (raw) this.prefs = { ...this.prefs, ...JSON.parse(raw) };
      } catch {
        // Ignore
      }
    }
  }

  private savePrefs(): void {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(this.prefs));
    } catch {
      // Ignore
    }
  }

  public toggleSfx(): boolean {
    this.prefs.sfx = !this.prefs.sfx;
    this.savePrefs();
    return this.prefs.sfx;
  }

  public toggleMusic(): boolean {
    this.prefs.music = !this.prefs.music;
    this.savePrefs();
    if (!this.prefs.music) this.stopMusicLoop();
    else this.startMusicLoop();
    return this.prefs.music;
  }

  public toggleVoice(): boolean {
    this.prefs.voice = !this.prefs.voice;
    this.savePrefs();
    return this.prefs.voice;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (this.prefs.music && this.musicTimer === null) {
      this.startMusicLoop();
    }
  }

  public setBattleIntensity(level: number): void {
    this.battleIntensity = Math.max(0, Math.min(1, level));
  }

  private canPlay(tag: string, minGapMs: number): boolean {
    if (!this.prefs.sfx || !this.ctx || this.ctx.state !== 'running') return false;
    const now = performance.now();
    if (now - (this.lastSfxAt[tag] ?? 0) < minGapMs) return false;
    this.lastSfxAt[tag] = now;
    return true;
  }

  public playUiClick(): void {
    if (!this.canPlay('ui', 40) || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(760, t);
    osc.frequency.exponentialRampToValueAtTime(1120, t + 0.045);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  public playLaser(): void {
    if (!this.canPlay('laser', 140) || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.14);
    gain.gain.setValueAtTime(0.045, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playHpm(): void {
    if (!this.canPlay('hpm', 220) || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.18);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  public playExplosion(heavy = false): void {
    if (!this.canPlay(heavy ? 'expH' : 'expL', heavy ? 180 : 120) || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(heavy ? 120 : 180, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + (heavy ? 0.34 : 0.18));
    gain.gain.setValueAtTime(heavy ? 0.11 : 0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.36 : 0.2));
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + (heavy ? 0.37 : 0.21));
  }

  public playAlertChime(danger = false): void {
    if (!this.canPlay('alert', 600) || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(danger ? 440 : 660, t);
    osc.frequency.setValueAtTime(danger ? 330 : 880, t + 0.09);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playRadioStatic(): void {
    if (!this.prefs.sfx || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, t);
    osc.frequency.setValueAtTime(880, t + 0.06);
    gain.gain.setValueAtTime(0.055, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public speakCommander(text: string, faction: 'alliance' | 'pact' | 'axis'): void {
    if (!this.prefs.voice || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = faction === 'pact' ? 0.96 : faction === 'axis' ? 1.04 : 1.0;
      utter.pitch = faction === 'pact' ? 0.72 : faction === 'axis' ? 0.88 : 0.82;
      utter.volume = 0.8;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore speech synthesis errors
    }
  }

  public speakEva(text: string): void {
    if (!this.prefs.voice || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const now = performance.now();
    if (now - this.lastVoiceAt < 3800) return;
    this.lastVoiceAt = now;
    try {
      const clean = text.replace(/\([^)]*\)/g, '').replace(/[!]/g, '.');
      const utter = new SpeechSynthesisUtterance(clean);
      utter.rate = 1.06;
      utter.pitch = 0.85;
      utter.volume = 0.72;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore speech synthesis errors
    }
  }

  private startMusicLoop(): void {
    if (this.musicTimer !== null || typeof window === 'undefined') return;
    // 116 BPM sixteenth-note pulse (~258ms per 8th note)
    const bassNotes = [55, 55, 65.41, 55, 73.42, 55, 82.41, 73.42]; // A1 industrial progression
    this.musicTimer = window.setInterval(() => {
      if (!this.prefs.music || !this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const freq = bassNotes[this.stepIdx % bassNotes.length];
      this.stepIdx += 1;

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240 + this.battleIntensity * 420, t);

      gain.gain.setValueAtTime(0.028 + this.battleIntensity * 0.02, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(filter).connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.23);

      // Combat percussion pulse when battleIntensity > 0.3
      if (this.battleIntensity > 0.3 && this.stepIdx % 2 === 0) {
        const kick = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(110, t);
        kick.frequency.exponentialRampToValueAtTime(36, t + 0.09);
        kGain.gain.setValueAtTime(0.05 * this.battleIntensity, t);
        kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        kick.connect(kGain).connect(this.ctx.destination);
        kick.start(t);
        kick.stop(t + 0.11);
      }
    }, 258);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();
