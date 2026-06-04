import cv2
import mediapipe as mp
import numpy as np
import os
from lsm_utils import normalize_landmarks

# Crear carpeta de datos si no existe
os.makedirs("datos_lsm", exist_ok=True)

# Inicializamos MediaPipe Hands
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

# Abrimos la cámara principal
cap = cv2.VideoCapture(0)

# Configuramos MediaPipe Hands
with mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,  # Detectamos ambas manos para dibujar, pero capturamos la principal
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
) as hands:

    print("=========================================================")
    print("      CAPTURADOR DE DATOS LSM - MODELO PORTÁTIL          ")
    print("=========================================================")
    print("Este programa te permite capturar muestras para entrenar.")
    print("Las coordenadas se normalizarán para funcionar en cualquier PC.")
    print("=========================================================")
    
    while True:
        clase = input("\nEscribe la letra a capturar (ej. A, B, C) o 'salir' para terminar: ").strip().upper()
        if clase == 'SALIR':
            break
            
        if not clase:
            continue
            
        print(f"\n--- PREPARANDO CAPTURA PARA LA LETRA: '{clase}' ---")
        print("1. Coloca tu mano frente a la cámara haciendo la seña.")
        print("2. Presiona la BARRA ESPACIADORA en la ventana de video para comenzar.")
        print("3. Mantén la pose y mueve ligeramente la mano en ángulos sutiles para enriquecer el entrenamiento.")
        print("---------------------------------------------------------")
        
        datos_clase = []
        capturando = False
        
        while len(datos_clase) < 100:
            ret, frame = cap.read()
            if not ret:
                print("No se pudo acceder a la cámara.")
                break
                
            # CORRECCIÓN DE ESPEJO
            frame = cv2.flip(frame, 1)
            
            # Procesamos la imagen con MediaPipe
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(image_rgb)
            
            # Dibujamos las interfaces de texto en la imagen
            cv2.putText(frame, f"Sena actual: {clase}", (15, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 0), 2)
            
            if not capturando:
                cv2.putText(frame, "Presiona ESPACIO para iniciar captura", (15, 80), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
            else:
                cv2.putText(frame, f"Capturando: {len(datos_clase)}/100 muestras", (15, 80), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                
            # Detectamos y dibujamos los landmarks de la mano
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    mp_drawing.draw_landmarks(
                        frame, hand_landmarks, mp_hands.HAND_CONNECTIONS,
                        mp_drawing.DrawingSpec(color=(121, 22, 76), thickness=2, circle_radius=4),
                        mp_drawing.DrawingSpec(color=(250, 44, 250), thickness=2, circle_radius=2)
                    )
                    
                    # Si ya presionó espacio, guardamos los puntos normalizados
                    if capturando:
                        datos_normalizados = normalize_landmarks(hand_landmarks)
                        datos_clase.append(datos_normalizados)
            
            # Mostramos la ventana
            cv2.imshow("Capturador LSM", frame)
            
            # Atajos de teclado
            key = cv2.waitKey(1) & 0xFF
            if key == ord(' '):  # Barra espaciadora para iniciar
                capturando = True
            elif key == ord('q'):  # 'q' para abortar esta letra
                print("Captura abortada.")
                break
                
        if len(datos_clase) == 100:
            # Guardamos los datos recolectados en un archivo .npy
            datos_np = np.array(datos_clase)
            ruta_archivo = os.path.join("datos_lsm", f"datos_{clase}.npy")
            np.save(ruta_archivo, datos_np)
            print(f"--> ¡Éxito! Se guardaron 100 muestras de la letra '{clase}' en {ruta_archivo}")

# Liberamos recursos al salir del bucle principal
cap.release()
cv2.destroyAllWindows()
print("\nPrograma de captura finalizado correctamente.")
