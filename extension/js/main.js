(function () {
  // Inside Premiere the panel uses CEP + Node; a browser test harness can provide window.SK_API instead.
  var api = window.SK_API || cepApi();
  var E = api.engine;
  var t = I18N.t;

  function cepApi() {
    var nodePath = require('path'), os = require('os'), fs = require('fs');
    var extDir = nodePath.dirname(decodeURIComponent(window.location.pathname).replace(/^\/([A-Za-z]:)/, '$1'));
    var cep = window.__adobe_cep__;
    var engine = require(nodePath.join(extDir, 'js', 'engine.js'));
    return {
      engine: engine,
      presetPath: engine.findWavPreset().replace(/\\/g, '/'),
      tmpWav: function () { return nodePath.join(os.tmpdir(), 'twoncut_' + Date.now() + '.wav').replace(/\\/g, '/'); },
      unlink: function (p) { try { fs.unlinkSync(p); } catch (e) {} },
      basename: function (p) { return nodePath.basename(p); },
      hostLocale: function () {
        try { return JSON.parse(cep.getHostEnvironment()).appUILocale; } catch (e) { return navigator.language; }
      },
      host: function (fn, args) {
        var script = fn + '(' + args.map(function (a) { return JSON.stringify(a); }).join(',') + ')';
        return new Promise(function (resolve) {
          cep.evalScript(script, function (raw) {
            try { resolve(JSON.parse(raw)); } catch (e) {
              resolve(raw === 'EvalScript error.' ? { ok: false, code: 'E_SCRIPT' } : { ok: false, code: 'E_BAD_REPLY', detail: raw });
            }
          });
        });
      }
    };
  }

  var $ = function (id) { return document.getElementById(id); };
  var S = { analysis: null, result: null, job: null, running: false, cancelled: false, hoverX: null, undo: null };

  var SLIDERS = { threshold: 'unitDb', minSilence: 'unitSec', padding: 'unitSec' };
  var COLORS = { violet: '#8b5cf6', blue: '#60a5fa', cut: '#fb7185' };

  // --- Helpers ---

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem('sk_' + key);
      localStorage.setItem('sk_' + key, val);
    } catch (e) { return null; }
  }

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    var ss = (s < 10 ? '0' : '') + s;
    return h ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
  }

  function fmtPrecise(sec) {
    var m = Math.floor(sec / 60), s = sec - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  function num(id) { return parseFloat($(id).value); }

  // Error from the host script or the engine → localized message.
  function errorText(e) {
    if (!e) return t('E_GENERIC', { detail: '?' });
    if (e.code) return t(e.code, { detail: e.detail !== undefined ? e.detail : '' });
    return t('E_GENERIC', { detail: e.message || String(e) });
  }

  function icon(name, cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg'), use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    if (cls) svg.setAttribute('class', cls);
    return svg;
  }

  function setIcon(svgEl, name) { svgEl.firstElementChild.setAttribute('href', '#i-' + name); }

  function log(msg, cls) {
    var line = document.createElement('div');
    if (cls) line.className = cls;
    var d = new Date();
    line.textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2) + '  ' + msg;
    $('log').appendChild(line);
    $('log').scrollTop = $('log').scrollHeight;
  }

  // type: info | ok | err | warn | busy
  var TOAST_ICONS = { info: 'info', ok: 'check', err: 'alert', warn: 'alert' };
  function status(type, msg, action) {
    var el = $('status');
    el.className = 'toast ' + type;
    el.innerHTML = '';
    if (type === 'busy') { var sp = document.createElement('span'); sp.className = 'spinner'; el.appendChild(sp); }
    else el.appendChild(icon(TOAST_ICONS[type], 't-icon'));
    var text = document.createElement('div'); text.className = 't-text'; text.textContent = msg;
    if (action) {
      var a = document.createElement('button');
      a.className = 't-action'; a.textContent = action.label; a.onclick = action.fn;
      text.appendChild(a);
    }
    el.appendChild(text);
    if (type !== 'busy') {
      var close = document.createElement('button');
      close.className = 't-close'; close.title = t('close');
      close.appendChild(icon('x'));
      close.onclick = function () { el.classList.add('hidden'); };
      el.appendChild(close);
    }
    log(msg, type === 'err' ? 'err' : type === 'ok' ? 'ok' : '');
  }

  function progress(p) {
    $('progressFill').style.width = p == null ? '0' : Math.round(Math.min(1, p) * 100) + '%';
  }

  function refreshButtons() {
    var ready = !!(S.analysis && S.result && S.result.cuts.length);
    var locked = !!S.running;
    $('analyze').disabled = S.running === 'host';
    $('cut').disabled = locked || !ready;
    $('addMarkers').disabled = locked || !ready;
    $('cutMarkers').disabled = locked || !S.analysis;
    $('clearMarkers').disabled = locked;
    $('autoThr').disabled = locked || !S.analysis;
    $('undo').disabled = locked || !S.undo;
    $('undo').title = S.undo ? t('undoTitle', { name: S.undo.seqName }) : t('undoNone');
    $('cutLabel').textContent = t('cutBtn') + (ready ? ' · ' + S.result.cuts.length : '');
  }

  $('toggleAdvanced').addEventListener('click', function () {
    var hidden = $('advanced').classList.toggle('hidden');
    $('toggleAdvanced').classList.toggle('active', !hidden);
  });

  // --- Language ---

  function renderSelInfo() {
    var el = $('selInfo');
    if (S.analysis) {
      var sel = S.analysis.sel;
      var tracks = sel.video.map(function (n) { return 'V' + (n + 1); }).concat(sel.audio.map(function (n) { return 'A' + (n + 1); }));
      el.textContent = t('selInfo', { n: sel.count, dur: fmt(S.analysis.dur), tracks: tracks.join(' ') });
      el.classList.add('ok');
    } else {
      el.textContent = S.afterCut ? t('afterCut') : t('selHint');
      el.classList.remove('ok');
    }
  }

  function setLanguage(lang) {
    I18N.set(lang);
    store('lang', lang);
    I18N.apply();
    Array.prototype.forEach.call($('langSwitch').children, function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    $('status').classList.add('hidden');
    renderSelInfo();
    if (!S.running) setAnalyzeRunning(false);
    syncControls();
    recompute();
  }

  Object.keys(I18N.languages).forEach(function (code) {
    var b = document.createElement('button');
    b.textContent = I18N.languages[code];
    b.setAttribute('data-lang', code);
    b.onclick = function () { setLanguage(code); };
    $('langSwitch').appendChild(b);
  });

  // --- Settings ---

  function opts() {
    var fd = S.analysis ? S.analysis.sel.frameDur : 1 / 30;
    return { threshold: num('threshold'), minSilence: num('minSilence'), padding: num('padding'), minKeep: Math.max(fd * 2, 0.08) };
  }

  function syncControls() {
    Object.keys(SLIDERS).forEach(function (id) {
      var el = $(id);
      $(id + 'Val').textContent = el.value + t(SLIDERS[id]);
      el.style.setProperty('--pct', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
    });
  }

  function onSettingsChanged() {
    syncControls();
    Object.keys(SLIDERS).forEach(function (id) { store(id, $(id).value); });
    scheduleRecompute();
  }

  Object.keys(SLIDERS).forEach(function (id) {
    var saved = store(id);
    if (saved !== null && saved !== undefined) $(id).value = saved;
    $(id).addEventListener('input', onSettingsChanged);
  });

  $('autoThr').addEventListener('click', function () {
    if (!S.analysis) return;
    var db = E.autoThreshold(S.analysis.env);
    if (db === null) { status('warn', t('autoNoFloor')); return; }
    $('threshold').value = db;
    onSettingsChanged();
    status('info', t('autoSet', { db: db }));
  });

  var backupSaved = store('backup');
  if (backupSaved !== null && backupSaved !== undefined) $('backup').checked = backupSaved === '1';
  $('backup').addEventListener('change', function () { store('backup', $('backup').checked ? '1' : '0'); });

  $('ffmpegPath').value = store('ffmpeg') || E.findFfmpeg();
  $('ffmpegPath').addEventListener('change', function () { store('ffmpeg', $('ffmpegPath').value.trim()); });

  // --- Preview ---

  var rafPending = false;
  function scheduleRecompute() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; recompute(); });
  }

  function recompute() {
    if (!S.analysis) {
      S.result = null;
      ['sAfter', 'sCuts', 'sSaved'].forEach(function (id) { $(id).textContent = '–'; });
      $('sBefore').textContent = '';
    } else {
      S.result = E.detect(S.analysis.env, opts());
      var d = S.analysis.dur, rm = S.result.removed, pct = d > 0 ? rm / d * 100 : 0;
      $('sBefore').textContent = '/ ' + fmt(d);
      $('sAfter').textContent = fmt(d - rm);
      $('sSaved').textContent = fmt(rm);
      var p = document.createElement('span');
      p.className = 'pct';
      p.textContent = Math.round(pct) + '%';
      $('sSaved').appendChild(p);
      $('sCuts').textContent = S.result.cuts.length;
    }
    refreshButtons();
    draw();
  }

  function cutAt(sec) {
    var cuts = S.result ? S.result.cuts : [];
    for (var i = 0; i < cuts.length; i++) if (sec >= cuts[i][0] && sec <= cuts[i][1]) return true;
    return false;
  }

  function draw() {
    var canvas = $('wave');
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var a = S.analysis;
    $('waveEmpty').classList.toggle('hidden', !!a);
    $('tEnd').textContent = a ? fmt(a.dur) : '';
    if (!a) return;

    var env = a.env, len = env.length, cuts = S.result ? S.result.cuts : [];
    var MIN_DB = -60, mid = h / 2, amp = h / 2 - 8;
    var level = function (db) { return Math.max(0, Math.min(1, (db - MIN_DB) / -MIN_DB)); };

    // Regions to cut: soft red background
    cuts.forEach(function (c) {
      var x0 = c[0] / a.dur * w, x1 = c[1] / a.dur * w;
      ctx.fillStyle = 'rgba(251, 113, 133, 0.10)';
      ctx.fillRect(x0, 0, Math.max(1, x1 - x0), h);
    });

    // Waveform: 2 px bars, kept parts in the violet → blue gradient, cut parts red
    var grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, COLORS.violet);
    grad.addColorStop(1, COLORS.blue);
    var BAR = 2, GAP = 1, step = BAR + GAP;
    for (var x = 0; x < w; x += step) {
      var f0 = Math.floor(x / w * len), f1 = Math.max(f0 + 1, Math.floor((x + step) / w * len));
      var peak = E.FLOOR;
      for (var f = f0; f < f1 && f < len; f++) if (env[f] > peak) peak = env[f];
      var bar = Math.max(1, level(peak) * amp);
      var inCut = cutAt((x + BAR / 2) / w * a.dur);
      ctx.fillStyle = inCut ? COLORS.cut : grad;
      ctx.globalAlpha = inCut ? 0.5 : 1;
      ctx.fillRect(x, mid - bar, BAR, bar * 2);
    }
    ctx.globalAlpha = 1;

    // Threshold line
    var ty = level(num('threshold')) * amp;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(mid - ty) + 0.5); ctx.lineTo(w, Math.round(mid - ty) + 0.5);
    ctx.moveTo(0, Math.round(mid + ty) - 0.5); ctx.lineTo(w, Math.round(mid + ty) - 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hover cursor
    if (S.hoverX !== null) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(Math.round(S.hoverX), 0, 1, h);
    }
  }

  $('wave').addEventListener('mousemove', function (e) {
    if (!S.analysis) return;
    var r = this.getBoundingClientRect();
    S.hoverX = Math.max(0, Math.min(r.width, e.clientX - r.left));
    var sec = S.hoverX / r.width * S.analysis.dur;
    var tip = $('waveTip'), cut = cutAt(sec);
    tip.textContent = fmtPrecise(S.analysis.sel.start + sec) + (cut ? t('waveTipCut') : '');
    tip.className = 'wave-tip' + (cut ? ' cut' : '');
    tip.style.left = Math.max(40, Math.min(r.width - 40, S.hoverX)) + 'px';
    draw();
  });
  $('wave').addEventListener('mouseleave', function () {
    S.hoverX = null;
    $('waveTip').classList.add('hidden');
    draw();
  });

  window.addEventListener('resize', draw);

  // --- 1. Analyze ---

  function setAnalyzeRunning(on) {
    $('analyze').classList.toggle('running', on);
    $('analyzeLabel').textContent = on ? t('cancel') : (S.analysis ? t('reanalyze') : t('analyze'));
    setIcon($('analyzeIcon'), on ? 'stop' : (S.analysis ? 'refresh' : 'play'));
    $('analyzeIcon').style.fill = S.analysis && !on ? 'none' : '';
    $('analyzeIcon').style.stroke = S.analysis && !on ? 'currentColor' : '';
    if (!on) progress(null);
  }

  $('analyze').addEventListener('click', async function () {
    if (S.running === 'prepare' || S.running === 'analyze') {
      S.cancelled = true;
      if (S.job) S.job.cancel();
      $('analyzeLabel').textContent = t('cancelling');
      return;
    }
    var ffmpeg = $('ffmpegPath').value.trim();
    if (!ffmpeg) {
      status('err', t('noFfmpeg'));
      $('advanced').classList.remove('hidden'); $('toggleAdvanced').classList.add('active');
      return;
    }

    S.analysis = null; S.cancelled = false; S.afterCut = false;
    renderSelInfo();
    recompute();
    var wav = api.tmpWav();
    try {
      S.running = 'prepare';
      setAnalyzeRunning(true);
      refreshButtons();
      status('busy', t('readingSel'));
      var sel = await api.host('SK_prepare', [wav, api.presetPath]);
      if (!sel.ok) { status('err', errorText(sel)); return; }
      if (S.cancelled) { status('info', t('analyzeCancelled')); return; }

      S.running = 'analyze';
      refreshButtons();
      var dur = sel.end - sel.start, env;
      if (sel.mode === 'direct') {
        // Each audio clip is read from its source file and placed at its timeline position
        env = E.emptyEnvelope(dur);
        for (var i = 0; i < sel.sources.length; i++) {
          if (S.cancelled) throw { code: 'E_CANCELLED' };
          var src = sel.sources[i];
          status('busy', t('readingAudio', { file: api.basename(src.path) }) + (sel.sources.length > 1 ? ' (' + (i + 1) + '/' + sel.sources.length + ')' : ''));
          S.job = E.decodeEnvelope(ffmpeg, src.path, src.inPt, src.outPt - src.inPt, (function (i) {
            return function (p) { progress((i + p) / sel.sources.length); };
          })(i));
          E.mixInto(env, await S.job.promise, src.start - sel.start);
        }
      } else {
        status('busy', t('readingComp'));
        S.job = E.decodeEnvelope(ffmpeg, wav, 0, dur, progress);
        env = await S.job.promise;
      }

      S.analysis = { sel: sel, env: env, dur: dur };
      renderSelInfo();
      recompute();

      var cuts = S.result.cuts.length;
      var suggestion = E.autoThreshold(env);
      if (!cuts) status('warn', t('noneFound'));
      else status('ok', t('found', { n: cuts, saved: fmt(S.result.removed) }));
      if (suggestion !== null && Math.abs(suggestion - num('threshold')) >= 5) log(t('suggest', { db: suggestion }));
    } catch (e) {
      if (S.cancelled) status('info', t('analyzeCancelled'));
      else status('err', errorText(e));
    } finally {
      api.unlink(wav);
      S.job = null; S.running = false;
      setAnalyzeRunning(false);
      refreshButtons();
    }
  });

  // --- 2. Apply ---

  function plan(extra) {
    var sel = S.analysis.sel;
    var p = {
      seqId: sel.seqId, video: sel.video, audio: sel.audio, start: sel.start,
      backup: $('backup').checked, backupSuffix: t('backupSuffix'),
      ranges: (S.result ? S.result.cuts : []).map(function (c) { return [c[0] + sel.start, c[1] + sel.start]; })
    };
    for (var k in extra) p[k] = extra[k];
    return JSON.stringify(p);
  }

  async function runCut(fromMarkers) {
    if (!S.analysis) return;
    S.running = 'host';
    refreshButtons();
    var what = fromMarkers ? t('markersWord') : t('cutsCount', { n: S.result.cuts.length });
    status('busy', t('cutting', { what: what }));
    var res = await api.host('SK_cut', [plan({ fromMarkers: !!fromMarkers })]);
    S.running = false;
    if (!res.ok) { status('err', errorText(res)); refreshButtons(); return; }

    // The timeline changed, so the old analysis no longer applies
    S.analysis = null;
    S.afterCut = true;
    renderSelInfo();
    setAnalyzeRunning(false);
    recompute();
    setUndo(res.backupId ? { seqId: res.seqId, backupId: res.backupId, seqName: res.seqName } : null);
    var msg = t('cutDone', { n: res.cuts, saved: fmt(res.saved) });
    if (!res.backupId) msg += t('noBackupNote');
    var undoAction = res.backupId ? { label: t('undo'), fn: undo } : null;
    if (res.mismatch) status('warn', msg + t('mismatch', { n: res.mismatch }), undoAction);
    else status('ok', msg, undoAction);
  }

  $('cut').addEventListener('click', function () { runCut(false); });
  $('cutMarkers').addEventListener('click', function () { runCut(true); });

  $('addMarkers').addEventListener('click', async function () {
    if (!S.analysis) return;
    S.running = 'host'; refreshButtons();
    var res = await api.host('SK_addMarkers', [plan()]);
    S.running = false; refreshButtons();
    if (!res.ok) { status('err', errorText(res)); return; }
    status('ok', t('markersAdded', { n: res.count }));
  });

  $('clearMarkers').addEventListener('click', async function () {
    var res = await api.host('SK_clearMarkers', [S.analysis ? S.analysis.sel.seqId : '']);
    if (!res.ok) { status('err', errorText(res)); return; }
    status('info', res.count ? t('markersCleared', { n: res.count }) : t('noMarkers'));
  });

  // --- Undo ---

  function setUndo(info) {
    S.undo = info;
    store('undo', info ? JSON.stringify(info) : '');
    refreshButtons();
  }

  try { var savedUndo = store('undo'); if (savedUndo) S.undo = JSON.parse(savedUndo); } catch (e) {}

  async function undo() {
    if (!S.undo || S.running) return;
    S.running = 'host'; refreshButtons();
    status('busy', t('undoing'));
    var info = {};
    for (var k in S.undo) info[k] = S.undo[k];
    info.cutSuffix = t('cutSuffix');
    var res = await api.host('SK_undo', [JSON.stringify(info)]);
    S.running = false;
    if (!res.ok) { status('err', errorText(res)); refreshButtons(); return; }
    setUndo(null);
    S.analysis = null; S.afterCut = false;
    renderSelInfo();
    setAnalyzeRunning(false);
    recompute();
    status('ok', t('undone', { name: res.name }) + (res.keptCut ? t('keptCut') : ''));
  }

  $('undo').addEventListener('click', undo);

  // --- Start ---
  setLanguage(store('lang') || I18N.fromLocale(api.hostLocale ? api.hostLocale() : navigator.language));
})();
