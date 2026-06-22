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
DYNAMIC_DATA_DIR = os.path.join(BASE_DIR, "..", "..", "datos_dinamicos")
LETTERS_MOTION_DIR = os.path.join(BASE_DIR, "..", "..", "datos_letras_movimiento")
MODEL_DIR = os.path.join(BASE_DIR, "ml")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(WORDS_DATA_DIR, exist_ok=True)
os.makedirs(DYNAMIC_DATA_DIR, exist_ok=True)
os.makedirs(LETTERS_MOTION_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

# Recording constants
LETTER_SAMPLES_PER_RECORDING = 50
WORD_SAMPLES_PER_RECORDING = 50
DYNAMIC_FRAMES_PER_SEQUENCE = 50
DYNAMICS_PER_SIGN = 3
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
dynamic_model = None
dynamic_label_encoder = None

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
            print(f"Backend: modelo_dinamico.pkl cargado exitosamente.")
            return True
        except Exception as e:
            print(f"Error al cargar modelo_dinamico.pkl: {e}")
            dynamic_model = None
            dynamic_label_encoder = None
    else:
        print("Backend: modelo_dinamico.pkl no encontrado.")
        dynamic_model = None
        dynamic_label_encoder = None
        return False

# Initial attempt to load the models
load_lsm_model()
load_word_model()
load_dynamic_model()

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

        # Prediction Mode — only one model runs at a time
        self.prediction_mode = "letters"  # "letters" | "words" | "dynamic"

        # Recording State (always static, 50 samples)
        self.is_recording = False
        self.recording_letter = ""
        self.recorded_samples = []

        # Word Recording State (static, 50 samples)
        self.is_recording_word = False
        self.recording_word_name = ""
        self.word_recorded_samples = []

        # Dynamic Recording State (sequence of frames)
        self.is_recording_dynamic = False
        self.recording_dynamic_name = ""
        self.dynamic_recorded_frames = []
        self.dynamic_sequences_saved = 0

        # Dynamic prediction buffer
        self.dynamic_buffer = []
        self.current_dynamic = ""
        self.current_dynamic_confidence = 0.0

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
                        if len(self.recorded_samples) >= LETTER_SAMPLES_PER_RECORDING:
                            datos_np = np.array(self.recorded_samples)
                            out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_lsm"))
                            os.makedirs(out_dir, exist_ok=True)
                            out_path = os.path.join(out_dir, f"datos_{self.recording_letter.upper()}.npy")
                            np.save(out_path, datos_np)
                            print(f"CameraManager: Grabadas {LETTER_SAMPLES_PER_RECORDING} muestras de '{self.recording_letter}' en {out_path}")
                            self.is_recording = False
                    except Exception as e:
                        print(f"Error en grabación: {e}")

                # Word capture (static, 50 samples)
                if self.is_recording_word and self.recording_word_name and hand_idx >= 0:
                    try:
                        datos_normalizados = normalize_landmarks(hand_landmarks)
                        self.word_recorded_samples.append(datos_normalizados)

                        if len(self.word_recorded_samples) >= WORD_SAMPLES_PER_RECORDING:
                            out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_palabras"))
                            os.makedirs(out_dir, exist_ok=True)
                            safe_name = "".join(c for c in self.recording_word_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
                            datos_np = np.array(self.word_recorded_samples)
                            out_path = os.path.join(out_dir, f"palabra_{safe_name}.npy")
                            np.save(out_path, datos_np)
                            print(f"CameraManager: Grabadas {WORD_SAMPLES_PER_RECORDING} muestras de '{self.recording_word_name}' en {out_path}")
                            self.is_recording_word = False
                    except Exception as e:
                        print(f"Error en grabación de palabra: {e}")

                # Dynamic capture (sequence of frames for movement-based signs)
                if self.is_recording_dynamic and self.recording_dynamic_name and hand_idx >= 0:
                    try:
                        datos_normalizados = normalize_landmarks(hand_landmarks)
                        self.dynamic_recorded_frames.append(datos_normalizados)

                        if len(self.dynamic_recorded_frames) >= DYNAMIC_FRAMES_PER_SEQUENCE:
                            out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_dinamicos"))
                            os.makedirs(out_dir, exist_ok=True)
                            safe_name = "".join(c for c in self.recording_dynamic_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
                            seq_np = np.array(self.dynamic_recorded_frames)
                            timestamp = int(time.time() * 1000)
                            out_path = os.path.join(out_dir, f"din_{safe_name}_{timestamp}.npy")
                            np.save(out_path, seq_np)
                            self.dynamic_sequences_saved += 1
                            print(f"CameraManager: Secuencia {self.dynamic_sequences_saved}/{DYNAMICS_PER_SIGN} de '{self.recording_dynamic_name}' guardada ({DYNAMIC_FRAMES_PER_SEQUENCE} frames)")
                            self.dynamic_recorded_frames = []
                            if self.dynamic_sequences_saved >= DYNAMICS_PER_SIGN:
                                print(f"CameraManager: {DYNAMICS_PER_SIGN} secuencias de '{self.recording_dynamic_name}' completadas.")
                                self.is_recording_dynamic = False
                    except Exception as e:
                        print(f"Error en grabación dinámica: {e}")

                # Dynamic prediction buffer (always accumulate when in dynamic mode)
                if self.prediction_mode == "dynamic" and detected and hand_idx >= 0:
                    try:
                        datos_normalizados = normalize_landmarks(hand_landmarks)
                        self.dynamic_buffer.append(datos_normalizados)
                        if len(self.dynamic_buffer) > DYNAMIC_FRAMES_PER_SEQUENCE:
                            self.dynamic_buffer = self.dynamic_buffer[-DYNAMIC_FRAMES_PER_SEQUENCE:]
                    except Exception as e:
                        pass

                # Prediction — only run the active mode's model
                if self.prediction_mode == "letters":
                    if detected and model and not self.is_recording and not self.is_recording_word and not self.is_recording_dynamic:
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
                    self.current_word = ""
                    self.current_word_confidence = 0.0
                    self.current_dynamic = ""
                    self.current_dynamic_confidence = 0.0

                elif self.prediction_mode == "words":
                    self.current_letter = ""
                    self.current_confidence = 0.0
                    letter_pred = ""
                    conf_pred = 0.0
                    self.current_dynamic = ""
                    self.current_dynamic_confidence = 0.0

                    if detected and word_model and not self.is_recording and not self.is_recording_word and not self.is_recording_dynamic:
                        try:
                            datos_normalizados = normalize_landmarks(hand_landmarks)
                            pred_word = word_model.predict([datos_normalizados])[0]
                            probs_word = word_model.predict_proba([datos_normalizados])[0]
                            idx_max = np.argmax(probs_word)
                            word_conf = float(probs_word[idx_max] * 100)
                            if word_conf > 30:
                                word_name = word_label_encoder.inverse_transform([idx_max])[0]
                                self.current_word = str(word_name)
                                self.current_word_confidence = word_conf
                            else:
                                self.current_word = ""
                                self.current_word_confidence = 0.0
                        except Exception as e:
                            pass
                    else:
                        self.current_word = ""
                        self.current_word_confidence = 0.0

                elif self.prediction_mode == "dynamic":
                    self.current_letter = ""
                    self.current_confidence = 0.0
                    letter_pred = ""
                    conf_pred = 0.0
                    self.current_word = ""
                    self.current_word_confidence = 0.0

                    if len(self.dynamic_buffer) == DYNAMIC_FRAMES_PER_SEQUENCE and dynamic_model and not self.is_recording_dynamic:
                        try:
                            seq_flattened = np.array(self.dynamic_buffer).flatten().reshape(1, -1)
                            pred_idx = dynamic_model.predict(seq_flattened)[0]
                            probs = dynamic_model.predict_proba(seq_flattened)[0]
                            idx_max = np.argmax(probs)
                            dyn_conf = float(probs[idx_max] * 100)
                            if dyn_conf > 30:
                                sign_name = dynamic_label_encoder.inverse_transform([pred_idx])[0]
                                self.current_dynamic = str(sign_name)
                                self.current_dynamic_confidence = dyn_conf
                            else:
                                self.current_dynamic = ""
                                self.current_dynamic_confidence = 0.0
                        except Exception as e:
                            print(f"Error en prediccion dinamica: {e}")
                            self.current_dynamic = ""
                            self.current_dynamic_confidence = 0.0
                    else:
                        self.current_dynamic = ""
                        self.current_dynamic_confidence = 0.0

                self.hand_detected = detected
                self.current_letter = letter_pred
                self.current_confidence = conf_pred

                # HUD overlay on the video frame
                if self.is_recording:
                    cv2.circle(frame, (30, 30), 8, (0, 0, 255), -1)
                    cv2.putText(frame, f"GRABANDO '{self.recording_letter}': {len(self.recorded_samples)}/{LETTER_SAMPLES_PER_RECORDING} MUESTRAS",
                        (48, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)
                    bar_w = int(w * (len(self.recorded_samples) / LETTER_SAMPLES_PER_RECORDING))
                    cv2.rectangle(frame, (0, h - 8), (bar_w, h), (0, 0, 255), -1)
                elif self.is_recording_word:
                    cv2.circle(frame, (30, 30), 8, (0, 165, 255), -1)
                    sample_count = len(self.word_recorded_samples)
                    cv2.putText(frame, f"GRABANDO PALABRA '{self.recording_word_name}': {sample_count}/{WORD_SAMPLES_PER_RECORDING} MUESTRAS",
                        (48, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 165, 255), 2)
                    bar_w = int(w * (sample_count / WORD_SAMPLES_PER_RECORDING))
                    cv2.rectangle(frame, (0, h - 8), (bar_w, h), (0, 165, 255), -1)
                elif self.is_recording_dynamic:
                    cv2.circle(frame, (30, 30), 8, (255, 0, 255), -1)
                    frame_count = len(self.dynamic_recorded_frames)
                    progress = self.dynamic_sequences_saved + (frame_count / DYNAMIC_FRAMES_PER_SEQUENCE)
                    total = DYNAMICS_PER_SIGN
                    cv2.putText(frame, f"DINAMICO '{self.recording_dynamic_name}': seq {self.dynamic_sequences_saved+1}/{total} ({frame_count}/{DYNAMIC_FRAMES_PER_SEQUENCE})",
                        (48, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 2)
                    bar_w = int(w * (progress / total))
                    cv2.rectangle(frame, (0, h - 8), (bar_w, h), (255, 0, 255), -1)
                else:
                    if self.prediction_mode == "dynamic":
                        if not dynamic_model:
                            cv2.putText(frame, "MODO DEMO - SIN MODELO DINAMICO", (15, 30),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 255), 2)
                        elif detected and self.current_dynamic:
                            cv2.putText(frame, f"DINAMICO: {self.current_dynamic} ({self.current_dynamic_confidence:.1f}%)", (15, 30),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                        else:
                            buf_len = len(self.dynamic_buffer)
                            cv2.putText(frame, f"DINAMICO - Buffer: {buf_len}/{DYNAMIC_FRAMES_PER_SEQUENCE}", (15, 30),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 165, 0), 2)
                    elif self.prediction_mode == "words":
                        if not word_model:
                            cv2.putText(frame, "MODO DEMO - SIN MODELO DE PALABRAS", (15, 30),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
                        elif detected and self.current_word:
                            cv2.putText(frame, f"PALABRA: {self.current_word} ({self.current_word_confidence:.1f}%)", (15, 30),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                        else:
                            cv2.putText(frame, "ESPERANDO MANO...", (15, 30),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
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
        "word_model_loaded": word_model is not None,
        "dynamic_model_loaded": dynamic_model is not None,
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
        "prediction_mode": camera_manager.prediction_mode,
        "word": camera_manager.current_word,
        "word_confidence": camera_manager.current_word_confidence,
        "is_recording_word": camera_manager.is_recording_word,
        "recording_word_name": camera_manager.recording_word_name,
        "word_recorded_samples_count": len(camera_manager.word_recorded_samples),
        "word_model_loaded": word_model is not None,
        "dynamic_sign": camera_manager.current_dynamic,
        "dynamic_confidence": camera_manager.current_dynamic_confidence,
        "is_recording_dynamic": camera_manager.is_recording_dynamic,
        "recording_dynamic_name": camera_manager.recording_dynamic_name,
        "dynamic_recorded_frames": len(camera_manager.dynamic_recorded_frames),
        "dynamic_sequences_saved": camera_manager.dynamic_sequences_saved,
        "dynamic_buffer_len": len(camera_manager.dynamic_buffer),
        "dynamic_model_loaded": dynamic_model is not None,
    }

@app.post("/camera/stop")
def stop_camera():
    """Forcefully stops the physical camera and releases all resources"""
    camera_manager.stop()
    return {"msg": "Camara apagada correctamente"}

@app.post("/start_capture/{letter}")
async def start_capture(letter: str):
    """Starts capturing 50 samples of the specified letter on the backend"""
    if not letter.isalpha() or len(letter) != 1:
        raise HTTPException(status_code=400, detail="La letra debe ser un solo caracter alfabetico.")
    
    camera_manager.is_recording_word = False
    camera_manager.recorded_samples = []
    camera_manager.recording_letter = letter.upper()
    camera_manager.is_recording = True
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

    if camera_manager.is_recording_word:
        raise HTTPException(status_code=400, detail="Ya hay una grabación de palabra en curso.")

    camera_manager.is_recording = False
    camera_manager.word_recorded_samples = []
    camera_manager.recording_word_name = word_name
    camera_manager.is_recording_word = True
    print(f"Backend: Iniciando captura de {WORD_SAMPLES_PER_RECORDING} muestras para la palabra '{word_name}'")
    return {"msg": f"Captura iniciada para la palabra '{word_name}'", "samples_needed": WORD_SAMPLES_PER_RECORDING}


@app.post("/stop_capture_word")
async def stop_capture_word():
    """Stops the current word recording, saving whatever has been captured so far"""
    if not camera_manager.is_recording_word:
        return {"msg": "No hay grabación de palabra en curso."}

    word_name = camera_manager.recording_word_name
    samples = camera_manager.word_recorded_samples
    camera_manager.is_recording_word = False

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

    if camera_manager.is_recording_dynamic:
        raise HTTPException(status_code=400, detail="Ya hay una grabacion dinamica en curso.")

    camera_manager.is_recording = False
    camera_manager.is_recording_word = False
    camera_manager.dynamic_recorded_frames = []
    camera_manager.recording_dynamic_name = sign_name
    camera_manager.dynamic_sequences_saved = 0
    camera_manager.is_recording_dynamic = True
    print(f"Backend: Iniciando captura dinamica de {DYNAMICS_PER_SIGN} secuencias x {DYNAMIC_FRAMES_PER_SEQUENCE} frames para '{sign_name}'")
    return {
        "msg": f"Captura dinamica iniciada para '{sign_name}'",
        "sequences_needed": DYNAMICS_PER_SIGN,
        "frames_per_sequence": DYNAMIC_FRAMES_PER_SEQUENCE,
    }

@app.post("/stop_capture_dynamic")
async def stop_capture_dynamic():
    """Stops the current dynamic recording, saving whatever has been captured so far"""
    if not camera_manager.is_recording_dynamic:
        return {"msg": "No hay grabacion dinamica en curso."}

    sign_name = camera_manager.recording_dynamic_name
    saved = camera_manager.dynamic_sequences_saved
    remaining_frames = len(camera_manager.dynamic_recorded_frames)
    camera_manager.is_recording_dynamic = False
    camera_manager.dynamic_recorded_frames = []

    if remaining_frames > 0:
        out_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "datos_dinamicos"))
        os.makedirs(out_dir, exist_ok=True)
        safe_name = "".join(c for c in sign_name if c.isalnum() or c in "_ ").strip().replace(" ", "_")
        seq_np = np.array(camera_manager.dynamic_recorded_frames[:DYNAMIC_FRAMES_PER_SEQUENCE])
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

# ---------- Prediction Mode Endpoints ----------

@app.post("/prediction_mode")
async def set_prediction_mode(mode: str):
    """Set the prediction mode to 'letters', 'words', or 'dynamic'"""
    if mode not in ("letters", "words", "dynamic"):
        raise HTTPException(status_code=400, detail="Mode must be 'letters', 'words', or 'dynamic'")
    camera_manager.prediction_mode = mode
    camera_manager.current_letter = ""
    camera_manager.current_confidence = 0.0
    camera_manager.current_word = ""
    camera_manager.current_word_confidence = 0.0
    camera_manager.current_dynamic = ""
    camera_manager.current_dynamic_confidence = 0.0
    camera_manager.dynamic_buffer = []
    if camera_manager.is_recording:
        camera_manager.is_recording = False
        camera_manager.recorded_samples = []
    if camera_manager.is_recording_word:
        camera_manager.is_recording_word = False
        camera_manager.word_recorded_samples = []
    if camera_manager.is_recording_dynamic:
        camera_manager.is_recording_dynamic = False
        camera_manager.dynamic_recorded_frames = []
    print(f"Backend: Modo de prediccion cambiado a '{mode}'")
    return {"msg": f"Prediction mode set to '{mode}'", "mode": mode}

@app.get("/prediction_mode")
def get_prediction_mode():
    return {"mode": camera_manager.prediction_mode}

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
    camera_manager.is_recording = False
    camera_manager.is_recording_word = False
    camera_manager.is_recording_dynamic = False
    camera_manager.recorded_samples = []
    camera_manager.word_recorded_samples = []
    camera_manager.dynamic_recorded_frames = []
    return {"msg": "Grabación detenida correctamente"}


