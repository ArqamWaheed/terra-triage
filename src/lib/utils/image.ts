// Client-only helper: downscale a user-selected image to a max longest-edge
// before upload. Keeps us well under Supabase Storage + Gemini payload limits
// and strips most EXIF as a side-effect of canvas re-encoding.

export async function downscaleImage(
  file: File,
  maxEdge = 1600,
  quality = 0.85,
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("downscaleImage() is client-only");
  }

  const { width, height } = await readDimensions(file);
  const longest = Math.max(width, height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  // Prefer OffscreenCanvas where available (Chrome/Firefox on modern mobile).
  if (
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function"
  ) {
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = new OffscreenCanvas(targetW, targetH);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D context unavailable");
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      bitmap.close?.();
      return await canvas.convertToBlob({ type: "image/jpeg", quality });
    } catch {
      // fall through to <canvas> path
    }
  }

  return await canvasFallback(file, targetW, targetH, quality);
}

async function readDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return dims;
    } catch {
      // fall through
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read image dimensions"));
    };
    img.src = url;
  });
}

async function canvasFallback(
  file: File,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load image"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas export failed"));
        },
        "image/jpeg",
        quality,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
