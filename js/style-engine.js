/*
 * MixMate Style Engine
 * Macht aus 1 Song einen Remix in einem gewählten Stil:
 *  - Tempo-Anpassung an das Stil-Tempo (Beat-Grid folgt dem Song)
 *  - Synthetisierte Drums (Kick/Snare/Clap/Hats/Perc) nach Stil-Pattern
 *  - Bassline (Offbeat-House, 808, Reggae, HipHop) in der erkannten Tonart
 *  - Optionale Instrumente: Piano, Gitarre (Karplus-Strong), Pad, Steel Drum
 *  - Sidechain-Ducking, EQ-Anpassung des Originals, Offline-Rendering
 */
(function (global) {
  'use strict';

  // 16 Steps pro Takt (16tel). Werte = Velocity 0..1.
  var X = 1, h = 0.55, q = 0.3, o = 0;

  var STYLES = [
    // ---------------- House ----------------
    {
      id: 'house-classic', group: 'House', label: 'Classic House', bpm: 124,
      swing: 0, duck: 0.45, songHP: 100,
      drums: {
        kick: [X,o,o,o, X,o,o,o, X,o,o,o, X,o,o,o],
        clap: [o,o,o,o, X,o,o,o, o,o,o,o, X,o,o,o],
        chat: [o,o,h,o, o,o,h,o, o,o,h,o, o,o,h,o],
        ohat: [o,o,X,o, o,o,X,o, o,o,X,o, o,o,X,o],
        perc: []
      },
      bass: { type: 'pluck', pattern: [o,o,X,o, o,o,X,o, o,o,X,o, o,o,X,o], octave: 2 },
      instFeel: 'house'
    },
    {
      id: 'house-deep', group: 'House', label: 'Deep House', bpm: 121,
      swing: 0.08, duck: 0.5, songHP: 110,
      drums: {
        kick: [X,o,o,o, X,o,o,o, X,o,o,o, X,o,o,o],
        clap: [o,o,o,o, h,o,o,o, o,o,o,o, h,o,o,o],
        chat: [q,o,h,q, q,o,h,q, q,o,h,q, q,o,h,q],
        ohat: [o,o,h,o, o,o,h,o, o,o,h,o, o,o,h,o],
        perc: [o,o,o,q, o,o,q,o, o,q,o,o, o,o,q,o]
      },
      bass: { type: 'pluck', pattern: [X,o,h,o, o,h,X,o, X,o,h,o, o,h,X,o], octave: 2 },
      instFeel: 'house'
    },
    {
      id: 'house-beach', group: 'House', label: 'Beach House', bpm: 116,
      swing: 0.05, duck: 0.35, songHP: 90,
      drums: {
        kick: [X,o,o,o, X,o,o,o, X,o,o,o, X,o,o,o],
        clap: [o,o,o,o, h,o,o,o, o,o,o,o, h,o,q,o],
        chat: [o,o,h,o, o,o,h,o, o,o,h,o, o,o,h,o],
        ohat: [o,o,o,o, o,o,h,o, o,o,o,o, o,o,h,o],
        perc: [o,q,o,o, o,o,o,q, o,q,o,o, o,o,q,o]
      },
      bass: { type: 'pluck', pattern: [X,o,o,h, o,o,X,o, X,o,o,h, o,o,X,o], octave: 2 },
      instFeel: 'tropical'
    },
    {
      id: 'house-tropical', group: 'House', label: 'Tropical House', bpm: 112,
      swing: 0.05, duck: 0.3, songHP: 90,
      drums: {
        kick: [X,o,o,o, X,o,o,o, X,o,o,o, X,o,o,o],
        clap: [o,o,o,o, h,o,o,o, o,o,o,o, h,o,o,o],
        chat: [o,o,q,o, o,o,q,o, o,o,q,o, o,o,q,o],
        ohat: [],
        perc: [o,h,o,q, o,q,h,o, o,h,o,q, o,q,o,h]
      },
      bass: { type: 'pluck', pattern: [X,o,o,o, o,o,X,o, o,o,X,o, o,o,h,o], octave: 2 },
      instFeel: 'tropical'
    },
    {
      id: 'house-vocal', group: 'House', label: 'Vocal House', bpm: 126,
      swing: 0, duck: 0.4, songHP: 80,
      drums: {
        kick: [X,o,o,o, X,o,o,o, X,o,o,o, X,o,o,o],
        clap: [o,o,o,o, X,o,o,o, o,o,o,o, X,o,o,h],
        chat: [o,o,h,o, o,o,h,o, o,o,h,o, o,o,h,o],
        ohat: [o,o,X,o, o,o,X,o, o,o,X,o, o,o,X,o],
        perc: []
      },
      bass: { type: 'pluck', pattern: [o,o,X,o, o,o,X,o, o,o,X,o, o,o,X,o], octave: 2 },
      instFeel: 'house'
    },
    // ---------------- Reggae ----------------
    {
      id: 'reggae', group: 'Reggae', label: 'Roots Reggae', bpm: 76,
      swing: 0.12, duck: 0, songHP: 70,
      drums: {
        kick: [o,o,o,o, o,o,o,o, X,o,o,o, o,o,o,o],
        clap: [],
        rim:  [o,o,o,o, o,o,o,o, X,o,o,o, o,o,o,o],
        chat: [h,o,q,o, h,o,q,o, h,o,q,o, h,o,q,o],
        ohat: [o,o,o,o, o,o,o,o, o,o,o,o, o,o,h,o],
        perc: []
      },
      bass: { type: 'reggae', pattern: [X,o,o,h, o,o,o,o, X,o,o,X, o,o,h,o], octave: 1 },
      instFeel: 'reggae'
    },
    // ---------------- HipHop ----------------
    {
      id: 'hiphop-boombap', group: 'HipHop', label: 'Boom Bap', bpm: 92,
      swing: 0.16, duck: 0.2, songHP: 90,
      drums: {
        kick: [X,o,o,o, o,o,o,h, o,o,X,o, o,o,o,o],
        snare:[o,o,o,o, X,o,o,o, o,o,o,o, X,o,o,o],
        chat: [h,o,h,o, h,o,h,o, h,o,h,o, h,o,h,o],
        ohat: [],
        perc: []
      },
      bass: { type: 'sub', pattern: [X,o,o,o, o,o,o,h, o,o,X,o, o,o,o,o], octave: 1 },
      instFeel: 'hiphop'
    },
    {
      id: 'hiphop-oldschool', group: 'HipHop', label: 'Old School', bpm: 102,
      swing: 0.1, duck: 0.2, songHP: 90,
      drums: {
        kick: [X,o,o,o, o,o,h,o, X,o,X,o, o,o,o,o],
        clap: [o,o,o,o, X,o,o,o, o,o,o,o, X,o,o,o],
        chat: [h,q,h,q, h,q,h,q, h,q,h,q, h,q,h,q],
        ohat: [o,o,o,o, o,o,o,o, o,o,o,o, o,o,X,o],
        perc: []
      },
      bass: { type: 'sub', pattern: [X,o,o,o, o,o,h,o, X,o,X,o, o,o,o,o], octave: 1 },
      instFeel: 'hiphop'
    },
    {
      id: 'hiphop-lofi', group: 'HipHop', label: 'Lo-Fi', bpm: 82,
      swing: 0.2, duck: 0.15, songHP: 60, songLP: 5200,
      drums: {
        kick: [X,o,o,o, o,o,o,o, o,o,X,o, o,h,o,o],
        snare:[o,o,o,o, h,o,o,o, o,o,o,o, h,o,o,o],
        chat: [q,o,q,o, q,o,q,o, q,o,q,o, q,o,q,o],
        ohat: [],
        perc: []
      },
      bass: { type: 'sub', pattern: [X,o,o,o, o,o,o,o, o,o,X,o, o,o,o,o], octave: 1 },
      instFeel: 'lofi'
    },
    // ---------------- Trap ----------------
    {
      id: 'trap', group: 'Trap', label: 'Trap', bpm: 140,
      swing: 0, duck: 0.25, songHP: 110,
      drums: {
        kick: [X,o,o,o, o,o,X,o, o,o,h,o, o,o,o,o],
        snare:[o,o,o,o, o,o,o,o, X,o,o,o, o,o,o,o],
        chat: [h,h,h,h, h,h,q,q, h,h,h,h, h,q,q,q],
        ohat: [o,o,o,o, o,o,o,o, o,o,o,o, o,o,X,o],
        perc: []
      },
      bass: { type: '808', pattern: [X,o,o,o, o,o,X,o, o,o,o,o, o,o,o,o], octave: 1 },
      instFeel: 'trap'
    },
    // ---------------- Dance / EDM ----------------
    {
      id: 'dance', group: 'Dance', label: 'Dance', bpm: 128,
      swing: 0, duck: 0.5, songHP: 100,
      drums: {
        kick: [X,o,o,o, X,o,o,o, X,o,o,o, X,o,o,o],
        clap: [o,o,o,o, X,o,o,o, o,o,o,o, X,o,o,o],
        chat: [o,o,h,o, o,o,h,o, o,o,h,o, o,o,h,o],
        ohat: [o,o,X,o, o,o,X,o, o,o,X,o, o,o,X,o],
        perc: []
      },
      bass: { type: 'pluck', pattern: [o,o,X,o, o,o,X,o, o,o,X,o, o,o,X,o], octave: 2 },
      instFeel: 'house'
    },
    {
      id: 'edm', group: 'EDM', label: 'Big Room EDM', bpm: 128,
      swing: 0, duck: 0.6, songHP: 110,
      drums: {
        kick: [X,o,o,o, X,o,o,o, X,o,o,o, X,o,o,o],
        clap: [o,o,o,o, X,o,o,o, o,o,o,o, X,o,o,o],
        chat: [o,h,o,h, o,h,o,h, o,h,o,h, o,h,o,h],
        ohat: [o,o,X,o, o,o,X,o, o,o,X,o, o,o,X,o],
        perc: []
      },
      bass: { type: 'saw', pattern: [o,o,X,o, o,o,X,o, o,o,X,o, o,o,X,o], octave: 2 },
      instFeel: 'house'
    }
  ];

  // ------------------------------------------------------------ Musik-Theorie

  function noteFreq(pc, octave) {
    var midi = 12 * (octave + 1) + pc;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // 4-Takt-Progression aus erkannter Tonart
  function chordProgression(rootPc, mode) {
    if (mode === 'minor') {
      // i – VI – III – VII
      return [
        { root: rootPc, type: 'min' },
        { root: (rootPc + 8) % 12, type: 'maj' },
        { root: (rootPc + 3) % 12, type: 'maj' },
        { root: (rootPc + 10) % 12, type: 'maj' }
      ];
    }
    // I – V – vi – IV
    return [
      { root: rootPc, type: 'maj' },
      { root: (rootPc + 7) % 12, type: 'maj' },
      { root: (rootPc + 9) % 12, type: 'min' },
      { root: (rootPc + 5) % 12, type: 'maj' }
    ];
  }

  function chordNotes(chord, octave) {
    var third = chord.type === 'min' ? 3 : 4;
    return [
      noteFreq(chord.root % 12, octave + (chord.root > 11 ? 1 : 0)),
      noteFreq((chord.root + third) % 12, octave + ((chord.root + third) >= 12 ? 1 : 0)),
      noteFreq((chord.root + 7) % 12, octave + ((chord.root + 7) >= 12 ? 1 : 0))
    ];
  }

  // ------------------------------------------------------------ Drum-Synths

  function synthKick(ctx, dest, t, vel, punchy) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(punchy ? 170 : 140, t);
    osc.frequency.exponentialRampToValueAtTime(punchy ? 48 : 42, t + 0.09);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (punchy ? 0.3 : 0.24));
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + 0.32);
  }

  function synthSnare(ctx, dest, t, vel, noiseBuf) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.8, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(bp); bp.connect(ng); ng.connect(dest); n.start(t);
    var osc = ctx.createOscillator(); osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t);
    var og = ctx.createGain();
    og.gain.setValueAtTime(vel * 0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og); og.connect(dest); osc.start(t); osc.stop(t + 0.12);
  }

  function synthClap(ctx, dest, t, vel, noiseBuf) {
    for (var i = 0; i < 3; i++) {
      var tt = t + i * 0.012;
      var n = ctx.createBufferSource(); n.buffer = noiseBuf;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vel * (i === 2 ? 0.8 : 0.4), tt);
      g.gain.exponentialRampToValueAtTime(0.001, tt + (i === 2 ? 0.22 : 0.04));
      n.connect(bp); bp.connect(g); g.connect(dest); n.start(tt);
    }
  }

  function synthHat(ctx, dest, t, vel, open, noiseBuf) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuf;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.28 : 0.045));
    n.connect(hp); hp.connect(g); g.connect(dest); n.start(t);
  }

  function synthPerc(ctx, dest, t, vel, noiseBuf) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuf; n.playbackRate.value = 0.5;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3600; bp.Q.value = 2;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    n.connect(bp); bp.connect(g); g.connect(dest); n.start(t);
  }

  function synthRim(ctx, dest, t, vel) {
    var osc = ctx.createOscillator(); osc.type = 'square';
    osc.frequency.setValueAtTime(820, t);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t + 0.06);
  }

  // ------------------------------------------------------------ Bass-Synths

  function synthBass(ctx, dest, t, freq, dur, vel, type) {
    if (type === '808') {
      var o8 = ctx.createOscillator(); o8.type = 'sine';
      o8.frequency.setValueAtTime(freq * 2, t);
      o8.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
      var g8 = ctx.createGain();
      g8.gain.setValueAtTime(vel, t);
      g8.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.5, dur));
      o8.connect(g8); g8.connect(dest);
      o8.start(t); o8.stop(t + Math.max(0.5, dur) + 0.05);
      return;
    }
    var osc = ctx.createOscillator();
    osc.type = type === 'saw' ? 'sawtooth' : (type === 'reggae' || type === 'sub') ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(type === 'saw' ? 900 : 500, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(lp); lp.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ Instrumente

  function synthPiano(ctx, dest, t, freq, dur, vel) {
    var ratios = [1, 2, 3];
    var gains = [1, 0.35, 0.12];
    for (var i = 0; i < ratios.length; i++) {
      var osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * ratios[i], t);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * gains[i], t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + dur + 0.05);
    }
  }

  // Karplus-Strong: gezupfte Saite
  function karplusBuffer(ctx, freq, cache) {
    var key = Math.round(freq * 10);
    if (cache[key]) return cache[key];
    var sr = ctx.sampleRate;
    var len = Math.floor(sr * 1.0);
    var buf = ctx.createBuffer(1, len, sr);
    var data = buf.getChannelData(0);
    var period = Math.max(2, Math.round(sr / freq));
    var seed = 987654 + key;
    for (var i = 0; i < period; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = seed / 0x3fffffff - 1;
    }
    for (var j = period; j < len; j++) {
      data[j] = 0.996 * 0.5 * (data[j - period] + data[j - period + 1]);
    }
    cache[key] = buf;
    return buf;
  }

  function synthGuitar(ctx, dest, t, freqs, vel, cache) {
    for (var i = 0; i < freqs.length; i++) {
      var src = ctx.createBufferSource();
      src.buffer = karplusBuffer(ctx, freqs[i], cache);
      var g = ctx.createGain();
      g.gain.setValueAtTime(vel * 0.7, t + i * 0.012);
      src.connect(g); g.connect(dest);
      src.start(t + i * 0.012);
    }
  }

  function synthPad(ctx, dest, t, freqs, dur, vel) {
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vel * 0.25, t + dur * 0.3);
    env.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(env); env.connect(dest);
    for (var i = 0; i < freqs.length; i++) {
      for (var d = -1; d <= 1; d += 2) {
        var osc = ctx.createOscillator(); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freqs[i] * (1 + d * 0.004), t);
        var g = ctx.createGain(); g.gain.value = 0.5;
        osc.connect(g); g.connect(lp);
        osc.start(t); osc.stop(t + dur + 0.05);
      }
    }
  }

  function synthSteel(ctx, dest, t, freq, vel) {
    var ratios = [1, 2.02, 3.4];
    var gains = [1, 0.5, 0.2];
    for (var i = 0; i < ratios.length; i++) {
      var osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * ratios[i] * 1.01, t);
      osc.frequency.exponentialRampToValueAtTime(freq * ratios[i], t + 0.04);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * gains[i] * 0.6, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.55);
    }
  }

  // ------------------------------------------------------------ Render

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function getStyle(id) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i];
    return STYLES[0];
  }

  /**
   * track: { buffer, analysis } — opts: { styleId, beatLevel, instLevel,
   *   instruments: {piano, guitar, pad, steel}, keepTempo }
   */
  async function renderStyleRemix(track, opts, onStatus) {
    var style = getStyle(opts.styleId);
    var sr = 44100;
    var songBpm = track.analysis.bpm || 120;

    var target = opts.keepTempo ? songBpm : style.bpm;
    var folded = songBpm;
    while (folded < target / 1.45) folded *= 2;
    while (folded > target * 1.45) folded /= 2;
    var rate = clamp(target / folded, 0.82, 1.2);
    var effBpm = folded * rate;          // tatsächliches Ausgabe-Tempo
    var beat = 60 / effBpm;
    var step16 = beat / 4;

    var duration = track.buffer.duration / rate + 1.2;
    duration = Math.min(duration, 60 * 15);

    if (onStatus) onStatus('Remix wird gerendert …');

    var off = new (global.OfflineAudioContext || global.webkitOfflineAudioContext)(
      2, Math.ceil(duration * sr), sr
    );

    // Master
    var comp = off.createDynamicsCompressor();
    comp.threshold.value = -9; comp.knee.value = 6; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    var master = off.createGain(); master.gain.value = 0.85;
    comp.connect(master); master.connect(off.destination);

    // Original-Song: Tempo + EQ + Ducking
    var src = off.createBufferSource();
    src.buffer = track.buffer;
    src.playbackRate.value = rate;
    var chain = src;
    if (style.songHP) {
      var hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = style.songHP;
      chain.connect(hp); chain = hp;
    }
    if (style.songLP) {
      var lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = style.songLP;
      chain.connect(lp); chain = lp;
    }
    var duckGain = off.createGain();
    var songGain = off.createGain();
    var targetRms = 0.16;
    songGain.gain.value = clamp(targetRms / Math.max(0.001, track.analysis.rms), 0.5, 2.5);
    chain.connect(duckGain); duckGain.connect(songGain); songGain.connect(comp);
    src.start(0);

    // Beat-Grid am Song ausrichten
    var anchorOut = (track.analysis.anchor || 0) / rate;
    var gridStart = anchorOut - Math.floor(anchorOut / (beat * 4)) * (beat * 4);
    while (gridStart > beat) gridStart -= beat;
    if (gridStart < 0) gridStart = 0;

    // Busse
    var drumBus = off.createGain();
    drumBus.gain.setValueAtTime(0.0001, gridStart);
    drumBus.gain.exponentialRampToValueAtTime(clamp(opts.beatLevel, 0.05, 1) * 0.95, gridStart + beat * 4);
    drumBus.connect(comp);
    var bassBus = off.createGain();
    bassBus.gain.value = clamp(opts.beatLevel, 0.05, 1) * 0.85;
    bassBus.connect(comp);
    var instBus = off.createGain();
    instBus.gain.value = clamp(opts.instLevel, 0, 1) * 0.8;
    var instDuck = off.createGain();
    instBus.connect(instDuck); instDuck.connect(comp);

    // Noise-Buffer (deterministisch)
    var noiseLen = Math.floor(sr * 0.3);
    var noiseBuf = off.createBuffer(1, noiseLen, sr);
    var nd = noiseBuf.getChannelData(0);
    var seed = 424242;
    for (var n = 0; n < noiseLen; n++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      nd[n] = seed / 0x3fffffff - 1;
    }

    // Tonart → Progression
    var key = track.analysis.key || {};
    var rootPc = typeof key.root === 'number' ? key.root : 9;
    var mode = key.mode === 'major' ? 'major' : 'minor';
    var prog = chordProgression(rootPc, mode);

    var karplusCache = {};
    var end = duration - 1.0;
    var barLen = beat * 4;
    var totalBars = Math.floor((end - gridStart) / barLen);
    totalBars = Math.min(totalBars, 400);

    var d = style.drums;
    var kickTimes = [];

    for (var bar = 0; bar < totalBars; bar++) {
      var barT = gridStart + bar * barLen;
      var chord = prog[bar % 4];

      for (var s = 0; s < 16; s++) {
        var swingOff = (s % 2 === 1) ? style.swing * step16 : 0;
        var t = barT + s * step16 + swingOff;
        if (t >= end) break;

        if (d.kick && d.kick[s]) { synthKick(off, drumBus, t, d.kick[s], style.duck > 0.35); kickTimes.push(t); }
        if (d.snare && d.snare[s]) synthSnare(off, drumBus, t, d.snare[s], noiseBuf);
        if (d.clap && d.clap[s]) synthClap(off, drumBus, t, d.clap[s], noiseBuf);
        if (d.chat && d.chat[s]) synthHat(off, drumBus, t, d.chat[s], false, noiseBuf);
        if (d.ohat && d.ohat[s]) synthHat(off, drumBus, t, d.ohat[s], true, noiseBuf);
        if (d.perc && d.perc[s]) synthPerc(off, drumBus, t, d.perc[s], noiseBuf);
        if (d.rim && d.rim[s]) synthRim(off, drumBus, t, d.rim[s]);

        // Bass
        var bp = style.bass;
        if (bp.pattern[s]) {
          var bassRoot = (s % 8 === 6 && bp.type !== '808')
            ? noteFreq((chord.root + 7) % 12, bp.octave)
            : noteFreq(chord.root, bp.octave);
          var bDur = bp.type === '808' ? beat * 1.5 : step16 * 1.8;
          synthBass(off, bassBus, t, bassRoot, bDur, bp.pattern[s] * 0.9, bp.type);
        }
      }

      // ---- Instrumente (folgen Tonart + Stil-Feel)
      scheduleInstruments(off, instBus, style.instFeel, opts.instruments, {
        barT: barT, step16: step16, beat: beat, barLen: barLen,
        chord: chord, bar: bar, end: end,
        noiseBuf: noiseBuf, karplusCache: karplusCache
      });
    }

    // Sidechain-Ducking auf Song + Instrumente
    var duck = style.duck;
    duckGain.gain.value = 1;
    instDuck.gain.value = 1;
    if (duck > 0) {
      var rel = Math.min(beat * 0.65, 0.4);
      var maxDucks = 2400;
      for (var ki = 0; ki < Math.min(kickTimes.length, maxDucks); ki++) {
        var kt = kickTimes[ki];
        duckGain.gain.setValueAtTime(1, Math.max(0, kt - 0.004));
        duckGain.gain.linearRampToValueAtTime(1 - duck, kt + 0.03);
        duckGain.gain.linearRampToValueAtTime(1, kt + rel);
        instDuck.gain.setValueAtTime(1, Math.max(0, kt - 0.004));
        instDuck.gain.linearRampToValueAtTime(1 - duck * 0.7, kt + 0.03);
        instDuck.gain.linearRampToValueAtTime(1, kt + rel);
      }
    }

    var rendered = await off.startRendering();
    return {
      buffer: rendered,
      meta: {
        style: style.group + ' – ' + style.label,
        targetBpm: Math.round(effBpm * 10) / 10,
        rate: rate,
        keyName: key.name || null,
        totalDuration: rendered.duration
      }
    };
  }

  function scheduleInstruments(ctx, dest, feel, active, p) {
    if (!active) return;
    var triad = chordNotes(p.chord, 4);
    var t;

    if (active.piano) {
      if (feel === 'house') {
        // Offbeat-Stabs
        [2, 6, 10, 14].forEach(function (s) {
          t = p.barT + s * p.step16;
          if (t < p.end) triad.forEach(function (f) { synthPiano(ctx, dest, t, f, 0.22, 0.3); });
        });
      } else if (feel === 'hiphop' || feel === 'lofi' || feel === 'trap') {
        t = p.barT;
        if (t < p.end) triad.forEach(function (f) { synthPiano(ctx, dest, t, f, p.barLen * 0.85, 0.22); });
      } else if (feel === 'reggae') {
        [2, 6, 10, 14].forEach(function (s) {
          t = p.barT + s * p.step16;
          if (t < p.end) triad.forEach(function (f) { synthPiano(ctx, dest, t, f, 0.15, 0.25); });
        });
      } else { // tropical
        [0, 4, 8, 12].forEach(function (s, i) {
          t = p.barT + s * p.step16;
          if (t < p.end) synthPiano(ctx, dest, t, triad[i % 3], 0.4, 0.3);
        });
      }
    }

    if (active.guitar) {
      if (feel === 'reggae') {
        // Skank auf den Offbeats
        [2, 6, 10, 14].forEach(function (s) {
          t = p.barT + s * p.step16;
          if (t < p.end) synthGuitar(ctx, dest, t, triad, 0.4, p.karplusCache);
        });
      } else if (feel === 'tropical') {
        [0, 2, 4, 6, 8, 10, 12, 14].forEach(function (s, i) {
          t = p.barT + s * p.step16;
          if (t < p.end) synthGuitar(ctx, dest, t, [triad[i % 3]], 0.3, p.karplusCache);
        });
      } else if (feel === 'hiphop' || feel === 'lofi') {
        [0, 7].forEach(function (s) {
          t = p.barT + s * p.step16;
          if (t < p.end) synthGuitar(ctx, dest, t, [triad[0], triad[2]], 0.28, p.karplusCache);
        });
      } else {
        [3, 11].forEach(function (s) {
          t = p.barT + s * p.step16;
          if (t < p.end) synthGuitar(ctx, dest, t, [triad[0]], 0.25, p.karplusCache);
        });
      }
    }

    if (active.pad) {
      t = p.barT;
      if (t < p.end) synthPad(ctx, dest, t, triad, p.barLen, 0.35);
    }

    if (active.steel) {
      var seq = [0, 2, 1, 2, 0, 1, 2, 1];
      [0, 2, 4, 6, 8, 10, 12, 14].forEach(function (s, i) {
        t = p.barT + s * p.step16;
        if (t < p.end && (feel === 'tropical' || i % 2 === 0)) {
          synthSteel(ctx, dest, t, chordNotes(p.chord, 5)[seq[i] % 3], 0.3);
        }
      });
    }
  }

  global.StyleEngine = {
    STYLES: STYLES,
    renderStyleRemix: renderStyleRemix
  };
})(window);
