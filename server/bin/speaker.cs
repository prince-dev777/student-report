using System;
using System.Speech.Synthesis;

class Program {
    static void Main(string[] args) {
        if (args == null || args.Length == 0) return;
        string text = string.Join(" ", args).Trim();
        if (string.IsNullOrEmpty(text)) return;

        try {
            using (SpeechSynthesizer synth = new SpeechSynthesizer()) {
                synth.SetOutputToDefaultAudioDevice();
                synth.Rate = 0;
                synth.Volume = 100;

                try {
                    foreach (InstalledVoice v in synth.GetInstalledVoices()) {
                        if (v != null && v.Enabled && v.VoiceInfo != null) {
                            string cName = v.VoiceInfo.Culture != null ? v.VoiceInfo.Culture.Name : "";
                            string vName = v.VoiceInfo.Name ?? "";
                            if (cName.IndexOf("hi", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                cName.IndexOf("IN", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                vName.IndexOf("India", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                vName.IndexOf("Ravi", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                vName.IndexOf("Heera", StringComparison.OrdinalIgnoreCase) >= 0) {
                                synth.SelectVoice(vName);
                                break;
                            }
                        }
                    }
                } catch { }

                synth.Speak(text);
            }
        } catch { }
    }
}
