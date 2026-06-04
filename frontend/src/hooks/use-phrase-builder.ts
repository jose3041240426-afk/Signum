import { useState, useRef, useCallback } from "react";
import { ENV } from "@/lib/env";

export function usePhraseBuilder() {
  const [phrase, setPhrase] = useState("");
  const [autoAddActive, setAutoAddActive] = useState(false);
  const lastAddedRef = useRef("");
  const stableCountRef = useRef(0);

  const addLetter = useCallback((letter: string) => {
    setPhrase((prev) => prev + letter);
    lastAddedRef.current = letter;
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
    stableCountRef.current = 0;
  }, []);

  const tryAutoAdd = useCallback((letter: string, confidence: number) => {
    if (!autoAddActive) return;
    if (confidence < ENV.AUTO_ADD_CONFIDENCE_MIN) return;
    if (letter === lastAddedRef.current) {
      stableCountRef.current = 0;
      return;
    }
    stableCountRef.current += 1;
    if (stableCountRef.current > ENV.AUTO_ADD_STABLE_FRAMES) {
      addLetter(letter);
    }
  }, [autoAddActive, addLetter]);

  const resetStableCount = useCallback(() => {
    stableCountRef.current = 0;
    lastAddedRef.current = "";
  }, []);

  return {
    phrase,
    setPhrase,
    autoAddActive,
    setAutoAddActive,
    addLetter,
    addSpace,
    backspace,
    clear,
    tryAutoAdd,
    resetStableCount,
  };
}
