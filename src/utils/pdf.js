import * as pdfjsLib from 'pdfjs-dist';

// Make pdf.js use the worker we put in /public
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

// Render the first page of a PDF file to a canvas
export async function pdfFirstPageToCanvas(file) {
  const arrayBuf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
  const page = await pdf.getPage(1);

  const scale = 2; // higher = sharper, larger
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// Canvas → PNG blob
export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  );
}
