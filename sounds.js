let _ac = null;

function ac() {
  if (!_ac) {
    try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  if (_ac?.state === 'suspended') _ac.resume();
  return _ac;
}

function tone(freq, dur, type = 'sine', vol = 0.22, delay = 0) {
  const ctx = ac(); if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}

function sweep(f0, f1, dur, type = 'sine', vol = 0.22, delay = 0) {
  const ctx = ac(); if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}

let _muted = localStorage.getItem('apt-snd') === '0';

function play(fn) { if (!_muted) fn(); }

export const sounds = {
  get muted() { return _muted; },

  place()       { play(() => { tone(440, 0.07, 'triangle', 0.25); tone(660, 0.1, 'triangle', 0.2, 0.06); }); },
  room()        { play(() => sweep(220, 660, 0.18, 'sine', 0.2)); },
  wall()        { play(() => { tone(900, 0.04, 'square', 0.12); tone(1100, 0.035, 'square', 0.1, 0.045); }); },
  select()      { play(() => tone(1100, 0.03, 'sine', 0.1)); },
  remove()      { play(() => sweep(500, 150, 0.14, 'sawtooth', 0.2)); },
  undo()        { play(() => { tone(550, 0.07, 'sine', 0.2); tone(380, 0.1, 'sine', 0.15, 0.07); }); },
  error()       { play(() => sweep(250, 100, 0.18, 'sawtooth', 0.25)); },
  overBudget()  { play(() => { tone(180, 0.12, 'sawtooth', 0.3); tone(120, 0.18, 'sawtooth', 0.25, 0.1); }); },

  achievement() {
    play(() => {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, 0.22, 'triangle', 0.2, i * 0.09)
      );
    });
  },

  toggleMute() {
    _muted = !_muted;
    localStorage.setItem('apt-snd', _muted ? '0' : '1');
    return _muted;
  },
};
