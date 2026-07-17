/**
 * TTS Service - browser + server fallbacks.
 *
 * Strategy (driven by localStorage "ttsProvider"):
 *   - "native": Web Speech API (window.speechSynthesis) -> Google Translate fallback.
 *   - "elevenlabs": Server-side /api/tts/elevenlabs proxy using ELEVENLABS_API_KEY.
 *
 * ElevenLabs requests fail silently to native on 4xx/5xx so the UI stays
 * responsive even if the user runs out of free credits.
 */

/* ------------------------------------------------------------------ */
/*  Voice cache                                                       */
/* ------------------------------------------------------------------ */

let cachedVoice: SpeechSynthesisVoice | null = null;
let voiceSearchDone = false;

function findBestVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  console.log(`[TTS] getVoices() returned ${voices.length} voices`);

  if (voices.length === 0) return null;

  const pick =
    voices.find((v) => v.lang === "es-MX") ||
    voices.find((v) => v.lang.startsWith("es-")) ||
    voices.find((v) => v.lang.startsWith("es")) ||
    voices[0];

  if (pick) {
    console.log(`[TTS] Selected voice: "${pick.name}" (${pick.lang})`);
  }
  return pick || null;
}

/** Waits up to ~3 s for voices to appear. Resolves to the best voice or null. */
function waitForVoices(): Promise<SpeechSynthesisVoice | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve(null);
      return;
    }

    // Fast path – voices already loaded
    const immediate = findBestVoice();
    if (immediate) {
      cachedVoice = immediate;
      voiceSearchDone = true;
      resolve(immediate);
      return;
    }

    // Listen for the async event Chrome/Firefox fire
    const onVoicesChanged = () => {
      const v = findBestVoice();
      if (v) {
        cachedVoice = v;
        voiceSearchDone = true;
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        resolve(v);
      }
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

    // Polling fallback for Edge / older browsers
    const intervals = [50, 150, 300, 600, 1200, 2500];
    let i = 0;
    const poll = () => {
      if (voiceSearchDone) return;
      const v = findBestVoice();
      if (v) {
        cachedVoice = v;
        voiceSearchDone = true;
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        resolve(v);
        return;
      }
      if (i < intervals.length) {
        setTimeout(poll, intervals[i++]);
      } else {
        voiceSearchDone = true;
        console.warn("[TTS] No voices found after waiting. Native TTS unavailable.");
        resolve(null);
      }
    };
    setTimeout(poll, intervals[i++]);
  });
}

// Kick off voice loading as soon as the module is imported
let voicePromise: Promise<SpeechSynthesisVoice | null> | null = null;
if (typeof window !== "undefined") {
  voicePromise = waitForVoices();
}

/* ------------------------------------------------------------------ */
/*  Online fallback (Google Translate public endpoint)                 */
/* ------------------------------------------------------------------ */

let fallbackAudio: HTMLAudioElement | null = null;

function speakOnline(text: string): Promise<void> {
  return new Promise((resolve) => {
    console.log(`[TTS] Using online fallback for: "${text}"`);
    try {
      if (typeof window === "undefined") {
        resolve();
        return;
      }

      if (!fallbackAudio) {
        fallbackAudio = new Audio();
      } else {
        // Pause any currently playing fallback audio
        fallbackAudio.pause();
      }

      const encoded = encodeURIComponent(text.slice(0, 200));
      fallbackAudio.src = `/api/tts?text=${encoded}`;
      fallbackAudio.volume = 1.0;

      const done = () => resolve();

      fallbackAudio.onended = done;
      fallbackAudio.onerror = (e) => {
        console.error("[TTS] Online fallback audio error", e);
        done();
      };

      const playPromise = fallbackAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Ignore AbortError which happens naturally when audio is paused/re-assigned quickly
          if (err.name !== "AbortError") {
            console.error("[TTS] Online fallback play() rejected", err);
          }
          done();
        });
      }
    } catch (e) {
      console.error("[TTS] Online fallback exception", e);
      resolve();
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Native speech (Web Speech API)                                    */
/* ------------------------------------------------------------------ */

function speakWithNativeAPI(text: string, voice: SpeechSynthesisVoice): Promise<boolean> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;

    // Cancel anything queued (also un-stucks Chrome's paused state)
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang || "es-MX";
    
    // Obtener valores personalizados de la configuración
    const savedRate = typeof window !== "undefined" ? window.localStorage.getItem("ttsRate") : null;
    const savedPitch = typeof window !== "undefined" ? window.localStorage.getItem("ttsPitch") : null;
    
    utterance.rate = savedRate ? parseFloat(savedRate) : 0.95;
    utterance.pitch = savedPitch ? parseFloat(savedPitch) : 1.0;
    utterance.volume = 1.0;

    let settled = false;
    const settle = (success: boolean) => {
      if (settled) return;
      settled = true;
      resolve(success);
    };

    // Safety timeout – if neither onend nor onerror fires in 8 s,
    // consider it a silent failure.
    const timer = setTimeout(() => {
      console.warn("[TTS] Native speech timed out (8 s). Treating as failure.");
      synth.cancel();
      settle(false);
    }, 8000);

    utterance.onend = () => {
      clearTimeout(timer);
      console.log("[TTS] Native speech finished successfully.");
      settle(true);
    };

    utterance.onerror = (ev) => {
      clearTimeout(timer);
      console.warn("[TTS] Native speech error:", ev.error);
      settle(false);
    };

    try {
      synth.speak(utterance);

      // Chrome bug: the queue can freeze in "paused" state after cancel().
      // Poking resume() fixes it.
      if (synth.paused) {
        synth.resume();
      }

      // Extra paranoia: Chrome sometimes fires nothing at all for very short texts.
      // A brief check after 200 ms to see if speaking actually started.
      setTimeout(() => {
        if (!settled && !synth.speaking && !synth.pending) {
          console.warn("[TTS] Native speech did not start after 200 ms.");
          clearTimeout(timer);
          settle(false);
        }
      }, 200);
    } catch (e) {
      console.error("[TTS] synth.speak() threw:", e);
      clearTimeout(timer);
      settle(false);
    }
  });
}

/* ------------------------------------------------------------------ */
/*  ElevenLabs catalog – voices confirmed working on the free tier  */
/* ------------------------------------------------------------------ */

export const ELEVENLABS_VOICES: Record<string, string> = {
  "pNInz6obpgDQGcFmaJgB": "Adam (recomendado español)",
  "EXAVITQu4vr4xnSDxMaL": "Sarah (recomendado español)",
  "Xb7hH8MSUJpSbSDYk0k2": "Alice",
  "hpp4J3VqNfWAUOO0d1Us": "Bella",
  "pqHfZKP75CvOlQylNhV4": "Bill",
  "nPczCjzI2devNBz1zQrb": "Brian",
  "N2lVS1w4EtoT3dr4eOWO": "Callum",
  "IKne3meq5aSn9XLyUdCD": "Charlie",
  "iP95p4xoKVk53GoZ742B": "Chris",
  "onwK4e9ZLuTAKqWW03F9": "Daniel",
  "cjVigY5qzO86Huf0OWal": "Eric",
  "JBFqnCBsd6RMkjVDRZzb": "George",
  "SOYHLrjzK2X1ezoPC6cr": "Harry",
  "cgSgspJ2msm6clMCkdW9": "Jessica",
  "FGY2WhTYpPnrIDTdsKH5": "Laura",
  "TX3LPaxmHKxFdv7VOQHJ": "Liam",
  "pFZP5JQG7iQjIQuC4Bku": "Lily",
  "XrExE9yKIg1WjnnlVkGX": "Matilda",
  "SAz9YHcvj6GT2YYXdXww": "River",
  "CwhRBWXzGAHq8TQ4Fs17": "Roger",
  "bIHbv24MWmeRgasZH58o": "Will",
};

/* ------------------------------------------------------------------ */
/*  ElevenLabs via /api/tts/elevenlabs                                 */
/* ------------------------------------------------------------------ */

let elevenlabsAudio: HTMLAudioElement | null = null;

async function speakElevenlabs(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const voiceId = localStorage.getItem("elevenlabsVoiceId") || "pNInz6obpgDQGcFmaJgB";
    const encoded = encodeURIComponent(text.slice(0, 500));
    const url = `/api/tts/elevenlabs?text=${encoded}&voice_id=${voiceId}&model_id=eleven_multilingual_v2`;

    if (!elevenlabsAudio) {
      elevenlabsAudio = new Audio();
    } else {
      elevenlabsAudio.pause();
    }

    elevenlabsAudio.src = url;
    elevenlabsAudio.volume = 1.0;

    await new Promise<void>((resolve) => {
      elevenlabsAudio!.onended = () => resolve();
      elevenlabsAudio!.onerror = (e) => {
        console.error("[TTS] ElevenLabs audio error", e);
        resolve();
      };
      const playPromise = elevenlabsAudio!.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== "AbortError") {
            console.error("[TTS] ElevenLabs play() rejected", err);
          }
          resolve();
        });
      }
      // Safety timeout
      setTimeout(() => resolve(), 15000);
    });

    return true;
  } catch (e) {
    console.error("[TTS] ElevenLabs exception", e);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export type TTSProvider = "native" | "elevenlabs";

export function getTTSProvider(): TTSProvider {
  if (typeof window === "undefined") return "native";
  const saved = localStorage.getItem("ttsProvider");
  if (saved === "elevenlabs") return "elevenlabs";
  return "native";
}

export async function speak(text: string): Promise<void> {
  if (!text || typeof window === "undefined") return;

  const provider = getTTSProvider();
  console.log(`[TTS] speak("${text}") via ${provider}`);

  if (provider === "elevenlabs") {
    const ok = await speakElevenlabs(text);
    if (ok) return;
    console.log("[TTS] ElevenLabs failed, falling back to native.");
  }

  // Native path (or fallback)
  const voice = cachedVoice ?? (voicePromise ? await voicePromise : null);
  if (voice) {
    const ok = await speakWithNativeAPI(text, voice);
    if (ok) return;
    console.log("[TTS] Native speech failed, falling back to online.");
  } else {
    console.log("[TTS] No native voices available.");
  }

  await speakOnline(text);
}

// Kept for backwards compatibility – now delegates to speak()
export async function speakNative(text: string): Promise<void> {
  await speak(text);
}

export function isNativeTTSAvailable(): boolean {
  return typeof window !== "undefined";
}
