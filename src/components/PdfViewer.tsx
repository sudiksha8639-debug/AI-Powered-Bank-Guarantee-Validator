import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  file: File;
  pageNumber: number;
  scale: number;
  onPageCount?: (count: number) => void;
}

export function PdfViewer({ file, pageNumber, scale, onPageCount }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!canvasRef.current) return;
      setLoading(true);
      setError(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        if (cancelled) return;
        onPageCount?.(pdf.numPages);

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError("Failed to render PDF page");
          setLoading(false);
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [file, pageNumber, scale, onPageCount]);

  return (
    <div className="relative flex items-center justify-center overflow-auto bg-muted/30">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse text-sm text-muted-foreground">Rendering page...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`max-w-full ${loading ? "opacity-0" : "opacity-100"} transition-opacity`}
      />
    </div>
  );
}
