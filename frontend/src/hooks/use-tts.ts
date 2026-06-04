import { useRef, useCallback } from "react";
import { generateAudioBlob } from "@/services/tts.service";

export function useTTS() {
  const speakingRef = useRef(false);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const prefetchingRef = useRef<Set<string>>(new Set());

  const prefetchAudio = useCallback(async (text: string) => {
    const key = text.trim().toLowerCase();
    if (audioCacheRef.current.has(key) || prefetchingRef.current.has(key)) return;
    prefetchingRef.current.add(key);
    try {
      const url = await generateAudioBlob(text);
      audioCacheRef.current.set(key, url);
    } catch {
      /* silent */
    } finally {
      prefetchingRef.current.delete(key);
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      const key = text.trim().toLowerCase();
      let url = audioCacheRef.current.get(key);
      if (!url) {
        url = await generateAudioBlob(text);
        audioCacheRef.current.set(key, url);
      }
      const audio = new Audio(url);
      audio.onended = () => { speakingRef.current = false; };
      audio.onerror = () => { speakingRef.current = false; };
      await audio.play();
    } catch {
      speakingRef.current = false;
    }
  }, []);

  return { prefetchAudio, speak };
}
