/* MixMate – UI & Orchestrierung */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    A: null, // { file, buffer, analysis }
    B: null,
    S: null, // Single-Song für Style-Remix
    mode: 'mix',
    busy: false,
    resultUrl: null,
    styleSettings: {
      styleId: null,
      beatLevel: 0.8,
      instLevel: 0.6,
      keepTempo: false,
      instruments: { piano: false, guitar: false, pad: false, steel: false }
    },
    settings: {
      preset: 'classic',
      bpmAuto: true,
      targetBpm: 124,
      transitionBars: 8,
      transitionPointPct: 0.75,
      curve: 'equal',
      bassSwap: true,
      skipIntroB: true,
      proMix: true,
      stems: {
        a: { vocals: 1, drums: 1, bass: 1, instr: 1 },
        b: { vocals: 1, drums: 1, bass: 1, instr: 1 }
      },
      house: false,
      houseLevel: 0.7,
      houseScope: 'rest'
    }
  };

  var BAR_STEPS = [4, 8, 16, 32]; // Takte für den Übergangs-Slider

  // ---------------------------------------------------------- Copyright-Gate

  var modal = $('copyrightModal');
  var check = $('copyrightCheck');
  var accept = $('copyrightAccept');

  if (localStorage.getItem('mixmate.rightsAccepted') === '1') {
    modal.classList.add('hidden');
  }
  check.addEventListener('change', function () {
    accept.disabled = !check.checked;
  });
  accept.addEventListener('click', function () {
    localStorage.setItem('mixmate.rightsAccepted', '1');
    modal.classList.add('hidden');
  });
  $('legalLink').addEventListener('click', function (e) {
    e.preventDefault();
    check.checked = true;
    accept.disabled = false;
    modal.classList.remove('hidden');
  });

  // ---------------------------------------------------------- Datei-Handling

  setupDeck('A');
  setupDeck('B');
  setupDeck('S');

  function setupDeck(deck) {
    var input = $('file' + deck);
    var drop = $('drop' + deck);

    input.addEventListener('change', function () {
      if (input.files && input.files[0]) loadTrack(deck, input.files[0]);
    });

    drop.addEventListener('dragover', function (e) {
      e.preventDefault();
      drop.classList.add('dragover');
    });
    drop.addEventListener('dragleave', function () { drop.classList.remove('dragover'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      drop.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadTrack(deck, e.dataTransfer.files[0]);
      }
    });
  }

  document.addEventListener('click', function (e) {
    var change = e.target.getAttribute && e.target.getAttribute('data-change');
    if (change) $('file' + change).click();
  });

  async function loadTrack(deck, file) {
    var status = $('status' + deck);
    var drop = $('drop' + deck);
    var info = $('info' + deck);

    drop.classList.add('hidden');
    info.classList.add('hidden');
    status.classList.remove('hidden');
    status.textContent = 'Lade & dekodiere …';
    state[deck] = null;
    updateMixButton();

    try {
      var buffer = await AudioEngine.decodeFile(file);
      var analysis = await AudioEngine.analyzeTrack(buffer, function (msg) {
        status.textContent = msg;
      });
      state[deck] = { file: file, buffer: buffer, analysis: analysis };

      $('name' + deck).textContent = file.name.replace(/\.[^.]+$/, '');
      $('bpm' + deck).textContent = analysis.bpm;
      $('key' + deck).textContent = analysis.key
        ? analysis.key.name + ' (' + analysis.key.camelot + ')'
        : 'Tonart ?';
      $('dur' + deck).textContent = formatTime(buffer.duration);
      drawWaveform($('wave' + deck), buffer,
        deck === 'A' ? '#ff2d78' : deck === 'S' ? '#b721ff' : '#21d4fd');

      status.classList.add('hidden');
      info.classList.remove('hidden');
      updateKeyHint();
    } catch (err) {
      console.error(err);
      status.textContent = '⚠️ Datei konnte nicht gelesen werden. Bitte MP3, M4A oder WAV verwenden.';
      drop.classList.remove('hidden');
    }
    updateMixButton();
  }

  function updateKeyHint() {
    var hint = $('keyHint');
    if (!state.A || !state.B || !state.A.analysis.key || !state.B.analysis.key) {
      hint.classList.add('hidden');
      return;
    }
    var compat = AudioEngine.camelotCompatible(
      state.A.analysis.key.camelot, state.B.analysis.key.camelot);
    hint.classList.remove('hidden', 'good', 'warn');
    if (compat === true) {
      hint.classList.add('good');
      hint.textContent = '✅ Harmonisch kompatibel (' + state.A.analysis.key.camelot +
        ' → ' + state.B.analysis.key.camelot + ') – die Tonarten passen gut zusammen.';
    } else if (compat === false) {
      hint.classList.add('warn');
      hint.textContent = '⚠️ Tonarten ' + state.A.analysis.key.camelot + ' → ' +
        state.B.analysis.key.camelot + ' sind nicht direkt kompatibel. ' +
        'Der Mix funktioniert trotzdem – der Bass-Swap entschärft harmonische Reibung.';
    } else {
      hint.classList.add('hidden');
    }
  }

  function updateMixButton() {
    $('mixBtn').disabled = !(state.A && state.B) || state.busy;
    var s = state.styleSettings;
    var styleReady = state.S && s.styleId && !state.busy;
    $('styleBtn').disabled = !styleReady;
    $('styleBtnSub').textContent = !state.S ? 'Song + Stil wählen'
      : !s.styleId ? 'Noch einen Stil wählen'
      : '1 Klick – fertig geremixt';
  }

  // ---------------------------------------------------------- Waveforms

  function drawWaveform(canvas, buffer, color, markers) {
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
    var cssH = parseInt(canvas.getAttribute('height'), 10) || 56;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    var peaks = AudioEngine.getPeaks(buffer, cssW);
    var mid = cssH / 2;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    for (var x = 0; x < cssW; x++) {
      var h = Math.max(1, peaks[x] * (cssH - 4));
      ctx.fillRect(x, mid - h / 2, 1, h);
    }
    ctx.globalAlpha = 1;

    if (markers) {
      markers.forEach(function (m) {
        var mx = (m.time / buffer.duration) * cssW;
        ctx.fillStyle = m.color;
        ctx.fillRect(mx, 0, 2, cssH);
      });
    }
  }

  // ---------------------------------------------------------- Presets

  document.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll('.chip').forEach(function (c) {
        c.classList.remove('chip-active');
      });
      chip.classList.add('chip-active');
      applyPreset(chip.getAttribute('data-preset'));
    });
  });

  function applyPreset(name) {
    var s = state.settings;
    s.preset = name;
    if (name === 'classic') {
      s.bpmAuto = true;
      s.transitionBars = 8;
      s.curve = 'equal';
      s.bassSwap = true;
      s.skipIntroB = true;
      s.house = false;
    } else if (name === 'house') {
      s.bpmAuto = false;
      s.targetBpm = 124;
      s.transitionBars = 8;
      s.curve = 'equal';
      s.bassSwap = true;
      s.skipIntroB = true;
      s.house = true;
      s.houseScope = 'rest';
      s.houseLevel = 0.7;
    } else if (name === 'quick') {
      s.bpmAuto = true;
      s.transitionBars = 4;
      s.curve = 'scurve';
      s.bassSwap = false;
      s.skipIntroB = true;
      s.house = false;
    }
    syncAdvancedUI();
  }

  // ---------------------------------------------------------- Advanced UI

  $('advToggle').addEventListener('click', function () {
    $('advPanel').classList.toggle('hidden');
  });

  $('bpmAuto').addEventListener('change', function () {
    state.settings.bpmAuto = this.checked;
    $('targetBpm').disabled = this.checked;
    updateAdvLabels();
  });
  $('targetBpm').addEventListener('input', function () {
    state.settings.targetBpm = parseInt(this.value, 10);
    updateAdvLabels();
  });
  $('transLen').addEventListener('input', function () {
    state.settings.transitionBars = BAR_STEPS[parseInt(this.value, 10) - 1];
    updateAdvLabels();
  });
  $('transPoint').addEventListener('input', function () {
    state.settings.transitionPointPct = parseInt(this.value, 10) / 100;
    updateAdvLabels();
  });
  $('bassSwap').addEventListener('change', function () {
    state.settings.bassSwap = this.checked;
  });
  $('proMix').addEventListener('change', function () {
    state.settings.proMix = this.checked;
  });
  $('stemsToggle').addEventListener('change', function () {
    $('stemsPanel').classList.toggle('hidden', !this.checked);
    if (!this.checked) {
      // Zurücksetzen, damit "aus" wirklich neutral ist
      ['a', 'b'].forEach(function (d) {
        ['vocals', 'drums', 'bass', 'instr'].forEach(function (k) {
          state.settings.stems[d][k] = 1;
        });
      });
      document.querySelectorAll('.stem-slider').forEach(function (sl) { sl.value = 100; });
    }
  });
  document.querySelectorAll('.stem-slider').forEach(function (sl) {
    sl.addEventListener('input', function () {
      state.settings.stems[sl.getAttribute('data-deck')][sl.getAttribute('data-stem')] =
        parseInt(sl.value, 10) / 100;
    });
  });
  $('skipIntro').addEventListener('change', function () {
    state.settings.skipIntroB = this.checked;
  });
  $('houseMode').addEventListener('change', function () {
    state.settings.house = this.checked;
    $('houseOpts').classList.toggle('hidden', !this.checked);
  });
  $('houseLevel').addEventListener('input', function () {
    state.settings.houseLevel = parseInt(this.value, 10) / 100;
    updateAdvLabels();
  });

  setupSegment('curveSeg', 'data-curve', function (v) { state.settings.curve = v; });
  setupSegment('houseScopeSeg', 'data-scope', function (v) { state.settings.houseScope = v; });

  function setupSegment(id, attr, onChange) {
    var seg = $(id);
    seg.querySelectorAll('.seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        seg.querySelectorAll('.seg-btn').forEach(function (b) {
          b.classList.remove('seg-active');
        });
        btn.classList.add('seg-active');
        onChange(btn.getAttribute(attr));
      });
    });
  }

  function syncAdvancedUI() {
    var s = state.settings;
    $('bpmAuto').checked = s.bpmAuto;
    $('targetBpm').disabled = s.bpmAuto;
    $('targetBpm').value = s.targetBpm;
    $('transLen').value = BAR_STEPS.indexOf(s.transitionBars) + 1;
    $('transPoint').value = Math.round(s.transitionPointPct * 100);
    $('bassSwap').checked = s.bassSwap;
    $('skipIntro').checked = s.skipIntroB;
    $('proMix').checked = s.proMix;
    $('houseMode').checked = s.house;
    $('houseOpts').classList.toggle('hidden', !s.house);
    $('houseLevel').value = Math.round(s.houseLevel * 100);
    setSegActive('curveSeg', 'data-curve', s.curve);
    setSegActive('houseScopeSeg', 'data-scope', s.houseScope);
    updateAdvLabels();
  }

  function setSegActive(id, attr, value) {
    $(id).querySelectorAll('.seg-btn').forEach(function (b) {
      b.classList.toggle('seg-active', b.getAttribute(attr) === value);
    });
  }

  function updateAdvLabels() {
    var s = state.settings;
    $('targetBpmVal').textContent = s.bpmAuto
      ? 'Auto' + (state.A ? ' (' + state.A.analysis.bpm + ')' : '')
      : s.targetBpm + ' BPM';
    $('transLenVal').textContent = s.transitionBars + ' Takte';
    $('transPointVal').textContent = Math.round(s.transitionPointPct * 100) + ' %';
    $('houseLevelVal').textContent = Math.round(s.houseLevel * 100) + ' %';
  }

  // ---------------------------------------------------------- Mixen

  $('mixBtn').addEventListener('click', runMix);
  $('remixBtn').addEventListener('click', function () {
    $('result').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  async function runMix() {
    if (!state.A || !state.B || state.busy) return;
    state.busy = true;
    updateMixButton();
    $('result').classList.add('hidden');
    $('progress').classList.remove('hidden');
    $('progressText').textContent = 'Mix wird berechnet …';

    var s = state.settings;
    var opts = {
      targetBpm: s.bpmAuto ? null : s.targetBpm,
      transitionBeats: s.transitionBars * 4,
      transitionPointPct: s.transitionPointPct,
      curve: s.curve,
      bassSwap: s.bassSwap,
      skipIntroB: s.skipIntroB,
      proMix: s.proMix,
      stems: s.stems,
      house: s.house,
      houseLevel: s.houseLevel,
      houseScope: s.houseScope
    };

    try {
      // UI einen Frame atmen lassen, bevor das Rendering die CPU belegt
      await new Promise(function (r) { setTimeout(r, 60); });

      var result = await AudioEngine.renderMix(state.A, state.B, opts, function (msg) {
        $('progressText').textContent = msg;
      });

      $('progressText').textContent = 'WAV wird erstellt …';
      await new Promise(function (r) { setTimeout(r, 30); });

      var blob = AudioEngine.encodeWav(result.buffer);
      if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
      state.resultUrl = URL.createObjectURL(blob);

      var player = $('player');
      player.src = state.resultUrl;
      var dl = $('downloadBtn');
      dl.href = state.resultUrl;
      dl.setAttribute('download', buildMixFilename());

      var m = result.meta;
      $('resultMeta').innerHTML =
        '<b>' + m.targetBpm + ' BPM</b> · Übergang bei ' +
        formatTime(m.transitionStart) + ' (' + Math.round(m.transitionDuration) + ' s)' +
        ' · Gesamtlänge ' + formatTime(m.totalDuration) +
        (opts.proMix ? ' · 🧠 Pro-Mix' : '') +
        (opts.house ? ' · 🏠 House-Layer aktiv' : '');

      drawWaveform($('waveResult'), result.buffer, '#b721ff', [
        { time: m.transitionStart, color: '#ff2d78' },
        { time: m.transitionStart + m.transitionDuration, color: '#21d4fd' }
      ]);

      $('progress').classList.add('hidden');
      $('result').classList.remove('hidden');
      $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error(err);
      $('progress').classList.add('hidden');
      alert('Beim Mixen ist ein Fehler aufgetreten: ' + (err && err.message ? err.message : err));
    }
    state.busy = false;
    updateMixButton();
  }

  function buildMixFilename() {
    var clean = function (f) {
      return f.file.name.replace(/\.[^.]+$/, '').replace(/[^\w\-äöüÄÖÜß ]/g, '').slice(0, 30).trim();
    };
    return 'MixMate – ' + clean(state.A) + ' x ' + clean(state.B) + '.wav';
  }

  function formatTime(sec) {
    sec = Math.round(sec);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ---------------------------------------------------------- Style-Remix

  $('tabMix').addEventListener('click', function () { setMode('mix'); });
  $('tabStyle').addEventListener('click', function () { setMode('style'); });

  function setMode(mode) {
    state.mode = mode;
    $('tabMix').classList.toggle('tab-active', mode === 'mix');
    $('tabStyle').classList.toggle('tab-active', mode === 'style');
    $('modeMix').classList.toggle('hidden', mode !== 'mix');
    $('modeStyle').classList.toggle('hidden', mode !== 'style');
    $('result').classList.add('hidden');
  }

  // Stil-Auswahl aus der Engine-Definition aufbauen
  (function buildStylePicker() {
    var container = $('styleGroups');
    var groups = {};
    StyleEngine.STYLES.forEach(function (st) {
      (groups[st.group] = groups[st.group] || []).push(st);
    });
    Object.keys(groups).forEach(function (g) {
      var row = document.createElement('div');
      row.className = 'style-group';
      var label = document.createElement('div');
      label.className = 'style-group-label';
      label.textContent = g;
      row.appendChild(label);
      var chips = document.createElement('div');
      chips.className = 'style-chips';
      groups[g].forEach(function (st) {
        var btn = document.createElement('button');
        btn.className = 'chip style-chip';
        btn.setAttribute('data-style', st.id);
        btn.textContent = st.label + ' · ' + st.bpm;
        btn.addEventListener('click', function () {
          document.querySelectorAll('.style-chip').forEach(function (c) {
            c.classList.remove('chip-active');
          });
          btn.classList.add('chip-active');
          state.styleSettings.styleId = st.id;
          updateMixButton();
        });
        chips.appendChild(btn);
      });
      row.appendChild(chips);
      container.appendChild(row);
    });
  })();

  document.querySelectorAll('.inst-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var key = chip.getAttribute('data-inst');
      var on = !state.styleSettings.instruments[key];
      state.styleSettings.instruments[key] = on;
      chip.classList.toggle('chip-active', on);
    });
  });

  $('instLevel').addEventListener('input', function () {
    state.styleSettings.instLevel = parseInt(this.value, 10) / 100;
    $('instLevelVal').textContent = this.value + ' %';
  });
  $('beatLevel').addEventListener('input', function () {
    state.styleSettings.beatLevel = parseInt(this.value, 10) / 100;
    $('beatLevelVal').textContent = this.value + ' %';
  });
  $('keepTempo').addEventListener('change', function () {
    state.styleSettings.keepTempo = this.checked;
  });

  $('styleBtn').addEventListener('click', runStyleRemix);

  async function runStyleRemix() {
    var s = state.styleSettings;
    if (!state.S || !s.styleId || state.busy) return;
    state.busy = true;
    updateMixButton();
    $('result').classList.add('hidden');
    $('progress').classList.remove('hidden');
    $('progressText').textContent = 'Style-Remix wird berechnet …';

    try {
      await new Promise(function (r) { setTimeout(r, 60); });

      var result = await StyleEngine.renderStyleRemix(state.S, {
        styleId: s.styleId,
        beatLevel: s.beatLevel,
        instLevel: s.instLevel,
        keepTempo: s.keepTempo,
        instruments: s.instruments
      }, function (msg) { $('progressText').textContent = msg; });

      $('progressText').textContent = 'WAV wird erstellt …';
      await new Promise(function (r) { setTimeout(r, 30); });

      var blob = AudioEngine.encodeWav(result.buffer);
      if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
      state.resultUrl = URL.createObjectURL(blob);

      $('player').src = state.resultUrl;
      var dl = $('downloadBtn');
      dl.href = state.resultUrl;
      var base = state.S.file.name.replace(/\.[^.]+$/, '')
        .replace(/[^\w\-äöüÄÖÜß ]/g, '').slice(0, 30).trim();
      dl.setAttribute('download', base + ' (' + result.meta.style + ' Remix).wav');

      var m = result.meta;
      var instNames = { piano: 'Piano', guitar: 'Gitarre', pad: 'Synth-Pad', steel: 'Steel Drum' };
      var instOn = Object.keys(s.instruments)
        .filter(function (k) { return s.instruments[k]; })
        .map(function (k) { return instNames[k]; });
      $('resultMeta').innerHTML =
        '<b>' + m.style + '</b> · ' + m.targetBpm + ' BPM' +
        (m.stretch ? ' (Tempo ' + (m.stretch > 0 ? '+' : '') + m.stretch + ' %, Pitch unverändert)' : '') +
        (m.keyName ? ' · Tonart ' + m.keyName : '') +
        ' · Länge ' + formatTime(m.totalDuration) +
        (instOn.length ? ' · Instrumente: ' + instOn.join(', ') : '') +
        (m.arrangement ? '<br>Arrangement: ' + m.arrangement : '');

      drawWaveform($('waveResult'), result.buffer, '#b721ff');

      $('progress').classList.add('hidden');
      $('result').classList.remove('hidden');
      $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error(err);
      $('progress').classList.add('hidden');
      alert('Beim Remixen ist ein Fehler aufgetreten: ' + (err && err.message ? err.message : err));
    }
    state.busy = false;
    updateMixButton();
  }

  // ---------------------------------------------------------- PWA

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline optional */ });
    });
  }

  // iOS-Tipp nur auf iOS-Geräten außerhalb des Standalone-Modus zeigen
  var isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (!isIos || standalone) $('iosTip').classList.add('hidden');

  syncAdvancedUI();
})();
