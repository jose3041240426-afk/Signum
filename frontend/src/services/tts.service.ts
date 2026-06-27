/**
 * TTS Service - 100% browser, zero Python.
 *
 * Strategy:
 *   1. Try the native Web Speech API (window.speechSynthesis).
 *   2. If that fails / no voices → fall back to playing audio from
 *      Google Translate's public TTS endpoint via an <audio> element.
 *
 * Known Linux pitfalls this handles:
 *   - Voices list empty (speech-dispatcher not installed)
 *   - speak() fires but produces no sound (espeak missing)
 *   - Chrome paused-queue bug
 *   - onend / onerror never firing
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
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
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
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export async function speakNative(text: string): Promise<void> {
  if (!text || typeof window === "undefined") return;

  console.log(`[TTS] speakNative("${text}")`);

  // 1. Try native
  const voice = cachedVoice ?? (voicePromise ? await voicePromise : null);

  if (voice) {
    const ok = await speakWithNativeAPI(text, voice);
    if (ok) return; // success – done
    console.log("[TTS] Native speech failed, falling back to online.");
  } else {
    console.log("[TTS] No native voices available.");
  }

  // 2. Online fallback
  await speakOnline(text);
}

export function isNativeTTSAvailable(): boolean {
  // Always return true so the UI shows the speak button.
  // The actual speech will use the fallback if native is unavailable.
  return typeof window !== "undefined";
}
