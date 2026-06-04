import cv2
import mediapipe as mp
import numpy as np
import pickle
import os
from lsm_utils import normalize_landmarks

# 1. Cargar el modelo entrenado
ruta_modelo = "modelo_lsm.pkl"
if not os.path.exists(ruta_modelo):
    print("=========================================================")
    print("Error: No se encontró el archivo 'modelo_lsm.pkl'.")
    print("Por favor, ejecuta primero 'paso3_entrenar.py' para entrenar tu modelo.")
    print("=========================================================")
    exit()

with open(ruta_modelo, "rb") as f:
    model = pickle.load(f)

print("¡Modelo LSM cargado con éxito! Iniciando cámara...")

# 2. Inicializar MediaPipe
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

# Abrimos la cámara (0 es la cámara principal)
cap = cv2.VideoCapture(0)

# Configuramos MediaPipe Hands
with mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
) as hands:

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("No se pudo acceder a la cámara.")
            break
            
        # CORRECCIÓN DE ESPEJO
        frame = cv2.flip(frame, 1)
        h, w, c = frame.shape
        
        # Convertimos de BGR a RGB para MediaPipe
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(image_rgb)
        
        clase_detectada = None
        certeza = 0.0
        
        # Procesamos si detecta alguna mano
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                # Dibujamos el esqueleto en pantalla
                mp_drawing.draw_landmarks(
                    frame, hand_landmarks, mp_hands.HAND_CONNECTIONS,
                    mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=4),
                    mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2, circle_radius=2)
                )
                
                # Extraemos y normalizamos coordenadas (independiente de cámara/distancia)
                datos_normalizados = normalize_landmarks(hand_landmarks)
                
                # Realizamos la predicción con el modelo cargado
                prediccion = model.predict([datos_normalizados])[0]
                probabilidades = model.predict_proba([datos_normalizados])[0]
                
                # Obtener la certeza (probabilidad más alta)
                idx_max = np.argmax(probabilidades)
                certeza = probabilidades[idx_max] * 100
                clase_detectada = prediccion
                
        # --- DISEÑO PREMIUM DE LA INTERFAZ ---
        # 1. Creamos un banner semi-transparente arriba (efecto Glassmorphism)
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, 75), (20, 20, 20), -1)
        
        # Mezclamos con transparencia
        alpha = 0.75
        frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)
        
        # 2. Dibujamos la información
        if clase_detectada:
            # Letra detectada
            cv2.putText(frame, "LETRA LSM:", (20, 48), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
            cv2.putText(frame, clase_detectada, (180, 52), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 255, 0), 4)
            
            # Porcentaje de certeza
            cv2.putText(frame, f"Certeza: {certeza:.1f}%", (w - 240, 48), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
            
            # Barra de progreso dinámica verde a la altura del separador
            ancho_barra = int(w * (certeza / 100.0))
            cv2.line(frame, (0, 73), (ancho_barra, 73), (0, 255, 0), 3)
        else:
            # Estado en espera
            cv2.putText(frame, "ESPERANDO MANO EN PANTALLA...", (20, 46), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (150, 150, 150), 2)
            
            # Línea de estado roja decorativa
            cv2.line(frame, (0, 73), (w, 73), (0, 0, 255), 2)
            
        # Atajo rápido para salir
        cv2.putText(frame, "Presiona 'q' para salir", (15, h - 15), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        # Mostramos la ventana
        cv2.imshow("Interprete de Lengua de Senas Mexicana (LSM)", frame)
        
        # Presionar 'q' para cerrar la ventana
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

# Liberamos recursos
cap.release()
cv2.destroyAllWindows()
print("\nIntérprete cerrado correctamente.")
