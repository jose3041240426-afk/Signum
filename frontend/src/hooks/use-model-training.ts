import { useState } from "react";
import { trainSignModel, trainWordModel } from "@/services/model.service";

export function useModelTraining() {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingMessage, setTrainingMessage] = useState("");
  const [isTrainingWords, setIsTrainingWords] = useState(false);
  const [trainingWordsMessage, setTrainingWordsMessage] = useState("");

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
    setTrainingWordsMessage("Entrenando modelo LSTM de palabras dinamicas...");
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

  return {
    isTraining, trainingMessage, trainLetters,
    isTrainingWords, trainingWordsMessage, trainWords,
  };
}
