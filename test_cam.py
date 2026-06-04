import cv2
print("Testing cameras...")
for i in range(3):
    cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
    print(f"Camera {i} (DSHOW) opened:", cap.isOpened())
    if cap.isOpened():
        ret, frame = cap.read()
        print(f" Camera {i} read success:", ret)
        cap.release()

for i in range(3):
    cap = cv2.VideoCapture(i)
    print(f"Camera {i} (Default) opened:", cap.isOpened())
    if cap.isOpened():
        ret, frame = cap.read()
        print(f" Camera {i} read success:", ret)
        cap.release()
