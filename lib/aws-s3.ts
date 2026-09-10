import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3UploadResult {
  url: string;
  key: string;
  source: "aws-s3" | "local-storage-fallback";
}

export async function uploadInspectionFrame(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = "image/jpeg"
): Promise<S3UploadResult> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = process.env.AWS_REGION || "ap-southeast-1";
  const bucket = process.env.AWS_S3_BUCKET_NAME || "sigap-inspection-frames";

  const key = `inspections/${new Date().toISOString().split("T")[0]}/${fileName}`;

  // Fallback if AWS credentials are not configured
  if (!accessKeyId || !secretAccessKey || accessKeyId.startsWith("AKIAXXXX")) {
    return {
      url: `/sample-frames/${fileName}`,
      key,
      source: "local-storage-fallback",
    };
  }

  try {
    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      })
    );

    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    return {
      url: publicUrl,
      key,
      source: "aws-s3",
    };
  } catch (error) {
    console.error("[AWS S3 Error] Upload failed, falling back to static path:", error);
    return {
      url: `/sample-frames/${fileName}`,
      key,
      source: "local-storage-fallback",
    };
  }
}

export async function getPresignedDownloadUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = process.env.AWS_REGION || "ap-southeast-1";
  const bucket = process.env.AWS_S3_BUCKET_NAME || "sigap-inspection-frames";

  if (!accessKeyId || !secretAccessKey || accessKeyId.startsWith("AKIAXXXX")) {
    return `/${key}`;
  }

  try {
    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    });

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  } catch (error) {
    console.error("[AWS S3 Presign Error]:", error);
    return `/${key}`;
  }
}
