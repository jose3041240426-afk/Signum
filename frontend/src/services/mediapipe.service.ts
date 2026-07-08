export interface MediaPipeDetectionResult {
  handDetected: boolean;
  landmarks: number[];
  canvas: HTMLCanvasElement | null;
}

type OnResult = (result: MediaPipeDetectionResult) => void;

let handLandmarkerInstance: any = null;
let isRunning = false;
let animFrameId: number | null = null;
let isCanvasMirrored = true;

export function setMirrored(mirrored: boolean) {
  isCanvasMirrored = mirrored;
}

// Hand connections for drawing (21 landmarks, standard MediaPipe topology)
const HAND_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],       // thumb
  [0,5],[5,6],[6,7],[7,8],       // index
  [0,9],[9,10],[10,11],[11,12],  // middle (connect to wrist)
  [0,13],[13,14],[14,15],[15,16],// ring (connect to wrist)
  [0,17],[17,18],[18,19],[19,20],// pinky (connect to wrist)
  [5,9],[9,13],[13,17],          // palm
];

export async function initMediaPipe(
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement,
  onResult: OnResult,
  existingStream?: MediaStream | null,
): Promise<void> {
  if (isRunning) {
    await stopMediaPipe();
  }

  // Use the modern tasks-vision HandLandmarker (MUCH faster than Holistic)
  const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
  );

  handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
      delegate: "GPU",
    },
    numHands: 2,
    runningMode: "VIDEO",
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  if (existingStream) {
    videoElement.srcObject = existingStream;
    try {
      await videoElement.play();
    } catch (e) {
      console.warn("[Signum] video.play() failed:", e);
    }
  }

  isRunning = true;

  // Render loop: 60fps video + hand overlay, detection runs synchronously
  let lastDetectTime = 0;
  let cachedResults: any = null;
  const DETECT_INTERVAL = 60; // detect every ~60ms (~16fps AI, plenty fast)

  const renderLoop = () => {
    if (!isRunning) return;

    const ctx = canvasElement.getContext("2d");
    if (!ctx || videoElement.readyState < 2) {
      animFrameId = requestAnimationFrame(renderLoop);
      return;
    }

    const w = videoElement.videoWidth || 640;
    const h = videoElement.videoHeight || 480;
    if (canvasElement.width !== w) canvasElement.width = w;
    if (canvasElement.height !== h) canvasElement.height = h;

    // 1) Draw video (mirrored or normal)
    ctx.save();
    if (isCanvasMirrored) {
      ctx.translate(canvasElement.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    ctx.restore();

    // 2) Run hand detection at throttled rate
    const now = performance.now();
    if (handLandmarkerInstance && now - lastDetectTime >= DETECT_INTERVAL) {
      try {
        cachedResults = handLandmarkerInstance.detectForVideo(videoElement, now);
      } catch {}
      lastDetectTime = now;
    }

    // 3) Draw cached hand results & compute landmarks for prediction
    let detectionResult: MediaPipeDetectionResult;

    if (cachedResults && cachedResults.landmarks && cachedResults.landmarks.length > 0) {
      // Draw each detected hand
      for (let i = 0; i < cachedResults.landmarks.length; i++) {
        const lms = cachedResults.landmarks[i];
        // Handedness: tasks-vision reports the PERSON's hand based on anatomy
        // "Right" = person's right hand, "Left" = person's left hand
        const handedness = cachedResults.handedness?.[i]?.[0];
        const isRightHand = handedness?.categoryName === "Right";
        // Since we mirror the canvas, person's right hand appears on right side
        const label = isRightHand ? "Derecha" : "Izquierda";
        const color = isRightHand ? "#4ade80" : "#60a5fa";

        drawHand(ctx, lms, label, color, canvasElement.width, canvasElement.height);
      }

      // Normalize the first detected hand for prediction (same format as before)
      const firstHand = cachedResults.landmarks[0];
      const baseX = firstHand[0].x;
      const baseY = firstHand[0].y;
      const baseZ = firstHand[0].z;

      const translated: number[][] = [];
      let maxDist = 0;
      for (const lm of firstHand) {
        const dx = lm.x - baseX;
        const dy = lm.y - baseY;
        const dz = lm.z - baseZ;
        translated.push([dx, dy, dz]);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > maxDist) maxDist = dist;
      }
      if (maxDist === 0) maxDist = 1;

      const normalized: number[] = [];
      for (const [x, y, z] of translated) {
        normalized.push(x / maxDist, y / maxDist, z / maxDist);
      }

      detectionResult = {
        handDetected: true,
        landmarks: normalized,
        canvas: canvasElement,
      };
    } else {
      detectionResult = {
        handDetected: false,
        landmarks: [],
        canvas: canvasElement,
      };
    }

    if (isRunning) onResult(detectionResult);

    animFrameId = requestAnimationFrame(renderLoop);
  };

  animFrameId = requestAnimationFrame(renderLoop);
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number; z: number }[],
  label: string,
  color: string,
  cw: number,
  ch: number,
) {
  // landmarks are in raw (non-mirrored) coords. Mirror x if isCanvasMirrored is true.
  const pts = landmarks.map((lm) => ({
    x: isCanvasMirrored ? (1 - lm.x) * cw : lm.x * cw,
    y: lm.y * ch,
  }));

  // Draw connections
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
    ctx.stroke();
  }

  // Draw landmark points
  for (const pt of pts) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#3B82F6";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pt of pts) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const pad = 18;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
  ctx.setLineDash([]);

  // Label pill
  ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
  const textW = ctx.measureText(label).width;
  const pillX = minX - pad;
  const pillY = minY - pad - 28;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, textW + 16, 24, 6);
  ctx.fill();

  ctx.fillStyle = "#000";
  ctx.fillText(label, pillX + 8, pillY + 17);
}

export async function stopMediaPipe(): Promise<void> {
  isRunning = false;
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (handLandmarkerInstance) {
    try {
      handLandmarkerInstance.close();
    } catch {}
    handLandmarkerInstance = null;
  }
}
