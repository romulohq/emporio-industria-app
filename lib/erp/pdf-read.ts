// O worker é importado aqui (e não resolvido por caminho em tempo de execução) para que o pdfjs rode no
// mesmo processo: o import registra globalThis.pdfjsWorker, e o empacotador/rastreio da Vercel o inclui.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfTextItem } from "@/lib/erp/pdf-table";

/** Textos de cada página já em coordenadas de tela — o viewport aplica a rotação da página. */
export async function readPdfPages(data: Uint8Array): Promise<PdfTextItem[][]> {
  const task = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });

  const pages: PdfTextItem[][] = [];
  try {
    const pdf = await task.promise;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const [a, b, c, d, e, f] = viewport.transform;
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const item of content.items) {
        if (!("str" in item) || item.str.trim() === "") continue;
        const x0 = item.transform[4];
        const y0 = item.transform[5];
        items.push({
          str: item.str,
          x: a * x0 + c * y0 + e,
          y: b * x0 + d * y0 + f,
          width: item.width * viewport.scale,
        });
      }
      pages.push(items);
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return pages;
}
