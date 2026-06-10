// ─── Image helpers ────────────────────────────────────────────────────────────
//
// Supports local file upload for NFT images:
//   1. Compress/resize in the browser
//   2. Use a compact data URL when small enough for Soroban
//   3. Otherwise upload via ImgBB when VITE_IMGBB_API_KEY is configured

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Max raw file size before compression (5 MB). */
export const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024;

/** Data URLs longer than this are too large for reliable Soroban mint txs. */
const MAX_DATA_URL_LENGTH = 48_000;

export interface CompressedImage {
  blob: Blob;
  dataUrl: string;
  mimeType: string;
}

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return 'Use a JPEG, PNG, WebP, or GIF image.';
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    return 'Image must be 5 MB or smaller.';
  }
  return null;
}

/** Resize and compress an image file in the browser. */
export async function compressImageFile(
  file: File,
  maxDimension = 1024,
  quality = 0.82,
): Promise<CompressedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = fitWithin(img.width, img.height, maxDimension);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare image canvas.');

    ctx.drawImage(img, 0, 0, width, height);

    const mimeType =
      file.type === 'image/png' || file.type === 'image/gif'
        ? file.type
        : 'image/jpeg';

    const blob = await canvasToBlob(canvas, mimeType, quality);
    const dataUrl = await blobToDataUrl(blob);
    return { blob, dataUrl, mimeType };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Resolve the image URL that will be written to the Soroban contract. */
export async function resolveMintImageUrl(opts: {
  file?: File | null;
  url?: string;
}): Promise<string> {
  if (opts.file) {
    const validationError = validateImageFile(opts.file);
    if (validationError) throw new Error(validationError);

    const compressed = await compressImageFile(opts.file);

    if (compressed.dataUrl.length <= MAX_DATA_URL_LENGTH) {
      return compressed.dataUrl;
    }

    const apiKey = (import.meta as ImportMeta & { env?: Record<string, string> })
      .env?.VITE_IMGBB_API_KEY;
    if (apiKey) {
      return uploadToImgbb(compressed.blob, apiKey);
    }

    throw new Error(
      'Image is too large to store on-chain after compression. Paste an HTTPS image URL instead, or add VITE_IMGBB_API_KEY for automatic uploads.',
    );
  }

  const trimmed = opts.url?.trim() ?? '';
  if (!trimmed) throw new Error('Add an image file or paste an image URL.');

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Image URL must use http or https.');
    }
  } catch {
    throw new Error('Image URL must be a valid http(s) address.');
  }

  return trimmed;
}

async function uploadToImgbb(blob: Blob, apiKey: string): Promise<string> {
  const dataUrl = await blobToDataUrl(blob);
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('Could not encode image for upload.');

  const body = new FormData();
  body.append('key', apiKey);
  body.append('image', base64);

  const resp = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body,
  });

  if (!resp.ok) {
    throw new Error(`Image upload failed (HTTP ${resp.status}).`);
  }

  const json = (await resp.json()) as {
    success?: boolean;
    data?: { url?: string; display_url?: string };
    error?: { message?: string };
  };

  if (!json.success) {
    throw new Error(json.error?.message ?? 'Image upload failed.');
  }

  return json.data?.url ?? json.data?.display_url ?? '';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the selected image.'));
    img.src = src;
  });
}

function fitWithin(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) reject(new Error('Could not compress image.'));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image data.'));
    reader.readAsDataURL(blob);
  });
}
