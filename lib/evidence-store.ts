import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export interface EvidenceRecord {
  storageKey: string;
  store: "s3" | "local";
  sha256: string;
  byteLength: number;
}

function getEvidenceStoreMode(): "s3" | "local" {
  const mode = process.env.SIGAP_EVIDENCE_STORE?.toLowerCase();
  if (mode === "s3" || mode === "local") return mode;
  // Default to s3 if bucket & credentials are provided, otherwise local
  const hasS3Config =
    (process.env.SIGAP_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME) &&
    (process.env.SIGAP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID);
  return hasS3Config ? "s3" : "local";
}

function getLocalEvidenceDir(): string {
  return process.env.SIGAP_EVIDENCE_DIR || path.join(process.cwd(), "data", "evidence");
}

function getS3Client(): { client: S3Client; bucket: string } {
  const accessKeyId = process.env.SIGAP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SIGAP_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.SIGAP_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;
  const region =
    process.env.SIGAP_S3_REGION ||
    process.env.AWS_S3_REGION ||
    process.env.SIGAP_AWS_REGION ||
    process.env.AWS_REGION ||
    "ap-southeast-2";
  const bucket = process.env.SIGAP_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || "sigap-inspection-frames";

  const client = new S3Client({
    region,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } }
      : {}),
  });

  return { client, bucket };
}

export async function storeEvidence(
  buffer: Buffer,
  eventId: string,
  expectedSha256?: string
): Promise<EvidenceRecord> {
  const computedSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (expectedSha256 && computedSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error(
      `Evidence hash mismatch: computed ${computedSha256} does not match expected ${expectedSha256}`
    );
  }

  // Pure UUID/hash derived key - never caller-controlled path
  const sanitizedEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, "");
  const storageKey = `evidence/${sanitizedEventId}-${computedSha256.slice(0, 16)}.jpg`;
  const mode = getEvidenceStoreMode();

  if (mode === "s3") {
    const { client, bucket } = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: "image/jpeg",
        ServerSideEncryption: "AES256",
      })
    );
    return {
      storageKey,
      store: "s3",
      sha256: computedSha256,
      byteLength: buffer.length,
    };
  }

  // Local durable store
  const dir = getLocalEvidenceDir();
  await fs.mkdir(dir, { recursive: true });

  const finalPath = path.join(dir, `${sanitizedEventId}-${computedSha256.slice(0, 16)}.jpg`);
  const tmpPath = `${finalPath}.${crypto.randomBytes(4).toString("hex")}.tmp`;

  await fs.writeFile(tmpPath, buffer);
  await fs.rename(tmpPath, finalPath);

  return {
    storageKey,
    store: "local",
    sha256: computedSha256,
    byteLength: buffer.length,
  };
}

export async function getEvidence(storageKey: string): Promise<{ buffer: Buffer; sha256: string }> {
  const mode = getEvidenceStoreMode();

  if (mode === "s3") {
    const { client, bucket } = getS3Client();
    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    );
    if (!res.Body) throw new Error(`Empty evidence body for ${storageKey}`);
    const bytes = await res.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    return { buffer, sha256 };
  }

  const dir = getLocalEvidenceDir();
  const fileName = path.basename(storageKey);
  const filePath = path.join(dir, fileName);
  const buffer = await fs.readFile(filePath);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  return { buffer, sha256 };
}

export async function getEvidenceSignedUrl(
  storageKey: string,
  expiresInSeconds: number = 900
): Promise<string> {
  const mode = getEvidenceStoreMode();
  if (mode === "s3") {
    const { client, bucket } = getS3Client();
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      }),
      { expiresIn: expiresInSeconds }
    );
  }
  // Local fallback points to authenticated Next.js proxy route
  return `/api/inspections/evidence/${encodeURIComponent(path.basename(storageKey))}`;
}
