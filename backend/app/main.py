import os
import io
import sys
import time
import pickle
import threading
import numpy as np
import cv2
import mediapipe as mp
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from gtts import gTTS

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
MODEL_DIR = os.path.join(BASE_DIR, "ml")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(WORDS_DATA_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

# Word recording constants
WORD_SEQ_LENGTH = 30
WORD_FEATURES = 63
WORD_SAMPLES_PER_RECORDING = 30
WORD_MAX_NAME_LEN = 30

app = FastAPI(title="LSM Unified Capture, Training & Inference API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits all origins for easy development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model
model = None
word_model = None
word_label_encoder = None

def load_lsm_model():
    global model
    model_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "modelo_lsm.pkl"))
    if os.path.exists(model_path):
        try:
            with open(model_path, "rb") as f:
                model = pickle.load(f)
            print(f"Backend: modelo_lsm.pkl cargado exitosamente.")
            return True
        except Exception as e:
            print(f"Error al cargar modelo_lsm.pkl: {e}")
    else:
        print("Backend: modelo_lsm.pkl no encontrado. Corriendo en modo demo.")
        model = None
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
            print(f"Backend: modelo_palabras.pkl cargado exitosamente.")
            return True
        except Exception as e:
            print(f"Error al cargar modelo_palabras.pkl: {e}")
            word_model = None
            word_label_encoder = None
    else:
        print("Backend: modelo_palabras.pkl no encontrado.")
        word_model = None
        word_label_encoder = None
        return False

# Initial attempt to load the models
load_lsm_model()
load_word_model()

class CameraManager:
    def __init__(self):
        self.cap = None
        self.lock = threading.Lock()
        self._running = False
        self._thread = None

        # State
        self.current_letter = ""
        self.current_confidence = 0.0
        self.hand_detected = False

        # Word Prediction State
        self.current_word = ""
        self.current_word_confidence = 0.0
        self.word_prediction_buffer = []

        # Recording State
        self.is_recording = False
        self.recording_letter = ""
        self.recorded_samples = []

        # Word Recording State
        self.is_recording_word = False
        self.recording_word_name = ""
        self.word_sequence_buffer = []
        self.word_recorded_sequences = []
        self.word_frame_counter = 0

        # MediaPipe Hands
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.hands = None

        # Latest encoded JPEG frame for streaming
        self._latest_frame = None
        self._frame_event = threading.Event()

    def start(self):
        with self.lock:
            if self._running:
                return
            print("CameraManager: Abriendo camara fisica (indice 0)...")
            self.cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            if not self.cap.isOpened() or not self.cap.read()[0]:
                print("CameraManager: DSHOW fallo para index 0. Intentando default...")
                self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened() or not self.cap.read()[0]:
                print("CameraManager: Camara index 0 fallo. Intentando index 1...")
                self.cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)
            if not self.cap.isOpened() or not self.cap.read()[0]:
                self.cap = cv2.VideoCapture(1)
            
            if not self.cap.isOpened():
                print("CameraManager: ERROR: No se pudo abrir ninguna camara (0 o 1).")
                self.cap = None
                return

            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            self.cap.set(cv2.CAP_PROP_FPS, 30)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            load_lsm_model()
            self.hands = self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            self._running = True
            self._thread = threading.Thread(target=self._capture_loop, daemon=True)
            self._thread.start()

    def stop(self):
        with self.lock:
            self._running = False
        if self._thread is not None:
            self._thread.join(timeout=3)
            self._thread = None
        with self.lock:
            if self.cap is not None:
                print("CameraManager: Cerrando camara y liberando recursos...")
                self.cap.release()
                self.cap = None
            if self.hands is not None:
                self.hands.close()
                self.hands = None
            self.current_letter = ""
            self.current_confidence = 0.0
            self.hand_detected = False

    def _capture_loop(self):
        """Background thread that captures frames, runs MediaPipe + model inference,
        and stores the latest JPEG for the streaming endpoint."""
        global model
        try:
            while self._running:
                with self.lock:
                    if self.cap is None or not self.cap.isOpened():
                        break
                    ret, frame = self.cap.read()

                if not ret:
                    time.sleep(0.01)
                    continue

                # Mirror effect
                frame = cv2.flip(frame, 1)
                h, w, _ = frame.shape

                # MediaPipe
                image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image_rgb.flags.writeable = False

                letter_pred = ""
                conf_pred = 0.0
                detected = False

                results = None
                if self.hands:
                    try:
                        results = self.hands.process(image_rgb)
                    except Exception as e:
                        print(f"MediaPipe process error (recuperable): {e}")

                hand_idx = -1
                if results and results.multi_hand_landmarks:
                    detected = True
                    for hand_idx, hand_landmarks in enumerate(results.multi_hand_landmarks):
                        # Draw skeleton
                        self.mp_drawing.draw_landmarks(
                            frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS,
                            self.mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=4),
                            self.mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2, circle_radius=2)
                        )

                # Capture samples if recording (any hand)
                if self.is_recording and self.recording_letter and hand_idx >= 0:
                    try:
                        datos_normalizados = normalize_landmarks(hand_landmarks)
                        self.recorded_samples.append(datos_normalizados)
                        if len(self.recorded_samples) >= 100:
                            datos_np = np.array(self.recorded_samples)
                            out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_lsm"))
                            os.makedirs(out_dir, exist_ok=True)
                            out_path = os.path.join(out_dir, f"datos_{self.recording_letter.upper()}.npy")
                            np.save(out_path, datos_np)
                            print(f"CameraManager: Grabadas 100 muestras de '{self.recording_letter}' en {out_path}")
                            self.is_recording = False
                    except Exception as e:
                        print(f"Error en grabación: {e}")

                # Word sequence capture (any hand)
                if self.is_recording_word and self.recording_word_name and hand_idx >= 0:
                    try:
                        datos_normalizados = normalize_landmarks(hand_landmarks)
                        self.word_sequence_buffer.append(datos_normalizados)
                        self.word_frame_counter += 1

                        if len(self.word_sequence_buffer) >= WORD_SEQ_LENGTH:
                            seq = np.array(self.word_sequence_buffer[-WORD_SEQ_LENGTH:])
                            self.word_recorded_sequences.append(seq)
                            self.word_sequence_buffer = []
                            print(f"CameraManager: Secuencia {len(self.word_recorded_sequences)}/{WORD_SAMPLES_PER_RECORDING} capturada para '{self.recording_word_name}'")

                        if len(self.word_recorded_sequences) >= WORD_SAMPLES_PER_RECORDING:
                            out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_palabras"))
                            os.makedirs(out_dir, exist_ok=True)
                            safe_name = "".join(c for c in self.recording_word_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
                            all_seqs = np.array(self.word_recorded_sequences)
                            out_path = os.path.join(out_dir, f"palabra_{safe_name}.npy")
                            np.save(out_path, all_seqs)
                            print(f"CameraManager: Grabadas {WORD_SAMPLES_PER_RECORDING} secuencias de '{self.recording_word_name}' en {out_path}")
                            self.is_recording_word = False
                    except Exception as e:
                        print(f"Error en grabación de palabra: {e}")

                # Prediction — keep highest confidence across hands
                if detected and model and not self.is_recording and not self.is_recording_word:
                    try:
                        datos_normalizados = normalize_landmarks(hand_landmarks)
                        pred = model.predict([datos_normalizados])[0]
                        probs = model.predict_proba([datos_normalizados])[0]
                        idx_max = np.argmax(probs)
                        this_conf = float(probs[idx_max] * 100)
                        if this_conf > conf_pred:
                            conf_pred = this_conf
                            letter_pred = str(pred)
                    except Exception as e:
                        print(f"Error en prediccion: {e}")

                # Word prediction — accumulate frames and predict sequences
                if detected and word_model and word_label_encoder and not self.is_recording and not self.is_recording_word:
                    try:
                        datos_normalizados = normalize_landmarks(hand_landmarks)
                        self.word_prediction_buffer.append(datos_normalizados)
                        if len(self.word_prediction_buffer) >= WORD_SEQ_LENGTH:
                            seq = np.array(self.word_prediction_buffer[-WORD_SEQ_LENGTH:]).reshape(1, WORD_SEQ_LENGTH, WORD_FEATURES)
                            pred_word = word_model.predict(seq, verbose=0)
                            pred_idx = np.argmax(pred_word[0])
                            word_conf = float(pred_word[0][pred_idx] * 100)
                            if word_conf > 30:
                                word_name = word_label_encoder.inverse_transform([pred_idx])[0]
                                self.current_word = str(word_name)
                                self.current_word_confidence = word_conf
                            else:
                                self.current_word = ""
                                self.current_word_confidence = 0.0
                            self.word_prediction_buffer = self.word_prediction_buffer[-WORD_SEQ_LENGTH // 2:]
                    except Exception as e:
                        pass

                self.hand_detected = detected
                self.current_letter = letter_pred
                self.current_confidence = conf_pred

                # HUD overlay on the video frame
                if self.is_recording:
                    cv2.circle(frame, (30, 30), 8, (0, 0, 255), -1)
                    cv2.putText(frame, f"GRABANDO '{self.recording_letter}': {len(self.recorded_samples)}/100 MUESTRAS",
                        (48, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)
                    bar_w = int(w * (len(self.recorded_samples) / 100.0))
                    cv2.rectangle(frame, (0, h - 8), (bar_w, h), (0, 0, 255), -1)
                elif self.is_recording_word:
                    cv2.circle(frame, (30, 30), 8, (0, 165, 255), -1)
                    seq_count = len(self.word_recorded_sequences)
                    cv2.putText(frame, f"GRABANDO PALABRA '{self.recording_word_name}': {seq_count}/{WORD_SAMPLES_PER_RECORDING} SECS",
                        (48, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 165, 255), 2)
                    bar_w = int(w * (seq_count / WORD_SAMPLES_PER_RECORDING))
                    cv2.rectangle(frame, (0, h - 8), (bar_w, h), (0, 165, 255), -1)
                else:
                    if not model:
                        cv2.putText(frame, "MODO DEMO - SIN MODELO ENTRENADO", (15, 30),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
                    elif detected and letter_pred:
                        cv2.putText(frame, f"LSM: {letter_pred} ({conf_pred:.1f}%)", (15, 30),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                    else:
                        cv2.putText(frame, "ESPERANDO MANO...", (15, 30),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

                # Encode and store latest frame (ALWAYS, regardless of recording state)
                ret_enc, jpeg = cv2.imencode('.jpg', frame)
                if ret_enc:
                    self._latest_frame = jpeg.tobytes()
                    self._frame_event.set()

                time.sleep(0.033)  # ~30 FPS
        except Exception as ex:
            print(f"Error fatal en loop de camara: {ex}")
        finally:
            with self.lock:
                self._running = False
                if self.cap is not None:
                    print("CameraManager: Hilo terminado, liberando camara...")
                    self.cap.release()
                    self.cap = None
                if self.hands is not None:
                    self.hands.close()
                    self.hands = None

    def stream_frames(self):
        """Generator that yields MJPEG frames from the background capture thread."""
        self.start()
        while self._running:
            if self._latest_frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + self._latest_frame + b'\r\n')
            # short sleep to avoid busy loop
            time.sleep(0.03)

# Instantiate global camera manager
camera_manager = CameraManager()

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "camera_active": camera_manager.cap is not None
    }

@app.get("/video_feed")
def video_feed():
    """MJPEG streaming endpoint — reads from the background capture thread."""
    return StreamingResponse(
        camera_manager.stream_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/prediction")
def get_prediction():
    """Retrieve the current sign language prediction and recording metadata"""
    return {
        "letter": camera_manager.current_letter,
        "confidence": camera_manager.current_confidence,
        "hand_detected": camera_manager.hand_detected,
        "model_loaded": model is not None,
        "is_recording": camera_manager.is_recording,
        "recording_letter": camera_manager.recording_letter,
        "recorded_samples_count": len(camera_manager.recorded_samples),
        "word": camera_manager.current_word,
        "word_confidence": camera_manager.current_word_confidence,
        "is_recording_word": camera_manager.is_recording_word,
        "recording_word_name": camera_manager.recording_word_name,
        "word_recorded_sequences_count": len(camera_manager.word_recorded_sequences),
        "word_model_loaded": word_model is not None,
    }

@app.post("/camera/stop")
def stop_camera():
    """Forcefully stops the physical camera and releases all resources"""
    camera_manager.stop()
    return {"msg": "Camara apagada correctamente"}

@app.post("/start_capture/{letter}")
async def start_capture(letter: str):
    """Starts capturing 100 samples of the specified letter on the backend"""
    if not letter.isalpha() or len(letter) != 1:
        raise HTTPException(status_code=400, detail="La letra debe ser un solo caracter alfabetico.")
    
    camera_manager.is_recording_word = False
    camera_manager.recorded_samples = []
    camera_manager.recording_letter = letter.upper()
    camera_manager.is_recording = True
    print(f"Backend: Iniciando captura de 100 muestras para la letra '{letter.upper()}'")
    return {"msg": f"Captura iniciada para la letra '{letter.upper()}'"}


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
    """Starts capturing sequences for a dynamic word/gesture"""
    word_name = word_name.strip()
    if not word_name or len(word_name) > WORD_MAX_NAME_LEN:
        raise HTTPException(status_code=400, detail="El nombre de la palabra debe tener entre 1 y 30 caracteres.")
    if not all(c.isalnum() or c in "_ " for c in word_name):
        raise HTTPException(status_code=400, detail="Solo se permiten letras, numeros, espacios y guion bajo.")

    if camera_manager.is_recording_word:
        raise HTTPException(status_code=400, detail="Ya hay una grabación de palabra en curso.")

    camera_manager.is_recording = False
    camera_manager.word_sequence_buffer = []
    camera_manager.word_recorded_sequences = []
    camera_manager.word_frame_counter = 0
    camera_manager.recording_word_name = word_name
    camera_manager.is_recording_word = True
    print(f"Backend: Iniciando captura de {WORD_SAMPLES_PER_RECORDING} secuencias para la palabra '{word_name}'")
    return {"msg": f"Captura iniciada para la palabra '{word_name}'", "sequences_needed": WORD_SAMPLES_PER_RECORDING, "seq_length": WORD_SEQ_LENGTH}


@app.post("/stop_capture_word")
async def stop_capture_word():
    """Stops the current word recording, saving whatever has been captured so far"""
    if not camera_manager.is_recording_word:
        return {"msg": "No hay grabación de palabra en curso."}

    word_name = camera_manager.recording_word_name
    seqs = camera_manager.word_recorded_sequences
    camera_manager.is_recording_word = False

    if len(seqs) > 0:
        out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_palabras"))
        os.makedirs(out_dir, exist_ok=True)
        safe_name = "".join(c for c in word_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
        all_seqs = np.array(seqs)
        out_path = os.path.join(out_dir, f"palabra_{safe_name}.npy")
        np.save(out_path, all_seqs)
        print(f"Backend: Guardadas {len(seqs)} secuencias de '{word_name}' en {out_path}")
        return {"msg": f"Grabación detenida. Se guardaron {len(seqs)} secuencias de '{word_name}'.", "sequences_saved": len(seqs)}
    else:
        return {"msg": f"Grabación detenida. No se capturaron suficientes secuencias para '{word_name}'.", "sequences_saved": 0}


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


@app.post("/train_words")
async def train_word_model():
    """Trains an LSTM model on all palabra_*.npy files in datos_palabras"""
    global word_model, word_label_encoder
    try:
        from sklearn.preprocessing import LabelEncoder
        import tensorflow as tf
        from tensorflow import keras
        from tensorflow.keras import layers

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
            datos = np.load(ruta_archivo)
            for seq in datos:
                if seq.shape == (WORD_SEQ_LENGTH, WORD_FEATURES):
                    X.append(seq)
                    y.append(clase)

        if len(X) < 4:
            raise HTTPException(status_code=400, detail=f"Muy pocas secuencias válidas ({len(X)}). Necesitas al menos 4.")

        X = np.array(X)
        le = LabelEncoder()
        y_encoded = le.fit_transform(y)
        y_cat = keras.utils.to_categorical(y_encoded)

        num_classes = len(le.classes_)

        model_lstm = keras.Sequential([
            layers.Masking(mask_value=0.0, input_shape=(WORD_SEQ_LENGTH, WORD_FEATURES)),
            layers.LSTM(128, return_sequences=True),
            layers.Dropout(0.3),
            layers.LSTM(64),
            layers.Dropout(0.3),
            layers.Dense(64, activation='relu'),
            layers.Dropout(0.3),
            layers.Dense(num_classes, activation='softmax')
        ])

        model_lstm.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )

        model_lstm.fit(X, y_cat, epochs=50, batch_size=min(16, len(X)), verbose=0, validation_split=0.2 if len(X) >= 8 else 0.0)

        model_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "modelo_palabras.pkl"))
        encoder_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "label_encoder_palabras.pkl"))
        with open(model_path, "wb") as f:
            pickle.dump(model_lstm, f)
        with open(encoder_path, "wb") as f:
            pickle.dump(le, f)

        word_model = model_lstm
        word_label_encoder = le

        return {"msg": "Modelo de palabras entrenado con éxito!", "classes": list(le.classes_), "total_sequences": len(X)}
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"TensorFlow/Keras no está instalado. Instala con: pip install tensorflow. Error: {str(e)}")
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

class Frame(BaseModel):
    landmarks: List[float]

class PredictRequest(BaseModel):
    frames: List[Frame]

@app.post("/predict")
async def predict_compatibility(request: PredictRequest):
    return {"text": "A"}

# ---------- TTS Endpoint (with in-memory cache) ----------
tts_cache: dict[str, bytes] = {}
tts_cache_lock = threading.Lock()

def _generate_tts_bytes(text: str) -> bytes:
    """Generate TTS audio bytes for a given text, using cache."""
    key = text.strip().lower()
    with tts_cache_lock:
        if key in tts_cache:
            return tts_cache[key]
    # Generate outside lock to avoid blocking other requests
    tts = gTTS(text=text, lang="es")
    fp = io.BytesIO()
    tts.write_to_fp(fp)
    audio_bytes = fp.getvalue()
    with tts_cache_lock:
        tts_cache[key] = audio_bytes
    return audio_bytes

def _precache_single(ch: str, timeout: float = 5.0) -> bool:
    """Try to generate TTS for a single character with a timeout."""
    result = [False]
    def _inner():
        try:
            _generate_tts_bytes(ch)
            result[0] = True
        except Exception:
            pass
    t = threading.Thread(target=_inner, daemon=True)
    t.start()
    t.join(timeout=timeout)
    return result[0]

def _precache_letters():
    """Pre-generate TTS for all 26 letters so first playback is instant."""
    import string
    print("TTS Cache: Pre-generando audio para las 26 letras...")
    cached = 0
    failed = []
    for i, ch in enumerate(string.ascii_uppercase):
        success = False
        for attempt in range(2):
            if _precache_single(ch, timeout=6.0):
                success = True
                break
            time.sleep(0.5)
        if success:
            cached += 1
            print(f"  TTS [{i+1}/26] '{ch}' OK")
        else:
            failed.append(ch)
            print(f"  TTS [{i+1}/26] '{ch}' FALLO (timeout/error)")
        time.sleep(0.2)  # small delay to avoid rate limits
    print(f"TTS Cache: {cached}/26 letras cacheadas. Fallos: {failed if failed else 'ninguno'}")

# Pre-cache in background thread so server starts instantly
threading.Thread(target=_precache_letters, daemon=True).start()

class TTSRequest(BaseModel):
    text: str

@app.post("/tts")
async def tts_post(request: TTSRequest):
    text = request.text
    if not text:
        raise HTTPException(status_code=400, detail="Text required")
    try:
        audio_bytes = _generate_tts_bytes(text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tts")
def tts_get(text: str):
    if not text:
        raise HTTPException(status_code=400, detail="Text required")
    try:
        audio_bytes = _generate_tts_bytes(text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

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
    """Stops both letter and word recording"""
    camera_manager.is_recording = False
    camera_manager.is_recording_word = False
    camera_manager.recorded_samples = []
    camera_manager.word_sequence_buffer = []
    camera_manager.word_recorded_sequences = []
    return {"msg": "Grabación detenida correctamente"}


