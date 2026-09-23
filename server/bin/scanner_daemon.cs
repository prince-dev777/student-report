using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Net;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Speech.Synthesis;

namespace CareerXoneScanner
{
    class Program
    {
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_SYSKEYDOWN = 0x0104;

        private static LowLevelKeyboardProc _proc = HookCallback;
        private static IntPtr _hookID = IntPtr.Zero;

        private static StringBuilder _buffer = new StringBuilder();
        private static DateTime _lastKeyTime = DateTime.MinValue;
        private static bool _isScannerBurst = false;
        private static Mutex _mutex;
        private static SpeechSynthesizer _synth = null;

        [STAThread]
        public static void Main(string[] args)
        {
            // 🛡️ Single Instance Protection
            bool isNewInstance = false;
            _mutex = new Mutex(true, "CareerXone_Scanner_Daemon_SingleInstance_Mutex", out isNewInstance);
            if (!isNewInstance)
            {
                return; // Another instance is already running
            }

            // Pre-warm Speech Synthesizer in background for instant 0ms response
            Task.Run(() => InitSynth());

            _hookID = SetHook(_proc);

            // Run Windows message loop without UI
            System.Windows.Forms.Application.Run();

            if (_hookID != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hookID);
            }
        }

        private static void InitSynth()
        {
            try
            {
                if (_synth == null)
                {
                    _synth = new SpeechSynthesizer();
                    _synth.SetOutputToDefaultAudioDevice();
                    _synth.Rate = 0;
                    _synth.Volume = 100;

                    foreach (InstalledVoice v in _synth.GetInstalledVoices())
                    {
                        if (v != null && v.Enabled && v.VoiceInfo != null)
                        {
                            string cName = v.VoiceInfo.Culture != null ? v.VoiceInfo.Culture.Name : "";
                            string vName = v.VoiceInfo.Name ?? "";
                            if (cName.IndexOf("hi", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                cName.IndexOf("IN", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                vName.IndexOf("India", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                vName.IndexOf("Ravi", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                vName.IndexOf("Heera", StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                _synth.SelectVoice(vName);
                                break;
                            }
                        }
                    }
                }
            }
            catch { }
        }

        private static void SpeakName(string name)
        {
            if (string.IsNullOrEmpty(name)) return;
            try
            {
                InitSynth();
                if (_synth != null)
                {
                    _synth.SpeakAsyncCancelAll();
                    _synth.SpeakAsync(name);
                }
            }
            catch { }
        }

        private static IntPtr SetHook(LowLevelKeyboardProc proc)
        {
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
            }
        }

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN))
            {
                int vkCode = Marshal.ReadInt32(lParam);
                DateTime now = DateTime.Now;
                double diffMs = (now - _lastKeyTime).TotalMilliseconds;
                _lastKeyTime = now;

                if (vkCode == 13) // Enter Key pressed
                {
                    if (_buffer.Length >= 2 && _isScannerBurst)
                    {
                        string scannedCode = _buffer.ToString().Trim();
                        _buffer.Clear();
                        _isScannerBurst = false;

                        // Process punch asynchronously in background thread
                        Task.Run(() => ProcessPunchAndPlayAudio(scannedCode));

                        // 🛡️ Suppress Enter key from typing into background/foreground windows
                        return (IntPtr)1;
                    }

                    _buffer.Clear();
                    _isScannerBurst = false;
                }
                else
                {
                    char c = GetCharFromVirtualKey(vkCode);
                    if (c != '\0')
                    {
                        // Hardware 2D QR scanners type at ultra-fast speeds: 5ms to 35ms per keystroke
                        if (diffMs < 50)
                        {
                            _isScannerBurst = true;
                            _buffer.Append(c);
                        }
                        else
                        {
                            // Delay > 50ms means manual human typing -> reset buffer
                            _buffer.Clear();
                            _buffer.Append(c);
                            _isScannerBurst = false;
                        }
                    }
                }
            }

            return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }

        private static char GetCharFromVirtualKey(int vkCode)
        {
            // Digits 0-9
            if (vkCode >= 48 && vkCode <= 57) return (char)vkCode;
            // Uppercase A-Z
            if (vkCode >= 65 && vkCode <= 90) return (char)vkCode;
            // Numpad 0-9
            if (vkCode >= 96 && vkCode <= 105) return (char)(vkCode - 48);

            // Common symbols used in Student IDs and QR codes
            switch (vkCode)
            {
                case 189: // Minus -
                case 109: // Numpad Minus
                    return '-';
                case 187: // Equals / Plus
                case 107:
                    return '+';
                case 190: // Period .
                case 110:
                    return '.';
                case 191: // Slash /
                case 111:
                    return '/';
                case 186: // Semicolon / Colon
                    return ':';
                case 222: // Quote
                    return '"';
                case 219: // Open bracket {
                    return '{';
                case 221: // Close bracket }
                    return '}';
                case 188: // Comma ,
                    return ',';
                case 32:  // Space
                    return ' ';
            }

            return '\0';
        }

        private static void ProcessPunchAndPlayAudio(string code)
        {
            bool success = false;
            string studentFirstName = "";

            try
            {
                var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:5000/api/attendance/scanner-punch");
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Timeout = 4000;

                string json = "{\"code\":\"" + EscapeJson(code) + "\"}";
                byte[] bytes = Encoding.UTF8.GetBytes(json);
                request.ContentLength = bytes.Length;

                using (var stream = request.GetRequestStream())
                {
                    stream.Write(bytes, 0, bytes.Length);
                }

                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    if (response.StatusCode == HttpStatusCode.OK)
                    {
                        using (var reader = new StreamReader(response.GetResponseStream()))
                        {
                            string body = reader.ReadToEnd();
                            if (body.Contains("\"success\":true"))
                            {
                                success = true;
                                studentFirstName = ExtractFirstName(body);
                            }
                        }
                    }
                }
            }
            catch
            {
                success = false;
            }

            // 🗣️ Voice Announcement: Speak the Student's First Name!
            try
            {
                if (success && !string.IsNullOrEmpty(studentFirstName))
                {
                    SpeakName(studentFirstName);
                }
                else if (success)
                {
                    // Fallback pleasant chime if name could not be resolved
                    Console.Beep(1200, 100);
                    Thread.Sleep(30);
                    Console.Beep(1760, 160);
                }
                else
                {
                    // ⚠️ Warning tone for unregistered student / scan error
                    Console.Beep(450, 220);
                }
            }
            catch
            {
                try { System.Media.SystemSounds.Asterisk.Play(); } catch { }
            }
        }

        private static string ExtractFirstName(string json)
        {
            try
            {
                // 1. Look for "firstName":"..."
                int fnIdx = json.IndexOf("\"firstName\":\"", StringComparison.OrdinalIgnoreCase);
                if (fnIdx >= 0)
                {
                    int start = fnIdx + 13;
                    int end = json.IndexOf("\"", start);
                    if (end > start)
                    {
                        string fn = json.Substring(start, end - start).Trim();
                        if (!string.IsNullOrEmpty(fn)) return CleanName(fn);
                    }
                }

                // 2. Fallback: Look for "name":"..."
                int nameIdx = json.IndexOf("\"name\":\"", StringComparison.OrdinalIgnoreCase);
                if (nameIdx >= 0)
                {
                    int start = nameIdx + 8;
                    int end = json.IndexOf("\"", start);
                    if (end > start)
                    {
                        string fullName = json.Substring(start, end - start).Trim();
                        string[] parts = fullName.Split(new char[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length > 0)
                        {
                            return CleanName(parts[0]);
                        }
                    }
                }
            }
            catch { }
            return "";
        }

        private static string CleanName(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            var sb = new StringBuilder();
            foreach (char c in s)
            {
                if (char.IsLetter(c)) sb.Append(c);
            }
            string cleaned = sb.ToString().Trim();
            if (cleaned.Length > 1)
            {
                return char.ToUpper(cleaned[0]) + cleaned.Substring(1).ToLower();
            }
            return cleaned.ToUpper();
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "");
        }

        // Win32 API Imports
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);
    }
}
