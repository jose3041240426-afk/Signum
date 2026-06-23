import { useRef, useCallback } from "react";
import { speakNative, isNativeTTSAvailable } from "@/services/tts.service";

export function useTTS() {
  const speakingRef = useRef(false);
  const lastSpokenRef = useRef("");

  const speak = useCallback(async (text: string) => {
    if (speakingRef.current) return;
    if (!text || text === lastSpokenRef.current) return;
    speakingRef.current = true;
    lastSpokenRef.current = text;
    try {
      if (isNativeTTSAvailable()) {
        await speakNative(text);
      }
    } catch {
      /* silent */
    } finally {
      speakingRef.current = false;
    }
  }, []);

  const speakPhrase = useCallback(async (text: string) => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      if (isNativeTTSAvailable()) {
        await speakNative(text);
      }
    } catch {
      /* silent */
    } finally {
      speakingRef.current = false;
    }
  }, []);

  const resetLastSpoken = useCallback(() => {
    lastSpokenRef.current = "";
  }, []);

  return { speak, speakPhrase, resetLastSpoken };
}
