import { useState, useCallback } from "react";
import {
  startLetterCapture as startLetterService,
  startWordCapture as startWordService,
  stopWordCapture as stopWordService,
  deleteWord as deleteWordService,
  getRegisteredLetters,
  getRegisteredWords,
} from "@/services/capture.service";

export function useCapture() {
  const [letterToCapture, setLetterToCapture] = useState("B");
  const [wordToCapture, setWordToCapture] = useState("Hola");
  const [registeredLetters, setRegisteredLetters] = useState<string[]>([]);
  const [registeredWords, setRegisteredWords] = useState<string[]>([]);

  const fetchRegisteredLetters = useCallback(async () => {
    const letters = await getRegisteredLetters();
    setRegisteredLetters(letters);
  }, []);

  const fetchRegisteredWords = useCallback(async () => {
    const words = await getRegisteredWords();
    setRegisteredWords(words);
  }, []);

  const startLetterRecording = useCallback(async (letter: string) => {
    await startLetterService(letter);
  }, []);

  const startWordRecording = useCallback(async (word: string) => {
    await startWordService(word);
  }, []);

  const stopWordRecording = useCallback(async () => {
    return stopWordService();
  }, []);

  const removeWord = useCallback(async (word: string) => {
    await deleteWordService(word);
    setRegisteredWords((prev) => prev.filter((w) => w !== word));
  }, []);

  return {
    letterToCapture, setLetterToCapture,
    wordToCapture, setWordToCapture,
    registeredLetters, registeredWords,
    fetchRegisteredLetters, fetchRegisteredWords,
    startLetterRecording, startWordRecording,
    stopWordRecording, removeWord,
  };
}
