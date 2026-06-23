import os
import io
import sys
import time
import pickle
import threading
import numpy as np
from collections import deque
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from contextlib import asynccontextmanager

# Add root folder to path so we can import lsm_utils
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
sys.path.append(os.path.abspath(os.path.join(BASE_DIR, "..", "..")))

try:
    from lsm_utils import normalize_landmarks
except ImportError:
    # Fallback definition of normalizer if lsm_utils is missing
    def normalize_landmarks(hand_landmarks):
        import math
        landmarks = hand_landmarks.landmark
        base_x = landmarks[0].x
        base_y = landmarks[0].y
        base_z = landmarks[0].z
        translated = [[lm.x - base_x, lm.y - base_y, lm.z - base_z] for lm in landmarks]
        max_dist = max(math.sqrt(c[0]**2 + c[1]**2 + c[2]**2) for c in translated)
        if max_dist == 0.0:
            max_dist = 1.0
        flat = []
        for c in translated:
            flat.extend([c[0]/max_dist, c[1]/max_dist, c[2]/max_dist])
        return flat

# Paths
DATA_DIR = os.path.join(BASE_DIR, "..", "..", "datos_lsm")
WORDS_DATA_DIR = os.path.join(BASE_DIR, "..", "..", "datos_palabras")
DYNAMIC_DATA_DIR = os.path.join(BASE_DIR, "..", "..", "datos_dinamicos")
LETTERS_MOTION_DIR = os.path.join(BASE_DIR, "..", "..", "datos_letras_movimiento")
MODEL_DIR = os.path.join(BASE_DIR, "ml")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(WORDS_DATA_DIR, exist_ok=True)
os.makedirs(DYNAMIC_DATA_DIR, exist_ok=True)
os.makedirs(LETTERS_MOTION_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

RECORDING_CONSTANTS = type("RC", (), {
    "LETTER_SAMPLES": 50,
    "WORD_SAMPLES": 50,
    "DYNAMIC_FRAMES": 50,
    "DYNAMICS_PER_SIGN": 3,
    "WORD_MAX_NAME": 30,
})()
LETTER_SAMPLES_PER_RECORDING = RECORDING_CONSTANTS.LETTER_SAMPLES
WORD_SAMPLES_PER_RECORDING = RECORDING_CONSTANTS.WORD_SAMPLES
DYNAMIC_FRAMES_PER_SEQUENCE = RECORDING_CONSTANTS.DYNAMIC_FRAMES
DYNAMICS_PER_SIGN = RECORDING_CONSTANTS.DYNAMICS_PER_SIGN
WORD_MAX_NAME_LEN = RECORDING_CONSTANTS.WORD_MAX_NAME

PREDICTION_BUFFER_SIZE = 5

global_model = {"letter": None, "word": None, "word_encoder": None, "dynamic": None, "dynamic_encoder": None}

prediction_buffers: dict[str, deque] = {
    "letters": deque(maxlen=PREDICTION_BUFFER_SIZE),
    "words": deque(maxlen=PREDICTION_BUFFER_SIZE),
}

def smooth_prediction(mode: str, raw_label: str) -> str:
    buf = prediction_buffers[mode]
    buf.append(raw_label)
    counts: dict[str, int] = {}
    for item in buf:
        counts[item] = counts.get(item, 0) + 1
    return max(counts, key=counts.get)

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_lsm_model()
    load_word_model()
    load_dynamic_model()
    print("Backend: Modelos cargados en startup.")
    yield

app = FastAPI(title="LSM Unified Capture, Training & Inference API", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_lsm_model():
    global model
    model_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "modelo_lsm.pkl"))
    if os.path.exists(model_path):
        try:
            with open(model_path, "rb") as f:
                model = pickle.load(f)
            global_model["letter"] = model
            print(f"Backend: modelo_lsm.pkl cargado exitosamente.")
            return True
        except Exception as e:
            print(f"Error al cargar modelo_lsm.pkl: {e}")
    else:
        print("Backend: modelo_lsm.pkl no encontrado. Corriendo en modo demo.")
        model = None
        global_model["letter"] = None
        return False

def load_word_model():
    global word_model, word_label_encoder
    model_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "modelo_palabras.pkl"))
    encoder_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "label_encoder_palabras.pkl"))
    if os.path.exists(model_path) and os.path.exists(encoder_path):
        try:
            with open(model_path, "rb") as f:
                word_model = pickle.load(f)
            with open(encoder_path, "rb") as f:
                word_label_encoder = pickle.load(f)
            global_model["word"] = word_model
            global_model["word_encoder"] = word_label_encoder
            print(f"Backend: modelo_palabras.pkl cargado exitosamente.")
            return True
        except Exception as e:
            print(f"Error al cargar modelo_palabras.pkl: {e}")
            word_model = None
            word_label_encoder = None
            global_model["word"] = None
            global_model["word_encoder"] = None
    else:
        print("Backend: modelo_palabras.pkl no encontrado.")
        word_model = None
        word_label_encoder = None
        global_model["word"] = None
        global_model["word_encoder"] = None
        return False

def load_dynamic_model():
    global dynamic_model, dynamic_label_encoder
    model_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "modelo_dinamico.pkl"))
    encoder_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "label_encoder_dinamico.pkl"))
    if os.path.exists(model_path) and os.path.exists(encoder_path):
        try:
            with open(model_path, "rb") as f:
                dynamic_model = pickle.load(f)
            with open(encoder_path, "rb") as f:
                dynamic_label_encoder = pickle.load(f)
            global_model["dynamic"] = dynamic_model
            global_model["dynamic_encoder"] = dynamic_label_encoder
            print(f"Backend: modelo_dinamico.pkl cargado exitosamente.")
            return True
        except Exception as e:
            print(f"Error al cargar modelo_dinamico.pkl: {e}")
            dynamic_model = None
            dynamic_label_encoder = None
            global_model["dynamic"] = None
            global_model["dynamic_encoder"] = None
    else:
        print("Backend: modelo_dinamico.pkl no encontrado.")
        dynamic_model = None
        dynamic_label_encoder = None
        global_model["dynamic"] = None
        global_model["dynamic_encoder"] = None
        return False

class PredictionState:
    def __init__(self):
        self.current_letter = ""
        self.current_confidence = 0.0
        self.hand_detected = False
        self.prediction_mode = "letters"
        self.current_word = ""
        self.current_word_confidence = 0.0
        self.current_dynamic = ""
        self.current_dynamic_confidence = 0.0
        self.is_recording = False
        self.recording_letter = ""
        self.recorded_samples: list = []
        self.is_recording_word = False
        self.recording_word_name = ""
        self.word_recorded_samples: list = []
        self.is_recording_dynamic = False
        self.recording_dynamic_name = ""
        self.dynamic_recorded_frames: list = []
        self.dynamic_sequences_saved = 0
        self.dynamic_buffer: list = []

state = PredictionState()

class LandmarksInput(BaseModel):
    landmarks: List[float]

class LandmarksBatchInput(BaseModel):
    frames: List[LandmarksInput]

@app.websocket("/ws/predict")
async def ws_predict(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            landmarks = data.get("landmarks", [])
            mode = data.get("mode", state.prediction_mode)

            result = {"letter": "", "confidence": 0.0, "word": "", "word_confidence": 0.0,
                      "dynamic_sign": "", "dynamic_confidence": 0.0, "hand_detected": False}

            if len(landmarks) == 63:
                arr = np.array(landmarks).reshape(1, -1)

                if mode == "letters" and model:
                    try:
                        pred = model.predict(arr)[0]
                        probs = model.predict_proba(arr)[0]
                        idx_max = int(np.argmax(probs))
                        conf = float(probs[idx_max] * 100)
                        raw_label = str(pred)
                        smoothed = smooth_prediction("letters", raw_label)
                        result["letter"] = smoothed
                        result["confidence"] = round(conf, 1)
                        result["hand_detected"] = True
                        state.current_letter = smoothed
                        state.current_confidence = conf
                        state.hand_detected = True
                    except Exception as e:
                        print(f"WS prediction error: {e}")

                elif mode == "words" and word_model and word_label_encoder:
                    try:
                        probs = word_model.predict_proba(arr)[0]
                        idx_max = int(np.argmax(probs))
                        conf = float(probs[idx_max] * 100)
                        if conf > 30:
                            word_name = word_label_encoder.inverse_transform([idx_max])[0]
                            raw_label = str(word_name)
                            smoothed = smooth_prediction("words", raw_label)
                            result["word"] = smoothed
                            result["word_confidence"] = round(conf, 1)
                            result["hand_detected"] = True
                            state.current_word = smoothed
                            state.current_word_confidence = conf
                        else:
                            prediction_buffers["words"].clear()
                    except Exception as e:
                        print(f"WS word prediction error: {e}")

                elif mode == "dynamic" and dynamic_model and dynamic_label_encoder:
                    state.dynamic_buffer.append(landmarks)
                    if len(state.dynamic_buffer) > DYNAMIC_FRAMES_PER_SEQUENCE:
                        state.dynamic_buffer = state.dynamic_buffer[-DYNAMIC_FRAMES_PER_SEQUENCE:]
                    if len(state.dynamic_buffer) == DYNAMIC_FRAMES_PER_SEQUENCE:
                        try:
                            seq_flattened = np.array(state.dynamic_buffer).flatten().reshape(1, -1)
                            probs = dynamic_model.predict_proba(seq_flattened)[0]
                            idx_max = int(np.argmax(probs))
                            conf = float(probs[idx_max] * 100)
                            if conf > 30:
                                sign_name = dynamic_label_encoder.inverse_transform([int(dynamic_model.predict(seq_flattened)[0])])[0]
                                result["dynamic_sign"] = str(sign_name)
                                result["dynamic_confidence"] = round(conf, 1)
                                result["hand_detected"] = True
                                state.current_dynamic = str(sign_name)
                                state.current_dynamic_confidence = conf
                        except Exception as e:
                            print(f"WS dynamic prediction error: {e}")

            await websocket.send_json(result)
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "word_model_loaded": word_model is not None,
        "dynamic_model_loaded": dynamic_model is not None,
        "camera_active": True,
    }

@app.post("/predict_landmarks")
async def predict_landmarks(request: LandmarksInput):
    if not model:
        raise HTTPException(status_code=400, detail="Modelo no cargado.")
    arr = np.array(request.landmarks).reshape(1, -1)
    try:
        pred = model.predict(arr)[0]
        probs = model.predict_proba(arr)[0]
        idx_max = int(np.argmax(probs))
        conf = float(probs[idx_max] * 100)
        raw_label = str(pred)
        smoothed = smooth_prediction("letters", raw_label)
        return {"letter": smoothed, "confidence": round(conf, 1)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict_word_landmarks")
async def predict_word_landmarks(request: LandmarksInput):
    if not word_model or not word_label_encoder:
        raise HTTPException(status_code=400, detail="Modelo de palabras no cargado.")
    arr = np.array(request.landmarks).reshape(1, -1)
    try:
        probs = word_model.predict_proba(arr)[0]
        idx_max = int(np.argmax(probs))
        conf = float(probs[idx_max] * 100)
        if conf > 30:
            word_name = word_label_encoder.inverse_transform([idx_max])[0]
            raw_label = str(word_name)
            smoothed = smooth_prediction("words", raw_label)
            return {"word": smoothed, "confidence": round(conf, 1)}
        return {"word": "", "confidence": 0.0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prediction")
def get_prediction():
    return {
        "letter": state.current_letter,
        "confidence": state.current_confidence,
        "hand_detected": state.hand_detected,
        "model_loaded": model is not None,
        "is_recording": state.is_recording,
        "recording_letter": state.recording_letter,
        "recorded_samples_count": len(state.recorded_samples),
        "prediction_mode": state.prediction_mode,
        "word": state.current_word,
        "word_confidence": state.current_word_confidence,
        "is_recording_word": state.is_recording_word,
        "recording_word_name": state.recording_word_name,
        "word_recorded_samples_count": len(state.word_recorded_samples),
        "word_model_loaded": word_model is not None,
        "dynamic_sign": state.current_dynamic,
        "dynamic_confidence": state.current_dynamic_confidence,
        "is_recording_dynamic": state.is_recording_dynamic,
        "recording_dynamic_name": state.recording_dynamic_name,
        "dynamic_recorded_frames": len(state.dynamic_recorded_frames),
        "dynamic_sequences_saved": state.dynamic_sequences_saved,
        "dynamic_buffer_len": len(state.dynamic_buffer),
        "dynamic_model_loaded": dynamic_model is not None,
    }

@app.post("/camera/stop")
def stop_camera():
    return {"msg": "Camara gestionada por el frontend (MediaPipe en navegador)"}

@app.post("/start_capture/{letter}")
async def start_capture(letter: str):
    if not letter.isalpha() or len(letter) != 1:
        raise HTTPException(status_code=400, detail="La letra debe ser un solo caracter alfabetico.")
    
    state.is_recording_word = False
    state.recorded_samples = []
    state.recording_letter = letter.upper()
    state.is_recording = True
    print(f"Backend: Iniciando captura estatica para la letra '{letter.upper()}'")
    return {"msg": f"Captura iniciada para la letra '{letter.upper()}'", "samples_needed": LETTER_SAMPLES_PER_RECORDING}


@app.post("/train")
async def train_model():
    """Trains the Random Forest model on all .npy files in datos_lsm and reloads it dynamically"""
    try:
        from sklearn.model_selection import train_test_split
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import accuracy_score
        
        ruta_datos = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_lsm"))
        if not os.path.exists(ruta_datos) or len(os.listdir(ruta_datos)) == 0:
            raise HTTPException(status_code=400, detail="No hay datos grabados en la carpeta 'datos_lsm'.")
            
        X = []
        y = []
        archivos = [f for f in os.listdir(ruta_datos) if f.endswith(".npy") and f.startswith("datos_")]
        
        if len(archivos) < 2:
            raise HTTPException(status_code=400, detail="Necesitas registrar al menos 2 letras/señas diferentes para entrenar.")
            
        for archivo in archivos:
            clase = archivo.replace("datos_", "").replace(".npy", "")
            ruta_archivo = os.path.join(ruta_datos, archivo)
            datos_clase = np.load(ruta_archivo)
            X.append(datos_clase)
            y.extend([clase] * len(datos_clase))
            
        X = np.vstack(X)
        y = np.array(y)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        clf = RandomForestClassifier(n_estimators=100, random_state=42)
        clf.fit(X_train, y_train)
        
        # Save model
        model_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "modelo_lsm.pkl"))
        with open(model_path, "wb") as f:
            pickle.dump(clf, f)
            
        # Dynamic reload
        load_lsm_model()
        
        return {"msg": "¡Modelo entrenado con éxito!", "classes": list(np.unique(y))}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Maintain compatibility with placeholders if needed ----------

@app.get("/registered_letters")
def get_registered_letters():
    """Returns a list of letters that have recorded data (datos_*.npy) in datos_lsm"""
    try:
        ruta_datos = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_lsm"))
        if not os.path.exists(ruta_datos):
            return {"registered": []}

        archivos = [f for f in os.listdir(ruta_datos) if f.endswith(".npy") and f.startswith("datos_")]
        letras = [f.replace("datos_", "").replace(".npy", "") for f in archivos]
        return {"registered": sorted(list(set(letras)))}
    except Exception as e:
        print(f"Error checking registered letters: {e}")
        return {"registered": []}


@app.post("/start_capture_word/{word_name}")
async def start_capture_word(word_name: str):
    """Starts capturing 50 static samples for a word"""
    word_name = word_name.strip()
    if not word_name or len(word_name) > WORD_MAX_NAME_LEN:
        raise HTTPException(status_code=400, detail="El nombre de la palabra debe tener entre 1 y 30 caracteres.")
    if not all(c.isalnum() or c in "_ " for c in word_name):
        raise HTTPException(status_code=400, detail="Solo se permiten letras, numeros, espacios y guion bajo.")

    if state.is_recording_word:
        raise HTTPException(status_code=400, detail="Ya hay una grabación de palabra en curso.")

    state.is_recording = False
    state.word_recorded_samples = []
    state.recording_word_name = word_name
    state.is_recording_word = True
    print(f"Backend: Iniciando captura de {WORD_SAMPLES_PER_RECORDING} muestras para la palabra '{word_name}'")
    return {"msg": f"Captura iniciada para la palabra '{word_name}'", "samples_needed": WORD_SAMPLES_PER_RECORDING}


@app.post("/stop_capture_word")
async def stop_capture_word():
    """Stops the current word recording, saving whatever has been captured so far"""
    if not state.is_recording_word:
        return {"msg": "No hay grabación de palabra en curso."}

    word_name = state.recording_word_name
    samples = state.word_recorded_samples
    state.is_recording_word = False

    if len(samples) > 0:
        out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_palabras"))
        os.makedirs(out_dir, exist_ok=True)
        safe_name = "".join(c for c in word_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
        datos_np = np.array(samples)
        out_path = os.path.join(out_dir, f"palabra_{safe_name}.npy")
        np.save(out_path, datos_np)
        print(f"Backend: Guardadas {len(samples)} muestras de '{word_name}' en {out_path}")
        return {"msg": f"Grabación detenida. Se guardaron {len(samples)} muestras de '{word_name}'.", "samples_saved": len(samples)}
    else:
        return {"msg": f"Grabación detenida. No se capturaron muestras para '{word_name}'.", "samples_saved": 0}


@app.get("/registered_words")
def get_registered_words():
    """Returns a list of words that have recorded data (palabra_*.npy) in datos_palabras"""
    try:
        ruta_datos = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_palabras"))
        if not os.path.exists(ruta_datos):
            return {"registered": []}

        archivos = [f for f in os.listdir(ruta_datos) if f.endswith(".npy") and f.startswith("palabra_")]
        palabras = [f.replace("palabra_", "").replace(".npy", "").replace("_", " ") for f in archivos]
        return {"registered": sorted(list(set(palabras)))}
    except Exception as e:
        print(f"Error checking registered words: {e}")
        return {"registered": []}

# Debug endpoint to list raw word files
@app.get("/debug/words_files")
def debug_word_files():
    try:
        ruta_datos = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_palabras"))
        if not os.path.isdir(ruta_datos):
            return {"files": [], "msg": "Folder does not exist"}
        files = [f for f in os.listdir(ruta_datos) if f.endswith('.npy')]
        return {"files": files, "path": ruta_datos}
    except Exception as e:
        return {"error": str(e)}


@app.post("/train_words")
async def train_word_model():
    """Trains a RandomForest model on all palabra_*.npy files in datos_palabras (static samples)"""
    global word_model, word_label_encoder
    try:
        from sklearn.model_selection import train_test_split
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import LabelEncoder

        ruta_datos = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_palabras"))
        if not os.path.exists(ruta_datos) or len(os.listdir(ruta_datos)) == 0:
            raise HTTPException(status_code=400, detail="No hay datos de palabras en la carpeta 'datos_palabras'.")

        archivos = [f for f in os.listdir(ruta_datos) if f.endswith(".npy") and f.startswith("palabra_")]
        if len(archivos) < 2:
            raise HTTPException(status_code=400, detail="Necesitas registrar al menos 2 palabras diferentes para entrenar.")

        X = []
        y = []

        for archivo in archivos:
            clase = archivo.replace("palabra_", "").replace(".npy", "").replace("_", " ")
            ruta_archivo = os.path.join(ruta_datos, archivo)
            datos_clase = np.load(ruta_archivo)
            X.append(datos_clase)
            y.extend([clase] * len(datos_clase))

        X = np.vstack(X)
        y = np.array(y)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        le = LabelEncoder()
        y_train_enc = le.fit_transform(y_train)

        clf = RandomForestClassifier(n_estimators=100, random_state=42)
        clf.fit(X_train, y_train_enc)

        model_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "modelo_palabras.pkl"))
        encoder_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "label_encoder_palabras.pkl"))
        with open(model_path, "wb") as f:
            pickle.dump(clf, f)
        with open(encoder_path, "wb") as f:
            pickle.dump(le, f)

        word_model = clf
        word_label_encoder = le

        return {"msg": "Modelo de palabras entrenado con éxito!", "classes": list(le.classes_), "total_samples": len(X)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/delete_word/{word_name}")
async def delete_word(word_name: str):
    """Deletes recorded data for a specific word"""
    safe_name = "".join(c for c in word_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
    ruta_datos = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_palabras"))
    file_path = os.path.join(ruta_datos, f"palabra_{safe_name}.npy")
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"msg": f"Datos de '{word_name}' eliminados."}
    else:
        raise HTTPException(status_code=404, detail=f"No se encontraron datos para '{word_name}'.")


# ---------- Dynamic (Movement) Endpoints ----------

@app.post("/start_capture_dynamic/{sign_name}")
async def start_capture_dynamic(sign_name: str):
    """Starts capturing sequences of frames for a movement-based sign"""
    sign_name = sign_name.strip()
    if not sign_name or len(sign_name) > WORD_MAX_NAME_LEN:
        raise HTTPException(status_code=400, detail="El nombre debe tener entre 1 y 30 caracteres.")
    if not all(c.isalnum() or c in "_ " for c in sign_name):
        raise HTTPException(status_code=400, detail="Solo se permiten letras, numeros, espacios y guion bajo.")

    if state.is_recording_dynamic:
        raise HTTPException(status_code=400, detail="Ya hay una grabacion dinamica en curso.")

    state.is_recording = False
    state.is_recording_word = False
    state.dynamic_recorded_frames = []
    state.recording_dynamic_name = sign_name
    state.dynamic_sequences_saved = 0
    state.is_recording_dynamic = True
    print(f"Backend: Iniciando captura dinamica de {DYNAMICS_PER_SIGN} secuencias x {DYNAMIC_FRAMES_PER_SEQUENCE} frames para '{sign_name}'")
    return {
        "msg": f"Captura dinamica iniciada para '{sign_name}'",
        "sequences_needed": DYNAMICS_PER_SIGN,
        "frames_per_sequence": DYNAMIC_FRAMES_PER_SEQUENCE,
    }

@app.post("/stop_capture_dynamic")
async def stop_capture_dynamic():
    """Stops the current dynamic recording, saving whatever has been captured so far"""
    if not state.is_recording_dynamic:
        return {"msg": "No hay grabacion dinamica en curso."}

    sign_name = state.recording_dynamic_name
    saved = state.dynamic_sequences_saved
    remaining_frames = len(state.dynamic_recorded_frames)
    state.is_recording_dynamic = False
    state.dynamic_recorded_frames = []

    if remaining_frames > 0:
        out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_dinamicos"))
        os.makedirs(out_dir, exist_ok=True)
        safe_name = "".join(c for c in sign_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
        seq_np = np.array(state.dynamic_recorded_frames[:DYNAMIC_FRAMES_PER_SEQUENCE])
        if len(seq_np) > 0:
            timestamp = int(time.time() * 1000)
            out_path = os.path.join(out_dir, f"din_{safe_name}_{timestamp}.npy")
            np.save(out_path, seq_np)
            saved += 1

    print(f"Backend: Captura dinamica detenida. {saved} secuencias guardadas para '{sign_name}'.")
    return {"msg": f"Grabacion detenida. Se guardaron {saved} secuencias de '{sign_name}'.", "sequences_saved": saved}

@app.get("/registered_dynamic")
def get_registered_dynamic():
    """Returns a list of dynamic signs that have recorded data in datos_dinamicos"""
    try:
        ruta_datos = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_dinamicos"))
        if not os.path.exists(ruta_datos):
            return {"registered": []}

        archivos = [f for f in os.listdir(ruta_datos) if f.endswith(".npy") and f.startswith("din_")]
        signs = set()
        for archivo in archivos:
            name_part = archivo.replace("din_", "").rsplit("_", 1)[0].replace("_", " ")
            signs.add(name_part)
        return {"registered": sorted(list(signs))}
    except Exception as e:
        print(f"Error checking registered dynamic signs: {e}")
        return {"registered": []}

@app.get("/dynamic_sign_details/{sign_name}")
def get_dynamic_sign_details(sign_name: str):
    """Returns the number of recorded sequences for a specific dynamic sign"""
    try:
        ruta_datos = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_dinamicos"))
        if not os.path.exists(ruta_datos):
            return {"sign": sign_name, "sequences": 0}

        safe_name = "".join(c for c in sign_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
        archivos = [f for f in os.listdir(ruta_datos) if f.endswith(".npy") and f.startswith(f"din_{safe_name}_")]
        return {"sign": sign_name, "sequences": len(archivos)}
    except Exception as e:
        return {"sign": sign_name, "sequences": 0, "error": str(e)}

@app.post("/train_dynamic")
async def train_dynamic_model():
    """Trains a RandomForest model on all din_*.npy files in datos_dinamicos (flattened sequences)"""
    global dynamic_model, dynamic_label_encoder
    try:
        from sklearn.model_selection import train_test_split
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import LabelEncoder

        ruta_datos = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_dinamicos"))
        if not os.path.exists(ruta_datos) or len(os.listdir(ruta_datos)) == 0:
            raise HTTPException(status_code=400, detail="No hay datos dinamicos en la carpeta 'datos_dinamicos'.")

        archivos = [f for f in os.listdir(ruta_datos) if f.endswith(".npy") and f.startswith("din_")]
        if len(archivos) < 2:
            raise HTTPException(status_code=400, detail="Necesitas registrar al menos 2 senas dinamicas diferentes para entrenar.")

        X = []
        y = []

        for archivo in archivos:
            name_part = archivo.replace("din_", "").rsplit("_", 1)[0].replace("_", " ")
            ruta_archivo = os.path.join(ruta_datos, archivo)
            datos_clase = np.load(ruta_archivo)
            seq_flattened = datos_clase.flatten().reshape(1, -1)
            X.append(seq_flattened[0])
            y.append(name_part)

        X = np.array(X)
        y = np.array(y)

        le = LabelEncoder()
        y_enc = le.fit_transform(y)

        clf = RandomForestClassifier(n_estimators=100, random_state=42)
        clf.fit(X, y_enc)

        model_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "modelo_dinamico.pkl"))
        encoder_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "label_encoder_dinamico.pkl"))
        with open(model_path, "wb") as f:
            pickle.dump(clf, f)
        with open(encoder_path, "wb") as f:
            pickle.dump(le, f)

        dynamic_model = clf
        dynamic_label_encoder = le

        load_dynamic_model()

        return {"msg": "Modelo dinamico entrenado con exito!", "classes": list(le.classes_), "total_sequences": len(X)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/delete_dynamic/{sign_name}")
async def delete_dynamic(sign_name: str):
    """Deletes all recorded dynamic sequences for a specific sign"""
    safe_name = "".join(c for c in sign_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
    ruta_datos = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_dinamicos"))
    if not os.path.exists(ruta_datos):
        raise HTTPException(status_code=404, detail=f"No se encontraron datos para '{sign_name}'.")

    archivos = [f for f in os.listdir(ruta_datos) if f.startswith(f"din_{safe_name}_") and f.endswith(".npy")]
    if not archivos:
        raise HTTPException(status_code=404, detail=f"No se encontraron datos para '{sign_name}'.")

    for archivo in archivos:
        os.remove(os.path.join(ruta_datos, archivo))

    return {"msg": f"Datos de '{sign_name}' eliminados ({len(archivos)} secuencias)."}

@app.post("/record_landmarks")
async def record_landmarks(request: LandmarksInput):
    if state.is_recording and state.recording_letter:
        state.recorded_samples.append(request.landmarks)
        if len(state.recorded_samples) >= LETTER_SAMPLES_PER_RECORDING:
            datos_np = np.array(state.recorded_samples)
            out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_lsm"))
            os.makedirs(out_dir, exist_ok=True)
            out_path = os.path.join(out_dir, f"datos_{state.recording_letter.upper()}.npy")
            np.save(out_path, datos_np)
            print(f"Backend: Grabadas {LETTER_SAMPLES_PER_RECORDING} muestras de '{state.recording_letter}'")
            state.is_recording = False
        return {"status": "recording", "samples": len(state.recorded_samples)}
    
    if state.is_recording_word and state.recording_word_name:
        state.word_recorded_samples.append(request.landmarks)
        if len(state.word_recorded_samples) >= WORD_SAMPLES_PER_RECORDING:
            datos_np = np.array(state.word_recorded_samples)
            out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_palabras"))
            os.makedirs(out_dir, exist_ok=True)
            safe_name = "".join(c for c in state.recording_word_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
            out_path = os.path.join(out_dir, f"palabra_{safe_name}.npy")
            np.save(out_path, datos_np)
            print(f"Backend: Grabadas {WORD_SAMPLES_PER_RECORDING} muestras de '{state.recording_word_name}'")
            state.is_recording_word = False
        return {"status": "recording_word", "samples": len(state.word_recorded_samples)}

    return {"status": "idle"}

# ---------- Prediction Mode Endpoints ----------

@app.post("/prediction_mode")
async def set_prediction_mode(mode: str):
    """Set the prediction mode to 'letters', 'words', or 'dynamic'"""
    if mode not in ("letters", "words", "dynamic"):
        raise HTTPException(status_code=400, detail="Mode must be 'letters', 'words', or 'dynamic'")
    state.prediction_mode = mode
    state.current_letter = ""
    state.current_confidence = 0.0
    state.current_word = ""
    state.current_word_confidence = 0.0
    state.current_dynamic = ""
    state.current_dynamic_confidence = 0.0
    state.dynamic_buffer = []
    if state.is_recording:
        state.is_recording = False
        state.recorded_samples = []
    if state.is_recording_word:
        state.is_recording_word = False
        state.word_recorded_samples = []
    if state.is_recording_dynamic:
        state.is_recording_dynamic = False
        state.dynamic_recorded_frames = []
    print(f"Backend: Modo de prediccion cambiado a '{mode}'")
    return {"msg": f"Prediction mode set to '{mode}'", "mode": mode}

@app.get("/prediction_mode")
def get_prediction_mode():
    return {"mode": state.prediction_mode}

# ---------- Compatibility Endpoints to Support Frontend/Backend Route Differences ----------

class RecordingStartRequest(BaseModel):
    letter: str

@app.post("/recording/start")
async def recording_start(req: RecordingStartRequest):
    return await start_capture(req.letter)

class RecordingWordStartRequest(BaseModel):
    word_name: str

@app.post("/recording_word/start")
async def recording_word_start(req: RecordingWordStartRequest):
    return await start_capture_word(req.word_name)

@app.post("/train_word")
async def train_word_alias():
    return await train_word_model()

@app.delete("/registered_words/{word_name}")
async def delete_word_alias(word_name: str):
    return await delete_word(word_name)

@app.post("/recording/stop")
def stop_recording():
    """Stops all recording types"""
    state.is_recording = False
    state.is_recording_word = False
    state.is_recording_dynamic = False
    state.recorded_samples = []
    state.word_recorded_samples = []
    state.dynamic_recorded_frames = []
    return {"msg": "Grabación detenida correctamente"}


