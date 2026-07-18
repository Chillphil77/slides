/*
 * MixMate Time-Stretch (WSOLA)
 * Ändert das Tempo eines AudioBuffers OHNE die Tonhöhe zu verändern —
 * wie der Master-Tempo-Modus in Profi-DJ-Software.
 *
 * Verfahren: Waveform Similarity Overlap-Add.
 * Hann-Fenster mit 50 % Überlappung (COLA), Offset-Suche per
 * Kreuzkorrelation auf Kanal 0, identische Offsets für alle Kanäle
 * (erhält die Stereo-Phase).
 */
(function (global) {
  'use strict';

  /**
   * factor > 1 → schneller (Ausgabe kürzer), < 1 → langsamer.
   * Gibt einen neuen AudioBuffer zurück; bei |factor-1| < 2 % das Original.
   */
  async function stretchBuffer(ctx, buffer, factor, onProgress) {
    if (Math.abs(factor - 1) < 0.02) return buffer;
    factor = Math.min(1.35, Math.max(0.7, factor));

    var sr = buffer.sampleRate;
    var N = Math.round(sr * 0.08);
    if (N % 2) N++;
    var hop = N / 2;                       // Synthese-Schrittweite
    var inHop = hop * factor;              // Analyse-Schrittweite
    var search = Math.round(sr * 0.006);   // ±6 ms Suchfenster
    var corrLen = hop;
    var corrStep = 8;
    var offStep = 3;

    var numCh = buffer.numberOfChannels;
    var inLen = buffer.length;
    var outLen = Math.floor(inLen / factor) + N * 2;

    var srcs = [];
    for (var c = 0; c < numCh; c++) srcs.push(buffer.getChannelData(c));
    var outs = [];
    for (var c2 = 0; c2 < numCh; c2++) outs.push(new Float32Array(outLen));

    var win = new Float32Array(N);
    for (var i = 0; i < N; i++) win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));

    var src0 = srcs[0];
    var frames = Math.floor((inLen - N - search - 1) / inHop);
    var prevIn = 0;
    var maxIn = inLen - N - 1;

    for (var f = 0; f < frames; f++) {
      var outPos = f * hop;
      var idealIn = Math.round(f * inHop);
      var inPos = idealIn;

      if (f > 0) {
        // Position, an der das Signal "natürlich" weiterliefe
        var natural = prevIn + hop;
        if (natural <= maxIn) {
          var bestOff = 0;
          var bestScore = -Infinity;
          var lo = Math.max(0, idealIn - search);
          var hi = Math.min(maxIn, idealIn + search);
          for (var cand = lo; cand <= hi; cand += offStep) {
            var score = 0;
            for (var k = 0; k < corrLen; k += corrStep) {
              score += src0[natural + k] * src0[cand + k];
            }
            if (score > bestScore) { bestScore = score; bestOff = cand - idealIn; }
          }
          inPos = idealIn + bestOff;
        }
      }
      if (inPos < 0) inPos = 0;
      if (inPos > maxIn) inPos = maxIn;

      for (var ch = 0; ch < numCh; ch++) {
        var srcCh = srcs[ch];
        var outCh = outs[ch];
        for (var j = 0; j < N; j++) {
          outCh[outPos + j] += srcCh[inPos + j] * win[j];
        }
      }
      prevIn = inPos;

      if (f % 400 === 0) {
        if (onProgress) onProgress(f / frames);
        // UI nicht blockieren
        await new Promise(function (r) { setTimeout(r, 0); });
      }
    }

    var finalLen = Math.min(outLen, Math.floor(inLen / factor));
    var out = ctx.createBuffer(numCh, Math.max(1, finalLen), sr);
    for (var ch2 = 0; ch2 < numCh; ch2++) {
      out.getChannelData(ch2).set(outs[ch2].subarray(0, finalLen));
    }
    return out;
  }

  global.TimeStretch = { stretchBuffer: stretchBuffer };
})(window);
