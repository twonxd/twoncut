<p align="center">
  <img src="docs/logo.png" width="88" alt="twoncut logo">
</p>

<h1 align="center">twoncut</h1>

<p align="center">
  Remove silences in Adobe Premiere Pro, right on your timeline.<br>
  Select clips, preview the cuts on a live waveform, cut in one click, undo if you change your mind.
</p>

<p align="center">
  <a href="https://github.com/twonxd/twoncut/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/twonxd/twoncut?color=8b5cf6"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-60a5fa"></a>
  <img alt="Windows" src="https://img.shields.io/badge/platform-Windows-6d6af7">
  <img alt="Premiere Pro 2022+" src="https://img.shields.io/badge/Premiere%20Pro-2022%2B-9999ff">
</p>

<p align="center">
  <b>English</b> · <a href="README.tr.md">Türkçe</a>
</p>

<p align="center">
  <img src="docs/panel.png" width="320" alt="twoncut panel in Premiere Pro">
</p>

## Features

- **Works on your selection** – regular clips, After Effects comps and nested sequences.
- **Live preview** – a waveform shows what stays and what gets cut; every setting change updates instantly, no re-analysis.
- **Auto threshold** – picks a threshold from the recording's own noise floor.
- **Cuts in place** – razors the selected tracks, removes the silences and closes the gaps. Clips after the selection move up with it.
- **Marker review** – drop red markers on every cut, delete the ones you want to keep, then cut from the rest.
- **Undo** – a backup sequence is taken before every cut, and one click brings it back.
- **Multi-track aware** – with several speakers on different tracks, a moment only counts as silence when everyone is quiet.
- **English and Turkish** – follows Premiere's language, switchable in the settings.

## Requirements

- Windows 10 or 11
- Adobe Premiere Pro 2022 or newer
- [FFmpeg](https://ffmpeg.org) – the installer can set it up for you

## Install

1. Download **`twoncut-setup.exe`** from the [latest release](https://github.com/twonxd/twoncut/releases/latest).
2. Run it and click **Install**. If FFmpeg is missing, click **Install FFmpeg** first.
3. Restart Premiere Pro and open **Window › Extensions › twoncut**.

The installer doesn't need administrator rights. Run it again later to update or uninstall.

> [!NOTE]
> The installer isn't code-signed yet, so Windows SmartScreen may show *"Windows protected your PC"*. Click **More info › Run anyway**. Signing is in progress.

## Usage

1. Select the clips to clean up on the timeline (keep **Linked Selection** on so their audio is selected too).
2. Click **Analyze**. The waveform shows the parts to keep and the parts to cut in red.
3. Adjust the settings until the preview looks right.
4. Click **Cut silences**, or use **Mark with markers** to review each cut on the timeline first.
5. Not happy with the result? Click **Undo** (↶).

### Settings

| Setting | What it does | Good starting point |
|---|---|---|
| **Threshold** | Anything quieter than this counts as silence. Raise it for noisy recordings. **Auto** sets it from the recording. | Auto |
| **Min. silence** | Pauses shorter than this are kept. | 0.4–0.8 s |
| **Padding** | Breathing room left before and after speech. | 0.1–0.2 s |

## Good to know

- Only the selected audio is listened to; music and other unselected tracks don't affect detection.
- Cuts are made on the tracks that contain selected clips. Unselected tracks (music, graphics) stay where they are, so add them after cutting or include them in the selection.
- Clips with changed speed are analyzed through an audio export, the same way as comps and nested sequences.
- Effects stay on the clips because the original clips are cut in place.

## How it works

The panel is a CEP extension. When you analyze, it reads the audio of the selected clips straight from their media files with FFmpeg (comps and nested sequences are exported to WAV first) and turns it into a 10 ms loudness envelope. Silence detection runs on that envelope in JavaScript, which is why the preview reacts instantly. Cutting is done with Premiere's scripting API: razor at each silence boundary, remove the silent pieces, then move the remaining clips left to close the gaps.

## Build from source

You only need Windows; the C# compiler that ships with .NET Framework 4.x is enough.

```powershell
# Build the installer into dist\twoncut-setup.exe
powershell -ExecutionPolicy Bypass -File installer\build.ps1

# Or install the panel straight from the repo while developing
powershell -ExecutionPolicy Bypass -File scripts\dev-install.ps1
```

The version comes from `extension/CSXS/manifest.xml`. Pushing a `v*` tag builds the installer on GitHub Actions and attaches it to a release.

```
extension/   CEP panel (HTML/CSS/JS UI, Node analysis engine, ExtendScript for Premiere)
installer/   Windows installer (C# WinForms) and build script
scripts/     Developer helpers
docs/        Images used in this README
```

## Contributing

Bug reports and pull requests are welcome. Please include your Premiere Pro version and the panel log (gear icon › Log) when reporting a bug.

## License

[MIT](LICENSE) © twonedit

twoncut is not affiliated with or endorsed by Adobe. Adobe and Premiere Pro are trademarks of Adobe Inc.
