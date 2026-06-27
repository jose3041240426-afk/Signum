import { useState } from "react";
import { db, type SignType } from "@/lib/db";
import { trainRandomForest } from "@/services/rf-trainer";
import type { RFModel } from "@/services/rf-inference";

async function trainForType(type: SignType): Promise<{
  model: RFModel;
  classes: string[];
  total: number;
}> {
  const samples = await db.getSamplesByType(type);

  if (samples.length === 0) {
    throw new Error(`No hay muestras de tipo "${type}" para entrenar.`);
  }

  const labels = [...new Set(samples.map((s) => s.label))];
  if (labels.length < 2) {
    throw new Error(
      `Se necesitan al menos 2 clases diferentes. Solo hay: ${labels.join(", ")}`,
    );
  }

  const trainingData = samples.map((s) => ({
    features: s.landmarks,
    label: s.label,
  }));

  const model = trainRandomForest(trainingData, {
    nTrees: 50,
    maxDepth: 15,
  });

  await db.saveModel({
    id: type === "letter" ? "rf-letter" : "rf-word",
    type,
    data: model,
    classes: model.classes,
  });

  return { model, classes: model.classes, total: samples.length };
}

export function useModelTraining() {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingMessage, setTrainingMessage] = useState("");
  const [isTrainingWords, setIsTrainingWords] = useState(false);
  const [trainingWordsMessage, setTrainingWordsMessage] = useState("");

  const trainLetters = async (): Promise<RFModel | null> => {
    setIsTraining(true);
    setTrainingMessage("Entrenando clasificador de letras...");
    try {
      const { model, classes, total } = await trainForType("letter");
      setTrainingMessage(
        `Modelo entrenado con ${total} muestras. Clases: ${classes.join(", ")}`,
      );
      return model;
    } catch (e: any) {
      if (e.message.includes("No hay muestras")) {
        setTrainingMessage("");
      } else {
        setTrainingMessage(`Fallo en letras: ${e.message}`);
      }
      return null;
    } finally {
      setIsTraining(false);
    }
  };

  const trainWords = async (): Promise<RFModel | null> => {
    setIsTrainingWords(true);
    setTrainingWordsMessage("Entrenando clasificador de palabras...");
    try {
      const { model, classes, total } = await trainForType("word");
      setTrainingWordsMessage(
        `Modelo de palabras entrenado con ${total} muestras. Clases: ${classes.join(", ")}`,
      );
      return model;
    } catch (e: any) {
      if (e.message.includes("No hay muestras")) {
        setTrainingWordsMessage("");
      } else {
        setTrainingWordsMessage(`Fallo en palabras: ${e.message}`);
      }
      return null;
    } finally {
      setIsTrainingWords(false);
    }
  };

  return {
    isTraining,
    trainingMessage,
    trainLetters,
    isTrainingWords,
    trainingWordsMessage,
    trainWords,
  };
}
