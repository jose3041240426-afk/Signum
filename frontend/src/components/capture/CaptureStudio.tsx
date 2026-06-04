"use client";
import { Input } from "../ui/input";
import { ProgressBar } from "../ui/progress-bar";

interface CaptureStudioProps {
  letterToCapture: string;
  setLetterToCapture: (l: string) => void;
  wordToCapture: string;
  setWordToCapture: (w: string) => void;
  isRecording: boolean;
  isRecordingWord: boolean;
  isTraining: boolean;
  isTrainingWords: boolean;
  trainingMessage: string;
  trainingWordsMessage: string;
  recordedSamplesCount: number;
  wordRecordedSeqCount: number;
  backendStatus: string;
  onStartLetter: () => void;
  onStartWord: () => void;
  onStopWord: () => void;
  onTrainLetters: () => void;
  onTrainWords: () => void;
}

export function CaptureStudio({
  letterToCapture, setLetterToCapture,
  wordToCapture, setWordToCapture,
  isRecording, isRecordingWord, isTraining, isTrainingWords,
  trainingMessage, trainingWordsMessage,
  backendStatus,
  onStartLetter, onStartWord, onStopWord, onTrainLetters, onTrainWords,
}: CaptureStudioProps) {
  const letterDisabled = isRecording || isTraining || backendStatus !== "online";
  const wordDisabled = isRecordingWord || isTrainingWords || isRecording || backendStatus !== "online";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500">Estudio Grabador Signum (Paso 2 y 3)</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Letra a Registrar (A-Z)</label>
            <Input
              type="text"
              maxLength={1}
              value={letterToCapture}
              onChange={(e) => setLetterToCapture(e.target.value.toUpperCase().slice(0,1))}
              disabled={letterDisabled}
              className="text-center font-bold"
            />
          </div>
          <button className="btn-capturar flex-[2]" onClick={onStartLetter} disabled={letterDisabled}>
            {isRecording ? "Capturando..." : `Capturar Letra '${letterToCapture}'`}
          </button>
        </div>
        {isRecording && (
          <div className="mt-4">
            <ProgressBar progress={recordedSamplesCount} total={100} label="Progreso de Grabacion" />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <button className="btn-entrenar w-full" onClick={onTrainLetters} disabled={letterDisabled}>
          <span className="btn-text-one">{isTraining ? "Entrenando IA..." : "Entrenar Inteligencia Artificial"}</span>
          <span className="btn-text-two">{isTraining ? "Procesando..." : "Iniciar entrenamiento"}</span>
        </button>
        {trainingMessage && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-700">
            {trainingMessage}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500">Estudio Palabras Dinamicas (Senas con Movimiento)</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Palabra a Registrar</label>
            <Input
              value={wordToCapture}
              onChange={(e) => setWordToCapture(e.target.value.slice(0,30))}
              disabled={wordDisabled}
              className="text-center font-bold"
            />
          </div>
          {!isRecordingWord ? (
            <button className="rounded-lg bg-black px-6 py-3 font-bold text-white transition hover:bg-gray-900 disabled:opacity-50" onClick={onStartWord} disabled={wordDisabled}>
              {`Capturar Palabra '${wordToCapture}'`}
            </button>
          ) : (
            <button className="rounded-lg bg-orange-600 px-6 py-3 font-bold text-white transition hover:bg-orange-700" onClick={onStopWord}>
              Detener Grabacion ({wordRecordedSeqCount}/30)
            </button>
          )}
        </div>
        {isRecordingWord && (
          <div className="mt-4">
            <ProgressBar progress={wordRecordedSeqCount} total={30} label="Progreso de Palabra" />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <button className="w-full rounded-full bg-gray-900 py-3 font-bold text-white transition hover:bg-black disabled:opacity-50" onClick={onTrainWords} disabled={wordDisabled}>
          {isTrainingWords ? "Entrenando LSTM..." : "Entrenar Modelo de Palabras (LSTM)"}
        </button>
        {trainingWordsMessage && (
          <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-center text-sm text-orange-800">
            {trainingWordsMessage}
          </div>
        )}
      </div>
    </div>
  );
}
