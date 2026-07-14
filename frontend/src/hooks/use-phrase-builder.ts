import { useState, useRef, useCallback } from "react";
import { ENV } from "@/lib/env";

export function usePhraseBuilder() {
  const [phrase, setPhrase] = useState("");
  const [autoAddActive, setAutoAddActive] = useState(false);
  const [preventRepeat, setPreventRepeat] = useState(false);
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

  const tryAutoAdd = useCallback((letter: string, confidence: number) => {
    if (!autoAddActive) return;
    if (confidence < confidenceMin) return;

    // Si la predicción cambió respecto al frame anterior, reiniciamos contador
    if (letter !== lastPredictedRef.current) {
      lastPredictedRef.current = letter;
      stableCountRef.current = 1;
      return;
    }

    // Si es igual a lo que acabamos de agregar hace un momento, no duplicamos
    if (letter === lastAddedRef.current) {
      stableCountRef.current = 0;
      return;
    }

    stableCountRef.current += 1;
    if (stableCountRef.current >= stableFrames) {
      addLetter(letter);
      stableCountRef.current = 0;
    }
  }, [autoAddActive, addLetter, confidenceMin, stableFrames]);

  const resetStableCount = useCallback(() => {
    stableCountRef.current = 0;
    lastAddedRef.current = "";
    lastPredictedRef.current = "";
  }, []);

  return {
    phrase,
    setPhrase,
    autoAddActive,
    setAutoAddActive,
    preventRepeat,
    setPreventRepeat,
    addLetter,
    addSpace,
    backspace,
    clear,
    tryAutoAdd,
    resetStableCount,
  };
}
