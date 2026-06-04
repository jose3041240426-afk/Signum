import cv2
import mediapipe as mp

# Inicializamos MediaPipe y las utilidades para dibujar
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils

# Abrimos la cámara (0 es la cámara principal)
cap = cv2.VideoCapture(0)

# Configuramos el modelo Holistic
with mp_holistic.Holistic(
    min_detection_confidence=0.5, 
    min_tracking_confidence=0.5) as holistic:

    while cap.isOpened():
        # Leemos el frame de la cámara
        ret, frame = cap.read()
        if not ret:
            print("No se pudo acceder a la cámara.")
            break

        # CORRECCIÓN DE ESPEJO: Invertimos la imagen para que sea intuitivo
        frame = cv2.flip(frame, 1)

        # Convertimos la imagen de BGR (OpenCV) a RGB (MediaPipe)
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Procesamos la imagen con el modelo Holistic
        results = holistic.process(image_rgb)

        # Volvemos a BGR para mostrarla con OpenCV
        image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)

        # --- DIBUJAMOS LOS RESULTADOS ---

        # 1. Rostro
        if results.face_landmarks:
            mp_drawing.draw_landmarks(
                image_bgr, results.face_landmarks, mp_holistic.FACEMESH_CONTOURS,
                mp_drawing.DrawingSpec(color=(80,110,10), thickness=1, circle_radius=1),
                mp_drawing.DrawingSpec(color=(80,256,121), thickness=1, circle_radius=1)
            )

        # 2. Pose (Hombros, brazos, torso)
        if results.pose_landmarks:
            mp_drawing.draw_landmarks(
                image_bgr, results.pose_landmarks, mp_holistic.POSE_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=4),
                mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2)
            )

        # 3. Mano Izquierda
        if results.left_hand_landmarks:
            mp_drawing.draw_landmarks(
                image_bgr, results.left_hand_landmarks, mp_holistic.HAND_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(121,22,76), thickness=2, circle_radius=4),
                mp_drawing.DrawingSpec(color=(121,44,250), thickness=2, circle_radius=2)
            )

        # 4. Mano Derecha
        if results.right_hand_landmarks:
            mp_drawing.draw_landmarks(
                image_bgr, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(0,255,0), thickness=2, circle_radius=4),
                mp_drawing.DrawingSpec(color=(0,0,255), thickness=2, circle_radius=2)
            )

        # Mostramos la ventana
        cv2.imshow('Detector de Señas - MVP', image_bgr)

        # Presiona 'q' para salir
        if cv2.waitKey(10) & 0xFF == ord('q'):
            break

# Liberamos recursos
cap.release()
cv2.destroyAllWindows()