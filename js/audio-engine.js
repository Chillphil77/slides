/*
 * MixMate Audio Engine
 * Alles läuft lokal im Browser über die Web Audio API:
 *  - BPM-Erkennung (Lowpass + Peak-Intervall-Histogramm)
 *  - Tonart-Erkennung (Chroma via Goertzel + Krumhansl-Profile)
 *  - Automatisches, beat-synchrones Mixing mit EQ-Bass-Swap,
 *    Loudness-Angleich und optionalem House-Beat-Layer
 *  - Offline-Rendering und WAV-Export
 */
(function (global) {
  'use strict';

  var AC = global.AudioContext || global.webkitAudioContext;
  var sharedCtx = null;

  function getCtx() {
    if (!sharedCtx) sharedCtx = new AC();
    if (sharedCtx.state === 'suspended') sharedCtx.resume();
    return sharedCtx;
  }

  // ---------------------------------------------------------------- Decode

  async function decodeFile(file) {
    var arrayBuf = await file.arrayBuffer();
    var ctx = getCtx();
    return await new Promise(function (resolve, reject) {
      // Callback-Form für ältere Safari-Versionen
      ctx.decodeAudioData(arrayBuf.slice(0), resolve, reject);
    });
  }

  function toMono(buffer) {
    if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
    var l = buffer.getChannelData(0);
    var r = buffer.getChannelData(1);
    var out = new Float32Array(buffer.length);
    for (var i = 0; i < buffer.length; i++) out[i] = (l[i] + r[i]) * 0.5;
    return out;
  }

  // ------------------------------------------------------------- Analysis

  async function detectBPM(buffer) {
    var sr = buffer.sampleRate;
    var off = new (global.OfflineAudioContext || global.webkitOfflineAudioContext)(
      1, buffer.length, sr
    );
    var src = off.createBufferSource();
    src.buffer = buffer;
    var lp = off.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 150;
    lp.Q.value = 1;
    src.connect(lp);
    lp.connect(off.destination);
    src.start(0);
    var rendered = await off.startRendering();
    var data = rendered.getChannelData(0);

    var max = 0;
    for (var i = 0; i < data.length; i++) {
      var v = Math.abs(data[i]);
      if (v > max) max = v;
    }
    if (max === 0) return { bpm: 120, anchor: 0, confidence: 0 };

    var durationSec = buffer.duration;
    var minPeaks = Math.max(20, Math.floor(durationSec * 1.2));
    var minGap = Math.floor(sr * 0.25);
    var peaks = [];
    var thresh;
    for (thresh = 0.9; thresh >= 0.2; thresh -= 0.05) {
      peaks = collectPeaks(data, thresh * max, minGap);
      if (peaks.length >= minPeaks) break;
    }
    if (peaks.length < 4) return { bpm: 120, anchor: 0, confidence: 0 };

    // Intervall-Histogramm: Abstände zwischen Peaks in BPM-Kandidaten falten
    var hist = {};
    for (var p = 0; p < peaks.length; p++) {
      for (var q = p + 1; q < Math.min(p + 10, peaks.length); q++) {
        var interval = (peaks[q].pos - peaks[p].pos) / sr;
        if (interval < 0.2) continue;
        var bpm = 60 / interval;
        while (bpm < 85) bpm *= 2;
        while (bpm > 170) bpm /= 2;
        var key = Math.round(bpm);
        hist[key] = (hist[key] || 0) + 1;
      }
    }
    var bestKey = 120, bestCount = 0, total = 0;
    for (var k in hist) {
      // Nachbar-Bins glätten
      var kk = parseInt(k, 10);
      var c = hist[k] + (hist[kk - 1] || 0) * 0.5 + (hist[kk + 1] || 0) * 0.5;
      total += hist[k];
      if (c > bestCount) { bestCount = c; bestKey = kk; }
    }
    // Feinauflösung: gewichteter Mittelwert um den besten Bin
    var num = 0, den = 0;
    for (var d = -1; d <= 1; d++) {
      var w = hist[bestKey + d] || 0;
      num += (bestKey + d) * w;
      den += w;
    }
    var bpmFinal = den > 0 ? num / den : bestKey;

    // Grid-Anker: stärkster Peak als Beat-Referenz
    var anchorPeak = peaks[0];
    for (var a = 1; a < peaks.length; a++) {
      if (peaks[a].val > anchorPeak.val) anchorPeak = peaks[a];
    }

    return {
      bpm: Math.round(bpmFinal * 10) / 10,
      anchor: anchorPeak.pos / sr,
      confidence: total > 0 ? Math.min(1, bestCount / (total * 0.25)) : 0
    };
  }

  function collectPeaks(data, threshold, minGap) {
    var peaks = [];
    var i = 0;
    var len = data.length;
    while (i < len) {
      if (Math.abs(data[i]) >= threshold) {
        // lokales Maximum im Fenster suchen
        var end = Math.min(i + minGap, len);
        var bestPos = i, bestVal = Math.abs(data[i]);
        for (var j = i; j < end; j++) {
          var v = Math.abs(data[j]);
          if (v > bestVal) { bestVal = v; bestPos = j; }
        }
        peaks.push({ pos: bestPos, val: bestVal });
        i = bestPos + minGap;
      } else {
        i++;
      }
    }
    return peaks;
  }

  // Tonart über Chroma-Vektor (Goertzel an Pitch-Class-Frequenzen)
  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  var MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  var CAMELOT = {
    'C major': '8B', 'C# major': '3B', 'D major': '10B', 'D# major': '5B',
    'E major': '12B', 'F major': '7B', 'F# major': '2B', 'G major': '9B',
    'G# major': '4B', 'A major': '11B', 'A# major': '6B', 'B major': '1B',
    'C minor': '5A', 'C# minor': '12A', 'D minor': '7A', 'D# minor': '2A',
    'E minor': '9A', 'F minor': '4A', 'F# minor': '11A', 'G minor': '6A',
    'G# minor': '1A', 'A minor': '8A', 'A# minor': '3A', 'B minor': '10A'
  };

  function detectKey(buffer) {
    var mono = toMono(buffer);
    var sr = buffer.sampleRate;
    var decim = 4;
    var dsr = sr / decim;

    var frameLen = 8192;
    var numFrames = 24;
    var startSample = Math.floor(mono.length * 0.15);
    var usable = Math.floor((mono.length * 0.7) / decim) - frameLen;
    if (usable < frameLen) { startSample = 0; usable = Math.floor(mono.length / decim) - frameLen; }
    if (usable <= 0) return null;

    var chroma = new Float32Array(12);
    var frame = new Float32Array(frameLen);

    for (var f = 0; f < numFrames; f++) {
      var offset = startSample + Math.floor((usable / numFrames) * f) * decim;
      for (var i = 0; i < frameLen; i++) {
        var idx = offset + i * decim;
        frame[i] = idx < mono.length ? mono[idx] : 0;
      }
      // 3 Oktaven: C3 (130.81 Hz) bis B5
      for (var note = 0; note < 36; note++) {
        var freq = 130.8128 * Math.pow(2, note / 12);
        if (freq > dsr / 2) break;
        var mag = goertzel(frame, freq, dsr);
        chroma[note % 12] += mag;
      }
    }

    var maxC = 0;
    for (var c = 0; c < 12; c++) if (chroma[c] > maxC) maxC = chroma[c];
    if (maxC === 0) return null;

    var best = { corr: -Infinity, root: 0, mode: 'major' };
    for (var root = 0; root < 12; root++) {
      var cMaj = correlate(chroma, MAJOR_PROFILE, root);
      var cMin = correlate(chroma, MINOR_PROFILE, root);
      if (cMaj > best.corr) best = { corr: cMaj, root: root, mode: 'major' };
      if (cMin > best.corr) best = { corr: cMin, root: root, mode: 'minor' };
    }
    var name = NOTE_NAMES[best.root] + ' ' + best.mode;
    return {
      name: NOTE_NAMES[best.root] + (best.mode === 'major' ? ' Dur' : ' Moll'),
      camelot: CAMELOT[name] || '?'
    };
  }

  function goertzel(frame, freq, sr) {
    var w = 2 * Math.PI * freq / sr;
    var coeff = 2 * Math.cos(w);
    var s0 = 0, s1 = 0, s2 = 0;
    for (var i = 0; i < frame.length; i++) {
      s0 = frame[i] + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
  }

  function correlate(chroma, profile, rotation) {
    var meanC = 0, meanP = 0;
    for (var i = 0; i < 12; i++) { meanC += chroma[i]; meanP += profile[i]; }
    meanC /= 12; meanP /= 12;
    var num = 0, denC = 0, denP = 0;
    for (var j = 0; j < 12; j++) {
      var cv = chroma[(j + rotation) % 12] - meanC;
      var pv = profile[j] - meanP;
      num += cv * pv;
      denC += cv * cv;
      denP += pv * pv;
    }
    return denC > 0 && denP > 0 ? num / Math.sqrt(denC * denP) : 0;
  }

  function camelotCompatible(camA, camB) {
    if (!camA || !camB || camA === '?' || camB === '?') return null;
    var nA = parseInt(camA, 10), lA = camA.slice(-1);
    var nB = parseInt(camB, 10), lB = camB.slice(-1);
    if (nA === nB) return true;
    if (lA === lB) {
      var diff = Math.abs(nA - nB);
      return diff === 1 || diff === 11;
    }
    return false;
  }

  function computeRMS(buffer) {
    var mono = toMono(buffer);
    var start = Math.floor(mono.length * 0.2);
    var end = Math.floor(mono.length * 0.8);
    if (end <= start) { start = 0; end = mono.length; }
    var sum = 0;
    var step = 4;
    var count = 0;
    for (var i = start; i < end; i += step) {
      sum += mono[i] * mono[i];
      count++;
    }
    return Math.sqrt(sum / Math.max(1, count));
  }

  // Erster "richtiger" Einsatz (Intro-Skip): erstes Fenster über 30 % des Max-RMS
  function findFirstBeat(buffer) {
    var mono = toMono(buffer);
    var sr = buffer.sampleRate;
    var win = Math.floor(sr * 0.3);
    var maxRms = 0;
    var windows = [];
    for (var i = 0; i + win < mono.length; i += win) {
      var sum = 0;
      for (var j = i; j < i + win; j += 4) sum += mono[j] * mono[j];
      var rms = Math.sqrt(sum / (win / 4));
      windows.push(rms);
      if (rms > maxRms) maxRms = rms;
    }
    if (maxRms === 0) return 0;
    for (var w = 0; w < windows.length; w++) {
      if (windows[w] > maxRms * 0.3) return (w * win) / sr;
    }
    return 0;
  }

  async function analyzeTrack(buffer, onStatus) {
    if (onStatus) onStatus('BPM wird erkannt …');
    var beat = await detectBPM(buffer);
    if (onStatus) onStatus('Tonart wird erkannt …');
    var key = detectKey(buffer);
    var rms = computeRMS(buffer);
    var firstBeat = findFirstBeat(buffer);
    return {
      bpm: beat.bpm,
      anchor: beat.anchor,
      confidence: beat.confidence,
      key: key,
      rms: rms,
      firstBeat: firstBeat,
      duration: buffer.duration
    };
  }

  // ------------------------------------------------------------ Waveforms

  function getPeaks(buffer, width) {
    var mono = toMono(buffer);
    var block = Math.max(1, Math.floor(mono.length / width));
    var peaks = new Float32Array(width);
    for (var i = 0; i < width; i++) {
      var start = i * block;
      var end = Math.min(start + block, mono.length);
      var max = 0;
      var step = Math.max(1, Math.floor(block / 50));
      for (var j = start; j < end; j += step) {
        var v = Math.abs(mono[j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  }

  // ------------------------------------------------------------ Mix render

  function snapToGrid(t, anchor, beatLen) {
    if (beatLen <= 0) return t;
    var snapped = anchor + Math.round((t - anchor) / beatLen) * beatLen;
    return Math.max(0, snapped);
  }

  function foldBpm(bpm, target) {
    var folded = bpm;
    while (folded < target / 1.45) folded *= 2;
    while (folded > target * 1.45) folded /= 2;
    return folded;
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function buildFadeCurve(type, steps, rising) {
    var curve = new Float32Array(steps);
    for (var i = 0; i < steps; i++) {
      var x = i / (steps - 1);
      if (type === 'linear') {
        curve[i] = rising ? x : 1 - x;
      } else if (type === 'scurve') {
        var s = x * x * (3 - 2 * x);
        curve[i] = rising ? s : 1 - s;
      } else { // equal power
        curve[i] = rising ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2);
      }
    }
    return curve;
  }

  /**
   * Rendert den kompletten Mix offline.
   * a/b: { buffer, analysis } — opts siehe app.js
   */
  async function renderMix(a, b, opts, onStatus) {
    var sr = 44100;
    var bpmA = a.analysis.bpm;
    var bpmB = b.analysis.bpm;
    var target = opts.targetBpm || bpmA;

    var foldedA = foldBpm(bpmA, target);
    var foldedB = foldBpm(bpmB, target);
    var rateA = clamp(target / foldedA, 0.8, 1.25);
    var rateB = clamp(target / foldedB, 0.8, 1.25);

    var beatOut = 60 / target;
    var beatA = 60 / foldedA;
    var beatB = 60 / foldedB;

    // Übergangspunkt in Track A (auf Beat-Raster gesnappt)
    var transBeats = opts.transitionBeats;
    var transDurInA = transBeats * beatA;
    var wantStartA = a.buffer.duration * opts.transitionPointPct;
    var maxStartA = a.buffer.duration - transDurInA - 0.5;
    var transStartA = snapToGrid(Math.min(wantStartA, Math.max(0, maxStartA)),
      a.analysis.anchor, beatA);
    if (transStartA > maxStartA) transStartA = Math.max(0, maxStartA);
    if (transStartA < 1) transStartA = Math.min(1, a.buffer.duration * 0.3);

    // Einstiegspunkt in Track B
    var bStart = 0;
    if (opts.skipIntroB) {
      bStart = snapToGrid(b.analysis.firstBeat, b.analysis.anchor, beatB);
      if (bStart > b.buffer.duration * 0.5) bStart = 0;
    }

    var T0 = transStartA / rateA;                       // Übergang beginnt (Output-Zeit)
    var tailB = (b.buffer.duration - bStart) / rateB;   // Restlaufzeit von B im Output
    var transDur = Math.min(transBeats * beatOut, tailB * 0.8, a.buffer.duration / rateA - T0);
    transDur = Math.max(beatOut * 2, transDur);
    var totalDur = T0 + tailB + 0.4;

    var maxDur = 60 * 20;
    if (totalDur > maxDur) totalDur = maxDur;

    if (onStatus) onStatus('Mix wird gerendert …');

    var off = new (global.OfflineAudioContext || global.webkitOfflineAudioContext)(
      2, Math.ceil(totalDur * sr), sr
    );

    // Master: Kompressor als "Glue" + Limiter-Schutz
    var comp = off.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    var master = off.createGain();
    master.gain.value = 0.95;
    comp.connect(master);
    master.connect(off.destination);

    // Loudness-Angleich (RMS → gemeinsames Ziel)
    var targetRms = 0.16;
    var gA = clamp(targetRms / Math.max(0.001, a.analysis.rms), 0.5, 2.5);
    var gB = clamp(targetRms / Math.max(0.001, b.analysis.rms), 0.5, 2.5);

    // ---- Deck A
    var srcA = off.createBufferSource();
    srcA.buffer = a.buffer;
    srcA.playbackRate.value = rateA;
    var shelfA = off.createBiquadFilter();
    shelfA.type = 'lowshelf';
    shelfA.frequency.value = 250;
    shelfA.gain.value = 0;
    var gainA = off.createGain();
    srcA.connect(shelfA);
    shelfA.connect(gainA);
    gainA.connect(comp);

    // ---- Deck B
    var srcB = off.createBufferSource();
    srcB.buffer = b.buffer;
    srcB.playbackRate.value = rateB;
    var shelfB = off.createBiquadFilter();
    shelfB.type = 'lowshelf';
    shelfB.frequency.value = 250;
    shelfB.gain.value = 0;
    var gainB = off.createGain();
    srcB.connect(shelfB);
    shelfB.connect(gainB);
    gainB.connect(comp);

    // ---- Crossfade-Automation
    var steps = 512;
    var fadeOut = buildFadeCurve(opts.curve, steps, false);
    var fadeIn = buildFadeCurve(opts.curve, steps, true);
    var outCurve = new Float32Array(steps);
    var inCurve = new Float32Array(steps);
    for (var i = 0; i < steps; i++) {
      outCurve[i] = fadeOut[i] * gA;
      inCurve[i] = fadeIn[i] * gB;
    }
    gainA.gain.setValueAtTime(gA, 0);
    gainA.gain.setValueCurveAtTime(outCurve, T0, transDur);
    gainB.gain.setValueAtTime(0, 0);
    gainB.gain.setValueCurveAtTime(inCurve, T0, transDur);

    // ---- Bass-Swap: B ohne Bass einblenden, am "Drop" Bass tauschen
    if (opts.bassSwap) {
      var drop = T0 + transDur * 0.55;
      drop = T0 + Math.round((drop - T0) / beatOut) * beatOut;
      var swapLen = beatOut * 2;
      shelfB.gain.setValueAtTime(-15, 0);
      shelfB.gain.setValueAtTime(-15, Math.max(0, drop - 0.01));
      shelfB.gain.linearRampToValueAtTime(0, drop + swapLen);
      shelfA.gain.setValueAtTime(0, 0);
      shelfA.gain.setValueAtTime(0, Math.max(0, drop - 0.01));
      shelfA.gain.linearRampToValueAtTime(-15, drop + swapLen);
    }

    srcA.start(0, 0);
    srcA.stop(Math.min(totalDur, T0 + transDur + 0.3));
    srcB.start(T0, Math.min(bStart, Math.max(0, b.buffer.duration - 0.1)));

    // ---- House-Beat-Layer (Kick + Offbeat-Hats auf dem Ziel-Grid)
    if (opts.house) {
      addHouseLayer(off, comp, {
        tStart: T0,
        tEnd: opts.houseScope === 'rest' ? totalDur - 0.4 : T0 + transDur,
        beat: beatOut,
        level: opts.houseLevel,
        rampBeats: 4
      });
    }

    var rendered = await off.startRendering();
    return {
      buffer: rendered,
      meta: {
        targetBpm: Math.round(target * 10) / 10,
        rateA: rateA,
        rateB: rateB,
        transitionStart: T0,
        transitionDuration: transDur,
        totalDuration: rendered.duration
      }
    };
  }

  function addHouseLayer(ctx, dest, cfg) {
    var layerGain = ctx.createGain();
    layerGain.gain.setValueAtTime(0.0001, cfg.tStart);
    layerGain.gain.exponentialRampToValueAtTime(
      Math.max(0.05, cfg.level), cfg.tStart + cfg.beat * cfg.rampBeats
    );
    layerGain.connect(dest);

    // Noise-Buffer für Hi-Hats (einmalig)
    var noiseLen = Math.floor(ctx.sampleRate * 0.06);
    var noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0);
    // Deterministisches Pseudo-Rauschen (kein Math.random nötig)
    var seed = 1234567;
    for (var n = 0; n < noiseLen; n++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      nd[n] = (seed / 0x3fffffff - 1) * Math.pow(1 - n / noiseLen, 0.5);
    }

    var maxEvents = 4000;
    var count = 0;
    for (var t = cfg.tStart; t < cfg.tEnd && count < maxEvents; t += cfg.beat) {
      // Kick auf jedem Beat
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
      var kg = ctx.createGain();
      kg.gain.setValueAtTime(1.0, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(kg);
      kg.connect(layerGain);
      osc.start(t);
      osc.stop(t + 0.3);

      // Offbeat-Hat
      var ht = t + cfg.beat / 2;
      if (ht < cfg.tEnd) {
        var hsrc = ctx.createBufferSource();
        hsrc.buffer = noiseBuf;
        var hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 8000;
        var hg = ctx.createGain();
        hg.gain.setValueAtTime(0.22, ht);
        hg.gain.exponentialRampToValueAtTime(0.001, ht + 0.05);
        hsrc.connect(hp);
        hp.connect(hg);
        hg.connect(layerGain);
        hsrc.start(ht);
      }
      count++;
    }
  }

  // ------------------------------------------------------------ WAV export

  function encodeWav(buffer) {
    var numCh = Math.min(2, buffer.numberOfChannels);
    var sr = buffer.sampleRate;
    var len = buffer.length;
    var bytesPerSample = 2;
    var blockAlign = numCh * bytesPerSample;
    var dataSize = len * blockAlign;
    var out = new ArrayBuffer(44 + dataSize);
    var view = new DataView(out);

    writeStr(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(view, 8, 'WAVE');
    writeStr(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeStr(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    var channels = [];
    for (var c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
    var offset = 44;
    for (var i = 0; i < len; i++) {
      for (var ch = 0; ch < numCh; ch++) {
        var s = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([out], { type: 'audio/wav' });
  }

  function writeStr(view, offset, str) {
    for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  global.AudioEngine = {
    getCtx: getCtx,
    decodeFile: decodeFile,
    analyzeTrack: analyzeTrack,
    getPeaks: getPeaks,
    renderMix: renderMix,
    encodeWav: encodeWav,
    camelotCompatible: camelotCompatible
  };
})(window);
