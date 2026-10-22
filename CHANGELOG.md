# Changelog

All notable changes to twoncut are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## [5.0.0] - 2026-10-23

First public release.

### Added
- English interface with a built-in Turkish translation (picked from Premiere's language, switchable in the settings).
- Bilingual Windows installer (`twoncut-setup.exe`) that checks for Premiere Pro and FFmpeg, can install FFmpeg through winget, and supports update and uninstall.
- Live waveform preview: changing the threshold, minimum silence or padding updates the cut regions instantly.
- Auto threshold based on the recording's noise floor.
- Marker review: mark cuts as red markers, delete the ones to keep, then cut from the remaining markers.
- Undo: restores the sequence from the backup taken before the cut.
- Works on timeline selections, including After Effects comps and nested sequences.

### Changed
- Extension ID is now `com.twonedit.twoncut`. The installer removes the panel installed by earlier private builds (`com.sessizkes.panel`).
- The WAV export preset is now taken from the user's Premiere Pro installation instead of being bundled.

[5.0.0]: https://github.com/twonxd/twoncut/releases/tag/v5.0.0
