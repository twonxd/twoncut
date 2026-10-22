// twoncut - Premiere Pro ExtendScript side.
// ExtendScript has no JSON object, so results are serialized by hand.
// Errors are returned as codes; the panel turns them into localized messages.

var SK_TICKS = 254016000000;
var SK_MARKER = 'twoncut';
var SK_MARKER_OLD = 'Sessiz Kes'; // markers created by older versions

function SK_str(s) {
  s = String(s);
  var out = '"';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i), code = s.charCodeAt(i);
    if (ch === '"' || ch === '\\') out += '\\' + ch;
    else if (code < 32 || code > 126) out += '\\u' + ('0000' + code.toString(16)).slice(-4);
    else out += ch;
  }
  return out + '"';
}

function SK_toJson(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return SK_str(v);
  var parts = [], i;
  if (v instanceof Array) {
    for (i = 0; i < v.length; i++) parts.push(SK_toJson(v[i]));
    return '[' + parts.join(',') + ']';
  }
  for (var k in v) if (v.hasOwnProperty(k)) parts.push(SK_str(k) + ':' + SK_toJson(v[k]));
  return '{' + parts.join(',') + '}';
}

function SK_error(code, detail) {
  return SK_toJson({ ok: false, code: code, detail: detail === undefined ? '' : String(detail) });
}

// Thrown inside try blocks and converted by SK_catch.
function SK_fail(code, detail) { return { skCode: code, detail: detail }; }

function SK_catch(e) {
  if (e && e.skCode) return SK_error(e.skCode, e.detail);
  return SK_error('E_GENERIC', (e && e.message ? e.message : String(e)) + (e && e.line ? ' (line ' + e.line + ')' : ''));
}

function SK_frameDur(seq) { return parseInt(seq.timebase, 10) / SK_TICKS; }

function SK_ping() { return SK_toJson({ ok: true }); }

// --- Pure helpers (testable without Premiere) ---

// Rounds ranges inward to frame boundaries so only the inside of a silence is removed.
function SK_alignRanges(ranges, frameDur) {
  var out = [];
  for (var i = 0; i < ranges.length; i++) {
    var a = Math.ceil(ranges[i][0] / frameDur - 1e-6) * frameDur;
    var b = Math.floor(ranges[i][1] / frameDur + 1e-6) * frameDur;
    if (b - a >= frameDur - 1e-9) out.push([a, b]);
  }
  out.sort(function (x, y) { return x[0] - y[0]; });
  return out;
}

// Total length removed before a clip's original start.
function SK_removedBefore(ranges, t, eps) {
  var sum = 0;
  for (var i = 0; i < ranges.length; i++) if (ranges[i][1] <= t + eps) sum += ranges[i][1] - ranges[i][0];
  return sum;
}

function SK_insideAny(ranges, start, end, eps) {
  for (var i = 0; i < ranges.length; i++)
    if (start >= ranges[i][0] - eps && end <= ranges[i][1] + eps) return true;
  return false;
}

// --- Sequence and selection ---

// Makes sure the analyzed sequence is still the active one.
function SK_activeSeq(seqId) {
  var seq = app.project.activeSequence;
  if (!seq) throw SK_fail('E_NO_SEQ');
  if (seqId && seq.sequenceID !== seqId) throw SK_fail('E_SEQ_CHANGED');
  return seq;
}

// Finds the tracks and time range of the selected clips, and the audio sources that can be read directly.
function SK_selectionInfo(seq) {
  var info = { video: [], audio: [], start: Infinity, end: -Infinity, count: 0, sources: [], direct: true };
  var groups = [['video', seq.videoTracks], ['audio', seq.audioTracks]];
  for (var g = 0; g < groups.length; g++) {
    var tracks = groups[g][1];
    for (var t = 0; t < tracks.numTracks; t++) {
      var clips = tracks[t].clips, used = false;
      for (var i = 0; i < clips.numItems; i++) {
        var c = clips[i];
        if (!c.isSelected()) continue;
        used = true;
        info.count++;
        info.start = Math.min(info.start, c.start.seconds);
        info.end = Math.max(info.end, c.end.seconds);
        if (groups[g][0] === 'audio') {
          var src = SK_directSource(c);
          if (src) info.sources.push(src);
          else info.direct = false;
        }
      }
      if (used) info[groups[g][0]].push(t);
    }
  }
  return info;
}

// Returns source info if the audio clip can be read straight from its media file.
// AE comps, nested sequences and speed-changed clips return null (they are analyzed via export).
function SK_directSource(c) {
  try {
    var pi = c.projectItem;
    if (!pi || (pi.isSequence && pi.isSequence())) return null;
    var speed = c.getSpeed();
    if (Math.abs(speed - 1) > 0.001) return null;
    var p = pi.getMediaPath();
    if (!p || /\.(aep|aepx|prproj)$/i.test(p) || !new File(p).exists) return null;
    return { name: c.name, path: p, inPt: c.inPoint.seconds, outPt: c.outPoint.seconds, start: c.start.seconds };
  } catch (e) {
    return null;
  }
}

// Reads the selection. If it contains comps or nested sequences, exports its audio as WAV;
// unselected audio tracks are muted meanwhile so music etc. doesn't affect detection.
function SK_prepare(wavPath, presetPath) {
  var seq = app.project.activeSequence;
  if (!seq) return SK_error('E_NO_SEQ');
  var sel = SK_selectionInfo(seq);
  if (!sel.count) return SK_error('E_NO_SELECTION');
  if (!sel.audio.length) return SK_error('E_NO_AUDIO');

  var result = {
    ok: true,
    mode: sel.direct ? 'direct' : 'export',
    seqId: seq.sequenceID,
    seqName: seq.name,
    start: sel.start,
    end: sel.end,
    frameDur: SK_frameDur(seq),
    video: sel.video,
    audio: sel.audio,
    count: sel.count,
    sources: sel.sources
  };
  if (sel.direct) return SK_toJson(result);

  var oldIn = seq.getInPoint(), oldOut = seq.getOutPoint();
  var mutes = [], t, exportResult;
  try {
    if (!new File(presetPath).exists) return SK_error('E_PRESET_MISSING', presetPath);
    for (t = 0; t < seq.audioTracks.numTracks; t++) {
      var track = seq.audioTracks[t];
      mutes.push(track.isMuted());
      var isSel = false;
      for (var k = 0; k < sel.audio.length; k++) if (sel.audio[k] === t) isSel = true;
      if (!isSel) track.setMute(1);
    }
    seq.setInPoint(sel.start);
    seq.setOutPoint(sel.end);
    var f = new File(wavPath);
    if (f.exists) f.remove();
    exportResult = seq.exportAsMediaDirect(wavPath, presetPath, 1);
    if (!new File(wavPath).exists) return SK_error('E_EXPORT_FAILED', exportResult || '-');
  } catch (e) {
    return SK_error('E_EXPORT_ERROR', e.toString());
  } finally {
    for (t = 0; t < mutes.length; t++) seq.audioTracks[t].setMute(mutes[t] ? 1 : 0);
    seq.setInPoint(parseFloat(oldIn));
    seq.setOutPoint(parseFloat(oldOut));
  }
  return SK_toJson(result);
}

// --- Markers ---

function SK_eachMarker(seq, fn) {
  var markers = seq.markers, m = markers.getFirstMarker();
  while (m) {
    var next = markers.getNextMarker(m);
    if (m.name === SK_MARKER || m.name === SK_MARKER_OLD) fn(m, markers);
    m = next;
  }
}

function SK_deleteMarkers(seq) {
  var n = 0;
  SK_eachMarker(seq, function (m, markers) { markers.deleteMarker(m); n++; });
  return n;
}

// Marks the ranges to cut with red markers (removes earlier twoncut markers first).
function SK_addMarkers(planJson) {
  try {
    var plan = eval('(' + planJson + ')');
    var seq = SK_activeSeq(plan.seqId);
    var ranges = SK_alignRanges(plan.ranges, SK_frameDur(seq));
    SK_deleteMarkers(seq);
    for (var i = 0; i < ranges.length; i++) {
      var m = seq.markers.createMarker(ranges[i][0]);
      m.name = SK_MARKER;
      m.end = ranges[i][1];
      try { m.setColorByIndex(1); } catch (e) {}
    }
    return SK_toJson({ ok: true, count: ranges.length });
  } catch (e) {
    return SK_catch(e);
  }
}

function SK_clearMarkers(seqId) {
  try {
    return SK_toJson({ ok: true, count: SK_deleteMarkers(SK_activeSeq(seqId)) });
  } catch (e) {
    return SK_catch(e);
  }
}

// --- Cutting ---

function SK_cut(planJson) {
  try {
    var plan = eval('(' + planJson + ')');
    var seq = SK_activeSeq(plan.seqId);
    var ranges = plan.ranges;

    if (plan.fromMarkers) {
      // Markers the user reviewed on the timeline become the cut list
      ranges = [];
      SK_eachMarker(seq, function (m) {
        var a = m.start.seconds, b = m.end.seconds;
        if (b > a && a >= plan.start - 0.001) ranges.push([a, b]);
      });
      if (!ranges.length) return SK_error('E_NO_MARKERS_SEL');
    }
    return SK_toJson(SK_doCut(seq, ranges, plan));
  } catch (e) {
    return SK_catch(e);
  }
}

function SK_doCut(seq, rawRanges, plan) {
  var frameDur = SK_frameDur(seq);
  var eps = frameDur / 2;
  var ranges = SK_alignRanges(rawRanges, frameDur);
  if (!ranges.length) throw SK_fail('E_NOTHING_TO_CUT');

  var backupName = null, backupId = null;
  if (plan.backup) {
    var before = {}, n;
    for (n = 0; n < app.project.sequences.numSequences; n++) before[app.project.sequences[n].sequenceID] = true;
    seq.clone();
    for (n = 0; n < app.project.sequences.numSequences; n++) {
      var s = app.project.sequences[n];
      if (!before[s.sequenceID]) {
        s.name = seq.name + (plan.backupSuffix || ' (backup)');
        backupName = s.name; backupId = s.sequenceID;
        break;
      }
    }
    app.project.openSequence(seq.sequenceID);
  }

  var tracks = [], i, r, t;
  for (i = 0; i < plan.video.length; i++) tracks.push({ kind: 'v', idx: plan.video[i], track: seq.videoTracks[plan.video[i]] });
  for (i = 0; i < plan.audio.length; i++) tracks.push({ kind: 'a', idx: plan.audio[i], track: seq.audioTracks[plan.audio[i]] });

  // 1) Razor at every silence boundary
  app.enableQE();
  var qeSeq = qe.project.getActiveSequence();
  var settings = seq.getSettings();
  var time = new Time();
  for (r = 0; r < ranges.length; r++) {
    for (var edge = 0; edge < 2; edge++) {
      time.seconds = ranges[r][edge];
      var tc = time.getFormatted(settings.videoFrameRate, settings.videoDisplayFormat);
      for (t = 0; t < tracks.length; t++) {
        var qt = tracks[t].kind === 'v' ? qeSeq.getVideoTrackAt(tracks[t].idx) : qeSeq.getAudioTrackAt(tracks[t].idx);
        qt.razor(tc);
      }
    }
  }

  // 2) Remove the silent pieces and work out where the rest should go
  var toRemove = [], toMove = [];
  for (t = 0; t < tracks.length; t++) {
    var clips = tracks[t].track.clips;
    for (i = 0; i < clips.numItems; i++) {
      var c = clips[i], st = c.start.seconds, en = c.end.seconds;
      if (en <= plan.start + eps) continue;
      if (SK_insideAny(ranges, st, en, eps)) toRemove.push(c);
      else toMove.push({ item: c, target: st - SK_removedBefore(ranges, st, eps) });
    }
  }
  var removed = 0;
  for (i = 0; i < toRemove.length; i++) {
    try { toRemove[i].remove(false, false); removed++; } catch (e) {}
  }

  // 3) Close the gaps left to right. If a linked clip already moved along, its delta is 0.
  toMove.sort(function (x, y) { return x.target - y.target; });
  var moved = 0, mismatch = 0, shift = new Time();
  for (i = 0; i < toMove.length; i++) {
    try {
      var delta = toMove[i].target - toMove[i].item.start.seconds;
      if (Math.abs(delta) < eps) continue;
      shift.seconds = delta;
      toMove[i].item.move(shift);
      moved++;
      if (Math.abs(toMove[i].item.start.seconds - toMove[i].target) > eps) mismatch++;
    } catch (e) { mismatch++; }
  }

  // Marker positions are meaningless after the cut
  try { SK_deleteMarkers(seq); } catch (e) {}

  var total = 0;
  for (r = 0; r < ranges.length; r++) total += ranges[r][1] - ranges[r][0];
  return {
    ok: true, cuts: ranges.length, removed: removed, moved: moved, mismatch: mismatch, saved: total,
    seqId: seq.sequenceID, seqName: seq.name, backup: backupName, backupId: backupId
  };
}

// --- Undo ---

// Deletes the cut sequence and brings the backup back under the original name.
function SK_undo(infoJson) {
  try {
    var info = eval('(' + infoJson + ')');
    var cut = null, bak = null;
    for (var n = 0; n < app.project.sequences.numSequences; n++) {
      var s = app.project.sequences[n];
      if (s.sequenceID === info.seqId) cut = s;
      if (s.sequenceID === info.backupId) bak = s;
    }
    if (!bak) return SK_error('E_NO_BACKUP');

    var name = cut ? cut.name : info.seqName;
    app.project.openSequence(bak.sequenceID);
    var kept = false;
    if (cut) {
      try { app.project.deleteSequence(cut); }
      catch (e) { cut.name = name + (info.cutSuffix || ' (cut)'); kept = true; }
    }
    bak.name = name;
    app.project.openSequence(bak.sequenceID);
    return SK_toJson({ ok: true, name: name, keptCut: kept });
  } catch (e) {
    return SK_error('E_UNDO', e.message || e.toString());
  }
}
