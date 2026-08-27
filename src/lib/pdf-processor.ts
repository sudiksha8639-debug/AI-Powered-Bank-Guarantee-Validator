import * as pdfjsLib from "pdfjs-dist";
import type { ExtractedPage, DocumentType } from "./types";

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function extractPdfText(
  file: File
): Promise<{ pages: ExtractedPage[]; documentType: DocumentType }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: ExtractedPage[] = [];

  let scannedCount = 0;
  let digitalCount = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str)
      .join(" ")
      .trim();

    const charCount = text.replace(/\s/g, "").length;
    const isScanned = charCount < 30;
    const confidence = isScanned ? 0.3 : Math.min(1, charCount / 200);

    if (isScanned) {
      scannedCount++;
    } else {
      digitalCount++;
    }

    pages.push({
      pageNumber: i,
      text,
      isScanned,
      confidence,
    });
  }

  let documentType: DocumentType = "DIGITAL";
  if (scannedCount > 0 && digitalCount > 0) {
    documentType = "MIXED";
  } else if (scannedCount > 0) {
    documentType = "SCANNED";
  }

  return { pages, documentType };
}

export async function renderPageToImage(
  file: File,
  pageNumber: number,
  scale = 2
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/png");
}
