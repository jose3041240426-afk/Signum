export interface MediaPipeDetectionResult {
  handDetected: boolean;
  landmarks: number[];
  canvas: HTMLCanvasElement | null;
}

type OnResult = (result: MediaPipeDetectionResult) => void;

let holisticInstance: any = null;
let isRunning = false;

const MEDIAPIPE_VERSION = "0.5.1675471629";
const FRAME_INTERVAL_MS = 50;

export async function initMediaPipe(
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement,
  onResult: OnResult,
  existingStream?: MediaStream | null,
): Promise<void> {
  if (isRunning) {
    await stopMediaPipe();
  }

  const holisticPkg = await import("@mediapipe/holistic");
  const HolisticConstructor =
    holisticPkg.Holistic ||
    (holisticPkg as any).default?.Holistic ||
    (holisticPkg as any).default;
  const handConnections =
    holisticPkg.HAND_CONNECTIONS ||
    (holisticPkg as any).default?.HAND_CONNECTIONS;

  holisticInstance = new HolisticConstructor({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@${MEDIAPIPE_VERSION}/${file}`,
  });

  holisticInstance.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
    selfieMode: true,
  });

  const drawingPkg = await import("@mediapipe/drawing_utils");
  const drawConnections =
    drawingPkg.drawConnectors ||
    (drawingPkg as any).default?.drawConnectors ||
    (drawingPkg as any).default;
  const drawLandmarkPoints =
    drawingPkg.drawLandmarks ||
    (drawingPkg as any).default?.drawLandmarks ||
    (drawingPkg as any).default;

  holisticInstance.onResults((results: any) => {
    const ctx = canvasElement.getContext("2d");
    if (!ctx) return;
    const w = videoElement.videoWidth || 800;
    const h = videoElement.videoHeight || 600;
    if (canvasElement.width !== w) canvasElement.width = w;
    if (canvasElement.height !== h) canvasElement.height = h;
    ctx.save();
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.translate(canvasElement.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    const detectedHands: any[] = [];
    if (results.rightHandLandmarks) detectedHands.push(results.rightHandLandmarks);
    if (results.leftHandLandmarks) detectedHands.push(results.leftHandLandmarks);

    let result: MediaPipeDetectionResult;

    if (detectedHands.length > 0) {
      for (const handLandmarks of detectedHands) {
        if (drawConnections && handConnections) {
          drawConnections(ctx, handLandmarks, handConnections, {
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

      result = {
        handDetected: true,
        landmarks: normalized,
        canvas: canvasElement,
      };
    } else {
      result = {
        handDetected: false,
        landmarks: [],
        canvas: canvasElement,
      };
    }

    ctx.restore();
    if (isRunning) onResult(result);
  });

  if (existingStream) {
    videoElement.srcObject = existingStream;
  } else {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 800, height: 600, facingMode: "user" },
    });
    videoElement.srcObject = stream;
  }

  await videoElement.play();
  isRunning = true;

  let lastSendTime = 0;
  const loop = async (timestamp: number) => {
    if (!isRunning) return;
    if (timestamp - lastSendTime >= FRAME_INTERVAL_MS) {
      if (holisticInstance && videoElement.readyState >= 2) {
        lastSendTime = timestamp;
        try {
          await holisticInstance.send({ image: videoElement });
        } catch (err) {
          console.error("[Signum] Error sending frame to holisticInstance:", err);
        }
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export async function stopMediaPipe(): Promise<void> {
  isRunning = false;
  if (holisticInstance) {
    try {
      holisticInstance.close();
    } catch {}
    holisticInstance = null;
  }
}
