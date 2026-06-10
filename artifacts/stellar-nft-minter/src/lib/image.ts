// ─── Image helpers ────────────────────────────────────────────────────────────
//
// Supports local file upload for NFT images:
//   1. Aggressively compress in the browser (JPEG)
//   2. Store compact data URL on-chain when small enough
//   3. Otherwise upload to free image host (no API key required)

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;

/** Max raw file size before compression (5 MB). */
export const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024;

/** Soroban tx args must stay small — target well under this. */
const MAX_DATA_URL_LENGTH = 24_000;

const COMPRESS_ATTEMPTS: Array<[number, number]> = [
  [640, 0.82],
  [512, 0.75],
  [384, 0.7],
  [256, 0.62],
  [200, 0.55],
  [160, 0.48],
];

export interface CompressedImage {
  blob: Blob;
  dataUrl: string;
  mimeType: string;
}

function guessMimeType(file: File): string {
  if (file.type && ACCEPTED_TYPES.has(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

export function validateImageFile(file: File): string | null {
  const mime = guessMimeType(file);
  if (!ACCEPTED_TYPES.has(mime) && !ACCEPTED_EXTENSIONS.test(file.name)) {
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
  maxDimension = 512,
  quality = 0.75,
  forceJpeg = false,
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
      forceJpeg || (!file.type && !file.name.match(/\.(png|gif|webp)$/i))
        ? 'image/jpeg'
        : file.type === 'image/png' || file.type === 'image/gif'
          ? file.type
          : 'image/jpeg';

    const blob = await canvasToBlob(
      canvas,
      forceJpeg ? 'image/jpeg' : mimeType,
      quality,
    );
    const dataUrl = await blobToDataUrl(blob);
    return { blob, dataUrl, mimeType: forceJpeg ? 'image/jpeg' : mimeType };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Compress repeatedly until the data URL fits on-chain limits. */
async function compressForOnChain(file: File): Promise<CompressedImage> {
  let last: CompressedImage | null = null;
  for (const [dim, quality] of COMPRESS_ATTEMPTS) {
    const result = await compressImageFile(file, dim, quality, true);
    last = result;
    if (result.dataUrl.length <= MAX_DATA_URL_LENGTH) return result;
  }
  if (!last) throw new Error('Could not compress image.');
  return last;
}

/** Resolve the image URL that will be written to the Soroban contract. */
export async function resolveMintImageUrl(opts: {
  file?: File | null;
  url?: string;
}): Promise<string> {
  if (opts.file) {
    const validationError = validateImageFile(opts.file);
    if (validationError) throw new Error(validationError);

    const compressed = await compressForOnChain(opts.file);

    if (compressed.dataUrl.length <= MAX_DATA_URL_LENGTH) {
      return compressed.dataUrl;
    }

    const apiKey = (import.meta as ImportMeta & { env?: Record<string, string> })
      .env?.VITE_IMGBB_API_KEY;

    const hostErrors: string[] = [];

    for (const host of [
      () => uploadToCatbox(compressed.blob),
      () => uploadTo0x0(compressed.blob),
      ...(apiKey ? [() => uploadToImgbb(compressed.blob, apiKey)] : []),
    ]) {
      try {
        return await host();
      } catch (err) {
        hostErrors.push(err instanceof Error ? err.message : String(err));
      }
    }

    throw new Error(
      `Image is too large after compression (${Math.round(compressed.dataUrl.length / 1024)} KB). Switch to the URL tab and paste a public image link.`,
    );
  }

  const trimmed = opts.url?.trim() ?? '';
  if (!trimmed) {
    throw new Error('Choose an image file or paste an image URL.');
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Image URL must use http or https.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('http')) throw err;
    throw new Error('Image URL must be a valid http(s) address.');
  }

  return trimmed;
}

async function uploadToCatbox(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', blob, 'nft.jpg');

  const resp = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
  });

  if (!resp.ok) {
    throw new Error(`Catbox upload failed (HTTP ${resp.status}).`);
  }

  const url = (await resp.text()).trim();
  if (!url.startsWith('http')) {
    throw new Error('Catbox upload returned an invalid URL.');
  }
  return url;
}

async function uploadTo0x0(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', blob, 'nft.jpg');

  const resp = await fetch('https://0x0.st', { method: 'POST', body: form });
  if (!resp.ok) {
    throw new Error(`Image host failed (HTTP ${resp.status}).`);
  }

  const url = (await resp.text()).trim();
  if (!url.startsWith('http')) {
    throw new Error('Image host returned an invalid URL.');
  }
  return url;
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
    throw new Error(`ImgBB upload failed (HTTP ${resp.status}).`);
  }

  const json = (await resp.json()) as {
    success?: boolean;
    data?: { url?: string; display_url?: string };
    error?: { message?: string };
  };

  if (!json.success) {
    throw new Error(json.error?.message ?? 'ImgBB upload failed.');
  }

  const url = json.data?.url ?? json.data?.display_url ?? '';
  if (!url) throw new Error('ImgBB upload returned an empty URL.');
  return url;
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
