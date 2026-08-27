import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import { renderPageToImage } from "./pdf-processor";
import { adaptiveOcr, enhanceAndOcrPage } from "./ocr-engine";
import type { ExtractedPage, DocumentType } from "./types";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export type FileType = "pdf" | "docx" | "txt" | "image" | "unknown";

const EXT_MAP: Record<string, FileType> = {
  pdf: "pdf",
  docx: "docx",
  doc: "docx",
  txt: "txt",
  text: "txt",
  png: "image",
  jpg: "image",
  jpeg: "image",
  tiff: "image",
  tif: "image",
  bmp: "image",
  webp: "image",
};

export function detectFileType(file: File): FileType {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (EXT_MAP[ext]) return EXT_MAP[ext];

  const mime = file.type.toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("word") || mime.includes("document")) return "docx";
  if (mime.includes("text")) return "txt";
  if (mime.includes("image")) return "image";

  return "unknown";
}

export function getAcceptedExtensions(): string {
  return ".pdf,.docx,.doc,.txt,.text,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp";
}

export function getFileTypeLabel(type: FileType): string {
  switch (type) {
    case "pdf": return "PDF Document";
    case "docx": return "Word Document";
    case "txt": return "Text File";
    case "image": return "Image Document";
    default: return "Unknown Format";
  }
}

/** Extract text from a DOCX file */
async function extractDocx(file: File): Promise<{ pages: ExtractedPage[]; documentType: DocumentType }> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.trim();

  return {
    pages: [
      {
        pageNumber: 1,
        text,
        isScanned: false,
        confidence: 1.0,
      },
    ],
    documentType: "DIGITAL",
  };
}

/** Extract text from a plain text file */
async function extractTxt(file: File): Promise<{ pages: ExtractedPage[]; documentType: DocumentType }> {
  const text = await file.text();
  return {
    pages: [
      {
        pageNumber: 1,
        text: text.trim(),
        isScanned: false,
        confidence: 1.0,
      },
    ],
    documentType: "DIGITAL",
  };
}

/** OCR an image file directly with enhancement */
async function extractImage(file: File): Promise<{ pages: ExtractedPage[]; documentType: DocumentType }> {
  const dataUrl = await readFileAsDataUrl(file);

  // Try enhanced OCR first, fall back to standard
  let result;
  try {
    result = await Tesseract.recognize(dataUrl, "eng");
  } catch {
    result = await Tesseract.recognize(dataUrl, "eng");
  }

  return {
    pages: [
      {
        pageNumber: 1,
        text: result.data.text.trim(),
        isScanned: false,
        confidence: result.data.confidence / 100,
      },
    ],
    documentType: "DIGITAL",
  };
}

/**
 * Extract text from PDF with adaptive OCR for scanned pages.
 * This implements the notebook's approach:
 * - Try direct text extraction first
 * - If insufficient text, use adaptive OCR
 * - Low-resolution pages get enhanced before OCR
 */
async function extractPdf(file: File): Promise<{ pages: ExtractedPage[]; documentType: DocumentType }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: ExtractedPage[] = [];
  let scannedCount = 0;
  let digitalCount = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(" ").trim();
    const charCount = text.replace(/\s/g, "").length;

    // Determine if page is scanned (very little extractable text)
    const isScanned = charCount < 30;
    let confidence = isScanned ? 0.3 : Math.min(1, charCount / 200);
    let finalText = text;

    if (isScanned) {
      scannedCount++;
      // Use adaptive OCR for scanned pages
      try {
        const ocrResult = await adaptiveOcr(file, i, confidence);
        if (ocrResult.text.length > finalText.length) {
          finalText = ocrResult.text;
          confidence = ocrResult.confidence;
        }
      } catch (err) {
        console.error(`OCR failed for page ${i}:`, err);
      }
    } else {
      digitalCount++;
      // Even for "digital" pages, check if text is suspiciously short
      if (charCount < 100 && pdf.numPages > 1) {
        // Might be a partially scanned page — try OCR as backup
        try {
          const ocrResult = await adaptiveOcr(file, i, confidence);
          if (ocrResult.text.length > finalText.length * 2) {
            finalText = ocrResult.text;
            confidence = ocrResult.confidence;
            // Reclassify as scanned
            digitalCount--;
            scannedCount++;
          }
        } catch {
          // Keep the original text
        }
      }
    }

    pages.push({ pageNumber: i, text: finalText, isScanned, confidence });
  }

  let documentType: DocumentType = "DIGITAL";
  if (scannedCount > 0 && digitalCount > 0) documentType = "MIXED";
  else if (scannedCount > 0) documentType = "SCANNED";

  return { pages, documentType };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Universal document extraction — accepts PDF, DOCX, TXT, or image files.
 * Returns extracted pages with text and document type classification.
 */
export async function extractDocumentText(
  file: File,
  onProgress?: (stage: string) => void
): Promise<{ pages: ExtractedPage[]; documentType: DocumentType }> {
  const fileType = detectFileType(file);

  switch (fileType) {
    case "pdf":
      onProgress?.("Extracting text from PDF…");
      return extractPdf(file);

    case "docx":
      onProgress?.("Extracting text from Word document…");
      return extractDocx(file);

    case "txt":
      onProgress?.("Reading text file…");
      return extractTxt(file);

    case "image":
      onProgress?.("Running OCR on image…");
      return extractImage(file);

    default:
      onProgress?.("Detecting file format…");
      try {
        return await extractPdf(file);
      } catch {
        try {
          return await extractDocx(file);
        } catch {
          try {
            return await extractTxt(file);
          } catch {
            throw new Error(
              `Unable to process this file type. Supported formats: PDF, Word (.docx), Text, and Images.`
            );
          }
        }
      }
  }
}

/**
 * Render a PDF page to a canvas image (for PDF files only)
 */
export async function renderPdfPageToImage(
  file: File,
  pageNumber: number,
  scale = 2
): Promise<string> {
  return renderPageToImage(file, pageNumber, scale);
}

/**
 * Check if the file is a PDF (for the PDF viewer)
 */
export function isPdfFile(file: File): boolean {
  return detectFileType(file) === "pdf";
}

/**
 * Get page count for any supported file.
 */
export async function getPageCount(file: File): Promise<number> {
  const fileType = detectFileType(file);
  if (fileType === "pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  }
  return 1;
}
