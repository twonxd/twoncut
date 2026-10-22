// twoncut setup (.NET Framework 4.x, C# 5).
// The panel files are embedded as payload.zip; installing needs no administrator rights.
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("twoncut Setup")]
[assembly: AssemblyDescription("Installer for the twoncut silence remover panel for Adobe Premiere Pro")]
[assembly: AssemblyCompany("twonedit")]
[assembly: AssemblyProduct("twoncut")]
[assembly: AssemblyCopyright("Copyright (c) 2026 twonedit. MIT License.")]
// Version attributes are generated into build/BuildInfo.cs from extension/CSXS/manifest.xml.

namespace Twoncut
{
    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            // Silent install: twoncut-setup.exe --install [--dest folder]
            if (args.Length > 0 && args[0] == "--install")
            {
                try
                {
                    InstallerForm.ExtractTo(args.Length > 2 && args[1] == "--dest" ? args[2] : InstallerForm.Dest);
                    return 0;
                }
                catch (Exception ex) { Console.Error.WriteLine(ex.Message); return 1; }
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
            return 0;
        }
    }

    // UI strings; Turkish when Windows is in Turkish, English otherwise.
    static class L
    {
        static readonly bool Tr = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "tr";
        static string T(string en, string tr) { return Tr ? tr : en; }

        public static readonly string Title = T("twoncut setup", "twoncut kurulum");
        public static readonly string Tagline = T("Silence remover for Premiere Pro", "Premiere Pro için sessizlik kesme eklentisi");
        public static readonly string VersionWord = T("version", "sürüm");
        public static readonly string Install = T("Install", "Kur");
        public static readonly string Reinstall = T("Reinstall", "Yeniden kur");
        public static readonly string Update = T("Update", "Güncelle");
        public static readonly string Done = T("Done", "Bitti");
        public static readonly string Uninstall = T("Uninstall", "Kaldır");
        public static readonly string InstallFfmpeg = T("Install FFmpeg", "FFmpeg'i kur");
        public static readonly string NotFound = T("not found", "bulunamadı");
        public static readonly string Ready = T("ready", "hazır");
        public static readonly string FfmpegMissing = T("required, not installed", "gerekli, kurulu değil");
        public static readonly string Installed = T("installed", "kurulu");
        public static readonly string NotInstalled = T("not installed", "kurulu değil");
        public static readonly string Installing = T("Installing…", "Kuruluyor…");
        public static readonly string InstallFailed = T("Install failed: ", "Kurulum başarısız: ");
        public static readonly string DoneRunning = T("Installed! Premiere Pro is open: restart it, then Window › Extensions › twoncut.",
                                                      "Kuruldu! Premiere Pro açık: kapatıp yeniden aç, sonra Pencere › Uzantılar › twoncut.");
        public static readonly string DoneClosed = T("Installed! Open Premiere Pro: Window › Extensions › twoncut.",
                                                     "Kuruldu! Premiere Pro'yu aç: Pencere › Uzantılar › twoncut.");
        public static readonly string FfmpegInstalling = T("Installing FFmpeg… Wait for the window that opens to finish.",
                                                           "FFmpeg kuruluyor… Açılan pencerede işlemin bitmesini bekle.");
        public static readonly string FfmpegDone = T("FFmpeg installed.", "FFmpeg kuruldu.");
        public static readonly string NoWinget = T("winget isn't available on this PC. The FFmpeg download page opened; reopen this window after installing it.",
                                                   "Bu bilgisayarda winget yok. FFmpeg indirme sayfası açıldı; kurduktan sonra bu pencereyi yeniden aç.");
        public static readonly string FfmpegFailed = T("FFmpeg couldn't be installed", "FFmpeg kurulamadı");
        public static readonly string TryAgain = T(" You can try again.", " Tekrar deneyebilirsin.");
        public static readonly string ConfirmUninstall = T("Uninstall twoncut?", "twoncut kaldırılsın mı?");
        public static readonly string Uninstalled = T("twoncut was removed. Restart Premiere Pro if it's open.",
                                                      "twoncut kaldırıldı. Premiere Pro açıksa yeniden başlat.");
        public static readonly string UninstallFailed = T("Couldn't remove: {0} (close Premiere Pro and try again.)",
                                                          "Kaldırılamadı: {0} (Premiere Pro açıksa kapatıp tekrar dene.)");
    }

    static class Theme
    {
        public static readonly Color Bg = Color.FromArgb(11, 11, 14);
        public static readonly Color Surface = Color.FromArgb(22, 22, 27);
        public static readonly Color SurfaceHover = Color.FromArgb(32, 32, 39);
        public static readonly Color Line = Color.FromArgb(40, 40, 48);
        public static readonly Color Text = Color.FromArgb(244, 244, 245);
        public static readonly Color Muted = Color.FromArgb(161, 161, 170);
        public static readonly Color Faint = Color.FromArgb(99, 99, 110);
        public static readonly Color Violet = Color.FromArgb(139, 92, 246);
        public static readonly Color Blue = Color.FromArgb(96, 165, 250);
        public static readonly Color Good = Color.FromArgb(74, 222, 128);
        public static readonly Color Warn = Color.FromArgb(251, 191, 36);
        public static readonly Color Bad = Color.FromArgb(251, 113, 133);

        public static GraphicsPath Round(RectangleF r, float rad)
        {
            var p = new GraphicsPath();
            float d = rad * 2;
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        public static Color Lighten(Color c, int amount)
        {
            return Color.FromArgb(c.A, Math.Min(255, c.R + amount), Math.Min(255, c.G + amount), Math.Min(255, c.B + amount));
        }
    }

    // Rounded gradient primary button and a quiet secondary button
    class FlatButton : Control
    {
        public bool Primary;
        public float Zoom = 1f;
        bool hover;

        public FlatButton()
        {
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer |
                     ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
            Cursor = Cursors.Hand;
        }

        protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnEnabledChanged(EventArgs e) { Cursor = Enabled ? Cursors.Hand : Cursors.Default; Invalidate(); base.OnEnabledChanged(e); }
        protected override void OnTextChanged(EventArgs e) { Invalidate(); base.OnTextChanged(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            Color textColor;
            using (var path = Theme.Round(r, 8 * Zoom))
            {
                if (!Enabled)
                {
                    using (var b = new SolidBrush(Theme.Surface)) g.FillPath(b, path);
                    textColor = Theme.Faint;
                }
                else if (Primary)
                {
                    int up = hover ? 18 : 0;
                    using (var b = new LinearGradientBrush(r, Theme.Lighten(Theme.Violet, up), Theme.Lighten(Theme.Blue, up), 0f))
                        g.FillPath(b, path);
                    textColor = Color.White;
                }
                else
                {
                    using (var b = new SolidBrush(hover ? Theme.SurfaceHover : Theme.Surface)) g.FillPath(b, path);
                    using (var pen = new Pen(Theme.Line)) g.DrawPath(pen, path);
                    textColor = Theme.Text;
                }
            }
            TextRenderer.DrawText(g, Text, Font, ClientRectangle, textColor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
        }
    }

    class InstallerForm : Form
    {
        static readonly string Version = BuildInfo.Version;
        const string BundleId = "com.twonedit.twoncut";
        static readonly string ExtensionsDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                                                            "Adobe", "CEP", "extensions");
        public static readonly string Dest = Path.Combine(ExtensionsDir, BundleId);
        // Folder used by versions before 5.0
        static readonly string LegacyDest = Path.Combine(ExtensionsDir, "com.sessizkes.panel");

        float S = 1f;
        FlatButton btnInstall, btnFfmpeg, btnClose;
        LinkLabel lnkUninstall;
        System.Windows.Forms.Timer spinTimer;
        float spinPhase;
        bool busy, installedDone;
        string message = "";
        Color messageColor = Theme.Muted;

        string premiere, ffmpeg, installedVersion;

        int P(float v) { return (int)Math.Round(v * S); }

        public InstallerForm()
        {
            using (var g = CreateGraphics()) S = g.DpiX / 96f;

            Text = L.Title;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(P(440), P(400));
            BackColor = Theme.Bg;
            DoubleBuffered = true;
            Font = new Font("Segoe UI", 9.5f);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            btnClose = new FlatButton { Text = "✕", Zoom = S, Font = new Font("Segoe UI", 9f) };
            btnClose.Bounds = new Rectangle(P(440 - 40), P(10), P(28), P(28));
            btnClose.Click += delegate { if (!busy) Close(); };
            Controls.Add(btnClose);

            btnFfmpeg = new FlatButton { Text = L.InstallFfmpeg, Zoom = S, Font = new Font("Segoe UI", 9.5f, FontStyle.Bold) };
            btnFfmpeg.Click += delegate { InstallFfmpeg(); };
            Controls.Add(btnFfmpeg);

            btnInstall = new FlatButton { Primary = true, Text = L.Install, Zoom = S, Font = new Font("Segoe UI", 10f, FontStyle.Bold) };
            btnInstall.Click += delegate { if (installedDone) Close(); else InstallPlugin(); };
            Controls.Add(btnInstall);

            lnkUninstall = new LinkLabel
            {
                Text = L.Uninstall, AutoSize = true, BackColor = Color.Transparent,
                LinkColor = Theme.Faint, ActiveLinkColor = Theme.Bad, LinkBehavior = LinkBehavior.HoverUnderline,
                Font = new Font("Segoe UI", 8.5f)
            };
            lnkUninstall.LinkClicked += delegate { Uninstall(); };
            Controls.Add(lnkUninstall);

            spinTimer = new System.Windows.Forms.Timer { Interval = 16 };
            spinTimer.Tick += delegate { spinPhase = (spinPhase + 0.012f) % 1f; Invalidate(new Rectangle(0, P(300), Width, P(8))); };

            // Borderless window: drag from anywhere
            MouseDown += delegate (object s, MouseEventArgs e) { if (e.Button == MouseButtons.Left) { ReleaseCapture(); SendMessage(Handle, 0xA1, 2, 0); } };

            Detect();
        }

        [DllImport("user32.dll")] static extern bool ReleaseCapture();
        [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, int msg, int w, int l);
        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int val, int size);

        protected override CreateParams CreateParams
        {
            get { var cp = base.CreateParams; cp.ClassStyle |= 0x20000; return cp; } // drop shadow
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            try { int round = 2; DwmSetWindowAttribute(Handle, 33, ref round, 4); } catch { } // rounded corners on Windows 11
        }

        // --- Detection ---

        void Detect()
        {
            premiere = FindPremiere();
            ffmpeg = FindFfmpeg();
            installedVersion = ReadInstalledVersion();
            LayoutButtons();
            Invalidate();
        }

        static string FindPremiere()
        {
            string found = null;
            var adobe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Adobe");
            if (!Directory.Exists(adobe)) return null;
            foreach (var d in Directory.GetDirectories(adobe, "Adobe Premiere Pro*"))
            {
                var name = Path.GetFileName(d).Replace("Adobe Premiere Pro", "").Trim();
                if (name.Length == 0) name = L.Installed;
                if (found == null || string.CompareOrdinal(name, found) > 0) found = name;
            }
            return found;
        }

        static string FindFfmpeg()
        {
            try
            {
                var psi = new ProcessStartInfo("where", "ffmpeg") { UseShellExecute = false, RedirectStandardOutput = true, CreateNoWindow = true };
                using (var p = Process.Start(psi))
                {
                    var line = p.StandardOutput.ReadLine();
                    p.WaitForExit(3000);
                    if (!string.IsNullOrEmpty(line) && File.Exists(line.Trim())) return line.Trim();
                }
            }
            catch { }
            var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var links = Path.Combine(local, @"Microsoft\WinGet\Links\ffmpeg.exe");
            if (File.Exists(links)) return links;
            var pkgs = Path.Combine(local, @"Microsoft\WinGet\Packages");
            try
            {
                if (Directory.Exists(pkgs))
                    foreach (var d in Directory.GetDirectories(pkgs, "*FFmpeg*"))
                        foreach (var sub in Directory.GetDirectories(d))
                        {
                            var exe = Path.Combine(sub, @"bin\ffmpeg.exe");
                            if (File.Exists(exe)) return exe;
                        }
            }
            catch { }
            foreach (var c in new[] { @"C:\ffmpeg\bin\ffmpeg.exe", @"C:\Program Files\ffmpeg\bin\ffmpeg.exe" })
                if (File.Exists(c)) return c;
            return null;
        }

        static string ReadInstalledVersion()
        {
            foreach (var dir in new[] { Dest, LegacyDest })
            {
                try
                {
                    var m = Path.Combine(dir, @"CSXS\manifest.xml");
                    if (!File.Exists(m)) continue;
                    var match = Regex.Match(File.ReadAllText(m), "ExtensionBundleVersion=\"([^\"]+)\"");
                    return match.Success ? match.Groups[1].Value : "?";
                }
                catch { }
            }
            return null;
        }

        static bool PremiereRunning()
        {
            return Process.GetProcessesByName("Adobe Premiere Pro").Length > 0;
        }

        // --- Layout ---

        void LayoutButtons()
        {
            int y = P(316), h = P(42), x = P(28), w = P(440 - 56);
            bool needFfmpeg = ffmpeg == null && !installedDone;
            btnFfmpeg.Visible = needFfmpeg;
            if (needFfmpeg)
            {
                int fw = P(140);
                btnFfmpeg.Bounds = new Rectangle(x, y, fw, h);
                btnInstall.Bounds = new Rectangle(x + fw + P(8), y, w - fw - P(8), h);
            }
            else btnInstall.Bounds = new Rectangle(x, y, w, h);

            if (installedDone) btnInstall.Text = L.Done;
            else btnInstall.Text = installedVersion == null ? L.Install : (installedVersion.StartsWith(Version) ? L.Reinstall : L.Update);

            lnkUninstall.Visible = installedVersion != null && !installedDone;
            lnkUninstall.Location = new Point((ClientSize.Width - lnkUninstall.PreferredWidth) / 2, P(366));
        }

        void SetBusy(bool on, string msg)
        {
            busy = on;
            btnInstall.Enabled = !on;
            btnFfmpeg.Enabled = !on;
            lnkUninstall.Enabled = !on;
            if (on) spinTimer.Start(); else spinTimer.Stop();
            Status(msg, Theme.Muted);
        }

        void Status(string msg, Color color)
        {
            message = msg; messageColor = color;
            Invalidate();
        }

        // --- Install ---

        // Unpacks the embedded panel into dest and lets Premiere load unsigned panels.
        public static void ExtractTo(string dest)
        {
            if (Directory.Exists(dest)) Directory.Delete(dest, true);
            Directory.CreateDirectory(dest);
            using (var res = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
            using (var zip = new ZipArchive(res, ZipArchiveMode.Read))
            {
                foreach (var entry in zip.Entries)
                {
                    var target = Path.Combine(dest, entry.FullName.Replace('/', Path.DirectorySeparatorChar));
                    if (entry.FullName.EndsWith("/")) { Directory.CreateDirectory(target); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    using (var src = entry.Open())
                    using (var dst = File.Create(target)) src.CopyTo(dst);
                }
            }
            // Remove the panel of versions before 5.0 so it doesn't show up twice
            if (dest == Dest && Directory.Exists(LegacyDest)) Directory.Delete(LegacyDest, true);
            // CEP debug mode lets Premiere load unsigned panels (one key per CEP version)
            for (int v = 9; v <= 13; v++)
                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Adobe\CSXS." + v))
                    key.SetValue("PlayerDebugMode", "1", RegistryValueKind.String);
        }

        void InstallPlugin()
        {
            SetBusy(true, L.Installing);
            new Thread(delegate ()
            {
                string error = null;
                try { ExtractTo(Dest); }
                catch (Exception ex) { error = ex.Message; }

                BeginInvoke((Action)delegate
                {
                    SetBusy(false, "");
                    if (error != null) { Status(L.InstallFailed + error, Theme.Bad); return; }
                    installedDone = true;
                    installedVersion = Version;
                    LayoutButtons();
                    Status(PremiereRunning() ? L.DoneRunning : L.DoneClosed, Theme.Good);
                });
            }) { IsBackground = true }.Start();
        }

        void InstallFfmpeg()
        {
            SetBusy(true, L.FfmpegInstalling);
            new Thread(delegate ()
            {
                string error = null;
                try
                {
                    var psi = new ProcessStartInfo("winget",
                        "install --id Gyan.FFmpeg -e --source winget --accept-source-agreements --accept-package-agreements")
                    { UseShellExecute = true };
                    using (var p = Process.Start(psi)) p.WaitForExit();
                }
                catch (System.ComponentModel.Win32Exception) { error = "nowinget"; }
                catch (Exception ex) { error = ex.Message; }

                var found = FindFfmpeg();
                BeginInvoke((Action)delegate
                {
                    SetBusy(false, "");
                    ffmpeg = found;
                    LayoutButtons();
                    if (found != null) { Status(L.FfmpegDone, Theme.Good); return; }
                    if (error == "nowinget")
                    {
                        Status(L.NoWinget, Theme.Warn);
                        try { Process.Start("https://www.gyan.dev/ffmpeg/builds/"); } catch { }
                    }
                    else Status(L.FfmpegFailed + (error != null ? ": " + error + "." : ".") + L.TryAgain, Theme.Bad);
                });
            }) { IsBackground = true }.Start();
        }

        void Uninstall()
        {
            if (MessageBox.Show(this, L.ConfirmUninstall, "twoncut", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            try
            {
                foreach (var dir in new[] { Dest, LegacyDest })
                    if (Directory.Exists(dir)) Directory.Delete(dir, true);
                installedVersion = null;
                LayoutButtons();
                Status(L.Uninstalled, Theme.Muted);
            }
            catch (Exception ex) { Status(string.Format(L.UninstallFailed, ex.Message), Theme.Bad); }
        }

        // --- Drawing ---

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            // Soft violet glow at the top
            using (var glow = new GraphicsPath())
            {
                glow.AddEllipse(new RectangleF(-P(60), -P(170), ClientSize.Width + P(120), P(300)));
                using (var pb = new PathGradientBrush(glow))
                {
                    pb.CenterColor = Color.FromArgb(70, Theme.Violet);
                    pb.SurroundColors = new[] { Color.FromArgb(0, Theme.Violet) };
                    g.FillPath(pb, glow);
                }
            }

            // Gradient "twoncut" title
            using (var titleFont = new Font("Segoe UI", 26f, FontStyle.Bold))
            using (var path = new GraphicsPath())
            {
                var size = g.MeasureString("twoncut", titleFont);
                float emSize = g.DpiY * titleFont.SizeInPoints / 72f;
                var origin = new PointF((ClientSize.Width - size.Width) / 2f + P(4), P(34));
                path.AddString("twoncut", titleFont.FontFamily, (int)FontStyle.Bold, emSize, origin, StringFormat.GenericDefault);
                var b = path.GetBounds();
                using (var brush = new LinearGradientBrush(new RectangleF(b.X - 1, b.Y, b.Width + 2, b.Height + 1),
                                                           Color.White, Color.FromArgb(165, 180, 252), 0f))
                    g.FillPath(brush, path);
            }
            DrawCentered(g, L.Tagline, 9.5f, Theme.Muted, P(92));
            DrawCentered(g, L.VersionWord + " " + Version, 8.5f, Theme.Faint, P(114));

            // Checklist
            var box = new RectangleF(P(28), P(146), ClientSize.Width - P(56), P(132));
            using (var path = Theme.Round(box, 10 * S))
            {
                using (var b = new SolidBrush(Theme.Surface)) g.FillPath(b, path);
                using (var pen = new Pen(Theme.Line)) g.DrawPath(pen, path);
            }
            DrawRow(g, 0, "Premiere Pro", premiere != null ? premiere : L.NotFound, premiere != null ? Theme.Good : Theme.Warn);
            DrawRow(g, 1, "FFmpeg", ffmpeg != null ? L.Ready : L.FfmpegMissing, ffmpeg != null ? Theme.Good : Theme.Warn);
            DrawRow(g, 2, "twoncut", installedVersion != null ? L.Installed + " (" + installedVersion + ")" : L.NotInstalled,
                    installedVersion != null ? Theme.Good : Theme.Faint);

            // Progress and status message
            if (busy)
            {
                var track = new RectangleF(P(28), P(300), ClientSize.Width - P(56), P(3));
                using (var b = new SolidBrush(Theme.Surface)) g.FillRectangle(b, track);
                float segW = track.Width * 0.3f, x = track.X + (track.Width + segW) * spinPhase - segW;
                var seg = RectangleF.Intersect(track, new RectangleF(x, track.Y, segW, track.Height));
                if (seg.Width > 0)
                    using (var b = new LinearGradientBrush(new RectangleF(x, track.Y, segW + 1, track.Height), Theme.Violet, Theme.Blue, 0f))
                        g.FillRectangle(b, seg);
            }
            if (!string.IsNullOrEmpty(message))
            {
                var r = new Rectangle(P(28), P(282), ClientSize.Width - P(56), P(30));
                using (var f = new Font("Segoe UI", 8.75f))
                    TextRenderer.DrawText(g, message, f, r, messageColor,
                        TextFormatFlags.HorizontalCenter | TextFormatFlags.Top | TextFormatFlags.WordBreak | TextFormatFlags.NoPadding);
            }
        }

        void DrawCentered(Graphics g, string text, float pt, Color color, int y)
        {
            using (var f = new Font("Segoe UI", pt))
                TextRenderer.DrawText(g, text, f, new Rectangle(0, y, ClientSize.Width, P(22)), color, TextFormatFlags.HorizontalCenter);
        }

        void DrawRow(Graphics g, int i, string label, string value, Color dot)
        {
            int top = P(146) + P(14) + i * P(36);
            int left = P(28) + P(16), right = ClientSize.Width - P(28) - P(16);
            using (var b = new SolidBrush(dot)) g.FillEllipse(b, left, top + P(8), P(7), P(7));
            using (var f = new Font("Segoe UI", 9.5f))
            {
                TextRenderer.DrawText(g, label, f, new Point(left + P(16), top + P(1)), Theme.Text);
                var sz = TextRenderer.MeasureText(value, f);
                TextRenderer.DrawText(g, value, f, new Point(right - sz.Width, top + P(1)), dot == Theme.Faint ? Theme.Muted : dot);
            }
            if (i < 2)
                using (var pen = new Pen(Theme.Line))
                    g.DrawLine(pen, left, top + P(30), right, top + P(30));
        }
    }
}
