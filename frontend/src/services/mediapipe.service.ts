export interface MediaPipeDetectionResult {
  handDetected: boolean;
  landmarks: number[];
  canvas: HTMLCanvasElement | null;
}

type OnResult = (result: MediaPipeDetectionResult) => void;

let holisticInstance: any = null;
let cameraInstance: any = null;
let isRunning = false;

export async function initMediaPipe(
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement,
  onResult: OnResult,
  existingStream?: MediaStream | null,
): Promise<void> {
  if (isRunning) return;

  const holisticPkg = await import("@mediapipe/holistic");

  holisticInstance = new holisticPkg.Holistic({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
  });

  holisticInstance.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  const drawingPkg = await import("@mediapipe/drawing_utils");

  holisticInstance.onResults((results: any) => {
    const ctx = canvasElement.getContext("2d")!;
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;
    ctx.save();
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Holistic uses leftHandLandmarks / rightHandLandmarks (NOT multiHandLandmarks)
    const detectedHands: any[] = [];
    if (results.rightHandLandmarks) detectedHands.push(results.rightHandLandmarks);
    if (results.leftHandLandmarks) detectedHands.push(results.leftHandLandmarks);

    if (detectedHands.length > 0) {
      const drawConnections = drawingPkg.drawConnectors;
      const drawLandmarkPoints = drawingPkg.drawLandmarks;

      for (const handLandmarks of detectedHands) {
        if (drawConnections && holisticPkg?.HAND_CONNECTIONS) {
          drawConnections(ctx, handLandmarks, holisticPkg.HAND_CONNECTIONS, {
            color: "#FFFFFF",
            lineWidth: 2,
          });
        }
        if (drawLandmarkPoints) {
          drawLandmarkPoints(ctx, handLandmarks, {
            color: "#3B82F6",
            lineWidth: 1,
            radius: 3,
          });
        }
      }

      const normalized: number[] = [];
      const hand = detectedHands[0];
      const baseX = hand[0].x;
      const baseY = hand[0].y;
      const baseZ = hand[0].z;

      const translated: number[][] = [];
      let maxDist = 0;
      for (const lm of hand) {
        const dx = lm.x - baseX;
        const dy = lm.y - baseY;
        const dz = lm.z - baseZ;
        translated.push([dx, dy, dz]);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > maxDist) maxDist = dist;
      }
      if (maxDist === 0) maxDist = 1;

      for (const [x, y, z] of translated) {
        normalized.push(x / maxDist, y / maxDist, z / maxDist);
      }

      onResult({
        handDetected: true,
        landmarks: normalized,
        canvas: canvasElement,
      });
    } else {
      onResult({
        handDetected: false,
        landmarks: [],
        canvas: canvasElement,
      });
    }
    ctx.restore();
  });

  try {
    const camUtilsPkg = await import("@mediapipe/camera_utils");
    const CameraClass = camUtilsPkg.Camera;
    cameraInstance = new CameraClass(videoElement, {
      onFrame: async () => {
        if (holisticInstance) {
          await holisticInstance.send({ image: videoElement });
        }
      },
      width: 640,
      height: 480,
    });
    await cameraInstance.start();
  } catch {
    if (existingStream) {
      videoElement.srcObject = existingStream;
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      videoElement.srcObject = stream;
    }
    await videoElement.play();
    const loop = async () => {
      if (!isRunning) return;
      if (holisticInstance && videoElement.readyState >= 2) {
        await holisticInstance.send({ image: videoElement });
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  isRunning = true;
}

export async function stopMediaPipe(): Promise<void> {
  isRunning = false;
  if (cameraInstance) {
    try { cameraInstance.stop(); } catch {}
    cameraInstance = null;
  }
  if (holisticInstance) {
    try { holisticInstance.close(); } catch {}
    holisticInstance = null;
  }
}
