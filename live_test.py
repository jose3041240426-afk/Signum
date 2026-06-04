import cv2
import mediapipe as mp
import pickle
import time
import numpy as np
from lsm_utils import normalize_landmarks

print("Loading model...")
with open('modelo_lsm.pkl', 'rb') as f:
    model = pickle.load(f)

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Cannot open camera")
    exit()

print("Camera opened. Trying to read 10 frames...")
for i in range(10):
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame")
        continue
    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(image_rgb)
    if results.multi_hand_landmarks:
        for hl in results.multi_hand_landmarks:
            datos = normalize_landmarks(hl)
            pred = model.predict([datos])[0]
            probs = model.predict_proba([datos])[0]
            conf = float(probs[np.argmax(probs)] * 100)
            print(f"Frame {i}: Detected hand, prediction: {pred} ({conf:.1f}%)")
    else:
        print(f"Frame {i}: No hands detected")
    time.sleep(0.1)

cap.release()
hands.close()
