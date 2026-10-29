import crypto from "crypto";
import fs from "fs";
import path from "path";
import jpeg from "jpeg-js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ort = require("onnxruntime-node");
import { getManifestCanonicalHash, IngestError } from "./inspection-service";

export interface VisionAnalysis {
  modelVersion: string;
  inferenceMs: number;
  classificationMs: number;
  localizationMs: number | null;
  localizationStatus: "completed" | "skipped" | "failed";
  outcome: "ok" | "defect" | "unknown";
  probabilities: { ok: number; defect: number } | null;
  confidence: number | null;
  errorCode?: "model_unavailable" | "low_confidence" | "unsupported_input";
  imageWidth: number;
  imageHeight: number;
  imageSha256: string;
  boundingBoxes: {
    id: string;
    label: "defect";
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }[];
}

interface ManifestModelInfo {
  modelPath: string;
  sha256: string;
  byteSize: number;
  inputName: string;
  outputName: string;
  inputShape: number[];
  outputShape: number[];
  classes: string[];
}

interface ManifestClassifierInfo extends ManifestModelInfo {
  thresholds: {
    defect: number;
    ok: number;
  };
}

interface ManifestDetectorInfo extends ManifestModelInfo {
  scoreThreshold: number;
  iouThreshold: number;
  iomThreshold: number;
}

interface ModelManifest {
  manifestVersion: number;
  preprocessingVersion: string;
  productFamily: string;
  classifier: ManifestClassifierInfo;
  detector: ManifestDetectorInfo;
  runtime?: {
    preferredProvider?: string;
    threads?: number;
  };
}
interface OrtTensor {
  data: Float32Array;
}

interface OrtInferenceSession {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
}


interface RuntimeSessions {
  manifest: ModelManifest;
  modelVersion: string;
  clsSession: OrtInferenceSession;
  detSession: OrtInferenceSession;
}

let sessionInitPromise: Promise<RuntimeSessions> | null = null;

async function initSessions(): Promise<RuntimeSessions> {
  const baseDir = path.join(process.cwd(), "ai_models");
  const manifestPath = path.join(baseDir, "model-manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Model manifest missing at ${manifestPath}`
    );
  }

  let manifest: ModelManifest;
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    manifest = JSON.parse(raw) as ModelManifest;
  } catch (err) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Failed to parse model manifest: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const clsInfo = manifest.classifier;
  const detInfo = manifest.detector;

  if (!clsInfo || !detInfo) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      "Model manifest missing classifier or detector definition"
    );
  }

  const clsFile = path.join(baseDir, clsInfo.modelPath);
  const detFile = path.join(baseDir, detInfo.modelPath);

  if (!fs.existsSync(clsFile)) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Classifier weights missing at ${clsFile}`
    );
  }
  if (!fs.existsSync(detFile)) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Detector weights missing at ${detFile}`
    );
  }

  // Verify classifier hash
  const clsBytes = fs.readFileSync(clsFile);
  const clsHash = crypto.createHash("sha256").update(clsBytes).digest("hex");
  if (clsHash.toLowerCase() !== clsInfo.sha256.toLowerCase()) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Classifier SHA-256 mismatch: expected ${clsInfo.sha256}, got ${clsHash}`
    );
  }

  // Verify detector hash
  const detBytes = fs.readFileSync(detFile);
  const detHash = crypto.createHash("sha256").update(detBytes).digest("hex");
  if (detHash.toLowerCase() !== detInfo.sha256.toLowerCase()) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Detector SHA-256 mismatch: expected ${detInfo.sha256}, got ${detHash}`
    );
  }

  const sessionOptions = {
    intraOpNumThreads: manifest.runtime?.threads ?? 2,
    interOpNumThreads: 1,
    executionMode: "sequential",
  };

  let clsSession: OrtInferenceSession;
  let detSession: OrtInferenceSession;
  try {
    clsSession = await ort.InferenceSession.create(clsFile, sessionOptions);
    detSession = await ort.InferenceSession.create(detFile, sessionOptions);
  } catch (err) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Failed to initialize ONNX inference sessions: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Verify input/output names and shapes
  if (!clsSession.inputNames.includes(clsInfo.inputName)) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Classifier session missing input '${clsInfo.inputName}'`
    );
  }
  if (!clsSession.outputNames.includes(clsInfo.outputName)) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Classifier session missing output '${clsInfo.outputName}'`
    );
  }
  if (!detSession.inputNames.includes(detInfo.inputName)) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Detector session missing input '${detInfo.inputName}'`
    );
  }
  if (!detSession.outputNames.includes(detInfo.outputName)) {
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Detector session missing output '${detInfo.outputName}'`
    );
  }

  // Compute canonical modelVersion using existing getManifestCanonicalHash only after validation
  const modelVersion = getManifestCanonicalHash();

  return {
    manifest,
    modelVersion,
    clsSession,
    detSession,
  };
}

function getRuntimeSessions(): Promise<RuntimeSessions> {
  if (!sessionInitPromise) {
    sessionInitPromise = initSessions().catch((err) => {
      // Clear promise so next call can retry
      sessionInitPromise = null;
      throw err;
    });
  }
  return sessionInitPromise;
}

/**
 * Pixel-center bilinear resize with edge clamping and rounded uint8 output,
 * matching OpenCV INTER_LINEAR uint8 semantics.
 * Returns float32 NCHW tensor divided by 255.0.
 */
function createRoiTensor(
  srcRgb: Uint8Array,
  srcW: number,
  srcH: number,
  offX: number,
  offY: number,
  roiSide: number,
  targetSize: number
): OrtTensor {
  const planeSize = targetSize * targetSize;
  const floatData = new Float32Array(3 * planeSize);
  const scale = roiSide / targetSize;

  for (let dy = 0; dy < targetSize; dy++) {
    const srcY = (dy + 0.5) * scale - 0.5;
    let y0 = Math.floor(srcY);
    let y1 = y0 + 1;
    const fy = srcY - y0;
    const wy1 = fy;
    const wy0 = 1 - wy1;

    y0 = Math.max(0, Math.min(roiSide - 1, y0));
    y1 = Math.max(0, Math.min(roiSide - 1, y1));

    const row0 = (y0 + offY) * srcW;
    const row1 = (y1 + offY) * srcW;

    for (let dx = 0; dx < targetSize; dx++) {
      const srcX = (dx + 0.5) * scale - 0.5;
      let x0 = Math.floor(srcX);
      let x1 = x0 + 1;
      const fx = srcX - x0;
      const wx1 = fx;
      const wx0 = 1 - wx1;

      x0 = Math.max(0, Math.min(roiSide - 1, x0));
      x1 = Math.max(0, Math.min(roiSide - 1, x1));

      const idx00 = (row0 + (x0 + offX)) * 3;
      const idx01 = (row0 + (x1 + offX)) * 3;
      const idx10 = (row1 + (x0 + offX)) * 3;
      const idx11 = (row1 + (x1 + offX)) * 3;

      const pIdx = dy * targetSize + dx;
      for (let c = 0; c < 3; c++) {
        const val0 = wx0 * srcRgb[idx00 + c] + wx1 * srcRgb[idx01 + c];
        const val1 = wx0 * srcRgb[idx10 + c] + wx1 * srcRgb[idx11 + c];
        const val = wy0 * val0 + wy1 * val1;
        const uint8Val = Math.round(val);
        floatData[c * planeSize + pIdx] = uint8Val / 255.0;
      }
    }
  }

  return new ort.Tensor("float32", floatData, [1, 3, targetSize, targetSize]);
}

function nmsBoxes(
  boxes: number[][],
  scores: number[],
  iouThresh: number,
  iomThresh: number
): number[] {
  const n = boxes.length;
  if (n === 0) return [];

  const x1 = new Float32Array(n);
  const y1 = new Float32Array(n);
  const x2 = new Float32Array(n);
  const y2 = new Float32Array(n);
  const areas = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const b = boxes[i];
    x1[i] = b[0] - b[2] / 2;
    y1[i] = b[1] - b[3] / 2;
    x2[i] = b[0] + b[2] / 2;
    y2[i] = b[1] + b[3] / 2;
    areas[i] = Math.max(0, x2[i] - x1[i]) * Math.max(0, y2[i] - y1[i]);
  }

  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => scores[b] - scores[a]);

  const keep: number[] = [];
  const suppressed = new Uint8Array(n);

  for (let idx = 0; idx < n; idx++) {
    const i = order[idx];
    if (suppressed[i]) continue;
    keep.push(i);

    for (let jdx = idx + 1; jdx < n; jdx++) {
      const j = order[jdx];
      if (suppressed[j]) continue;

      const xx1 = Math.max(x1[i], x1[j]);
      const yy1 = Math.max(y1[i], y1[j]);
      const xx2 = Math.min(x2[i], x2[j]);
      const yy2 = Math.min(y2[i], y2[j]);

      const w = Math.max(0, xx2 - xx1);
      const h = Math.max(0, yy2 - yy1);
      const inter = w * h;

      const union = areas[i] + areas[j] - inter + 1e-6;
      const ovr = inter / union;

      const minArea = Math.min(areas[i], areas[j]) + 1e-6;
      const containment = inter / minArea;

      if (ovr > iouThresh || containment > iomThresh) {
        suppressed[j] = 1;
      }
    }
  }

  return keep;
}

export async function analyzeJpeg(jpegBytes: Buffer): Promise<VisionAnalysis> {
  // 1. Validate byte size before inference/decode
  if (jpegBytes.length > 1048576) {
    throw new IngestError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Decoded JPEG image exceeds maximum size of 1 MiB"
    );
  }

  // 2. Decode submitted JPEG bytes
  let decoded: { width: number; height: number; data: Uint8Array };
  try {
    decoded = jpeg.decode(jpegBytes, { useTArray: true, formatAsRGBA: false });
  } catch (err) {
    throw new IngestError(
      422,
      "INVALID_JPEG",
      `frame data is not a valid decodable JPEG: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (
    !decoded ||
    typeof decoded.width !== "number" ||
    typeof decoded.height !== "number" ||
    !decoded.data
  ) {
    throw new IngestError(422, "INVALID_JPEG", "Failed to decode JPEG image properties");
  }

  if (decoded.width <= 0 || decoded.height <= 0) {
    throw new IngestError(
      422,
      "INVALID_FRAME_DIMENSIONS",
      "frame width and height must be positive finite numbers"
    );
  }

  if (decoded.width > 1920 || decoded.height > 1080) {
    throw new IngestError(
      422,
      "FRAME_DIMENSIONS_EXCEEDED",
      `frame dimensions (${decoded.width}x${decoded.height}) must not exceed 1920x1080`
    );
  }

  const imageSha256 = crypto.createHash("sha256").update(jpegBytes).digest("hex");
  const srcW = decoded.width;
  const srcH = decoded.height;

  // 3. Load sessions
  const { manifest, modelVersion, clsSession, detSession } = await getRuntimeSessions();

  // 4. Center-square ROI
  const side = Math.min(srcW, srcH);
  const offX = Math.floor((srcW - side) / 2);
  const offY = Math.floor((srcH - side) / 2);

  // 5. Run classification
  const tCls0 = performance.now();
  let classificationMs = 0;
  let outcome: "ok" | "defect" | "unknown" = "unknown";
  let probabilities: { ok: number; defect: number } | null = null;
  let confidence: number | null = null;
  let errorCode: "model_unavailable" | "low_confidence" | "unsupported_input" | undefined = undefined;

  try {
    const clsTensor = createRoiTensor(
      decoded.data,
      srcW,
      srcH,
      offX,
      offY,
      side,
      300
    );

    const clsOutputs = await clsSession.run({
      [manifest.classifier.inputName]: clsTensor,
    });
    classificationMs = Number((performance.now() - tCls0).toFixed(4));

    const clsRaw = clsOutputs[manifest.classifier.outputName].data as Float32Array;
    let pDefect = Number(clsRaw[0]);
    let pOk = Number(clsRaw[1]);

    if (!Number.isFinite(pDefect) || !Number.isFinite(pOk) || pDefect < 0 || pOk < 0) {
      outcome = "unknown";
      errorCode = "model_unavailable";
    } else {
      const probSum = pDefect + pOk;
      if (probSum <= 0) {
        outcome = "unknown";
        errorCode = "model_unavailable";
      } else {
        pDefect = pDefect / probSum;
        pOk = pOk / probSum;

        const th = manifest.classifier.thresholds;
        if (pDefect >= th.defect && pDefect >= pOk) {
          outcome = "defect";
          confidence = Number((pDefect * 100).toFixed(2));
          errorCode = undefined;
        } else if (pOk >= th.ok && pOk >= pDefect) {
          outcome = "ok";
          confidence = Number((pOk * 100).toFixed(2));
          errorCode = undefined;
        } else {
          outcome = "unknown";
          confidence = Number((Math.max(pDefect, pOk) * 100).toFixed(2));
          errorCode = "low_confidence";
        }

        probabilities = {
          ok: Number(pOk.toFixed(6)),
          defect: Number(pDefect.toFixed(6)),
        };
      }
    }
  } catch (err) {
    classificationMs = Number((performance.now() - tCls0).toFixed(4));
    throw new IngestError(
      503,
      "MODEL_UNAVAILABLE",
      `Classifier execution failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 6. Localization
  let localizationMs: number | null = null;
  let localizationStatus: "completed" | "skipped" | "failed" = "skipped";
  let boundingBoxes: VisionAnalysis["boundingBoxes"] = [];

  if (outcome === "defect" || (outcome === "unknown" && errorCode === "low_confidence")) {
    const tLoc0 = performance.now();
    try {
      const detTensor = createRoiTensor(
        decoded.data,
        srcW,
        srcH,
        offX,
        offY,
        side,
        640
      );

      const detOutputs = await detSession.run({
        [manifest.detector.inputName]: detTensor,
      });
      localizationMs = Number((performance.now() - tLoc0).toFixed(4));

      const detRaw = detOutputs[manifest.detector.outputName].data as Float32Array;
      const numAnchors = 8400;
      const scoreThresh = manifest.detector.scoreThreshold;

      const filteredBoxes: number[][] = [];
      const filteredScores: number[] = [];

      for (let i = 0; i < numAnchors; i++) {
        const score = detRaw[4 * numAnchors + i];
        if (score >= scoreThresh) {
          filteredBoxes.push([
            detRaw[0 * numAnchors + i],
            detRaw[1 * numAnchors + i],
            detRaw[2 * numAnchors + i],
            detRaw[3 * numAnchors + i],
          ]);
          filteredScores.push(score);
        }
      }

      if (filteredBoxes.length > 0) {
        const keep = nmsBoxes(
          filteredBoxes,
          filteredScores,
          manifest.detector.iouThreshold,
          manifest.detector.iomThreshold
        );

        const scale = 640 / side;
        const resultBoxes: VisionAnalysis["boundingBoxes"] = [];

        for (let idx = 0; idx < keep.length; idx++) {
          const k = keep[idx];
          const b = filteredBoxes[k];
          const sc = filteredScores[k];

          const cx = b[0] / scale;
          const cy = b[1] / scale;
          const bw = b[2] / scale;
          const bh = b[3] / scale;

          const x1 = cx - bw / 2.0 + offX;
          const y1 = cy - bh / 2.0 + offY;
          const x2 = cx + bw / 2.0 + offX;
          const y2 = cy + bh / 2.0 + offY;

          const ix1 = Math.max(0.0, Math.min(srcW, x1));
          const iy1 = Math.max(0.0, Math.min(srcH, y1));
          const ix2 = Math.max(0.0, Math.min(srcW, x2));
          const iy2 = Math.max(0.0, Math.min(srcH, y2));

          const iw = ix2 - ix1;
          const ih = iy2 - iy1;

          if (iw <= 0.0 || ih <= 0.0) continue;

          resultBoxes.push({
            id: `det-${idx + 1}`,
            label: "defect",
            x: Number(((ix1 / srcW) * 100).toFixed(2)),
            y: Number(((iy1 / srcH) * 100).toFixed(2)),
            width: Number(((iw / srcW) * 100).toFixed(2)),
            height: Number(((ih / srcH) * 100).toFixed(2)),
            confidence: Number((sc * 100).toFixed(2)),
          });
        }

        boundingBoxes = resultBoxes;
      }

      localizationStatus = "completed";
    } catch {
      localizationMs = Number((performance.now() - tLoc0).toFixed(4));
      localizationStatus = "failed";
      boundingBoxes = [];
    }
  }

  const inferenceMs = Number((classificationMs + (localizationMs ?? 0)).toFixed(4));

  return {
    modelVersion,
    inferenceMs,
    classificationMs,
    localizationMs,
    localizationStatus,
    outcome,
    probabilities,
    confidence,
    errorCode,
    imageWidth: srcW,
    imageHeight: srcH,
    imageSha256,
    boundingBoxes,
  };
}
