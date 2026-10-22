// UI strings for every supported language. Placeholders look like {name}.
(function () {
  var STRINGS = {
    en: {
      // Layout
      gearTitle: 'Advanced settings',
      advanced: 'Advanced',
      language: 'Language',
      ffmpegPath: 'FFmpeg path',
      ffmpegPlaceholder: 'auto-detected',
      clearMarkers: 'Clear twoncut markers',
      log: 'Log',
      logEmpty: 'No entries yet',
      selection: 'Selection',
      selHint: 'Select the clips to cut on the timeline',
      selInfo: '{n} clips · {dur} · {tracks}',
      analyze: 'Analyze',
      reanalyze: 'Re-analyze',
      cancel: 'Cancel',
      cancelling: 'Cancelling…',
      preview: 'Preview',
      keep: 'Keep',
      cutLegend: 'Cut',
      waveEmpty: 'Appears here after analysis',
      waveTipCut: ' · cut',
      saved: 'Saved',
      newLength: 'New length',
      cuts: 'Cuts',
      settings: 'Settings',
      threshold: 'Threshold',
      auto: 'Auto',
      autoTitle: 'Set the threshold from the recording\'s noise level',
      minSilence: 'Min. silence',
      padding: 'Padding',
      unitDb: ' dB',
      unitSec: ' s',
      backup: 'Back up before cutting',
      backupHint: '(for undo)',
      addMarkers: 'Mark with markers',
      addMarkersTitle: 'Place red markers where cuts will happen, then delete the ones you want to keep',
      cutMarkers: 'Cut from markers',
      cutMarkersTitle: 'Cut the twoncut markers left on the timeline',
      cutBtn: 'Cut silences',
      undoTitle: 'Undo last cut: {name}',
      undoNone: 'Nothing to undo',
      close: 'Close',
      backupSuffix: ' (backup)',
      cutSuffix: ' (cut)',

      // Status
      readingSel: 'Reading selection…',
      readingAudio: 'Reading audio: {file}',
      readingComp: 'Reading comp / nested sequence audio…',
      analyzeCancelled: 'Analysis cancelled.',
      noFfmpeg: 'FFmpeg not found. Set the ffmpeg.exe path in the settings (top right).',
      found: 'Found {n} silences, the video will be {saved} shorter. The preview updates as you change settings.',
      noneFound: 'No silence found with these settings. Raise the threshold or press "Auto".',
      suggest: 'Suggested threshold: {db} dB (apply with "Auto")',
      autoNoFloor: 'No clear noise floor in this recording, threshold unchanged.',
      autoSet: 'Threshold set to {db} dB from the recording\'s level.',
      cutting: 'Cutting ({what})… This can take a while on long timelines.',
      cutsCount: '{n} cuts',
      markersWord: 'markers',
      cutDone: 'Cut {n} silences, the video is {saved} shorter.',
      noBackupNote: ' Backup was off; use Ctrl+Z in Premiere to undo.',
      mismatch: ' Note: {n} clips didn\'t land exactly, check the timeline.',
      undo: 'Undo',
      afterCut: 'Cut done. Select again and analyze for a new cut.',
      markersAdded: 'Added {n} red markers. Delete the ones you want to keep, then "Cut from markers".',
      markersCleared: 'Removed {n} twoncut markers.',
      noMarkers: 'No twoncut markers to remove.',
      undoing: 'Undoing…',
      undone: '"{name}" is back to how it was before the cut.',
      keptCut: ' The cut version is kept as "(cut)".',

      // Errors
      E_NO_SEQ: 'No open sequence. Open a sequence first.',
      E_SEQ_CHANGED: 'The analyzed sequence isn\'t open. Go back to it or analyze again.',
      E_NO_SELECTION: 'No clips selected on the timeline. Select the clips to cut (video, AE comp or nested sequence).',
      E_NO_AUDIO: 'The selection has no audio. Select the clip\'s audio too (turn on Linked Selection).',
      E_PRESET_MISSING: 'WAV export preset not found: {detail}. Reinstall the panel.',
      E_EXPORT_FAILED: 'Couldn\'t export the audio (Premiere: {detail}). If the selection has an AE comp, make sure After Effects is installed and the project opens, or right-click the comp › Render and Replace and try again.',
      E_EXPORT_ERROR: 'Export error: {detail}',
      E_NO_MARKERS_SEL: 'No twoncut markers in the selection. Mark them first with "Mark with markers".',
      E_NOTHING_TO_CUT: 'Nothing to cut.',
      E_NO_BACKUP: 'Backup sequence not found (it may have been deleted). Use Ctrl+Z in Premiere.',
      E_UNDO: 'Couldn\'t undo: {detail}',
      E_SCRIPT: 'Premiere script didn\'t load. Restart Premiere.',
      E_BAD_REPLY: 'Couldn\'t read Premiere\'s reply: {detail}',
      E_FFMPEG_RUN: 'Couldn\'t run FFmpeg: {detail}',
      E_CANCELLED: 'Cancelled.',
      E_NO_AUDIO_STREAM: 'This clip has no audio: {detail}',
      E_FFMPEG_READ: 'FFmpeg couldn\'t read this file: {detail}',
      E_GENERIC: 'Error: {detail}'
    },

    tr: {
      gearTitle: 'Gelişmiş ayarlar',
      advanced: 'Gelişmiş',
      language: 'Dil',
      ffmpegPath: 'FFmpeg yolu',
      ffmpegPlaceholder: 'otomatik bulunur',
      clearMarkers: 'twoncut marker\'larını temizle',
      log: 'Kayıt',
      logEmpty: 'Henüz kayıt yok',
      selection: 'Seçim',
      selHint: 'Timeline\'da kesilecek klipleri seç',
      selInfo: '{n} klip · {dur} · {tracks}',
      analyze: 'Analiz et',
      reanalyze: 'Yeniden analiz et',
      cancel: 'İptal',
      cancelling: 'İptal ediliyor…',
      preview: 'Önizleme',
      keep: 'Kalır',
      cutLegend: 'Kesilir',
      waveEmpty: 'Analizden sonra burada görünür',
      waveTipCut: ' · kesilecek',
      saved: 'Kazanç',
      newLength: 'Yeni süre',
      cuts: 'Kesim',
      settings: 'Ayarlar',
      threshold: 'Eşik',
      auto: 'Oto',
      autoTitle: 'Kaydın gürültü seviyesine göre eşiği ayarla',
      minSilence: 'Min. sessizlik',
      padding: 'Pay',
      unitDb: ' dB',
      unitSec: ' sn',
      backup: 'Kesmeden önce yedek al',
      backupHint: '(geri al için)',
      addMarkers: 'Marker ile işaretle',
      addMarkersTitle: 'Kesilecek yerlere kırmızı marker koy, istemediklerini timeline\'da sil',
      cutMarkers: 'Marker\'lardan kes',
      cutMarkersTitle: 'Timeline\'da kalan twoncut marker\'larını kes',
      cutBtn: 'Sessiz yerleri kes',
      undoTitle: 'Son kesimi geri al: {name}',
      undoNone: 'Geri alınacak kesim yok',
      close: 'Kapat',
      backupSuffix: ' (yedek)',
      cutSuffix: ' (kesilmiş)',

      readingSel: 'Seçim okunuyor…',
      readingAudio: 'Ses okunuyor: {file}',
      readingComp: 'Comp / iç içe sekans sesi okunuyor…',
      analyzeCancelled: 'Analiz iptal edildi.',
      noFfmpeg: 'FFmpeg bulunamadı. Sağ üstteki ayarlardan ffmpeg.exe yolunu gir.',
      found: '{n} sessiz yer bulundu, video {saved} kısalacak. Ayarları değiştirdikçe önizleme güncellenir.',
      noneFound: 'Bu ayarlarla sessizlik bulunamadı. Eşiği yükselt ya da "Oto"ya bas.',
      suggest: 'Önerilen eşik: {db} dB ("Oto" ile uygulanır)',
      autoNoFloor: 'Kayıtta belirgin bir gürültü tabanı yok, eşik değiştirilmedi.',
      autoSet: 'Eşik kaydın ses seviyesine göre {db} dB olarak ayarlandı.',
      cutting: 'Kesiliyor ({what})… Uzun timeline\'larda biraz sürebilir.',
      cutsCount: '{n} kesim',
      markersWord: 'marker',
      cutDone: '{n} sessiz yer kesildi, video {saved} kısaldı.',
      noBackupNote: ' Yedek kapalıydı; geri almak için Premiere\'de Ctrl+Z kullan.',
      mismatch: ' Dikkat: {n} klip tam yerine oturmadı, timeline\'ı kontrol et.',
      undo: 'Geri al',
      afterCut: 'Kesim tamam. Yeni kesim için tekrar seç ve analiz et.',
      markersAdded: '{n} kırmızı marker eklendi. Kesilmesini istemediklerini timeline\'da sil, sonra "Marker\'lardan kes".',
      markersCleared: '{n} twoncut marker\'ı silindi.',
      noMarkers: 'Silinecek twoncut marker\'ı yok.',
      undoing: 'Geri alınıyor…',
      undone: '"{name}" kesimden önceki haline döndü.',
      keptCut: ' Kesilmiş hali "(kesilmiş)" adıyla duruyor.',

      E_NO_SEQ: 'Açık bir sekans yok. Önce bir sekans aç.',
      E_SEQ_CHANGED: 'Analiz edilen sekans açık değil. O sekansa dön ya da yeniden analiz et.',
      E_NO_SELECTION: 'Timeline\'da klip seçili değil. Kesilecek klipleri seç (video, AE comp veya iç içe sekans).',
      E_NO_AUDIO: 'Seçimde ses yok. Klibin ses kısmını da seç (Linked Selection açık olsun).',
      E_PRESET_MISSING: 'WAV ayarı bulunamadı: {detail}. Paneli yeniden kur.',
      E_EXPORT_FAILED: 'Ses dışa aktarılamadı (Premiere: {detail}). Seçimde AE comp varsa After Effects\'in kurulu ve projenin açılabilir olduğunu kontrol et ya da comp\'a sağ tıklayıp "Render and Replace" yapıp tekrar dene.',
      E_EXPORT_ERROR: 'Dışa aktarma hatası: {detail}',
      E_NO_MARKERS_SEL: 'Seçimde twoncut marker\'ı yok. Önce "Marker ile işaretle" ile işaretle.',
      E_NOTHING_TO_CUT: 'Kesilecek sessizlik yok.',
      E_NO_BACKUP: 'Yedek sekans bulunamadı (silinmiş olabilir). Premiere\'de Ctrl+Z ile geri alabilirsin.',
      E_UNDO: 'Geri alınamadı: {detail}',
      E_SCRIPT: 'Premiere komut dosyası yüklenmedi. Premiere\'i yeniden başlat.',
      E_BAD_REPLY: 'Premiere yanıtı okunamadı: {detail}',
      E_FFMPEG_RUN: 'FFmpeg çalıştırılamadı: {detail}',
      E_CANCELLED: 'İptal edildi.',
      E_NO_AUDIO_STREAM: 'Bu klipte ses yok: {detail}',
      E_FFMPEG_READ: 'FFmpeg bu dosyayı okuyamadı: {detail}',
      E_GENERIC: 'Hata: {detail}'
    }
  };

  var lang = 'en';

  function t(key, params) {
    var s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
    if (params) s = s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] !== undefined ? params[k] : m; });
    return s;
  }

  // Fills every element marked with data-i18n / data-i18n-title / data-i18n-placeholder / data-i18n-empty.
  function apply(root) {
    root = root || document;
    var each = function (attr, fn) {
      Array.prototype.forEach.call(root.querySelectorAll('[' + attr + ']'), function (el) { fn(el, el.getAttribute(attr)); });
    };
    each('data-i18n', function (el, k) { el.textContent = t(k); });
    each('data-i18n-title', function (el, k) { el.title = t(k); });
    each('data-i18n-placeholder', function (el, k) { el.placeholder = t(k); });
    each('data-i18n-empty', function (el, k) { el.setAttribute('data-empty', t(k)); });
    document.documentElement.lang = lang;
  }

  window.I18N = {
    languages: { en: 'English', tr: 'Türkçe' },
    t: t,
    apply: apply,
    get: function () { return lang; },
    set: function (l) { if (STRINGS[l]) lang = l; },
    // Picks a supported language from a locale such as "tr_TR" or "en-US".
    fromLocale: function (locale) {
      var code = String(locale || '').slice(0, 2).toLowerCase();
      return STRINGS[code] ? code : 'en';
    }
  };
})();
