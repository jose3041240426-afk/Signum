import { useState, useCallback, useRef } from "react";
import { db, type SignType } from "@/lib/db";
import {
  startCapture,
  feedCaptureFrame,
  cancelCapture,
  type CaptureState,
} from "@/services/capture-local.service";

export function useCapture() {
  const [letterToCapture, setLetterToCapture] = useState("");
  const [wordToCapture, setWordToCapture] = useState("");
  const [captureState, setCaptureState] = useState<CaptureState>({
    isRecording: false,
    label: "",
    samplesCount: 0,
    requiredSamples: 0,
    status: "idle",
  });
  const [registeredLetters, setRegisteredLetters] = useState<string[]>([]);
  const [registeredWords, setRegisteredWords] = useState<string[]>([]);
  const captureActiveRef = useRef(false);

  const fetchRegisteredLetters = useCallback(async () => {
    const labels = await db.getDistinctLabels("letter");
    setRegisteredLetters(labels);
  }, []);

  const fetchRegisteredWords = useCallback(async () => {
    const labels = await db.getDistinctLabels("word");
    setRegisteredWords(labels);
  }, []);

  const startLetterRecording = useCallback(
    async (letter: string) => {
      captureActiveRef.current = true;
      const state = startCapture("letter", letter, (count) => {
        setCaptureState((prev) => ({
          ...prev,
          samplesCount: count,
        }));
      }, () => {
        setCaptureState({
          isRecording: false,
          label: "",
          samplesCount: 0,
          requiredSamples: 0,
          status: "done",
        });
        captureActiveRef.current = false;
        fetchRegisteredLetters();
      });
      setCaptureState(state);
    },
    [fetchRegisteredLetters],
  );

  const startWordRecording = useCallback(
    async (word: string) => {
      captureActiveRef.current = true;
      const state = startCapture("word", word, (count) => {
        setCaptureState((prev) => ({
          ...prev,
          samplesCount: count,
        }));
      }, () => {
        setCaptureState({
          isRecording: false,
          label: "",
          samplesCount: 0,
          requiredSamples: 0,
          status: "done",
        });
        captureActiveRef.current = false;
        fetchRegisteredWords();
      });
      setCaptureState(state);
    },
    [fetchRegisteredWords],
  );

  const stopRecording = useCallback(async () => {
    cancelCapture();
    captureActiveRef.current = false;
    setCaptureState({
      isRecording: false,
      label: "",
      samplesCount: 0,
      requiredSamples: 0,
      status: "idle",
    });
  }, []);

  const removeLetter = useCallback(async (letter: string) => {
    await db.deleteSamplesByLabel(letter);
    fetchRegisteredLetters();
  }, [fetchRegisteredLetters]);

  const removeWord = useCallback(async (word: string) => {
    await db.deleteSamplesByLabel(word);
    fetchRegisteredWords();
  }, [fetchRegisteredWords]);

  return {
    letterToCapture,
    setLetterToCapture,
    wordToCapture,
    setWordToCapture,
    captureState,
    registeredLetters,
    registeredWords,
    fetchRegisteredLetters,
    fetchRegisteredWords,
    startLetterRecording,
    startWordRecording,
    stopRecording,
    removeLetter,
    removeWord,
    captureActiveRef,
  };
}
