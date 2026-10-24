import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface ProcessedUpload {
  imageKey: string;
  imageUrl: string;
  mimeType: string;
  sizeBytes: number;
  exifStripped: boolean;
}

/**
 * Strips EXIF / GPS metadata from JPEG/PNG/WebP images using `sharp` when available,
 * with a binary JPEG APP1 (EXIF) marker stripper as fallback.
 */
export async function stripImageExifAndOptimize(
  inputBuffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; exifStripped: boolean }> {
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;
    // Rotate according to orientation tag first, then strip metadata by not calling .withMetadata()
    const pipeline = sharp(inputBuffer).rotate().resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    });

    if (mimeType === "image/jpeg") {
      const out = await pipeline.jpeg({ quality: 85 }).toBuffer();
      return { buffer: out, exifStripped: true };
    }
    if (mimeType === "image/png") {
      const out = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      return { buffer: out, exifStripped: true };
    }
    if (mimeType === "image/webp") {
      const out = await pipeline.webp({ quality: 85 }).toBuffer();
      return { buffer: out, exifStripped: true };
    }
  } catch {
    // Fallback: binary JPEG APP1 (0xFFE1) EXIF stripper
    if (
      mimeType === "image/jpeg" &&
      inputBuffer.length > 4 &&
      inputBuffer[0] === 0xff &&
      inputBuffer[1] === 0xd8
    ) {
      return {
        buffer: stripJpegApp1Segments(inputBuffer),
        exifStripped: true,
      };
    }
  }

  return { buffer: inputBuffer, exifStripped: false };
}

/**
 * Pure binary stripper for JPEG APP1 (EXIF/XMP) and APP13 segments.
 */
export function stripJpegApp1Segments(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return buf;
  }
  const chunks: Buffer[] = [buf.subarray(0, 2)];
  let offset = 2;

  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) {
      chunks.push(buf.subarray(offset));
      break;
    }
    const marker = buf[offset + 1];
    // SOS (Start of Scan) or EOI -> copy remainder of image data
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(buf.subarray(offset));
      break;
    }
    // Standalone markers without length
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(buf.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buf.length) {
      chunks.push(buf.subarray(offset));
      break;
    }
    // Skip APP1 (0xE1 - EXIF/GPS) and APP13 (0xED - IPTC)
    if (marker !== 0xe1 && marker !== 0xed) {
      chunks.push(buf.subarray(offset, offset + 2 + segmentLength));
    }
    offset += 2 + segmentLength;
  }

  return Buffer.concat(chunks);
}

/**
 * Validates magic bytes for JPEG, PNG, and WebP.
 */
export function detectImageMimeType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  // WebP: RIFF....WEBP
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Stores an uploaded photo after validating magic bytes, enforcing size limits,
 * and stripping EXIF metadata.
 * - Uses Vercel Blob REST API if `BLOB_READ_WRITE_TOKEN` is configured (production / Vercel compatible).
 * - Uses local persistent storage (`public/uploads/retro`) in development when `BLOB_READ_WRITE_TOKEN` is absent.
 */
export async function storePhotoUpload(
  file: File,
  folder: "retro" | "avatars" = "retro"
): Promise<ProcessedUpload> {
  if (file.size <= 0) {
    throw new Error("Le fichier image est vide.");
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("L'image dépasse la taille maximale autorisée de 5 Mo.");
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectImageMimeType(rawBuffer);

  if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
    throw new Error(
      "Format d'image non supporté. Utilisez uniquement JPEG, PNG ou WebP."
    );
  }

  const { buffer: cleanBuffer, exifStripped } =
    await stripImageExifAndOptimize(rawBuffer, detectedMime);

  const ext =
    detectedMime === "image/png"
      ? "png"
      : detectedMime === "image/webp"
        ? "webp"
        : "jpg";
  const randomId = crypto.randomBytes(16).toString("hex");
  const imageKey = `${folder}/${Date.now()}-${randomId}.${ext}`;

  const vercelBlobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (vercelBlobToken) {
    const uploadResponse = await fetch(
      `https://blob.vercel-storage.com/${imageKey}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${vercelBlobToken}`,
          "x-api-version": "7",
          "content-type": detectedMime,
        },
        body: new Uint8Array(cleanBuffer),
      }
    );

    if (!uploadResponse.ok) {
      throw new Error(
        `Échec du stockage Vercel Blob (${uploadResponse.status}).`
      );
    }

    const blobData = (await uploadResponse.json()) as { url: string };
    return {
      imageKey,
      imageUrl: blobData.url,
      mimeType: detectedMime,
      sizeBytes: cleanBuffer.length,
      exifStripped,
    };
  }

  // Local persistent storage in public/uploads/
  const targetDir = path.join(process.cwd(), "public", "uploads", folder);
  await fs.mkdir(targetDir, { recursive: true });
  const filename = path.basename(imageKey);
  const fullPath = path.join(targetDir, filename);
  await fs.writeFile(fullPath, cleanBuffer);

  return {
    imageKey,
    imageUrl: `/uploads/${imageKey}`,
    mimeType: detectedMime,
    sizeBytes: cleanBuffer.length,
    exifStripped,
  };
}
