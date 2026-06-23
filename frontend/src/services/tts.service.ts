let spanishVoice: SpeechSynthesisVoice | null = null;

function findSpanishVoice(): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.startsWith("es-MX")) ||
    voices.find((v) => v.lang.startsWith("es-")) ||
    null
  );
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    spanishVoice = findSpanishVoice();
  };
  spanishVoice = findSpanishVoice();
}

export function speakNative(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error("speechSynthesis not supported"));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-MX";
    if (spanishVoice) utterance.voice = spanishVoice;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function isNativeTTSAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function generateAudioBlob(_text: string): Promise<string> {
  return Promise.reject(
    new Error("Use speakNative() instead — backend TTS removed"),
  );
}
