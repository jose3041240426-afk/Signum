import { useState, useCallback, useRef } from "react";
import { db, type SignType } from "@/lib/db";
import { trainRandomForest } from "@/services/rf-trainer";
import {
  startCapture,
  feedCaptureFrame,
  cancelCapture,
  startManualSample,
  stopManualSample,
  type CaptureState,
} from "@/services/capture-local.service";

export function useCapture() {
  const [letterToCapture, setLetterToCapture] = useState("");
  const [wordToCapture, setWordToCapture] = useState("");
  const [dynamicToCapture, setDynamicToCapture] = useState("");
  const [captureState, setCaptureState] = useState<CaptureState>({
    isRecording: false,
    label: "",
    samplesCount: 0,
    requiredSamples: 0,
    status: "idle",
    isSampleRecording: false,
    currentSampleFrames: 0,
  });
  const [registeredLetters, setRegisteredLetters] = useState<string[]>([]);
  const [registeredWords, setRegisteredWords] = useState<string[]>([]);
  const [registeredDynamic, setRegisteredDynamic] = useState<string[]>([]);
  const captureActiveRef = useRef(false);

  const fetchRegisteredLetters = useCallback(async () => {
    const labels = await db.getDistinctLabels("letter");
    setRegisteredLetters(labels);
  }, []);

  const fetchRegisteredWords = useCallback(async () => {
    const labels = await db.getDistinctLabels("word");
    setRegisteredWords(labels);
  }, []);

  const fetchRegisteredDynamic = useCallback(async () => {
    const labels = await db.getDistinctLabels("dynamic");
    setRegisteredDynamic(labels);
  }, []);

  const retrainModelAfterDelete = useCallback(async (type: SignType) => {
    const modelId =
      type === "letter" ? "rf-letter" : type === "word" ? "rf-word" : "rf-dynamic";
    const samples = await db.getSamplesByType(type);
    const labels = [...new Set(samples.map((s) => s.label))].sort();

    if (labels.length < 2) {
      await db.deleteModel(modelId);
      return;
    }

    const trainingData = samples.map((s) => ({
      features: s.landmarks,
      label: s.label,
    }));
    const model = trainRandomForest(trainingData, { nTrees: 50, maxDepth: 15 });
    await db.saveModel({
      id: modelId,
      type,
      data: model,
      classes: model.classes,
    });
  }, []);

  const startLetterRecording = useCallback(
    async (letter: string) => {
      captureActiveRef.current = true;
      const state = startCapture("letter", letter, (count, extraState) => {
        setCaptureState((prev) => ({
          ...prev,
          samplesCount: count,
          ...extraState,
        }));
      }, () => {
        setCaptureState({
          isRecording: false,
          label: "",
          samplesCount: 0,
          requiredSamples: 0,
          status: "done",
          isSampleRecording: false,
          currentSampleFrames: 0,
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
      const state = startCapture("word", word, (count, extraState) => {
        setCaptureState((prev) => ({
          ...prev,
          samplesCount: count,
          ...extraState,
        }));
      }, () => {
        setCaptureState({
          isRecording: false,
          label: "",
          samplesCount: 0,
          requiredSamples: 0,
          status: "done",
          isSampleRecording: false,
          currentSampleFrames: 0,
        });
        captureActiveRef.current = false;
        fetchRegisteredWords();
      });
      setCaptureState(state);
    },
    [fetchRegisteredWords],
  );

  const startDynamicRecording = useCallback(
    async (sign: string) => {
      captureActiveRef.current = true;
      const state = startCapture("dynamic", sign, (count, extraState) => {
        setCaptureState((prev) => ({
          ...prev,
          samplesCount: count,
          ...extraState,
        }));
      }, () => {
        setCaptureState({
          isRecording: false,
          label: "",
          samplesCount: 0,
          requiredSamples: 0,
          status: "done",
          isSampleRecording: false,
          currentSampleFrames: 0,
        });
        captureActiveRef.current = false;
        fetchRegisteredDynamic();
      });
      setCaptureState(state);
    },
    [fetchRegisteredDynamic],
  );

  const triggerStartManualSample = useCallback(() => {
    startManualSample();
  }, []);

  const triggerStopManualSample = useCallback(() => {
    stopManualSample();
  }, []);

  const stopRecording = useCallback(async () => {
    cancelCapture();
    captureActiveRef.current = false;
    setCaptureState({
      isRecording: false,
      label: "",
      samplesCount: 0,
      requiredSamples: 0,
      status: "idle",
      isSampleRecording: false,
      currentSampleFrames: 0,
    });
  }, []);

  const removeLetter = useCallback(async (letter: string) => {
    await db.deleteSamplesByLabel(letter);
    await retrainModelAfterDelete("letter");
    fetchRegisteredLetters();
  }, [retrainModelAfterDelete, fetchRegisteredLetters]);

  const removeWord = useCallback(async (word: string) => {
    await db.deleteSamplesByLabel(word);
    await retrainModelAfterDelete("word");
    fetchRegisteredWords();
  }, [retrainModelAfterDelete, fetchRegisteredWords]);

  const removeDynamic = useCallback(async (sign: string) => {
    await db.deleteSamplesByLabel(sign);
    await retrainModelAfterDelete("dynamic");
    fetchRegisteredDynamic();
  }, [retrainModelAfterDelete, fetchRegisteredDynamic]);

  return {
    letterToCapture,
    setLetterToCapture,
    wordToCapture,
    setWordToCapture,
    dynamicToCapture,
    setDynamicToCapture,
    captureState,
    registeredLetters,
    registeredWords,
    registeredDynamic,
    fetchRegisteredLetters,
    fetchRegisteredWords,
    fetchRegisteredDynamic,
    startLetterRecording,
    startWordRecording,
    startDynamicRecording,
    startManualSample: triggerStartManualSample,
    stopManualSample: triggerStopManualSample,
    stopRecording,
    removeLetter,
    removeWord,
    removeDynamic,
    captureActiveRef,
  };
}
