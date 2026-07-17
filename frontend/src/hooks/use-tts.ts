import { useRef, useCallback } from "react";
import { speak, isNativeTTSAvailable } from "@/services/tts.service";

export function useTTS() {
  const speakingRef = useRef(false);
  const lastSpokenRef = useRef("");

  const speakTTS = useCallback(async (text: string) => {
    if (!text) return;
    resetLastSpoken();
    if (speakingRef.current) {
      window.speechSynthesis?.cancel();
      speakingRef.current = false;
    }
    speakingRef.current = true;
    lastSpokenRef.current = text;
    try {
      await speak(text);
    } catch {
    } finally {
      speakingRef.current = false;
    }
  }, []);

  const speakPhrase = useCallback(async (text: string) => {
    if (!text) return;
    if (speakingRef.current) {
      window.speechSynthesis?.cancel();
      speakingRef.current = false;
    }
    speakingRef.current = true;
    try {
      await speak(text);
    } catch {
    } finally {
      speakingRef.current = false;
    }
  }, []);

  const resetLastSpoken = useCallback(() => {
    lastSpokenRef.current = "";
  }, []);

  return { speak: speakTTS, speakPhrase, resetLastSpoken };
}
