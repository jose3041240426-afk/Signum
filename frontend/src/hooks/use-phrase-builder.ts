import { useState, useRef, useCallback } from "react";
import { ENV } from "@/lib/env";

export function usePhraseBuilder(onAdd?: (label: string, confidence: number, isWord: boolean) => void) {
  const [phrase, setPhrase] = useState("");
  const [autoAddActive, setAutoAddActive] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("autoAddActive") === "true";
    return false;
  });
  const [preventRepeat, setPreventRepeat] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("preventRepeat") === "true";
    return false;
  });

  const persistAutoAdd = useCallback((v: boolean) => {
    setAutoAddActive(v);
    if (typeof window !== "undefined") localStorage.setItem("autoAddActive", String(v));
  }, []);
  const persistPreventRepeat = useCallback((v: boolean) => {
    setPreventRepeat(v);
    if (typeof window !== "undefined") localStorage.setItem("preventRepeat", String(v));
  }, []);
  const lastAddedRef = useRef("");
  const lastPredictedRef = useRef("");
  const stableCountRef = useRef(0);

  const [confidenceMin] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("autoAddConfidence");
      return saved ? parseInt(saved, 10) : ENV.AUTO_ADD_CONFIDENCE_MIN;
    }
    return ENV.AUTO_ADD_CONFIDENCE_MIN;
  });

  const [stableFrames] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("autoAddStableFrames");
      return saved ? parseInt(saved, 10) : ENV.AUTO_ADD_STABLE_FRAMES;
    }
    return ENV.AUTO_ADD_STABLE_FRAMES;
  });

  const addLetter = useCallback((letter: string) => {
    setPhrase((prev) => {
      if (preventRepeat && lastAddedRef.current === letter) {
        return prev;
      }
      return prev + letter;
    });
    lastAddedRef.current = letter;
    stableCountRef.current = 0;
  }, [preventRepeat]);

  const addWord = useCallback((word: string) => {
    setPhrase((prev) => {
      const trimmed = word.trim();
      if (!trimmed) return prev;
      const needSpace = prev.length > 0 && !prev.endsWith(" ");
      return prev + (needSpace ? " " : "") + trimmed;
    });
    lastAddedRef.current = word.trim();
    stableCountRef.current = 0;
  }, []);

  const addSpace = useCallback(() => {
    setPhrase((prev) => prev + " ");
    lastAddedRef.current = " ";
    stableCountRef.current = 0;
  }, []);

  const backspace = useCallback(() => {
    setPhrase((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setPhrase("");
    lastAddedRef.current = "";
    lastPredictedRef.current = "";
    stableCountRef.current = 0;
  }, []);

  const tryAutoAdd = useCallback((label: string, confidence: number, isWord = false) => {
    if (!autoAddActive) return;
    if (confidence < confidenceMin) return;

    const normalized = label.trim();

    // Si la predicción cambió respecto al frame anterior, reiniciamos contador
    if (normalized !== lastPredictedRef.current) {
      lastPredictedRef.current = normalized;
      stableCountRef.current = 1;
      return;
    }

    // Si es igual a lo que acabamos de agregar hace un momento, no duplicamos
    if (normalized === lastAddedRef.current) {
      stableCountRef.current = 0;
      return;
    }

    stableCountRef.current += 1;
    if (stableCountRef.current >= stableFrames) {
      if (isWord) addWord(normalized);
      else addLetter(normalized);
      onAdd?.(normalized, confidence, isWord);
      stableCountRef.current = 0;
    }
  }, [autoAddActive, addLetter, addWord, confidenceMin, stableFrames, onAdd]);

  const resetStableCount = useCallback(() => {
    stableCountRef.current = 0;
    lastAddedRef.current = "";
    lastPredictedRef.current = "";
  }, []);

  return {
    phrase,
    setPhrase,
    autoAddActive,
    setAutoAddActive: persistAutoAdd,
    preventRepeat,
    setPreventRepeat: persistPreventRepeat,
    addLetter,
    addWord,
    addSpace,
    backspace,
    clear,
    tryAutoAdd,
    resetStableCount,
  };
}
