import { useState } from "react";
import { trainSignModel, trainWordModel, trainDynamicModel } from "@/services/model.service";

export function useModelTraining() {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingMessage, setTrainingMessage] = useState("");
  const [isTrainingWords, setIsTrainingWords] = useState(false);
  const [trainingWordsMessage, setTrainingWordsMessage] = useState("");
  const [isTrainingDynamic, setIsTrainingDynamic] = useState(false);
  const [trainingDynamicMessage, setTrainingDynamicMessage] = useState("");

  const trainLetters = async () => {
    setIsTraining(true);
    setTrainingMessage("Recopilando archivos de datos y entrenando clasificador...");
    try {
      const data = await trainSignModel();
      setTrainingMessage(`Modelo entrenado con las senas: ${data.classes.join(", ")}`);
      return true;
    } catch (e: any) {
      setTrainingMessage(`Fallo: ${e.message}`);
      return false;
    } finally {
      setIsTraining(false);
    }
  };

  const trainWords = async () => {
    setIsTrainingWords(true);
    setTrainingWordsMessage("Entrenando modelo de palabras...");
    try {
      const data = await trainWordModel();
      setTrainingWordsMessage(`Modelo de palabras entrenado: ${data.classes.join(", ")} (${data.total_sequences} secuencias)`);
      return true;
    } catch (e: any) {
      setTrainingWordsMessage(`Fallo: ${e.message}`);
      return false;
    } finally {
      setIsTrainingWords(false);
    }
  };

  const trainDynamic = async () => {
    setIsTrainingDynamic(true);
    setTrainingDynamicMessage("Entrenando modelo de senas con movimiento...");
    try {
      const data = await trainDynamicModel();
      setTrainingDynamicMessage(`Modelo dinamico entrenado: ${data.classes.join(", ")} (${data.total_sequences} secuencias)`);
      return true;
    } catch (e: any) {
      setTrainingDynamicMessage(`Fallo: ${e.message}`);
      return false;
    } finally {
      setIsTrainingDynamic(false);
    }
  };

  return {
    isTraining, trainingMessage, trainLetters,
    isTrainingWords, trainingWordsMessage, trainWords,
    isTrainingDynamic, trainingDynamicMessage, trainDynamic,
  };
}
