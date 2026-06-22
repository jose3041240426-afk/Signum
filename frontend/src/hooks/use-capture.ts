import { useState, useCallback } from "react";
import {
  startLetterCapture as startLetterService,
  startWordCapture as startWordService,
  stopWordCapture as stopWordService,
  startDynamicCapture as startDynamicService,
  stopDynamicCapture as stopDynamicService,
  deleteWord as deleteWordService,
  deleteDynamic as deleteDynamicService,
  getRegisteredLetters,
  getRegisteredWords,
  getRegisteredDynamic,
} from "@/services/capture.service";

export function useCapture() {
  const [letterToCapture, setLetterToCapture] = useState("B");
  const [wordToCapture, setWordToCapture] = useState("Hola");
  const [dynamicToCapture, setDynamicToCapture] = useState("Hola");
  const [registeredLetters, setRegisteredLetters] = useState<string[]>([]);
  const [registeredWords, setRegisteredWords] = useState<string[]>([]);
  const [registeredDynamic, setRegisteredDynamic] = useState<string[]>([]);

  const fetchRegisteredLetters = useCallback(async () => {
    const letters = await getRegisteredLetters();
    setRegisteredLetters(letters);
  }, []);

  const fetchRegisteredWords = useCallback(async () => {
    const words = await getRegisteredWords();
    setRegisteredWords(words);
  }, []);

  const fetchRegisteredDynamic = useCallback(async () => {
    const signs = await getRegisteredDynamic();
    setRegisteredDynamic(signs);
  }, []);

  const startLetterRecording = useCallback(async (letter: string) => {
    await startLetterService(letter);
  }, []);

  const startWordRecording = useCallback(async (word: string) => {
    await startWordService(word);
  }, []);

  const startDynamicRecording = useCallback(async (signName: string) => {
    return startDynamicService(signName);
  }, []);

  const stopWordRecording = useCallback(async () => {
    return stopWordService();
  }, []);

  const stopDynamicRecording = useCallback(async () => {
    return stopDynamicService();
  }, []);

  const removeWord = useCallback(async (word: string) => {
    await deleteWordService(word);
    setRegisteredWords((prev) => prev.filter((w) => w !== word));
  }, []);

  const removeDynamic = useCallback(async (signName: string) => {
    await deleteDynamicService(signName);
    setRegisteredDynamic((prev) => prev.filter((s) => s !== signName));
  }, []);

  return {
    letterToCapture, setLetterToCapture,
    wordToCapture, setWordToCapture,
    dynamicToCapture, setDynamicToCapture,
    registeredLetters, registeredWords, registeredDynamic,
    fetchRegisteredLetters, fetchRegisteredWords, fetchRegisteredDynamic,
    startLetterRecording, startWordRecording, startDynamicRecording,
    stopWordRecording, stopDynamicRecording,
    removeWord, removeDynamic,
  };
}
