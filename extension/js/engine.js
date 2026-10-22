// twoncut analysis engine.
// Audio is decoded once with FFmpeg into a 10 ms loudness envelope (dB).
// Silence detection then runs on that envelope in JS, so results update instantly as settings change.
// Errors carry a .code (see i18n.js) and an optional .detail.
var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var RATE = 100;      // envelope resolution: 100 values per second (10 ms)
var SAMPLE_RATE = 4000;
var FLOOR = -100;    // silence floor (dB)
var BURST = 0.06;    // sounds shorter than this inside a silence (clicks, breaths) are ignored

function fail(code, detail) {
  var e = new Error(code);
  e.code = code;
  e.detail = detail;
  return e;
}

function findFfmpeg() {
  try {
    var out = childProcess.execSync('where ffmpeg', { encoding: 'utf8', windowsHide: true });
    var first = out.split(/\r?\n/)[0].trim();
    if (first) return first;
  } catch (e) {}
  // winget installs may not be on the PATH of an already running Premiere
  var link = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe');
  if (fs.existsSync(link)) return link;
  var base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  try {
    var dirs = fs.readdirSync(base).filter(function (d) { return /ffmpeg/i.test(d); });
    for (var i = 0; i < dirs.length; i++) {
      var sub = fs.readdirSync(path.join(base, dirs[i]));
      for (var j = 0; j < sub.length; j++) {
        var exe = path.join(base, dirs[i], sub[j], 'bin', 'ffmpeg.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
  } catch (e) {}
  var common = ['C:\\ffmpeg\\bin\\ffmpeg.exe', 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe'];
  for (var k = 0; k < common.length; k++) if (fs.existsSync(common[k])) return common[k];
  return '';
}

// Finds Premiere's own "Waveform Audio" export preset (used to export comps / nested sequences).
// Prefers the Premiere version hosting this panel, then any installed version.
function findWavPreset() {
  var roots = [];
  var dir = path.dirname(process.execPath);
  for (var up = 0; up < 5; up++) {
    if (fs.existsSync(path.join(dir, 'MediaIO'))) { roots.push(dir); break; }
    dir = path.dirname(dir);
  }
  var adobe = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Adobe');
  try {
    fs.readdirSync(adobe).filter(function (d) { return /^Adobe Premiere Pro/i.test(d); }).sort().reverse()
      .forEach(function (d) { roots.push(path.join(adobe, d)); });
  } catch (e) {}

  for (var i = 0; i < roots.length; i++) {
    var presets = path.join(roots[i], 'MediaIO', 'systempresets');
    try {
      var waveDirs = fs.readdirSync(presets).filter(function (d) { return /_57415645$/i.test(d); }); // "WAVE" format folder
      for (var j = 0; j < waveDirs.length; j++) {
        var files = fs.readdirSync(path.join(presets, waveDirs[j])).filter(function (f) { return /\.epr$/i.test(f); });
        files.sort(function (a, b) { return (/48kHz/i.test(b) ? 1 : 0) - (/48kHz/i.test(a) ? 1 : 0); });
        if (files.length) return path.join(presets, waveDirs[j], files[0]);
      }
    } catch (e) {}
  }
  return '';
}

// Builds the loudness envelope of [start, start + duration] in file.
// Returns { promise, cancel }; onProgress(0..1) reports progress.
function decodeEnvelope(ffmpeg, file, start, duration, onProgress) {
  var proc, cancelled = false;
  var promise = new Promise(function (resolve, reject) {
    var args = [
      '-hide_banner', '-nostats', '-v', 'error',
      '-ss', String(start), '-t', String(duration),
      '-i', file,
      '-map', '0:a:0', '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE),
      '-f', 'f32le', '-'
    ];
    proc = childProcess.spawn(ffmpeg, args, { windowsHide: true });

    var hop = SAMPLE_RATE / RATE;
    var total = Math.max(1, Math.ceil(duration * RATE));
    var env = new Float32Array(total).fill(FLOOR);
    var idx = 0, acc = 0, n = 0, leftover = null, lastReport = 0, stderr = '';

    proc.stdout.on('data', function (chunk) {
      var buf = leftover ? Buffer.concat([leftover, chunk]) : chunk;
      var usable = buf.length - (buf.length % 4);
      for (var i = 0; i < usable; i += 4) {
        var v = buf.readFloatLE(i);
        acc += v * v;
        if (++n === hop) {
          if (idx < total) env[idx] = toDb(acc / n);
          idx++; acc = 0; n = 0;
        }
      }
      leftover = usable < buf.length ? buf.slice(usable) : null;
      if (onProgress && idx - lastReport > RATE * 5) { lastReport = idx; onProgress(Math.min(1, idx / total)); }
    });
    proc.stderr.on('data', function (d) { stderr += d.toString(); });
    proc.on('error', function (e) {
      reject(e.code === 'ENOENT' ? fail('E_FFMPEG_RUN', ffmpeg) : fail('E_FFMPEG_RUN', e.message));
    });
    proc.on('close', function (code) {
      if (cancelled) return reject(fail('E_CANCELLED'));
      if (n > 0 && idx < total) env[idx] = toDb(acc / n);
      if (code !== 0) {
        if (/matches no streams|does not contain any stream/i.test(stderr))
          return reject(fail('E_NO_AUDIO_STREAM', path.basename(file)));
        var last = stderr.trim().split(/\r?\n/).pop() || '';
        return reject(fail('E_FFMPEG_READ', path.basename(file) +
          (last ? ' (' + last.replace(/^\[[^\]]*\]\s*/, '').slice(0, 160) + ')' : '')));
      }
      if (onProgress) onProgress(1);
      resolve(env);
    });
  });
  return {
    promise: promise,
    cancel: function () { cancelled = true; try { proc.kill(); } catch (e) {} }
  };
}

function toDb(meanSquare) {
  return meanSquare > 1e-10 ? Math.max(FLOOR, 10 * Math.log10(meanSquare)) : FLOOR;
}

// Places a clip's envelope onto the timeline envelope; where clips overlap the loudest wins.
function mixInto(target, env, offsetSec) {
  var off = Math.round(offsetSec * RATE);
  for (var i = 0; i < env.length; i++) {
    var j = off + i;
    if (j >= 0 && j < target.length && env[i] > target[j]) target[j] = env[i];
  }
}

function emptyEnvelope(duration) {
  return new Float32Array(Math.max(1, Math.ceil(duration * RATE))).fill(FLOOR);
}

// Suggests a threshold (dB) from the noise floor and speech level. Null if there is no clear gap.
function autoThreshold(env) {
  var vals = [];
  for (var i = 0; i < env.length; i++) if (env[i] > FLOOR + 1) vals.push(env[i]);
  if (vals.length < RATE) return null;
  vals.sort(function (a, b) { return a - b; });
  var noise = vals[Math.floor(vals.length * 0.1)];
  var speech = vals[Math.floor(vals.length * 0.9)];
  var range = speech - noise;
  if (range < 12) return null;
  // At least 10 dB above the noise, at least 6 dB below speech
  var thr = Math.min(speech - 6, noise + Math.max(10, range * 0.4));
  return Math.round(Math.max(-60, Math.min(-15, thr)));
}

// Finds silences on the envelope. All returned times are seconds from the start of the envelope.
function detect(env, opts) {
  var len = env.length;
  var silent = new Uint8Array(len);
  for (var i = 0; i < len; i++) silent[i] = env[i] < opts.threshold ? 1 : 0;

  // Treat very short sounds between silences (clicks, breaths) as silence
  var burst = Math.round(BURST * RATE), runStart = -1;
  for (i = 0; i <= len; i++) {
    if (i < len && !silent[i]) { if (runStart < 0) runStart = i; continue; }
    if (runStart >= 0) {
      var bounded = runStart > 0 && i < len;
      if (bounded && i - runStart < burst) for (var k = runStart; k < i; k++) silent[k] = 1;
      runStart = -1;
    }
  }

  var silences = [], minLen = opts.minSilence * RATE;
  runStart = -1;
  for (i = 0; i <= len; i++) {
    if (i < len && silent[i]) { if (runStart < 0) runStart = i; continue; }
    if (runStart >= 0) {
      if (i - runStart >= minLen) silences.push([runStart / RATE, i / RATE]);
      runStart = -1;
    }
  }

  var duration = len / RATE;
  var keeps = computeKeeps(silences, 0, duration, opts.padding, opts.minKeep || 0.08);
  var cuts = computeCuts(keeps, duration, 0);
  var removed = 0;
  cuts.forEach(function (c) { removed += c[1] - c[0]; });
  return { cuts: cuts, keeps: keeps, removed: removed, duration: duration };
}

// Inverts silences into speech, pads each speech part and merges overlaps.
function computeKeeps(silences, inPt, outPt, padding, minKeep) {
  var speech = [];
  var cursor = inPt;
  silences.forEach(function (s) {
    if (s[0] > cursor) speech.push([cursor, s[0]]);
    cursor = Math.max(cursor, s[1]);
  });
  if (cursor < outPt) speech.push([cursor, outPt]);

  var merged = [];
  speech.forEach(function (seg) {
    var a = Math.max(inPt, seg[0] - padding);
    var b = Math.min(outPt, seg[1] + padding);
    var last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  });
  return merged.filter(function (seg) { return seg[1] - seg[0] >= minKeep; });
}

// Inverse of the kept parts: ranges to cut inside [0, duration], shifted by offset.
function computeCuts(keeps, duration, offset) {
  var cuts = [], cursor = 0;
  keeps.forEach(function (k) {
    if (k[0] > cursor) cuts.push([offset + cursor, offset + k[0]]);
    cursor = k[1];
  });
  if (cursor < duration) cuts.push([offset + cursor, offset + duration]);
  return cuts;
}

module.exports = {
  RATE: RATE, FLOOR: FLOOR,
  findFfmpeg: findFfmpeg, findWavPreset: findWavPreset, decodeEnvelope: decodeEnvelope, mixInto: mixInto, emptyEnvelope: emptyEnvelope,
  autoThreshold: autoThreshold, detect: detect, computeKeeps: computeKeeps, computeCuts: computeCuts
};
