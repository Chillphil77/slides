/*
 * MixMate Style Engine v2
 * Macht aus 1 Song einen Remix in einem gewählten Stil — mit echtem
 * Arrangement statt statischem Loop:
 *  - Pitch-neutraler Time-Stretch (WSOLA) statt Chipmunk-Effekt
 *  - Auto-Tempo: Stil hat einen BPM-Bereich, gewählt wird das Tempo mit
 *    dem geringsten Stretch
 *  - Arrangement: Intro → Build → Drop → Breakdown → Drop 2 → Outro,
 *    Breakdown an der leisesten Stelle des Songs
 *  - Fills alle 4 Takte, Snare-Rolls, Riser, Crashes, Pattern-Variation,
 *    humanisierte Velocities/Timing
 *  - Filter-Automation auf dem Original (Spannungsauf- und -abbau)
 *  - Bass + Instrumente folgen der erkannten Tonart
 */
(function (global) {
  'use strict';

  var X = 1, h = 0.55, q = 0.3, o = 0;

  var STYLES = [
    {
      id: 'house-classic', group: 'House', label: 'Classic House', bpm: 124, bpmRange: [119, 127],
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
      id: 'house-deep', group: 'House', label: 'Deep House', bpm: 121, bpmRange: [116, 124],
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
      id: 'house-beach', group: 'House', label: 'Beach House', bpm: 116, bpmRange: [110, 121],
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
      id: 'house-tropical', group: 'House', label: 'Tropical House', bpm: 112, bpmRange: [105, 118],
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
      id: 'house-vocal', group: 'House', label: 'Vocal House', bpm: 126, bpmRange: [121, 128],
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
    {
      id: 'reggae', group: 'Reggae', label: 'Roots Reggae', bpm: 76, bpmRange: [70, 84],
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
    {
      id: 'hiphop-boombap', group: 'HipHop', label: 'Boom Bap', bpm: 92, bpmRange: [86, 98],
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
      id: 'hiphop-oldschool', group: 'HipHop', label: 'Old School', bpm: 102, bpmRange: [95, 108],
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
      id: 'hiphop-lofi', group: 'HipHop', label: 'Lo-Fi', bpm: 82, bpmRange: [74, 90],
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
    {
      id: 'trap', group: 'Trap', label: 'Trap', bpm: 140, bpmRange: [130, 150],
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
    {
      id: 'dance', group: 'Dance', label: 'Dance', bpm: 128, bpmRange: [122, 132],
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
      id: 'edm', group: 'EDM', label: 'Big Room EDM', bpm: 128, bpmRange: [124, 132],
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

  function chordProgression(rootPc, mode) {
    if (mode === 'minor') {
      return [
        { root: rootPc, type: 'min' },
        { root: (rootPc + 8) % 12, type: 'maj' },
        { root: (rootPc + 3) % 12, type: 'maj' },
        { root: (rootPc + 10) % 12, type: 'maj' }
      ];
    }
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
      noteFreq(chord.root % 12, octave),
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

  // ------------------------------------------------------------ FX-Synths

  function synthRiser(ctx, dest, tStart, dur, noiseBuf) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.Q.value = 1.5;
    hp.frequency.setValueAtTime(400, tStart);
    hp.frequency.exponentialRampToValueAtTime(6500, tStart + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, tStart);
    g.gain.exponentialRampToValueAtTime(0.22, tStart + dur);
    g.gain.linearRampToValueAtTime(0.0001, tStart + dur + 0.05);
    n.connect(hp); hp.connect(g); g.connect(dest);
    n.start(tStart); n.stop(tStart + dur + 0.1);
  }

  function synthCrash(ctx, dest, t, noiseBuf) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    n.connect(hp); hp.connect(g); g.connect(dest);
    n.start(t); n.stop(t + 1.4);
  }

  function synthImpact(ctx, dest, t) {
    var osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.35);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + 0.55);
  }

  // Snare-/Clap-Roll über die letzte Takthälfte
  function synthRoll(ctx, dest, tBarStart, barLen, noiseBuf, useClap) {
    var steps = 8;
    var stepDur = (barLen / 2) / steps;
    for (var i = 0; i < steps; i++) {
      var t = tBarStart + barLen / 2 + i * stepDur;
      var vel = 0.25 + 0.65 * (i / (steps - 1));
      if (useClap) synthClap(ctx, dest, t, vel, noiseBuf);
      else synthSnare(ctx, dest, t, vel, noiseBuf);
    }
  }

  // ------------------------------------------------------------ Bass & Instrumente

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

  // ------------------------------------------------------------ Arrangement

  function computeBarEnergy(buffer, gridStart, barLen, totalBars) {
    var mono = buffer.getChannelData(0);
    var sr = buffer.sampleRate;
    var out = new Float32Array(totalBars);
    for (var b = 0; b < totalBars; b++) {
      var s = Math.floor((gridStart + b * barLen) * sr);
      var e = Math.min(mono.length, Math.floor((gridStart + (b + 1) * barLen) * sr));
      var sum = 0, n = 0;
      for (var i = s; i < e; i += 8) { sum += mono[i] * mono[i]; n++; }
      out[b] = n ? Math.sqrt(sum / n) : 0;
    }
    return out;
  }

  /*
   * Abschnitts-Plan:
   *  intro(4) → build(4) → drop … breakdown(8, an der leisesten Stelle)
   *  … drop2 … outro(4). Kurze Songs bekommen eine kompakte Version.
   */
  function buildArrangement(totalBars, energy) {
    var plan = [];
    function add(type, start, len) {
      if (len > 0) plan.push({ type: type, start: start, end: start + len - 1 });
    }
    if (totalBars < 16) {
      add('build', 0, Math.min(2, totalBars));
      add('drop', 2, Math.max(0, totalBars - 4));
      add('outro', Math.max(2, totalBars - 2), Math.min(2, totalBars - 2));
      return plan;
    }
    add('intro', 0, 4);
    add('build', 4, 4);

    var bdStart = -1;
    if (totalBars >= 34) {
      // leisestes 8-Takt-Fenster in der Songmitte suchen
      var best = Infinity;
      var lo = 14, hi = totalBars - 16;
      for (var s = lo; s <= hi; s++) {
        var sum = 0;
        for (var k = 0; k < 8; k++) sum += energy[s + k] || 0;
        if (sum < best) { best = sum; bdStart = s; }
      }
      // auf 4-Takt-Raster relativ zum Drop-Beginn snappen
      if (bdStart > 0) bdStart = 8 + Math.round((bdStart - 8) / 4) * 4;
    }

    var outroStart = totalBars - 4;
    if (bdStart > 10 && bdStart + 10 < outroStart) {
      add('drop', 8, bdStart - 8);
      add('breakdown', bdStart, 8);
      add('drop', bdStart + 8, outroStart - (bdStart + 8));
    } else {
      add('drop', 8, outroStart - 8);
    }
    add('outro', outroStart, 4);
    return plan;
  }

  function sectionAt(plan, bar) {
    for (var i = 0; i < plan.length; i++) {
      if (bar >= plan[i].start && bar <= plan[i].end) return plan[i];
    }
    return { type: 'drop', start: 0, end: 9999 };
  }

  // ------------------------------------------------------------ Render

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function getStyle(id) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i];
    return STYLES[0];
  }

  async function renderStyleRemix(track, opts, onStatus) {
    var style = getStyle(opts.styleId);
    var sr = 44100;
    var songBpm = track.analysis.bpm || 120;

    // Auto-Tempo: BPM in den Stil-Bereich falten, minimalen Stretch wählen
    var range = style.bpmRange || [style.bpm - 5, style.bpm + 5];
    var center = (range[0] + range[1]) / 2;
    var folded = songBpm;
    while (folded < center / 1.5) folded *= 2;
    while (folded > center * 1.5) folded /= 2;
    var target = opts.keepTempo ? folded : clamp(folded, range[0], range[1]);
    var factor = clamp(target / folded, 0.85, 1.18);
    target = folded * factor;

    // Pitch-neutraler Time-Stretch (WSOLA) statt playbackRate
    var buffer = track.buffer;
    if (Math.abs(factor - 1) >= 0.02 && global.TimeStretch) {
      if (onStatus) onStatus('Tempo wird angepasst (ohne Pitch-Änderung) …');
      buffer = await global.TimeStretch.stretchBuffer(
        AudioEngine.getCtx(), track.buffer, factor,
        function (p) {
          if (onStatus) onStatus('Tempo wird angepasst … ' + Math.round(p * 100) + ' %');
        }
      );
    }

    var beat = 60 / target;
    var step16 = beat / 4;
    var barLen = beat * 4;

    var duration = buffer.duration + 1.2;
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

    // Original-Song mit automatisierbaren Filtern
    var src = off.createBufferSource();
    src.buffer = buffer;
    var hpAuto = off.createBiquadFilter(); hpAuto.type = 'highpass';
    hpAuto.frequency.value = style.songHP || 30;
    var lpAuto = off.createBiquadFilter(); lpAuto.type = 'lowpass';
    lpAuto.frequency.value = style.songLP || 18000;
    var duckGain = off.createGain();
    var songGain = off.createGain();
    songGain.gain.value = clamp(0.16 / Math.max(0.001, track.analysis.rms), 0.5, 2.5);
    src.connect(hpAuto); hpAuto.connect(lpAuto); lpAuto.connect(duckGain);
    duckGain.connect(songGain); songGain.connect(comp);
    src.start(0);

    // Beat-Grid am (gestreckten) Song ausrichten
    var anchorOut = (track.analysis.anchor || 0) / factor;
    var gridStart = anchorOut - Math.floor(anchorOut / barLen) * barLen;
    while (gridStart > beat) gridStart -= beat;
    if (gridStart < 0) gridStart = 0;

    // Busse
    var beatLvl = clamp(opts.beatLevel, 0.05, 1);
    var drumBus = off.createGain(); drumBus.gain.value = beatLvl * 0.95;
    drumBus.connect(comp);
    var fxBus = off.createGain(); fxBus.gain.value = beatLvl * 0.9;
    fxBus.connect(comp);
    var bassBus = off.createGain(); bassBus.gain.value = beatLvl * 0.85;
    bassBus.connect(comp);
    var instBus = off.createGain(); instBus.gain.value = clamp(opts.instLevel, 0, 1) * 0.8;
    var instDuck = off.createGain();
    instBus.connect(instDuck); instDuck.connect(comp);

    // Deterministisches Rauschen + Humanize-Zufall
    var noiseLen = Math.floor(sr * 0.3);
    var noiseBuf = off.createBuffer(1, noiseLen, sr);
    var nd = noiseBuf.getChannelData(0);
    var seed = 424242;
    for (var n = 0; n < noiseLen; n++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      nd[n] = seed / 0x3fffffff - 1;
    }
    var rndSeed = 1337;
    function rnd() {
      rndSeed = (rndSeed * 1103515245 + 12345) & 0x7fffffff;
      return rndSeed / 0x7fffffff;
    }
    function hum(vel) { return vel * (0.85 + 0.3 * rnd()); }
    function jit() { return (rnd() - 0.5) * 0.006; }

    // Tonart → Progression
    var key = track.analysis.key || {};
    var rootPc = typeof key.root === 'number' ? key.root : 9;
    var mode = key.mode === 'major' ? 'major' : 'minor';
    var prog = chordProgression(rootPc, mode);
    var karplusCache = {};

    var end = duration - 1.0;
    var totalBars = Math.min(400, Math.floor((end - gridStart) / barLen));
    var energy = computeBarEnergy(buffer, gridStart, barLen, totalBars);
    var plan = buildArrangement(totalBars, energy);

    var d = style.drums;
    var kickTimes = [];
    var prevType = null;

    for (var bar = 0; bar < totalBars; bar++) {
      var sec = sectionAt(plan, bar);
      var barT = gridStart + bar * barLen;
      var chord = prog[bar % 4];
      var barInSec = bar - sec.start;
      var lastBarOfSec = bar === sec.end;
      var secLen = sec.end - sec.start + 1;

      // Übergangs-FX beim Abschnittswechsel
      if (sec.type !== prevType) {
        if (sec.type === 'drop') { synthCrash(off, fxBus, barT, noiseBuf); synthImpact(off, fxBus, barT); }
        if (sec.type === 'breakdown') synthCrash(off, fxBus, barT, noiseBuf);
        prevType = sec.type;
      }
      // Riser + Roll vor jedem Drop
      if (lastBarOfSec && (sec.type === 'build' || sec.type === 'breakdown')) {
        synthRiser(off, fxBus, barT, barLen, noiseBuf);
        synthRoll(off, drumBus, barT, barLen, noiseBuf, !!d.clap);
      }

      // Layer-Schalter je Abschnitt
      var L = {
        kick: sec.type === 'drop' || sec.type === 'build' || (sec.type === 'outro' && barInSec < 2),
        snare: sec.type === 'drop' || sec.type === 'build',
        hats: sec.type !== 'breakdown' || barInSec >= secLen - 2,
        hatsVel: sec.type === 'intro' ? 0.55 : sec.type === 'outro' ? 0.7 : 1,
        perc: sec.type !== 'intro' && sec.type !== 'breakdown',
        bass: sec.type === 'drop',
        duck: (sec.type === 'drop' || sec.type === 'build') && style.duck > 0
      };

      // Fill-Takte im Drop: alle 4 Takte kleine Variation, alle 8 Takte Roll
      var fill4 = sec.type === 'drop' && barInSec % 4 === 3;
      var fill8 = sec.type === 'drop' && barInSec % 8 === 7;
      if (fill8) synthRoll(off, drumBus, barT, barLen, noiseBuf, !!d.clap);

      for (var s = 0; s < 16; s++) {
        var swingOff = (s % 2 === 1) ? style.swing * step16 : 0;
        var t = barT + s * step16 + swingOff;
        if (t >= end) break;

        if (L.kick && d.kick && d.kick[s]) {
          synthKick(off, drumBus, t, d.kick[s], style.duck > 0.35);
          kickTimes.push({ t: t, duck: L.duck });
        }
        // Fill: Extra-Kick auf 16tel 14 alle 4 Takte (nur 4-to-floor-Stile)
        if (fill4 && !fill8 && s === 14 && L.kick && d.kick && d.kick[0] && d.kick[4]) {
          synthKick(off, drumBus, t, 0.7, style.duck > 0.35);
        }
        if (L.snare && !fill8) {
          if (d.snare && d.snare[s]) synthSnare(off, drumBus, t + jit(), hum(d.snare[s]), noiseBuf);
          if (d.clap && d.clap[s]) synthClap(off, drumBus, t + jit(), hum(d.clap[s]), noiseBuf);
        }
        if (L.hats) {
          if (d.chat && d.chat[s]) synthHat(off, drumBus, t + jit(), hum(d.chat[s] * L.hatsVel), false, noiseBuf);
          // Open-Hat-Variation: in jeder zweiten 8-Takt-Gruppe um ein 16tel verschoben
          var ohatIdx = (sec.type === 'drop' && Math.floor(barInSec / 8) % 2 === 1) ? (s + 15) % 16 : s;
          if (d.ohat && d.ohat.length && d.ohat[ohatIdx]) {
            synthHat(off, drumBus, t + jit(), hum(d.ohat[ohatIdx] * L.hatsVel), true, noiseBuf);
          }
        }
        if (L.perc && d.perc && d.perc.length && d.perc[s]) {
          synthPerc(off, drumBus, t + jit(), hum(d.perc[s]), noiseBuf);
        }
        if (d.rim && d.rim.length && d.rim[s] && (sec.type === 'drop' || sec.type === 'build')) {
          synthRim(off, drumBus, t, hum(d.rim[s]));
        }

        // Bass (nur im Drop) mit Walkup am Ende jeder 4-Takt-Gruppe
        if (L.bass) {
          var bp = style.bass;
          if (bp.pattern[s]) {
            var isWalk = bar % 4 === 3 && s >= 12;
            var pc2 = isWalk ? (s >= 14 ? (chord.root + 12) : (chord.root + 7)) : chord.root;
            var bassFreq = noteFreq(pc2 % 12, bp.octave + (pc2 >= 12 ? 1 : 0));
            var bDur = bp.type === '808' ? beat * 1.5 : step16 * 1.8;
            synthBass(off, bassBus, t, bassFreq, bDur, hum(bp.pattern[s] * 0.9), bp.type);
          }
        }
      }

      // Instrumente je Abschnitt
      var instSet = null;
      if (opts.instruments) {
        if (sec.type === 'intro' || sec.type === 'outro') {
          instSet = { pad: opts.instruments.pad };
        } else if (sec.type === 'breakdown') {
          instSet = opts.instruments; // Breakdown gehört den Instrumenten
        } else if (sec.type === 'build') {
          instSet = { pad: opts.instruments.pad, piano: opts.instruments.piano };
        } else {
          instSet = opts.instruments;
        }
      }
      if (instSet) {
        scheduleInstruments(off, instBus, style.instFeel, instSet, {
          barT: barT, step16: step16, beat: beat, barLen: barLen,
          chord: chord, bar: bar, end: end,
          noiseBuf: noiseBuf, karplusCache: karplusCache
        });
      }
    }

    // ---- Filter-Automation des Originals je Abschnitt
    var baseHP = style.songHP || 30;
    var baseLP = style.songLP || 18000;
    hpAuto.frequency.setValueAtTime(baseHP, 0);
    lpAuto.frequency.setValueAtTime(baseLP, 0);
    for (var p = 0; p < plan.length; p++) {
      var secP = plan[p];
      var t0 = gridStart + secP.start * barLen;
      var t1 = gridStart + (secP.end + 1) * barLen;
      if (secP.type === 'build') {
        // Spannungsaufbau: Highpass zieht hoch, am Drop schlagartig offen
        hpAuto.frequency.setValueAtTime(baseHP, t0);
        hpAuto.frequency.exponentialRampToValueAtTime(Math.max(350, baseHP * 3), t1 - 0.02);
        hpAuto.frequency.setValueAtTime(baseHP, t1);
      } else if (secP.type === 'breakdown') {
        lpAuto.frequency.setValueAtTime(baseLP, t0);
        lpAuto.frequency.exponentialRampToValueAtTime(1100, t0 + 0.6);
        lpAuto.frequency.exponentialRampToValueAtTime(baseLP, t1 - barLen * 0.5);
      } else if (secP.type === 'outro') {
        lpAuto.frequency.setValueAtTime(baseLP, Math.max(0, t1 - barLen));
        lpAuto.frequency.exponentialRampToValueAtTime(2500, Math.min(duration - 0.1, t1 + 0.5));
      }
    }

    // ---- Sidechain-Ducking (nur wo der Abschnitt es will)
    duckGain.gain.value = 1;
    instDuck.gain.value = 1;
    if (style.duck > 0) {
      var rel = Math.min(beat * 0.65, 0.4);
      for (var ki = 0; ki < Math.min(kickTimes.length, 2400); ki++) {
        if (!kickTimes[ki].duck) continue;
        var kt = kickTimes[ki].t;
        duckGain.gain.setValueAtTime(1, Math.max(0, kt - 0.004));
        duckGain.gain.linearRampToValueAtTime(1 - style.duck, kt + 0.03);
        duckGain.gain.linearRampToValueAtTime(1, kt + rel);
        instDuck.gain.setValueAtTime(1, Math.max(0, kt - 0.004));
        instDuck.gain.linearRampToValueAtTime(1 - style.duck * 0.7, kt + 0.03);
        instDuck.gain.linearRampToValueAtTime(1, kt + rel);
      }
    }

    var rendered = await off.startRendering();
    var sections = plan.map(function (sp) {
      return sp.type + ' (' + (sp.end - sp.start + 1) + ')';
    }).join(' → ');
    return {
      buffer: rendered,
      meta: {
        style: style.group + ' – ' + style.label,
        targetBpm: Math.round(target * 10) / 10,
        stretch: Math.round((factor - 1) * 1000) / 10,
        keyName: key.name || null,
        arrangement: sections,
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
      } else {
        [0, 4, 8, 12].forEach(function (s, i) {
          t = p.barT + s * p.step16;
          if (t < p.end) synthPiano(ctx, dest, t, triad[i % 3], 0.4, 0.3);
        });
      }
    }

    if (active.guitar) {
      if (feel === 'reggae') {
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
