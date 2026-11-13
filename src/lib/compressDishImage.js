'use client';

/**
 * Downscales and re-encodes an AI-generated data:image URL in the browser so
 * persisted illustrations stay ~15-30 KB each (safe for Firestore 1 MiB docs,
 * localStorage 5 MiB quota, and offline PWA cache).
 */
export async function compressDishImageDataUrl(dataUrl, maxDim = 384, quality = 0.82) {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof dataUrl !== 'string' ||
    !dataUrl.startsWith('data:image/')
  ) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || maxDim;
        const h = img.naturalHeight || maxDim;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const webp = canvas.toDataURL('image/webp', quality);
        const jpeg = canvas.toDataURL('image/jpeg', quality);
        const best =
          webp.startsWith('data:image/webp') && webp.length < jpeg.length ? webp : jpeg;

        resolve(best.length < dataUrl.length ? best : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
