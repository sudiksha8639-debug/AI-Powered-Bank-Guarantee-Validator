import Tesseract from "tesseract.js";
import { renderPageToImage } from "./pdf-processor";

/**
 * Enhance a canvas image for better OCR results.
 * Performs contrast enhancement and sharpening for low-resolution scans.
 */
function enhanceImageForOcr(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      // Get pixel data for enhancement
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Step 1: Convert to grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // Step 2: Contrast enhancement (simple histogram stretching)
      let min = 255;
      let max = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < min) min = data[i];
        if (data[i] > max) max = data[i];
      }
      const range = max - min;
      if (range > 10) {
        for (let i = 0; i < data.length; i += 4) {
          const normalized = ((data[i] - min) / range) * 255;
          // Increase contrast around the midpoint
          const contrasted = ((normalized - 128) * 1.5) + 128;
          const clamped = Math.max(0, Math.min(255, contrasted));
          data[i] = clamped;
          data[i + 1] = clamped;
          data[i + 2] = clamped;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = imageDataUrl;
  });
}

/**
 * Run OCR on a PDF page at standard resolution (2x).
 * Suitable for pages that are scanned but at reasonable resolution.
 */
export async function ocrPage(
  file: File,
  pageNumber: number,
  onProgress?: (progress: number) => void
): Promise<{ text: string; confidence: number }> {
  const imageData = await renderPageToImage(file, pageNumber, 2);

  const result = await Tesseract.recognize(imageData, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });

  return {
    text: result.data.text.trim(),
    confidence: result.data.confidence / 100,
  };
}

/**
 * Enhance and OCR a low-resolution scanned page.
 * Renders at 3x scale and applies image preprocessing for better results.
 * This matches the notebook's adaptive OCR for scanned documents.
 */
export async function enhanceAndOcrPage(
  file: File,
  pageNumber: number,
  onProgress?: (progress: number) => void
): Promise<{ text: string; confidence: number }> {
  // Render at higher scale for low-resolution scans
  const imageData = await renderPageToImage(file, pageNumber, 3);

  // Apply image enhancement for low-quality scans
  const enhancedImage = await enhanceImageForOcr(imageData);

  const result = await Tesseract.recognize(enhancedImage, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });

  return {
    text: result.data.text.trim(),
    confidence: result.data.confidence / 100,
  };
}

/**
 * Adaptive OCR: automatically choose the best OCR strategy based on page quality.
 * Returns the result with highest confidence.
 * This matches the notebook's approach of trying multiple strategies.
 */
export async function adaptiveOcr(
  file: File,
  pageNumber: number,
  existingConfidence: number,
  onProgress?: (progress: number) => void
): Promise<{ text: string; confidence: number }> {
  // If existing extraction is good enough, don't run OCR
  if (existingConfidence > 0.7) {
    return { text: "", confidence: existingConfidence };
  }

  // Strategy 1: Standard OCR at 2x
  if (onProgress) onProgress(0);
  const standard = await ocrPage(file, pageNumber, onProgress);

  // If standard OCR gives good results, use it
  if (standard.confidence > 0.75) {
    return standard;
  }

  // Strategy 2: Enhanced OCR at 3x with preprocessing
  if (onProgress) onProgress(0);
  const enhanced = await enhanceAndOcrPage(file, pageNumber, onProgress);

  // Return whichever has higher confidence
  if (enhanced.confidence > standard.confidence) {
    return enhanced;
  }

  return standard;
}
