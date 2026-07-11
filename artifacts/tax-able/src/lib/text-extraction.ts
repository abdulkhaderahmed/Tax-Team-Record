import { HEALTH_MARKERS } from "./doc-constants";
import { pageNeedsOcr, runTesseractOcr, selectBestPageText } from "./ocr";

export interface TextChunk {
  chunkIndex: number;
  pageNumber?: number;
  text: string;
}

export interface HealthFlag {
  marker: string;
  context: string;
  chunkIndex: number;
  pageNumber?: number;
}

export interface ExtractionResult {
  chunks: TextChunk[];
  healthFlags: HealthFlag[];
  error?: string;
}

export interface PDFTextResult {
  pages: Array<{ num: number; text: string }>;
  text: string;
  total: number;
}

interface PDFScreenshotResult {
  pages: Array<{ pageNumber: number; data: Uint8Array }>;
}

function extractHealthFlags(
  text: string,
  chunkIndex: number,
  pageNumber?: number,
): HealthFlag[] {
  const flags: HealthFlag[] = [];
  for (const { key, pattern } of HEALTH_MARKERS) {
    const rx = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      const start = Math.max(0, m.index - 80);
      const end = Math.min(text.length, m.index + m[0].length + 80);
      flags.push({
        marker: key,
        context: "…" + text.slice(start, end).replace(/\s+/g, " ").trim() + "…",
        chunkIndex,
        pageNumber,
      });
    }
  }
  return flags;
}

/** Keep PDF physical pages as the durable source boundary used by citations and model chunks. */
export function pdfTextResultToChunks(result: PDFTextResult): TextChunk[] {
  return result.pages.map((page, chunkIndex) => ({
    chunkIndex,
    pageNumber: page.num,
    text: page.text.trim(),
  }));
}

async function applyOcrToSparsePages(
  parser: {
    getScreenshot(params: {
      partial: number[];
      desiredWidth: number;
      imageBuffer: boolean;
      imageDataUrl: boolean;
    }): Promise<PDFScreenshotResult>;
  },
  chunks: TextChunk[],
): Promise<{ chunks: TextChunk[]; flags: HealthFlag[] }> {
  if (process.env.OCR_ENABLED === "false") return { chunks, flags: [] };

  const candidatePages = chunks
    .filter((chunk) => chunk.pageNumber != null && pageNeedsOcr(chunk.text))
    .map((chunk) => chunk.pageNumber as number);
  if (candidatePages.length === 0) return { chunks, flags: [] };

  let screenshots: PDFScreenshotResult;
  try {
    screenshots = await parser.getScreenshot({
      partial: candidatePages,
      desiredWidth: 3_000,
      imageBuffer: true,
      imageDataUrl: false,
    });
  } catch (error) {
    return {
      chunks,
      flags: candidatePages.map((pageNumber) => ({
        marker: "ocr_unavailable",
        context: `OCR rendering was unavailable for physical PDF page ${pageNumber}: ${String(error).slice(0, 180)}`,
        chunkIndex:
          chunks.find((chunk) => chunk.pageNumber === pageNumber)?.chunkIndex ??
          pageNumber - 1,
        pageNumber,
      })),
    };
  }

  const byPage = new Map(
    chunks.map((chunk) => [chunk.pageNumber, { ...chunk }]),
  );
  const flags: HealthFlag[] = [];
  let engineUnavailable = false;

  for (const screenshot of screenshots.pages) {
    if (engineUnavailable) break;
    const chunk = byPage.get(screenshot.pageNumber);
    if (!chunk) continue;
    try {
      const ocrText = await runTesseractOcr(screenshot.data);
      const selected = selectBestPageText(chunk.text, ocrText);
      if (selected.usedOcr) {
        chunk.text = selected.text;
        flags.push({
          marker: "ocr_applied",
          context: `OCR recovered additional text from physical PDF page ${screenshot.pageNumber}.`,
          chunkIndex: chunk.chunkIndex,
          pageNumber: screenshot.pageNumber,
        });
      }
    } catch (error) {
      engineUnavailable = String(error).includes("ENOENT");
      flags.push({
        marker: "ocr_unavailable",
        context: `OCR was unavailable for physical PDF page ${screenshot.pageNumber}: ${String(error).slice(0, 180)}`,
        chunkIndex: chunk.chunkIndex,
        pageNumber: screenshot.pageNumber,
      });
    }
  }

  return {
    chunks: chunks.map((chunk) => byPage.get(chunk.pageNumber) ?? chunk),
    flags,
  };
}

export async function extractText(
  buffer: Buffer,
  fileType: "pdf" | "docx",
): Promise<ExtractionResult> {
  try {
    if (fileType === "pdf") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require("pdf-parse") as {
        PDFParse: new (opts: { data: Buffer }) => {
          getText(): Promise<PDFTextResult>;
          getScreenshot(params: {
            partial: number[];
            desiredWidth: number;
            imageBuffer: boolean;
            imageDataUrl: boolean;
          }): Promise<PDFScreenshotResult>;
          destroy(): Promise<void>;
        };
      };
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        const nativeChunks = pdfTextResultToChunks(result);
        const ocr = await applyOcrToSparsePages(parser, nativeChunks);
        return {
          chunks: ocr.chunks,
          healthFlags: ocr.chunks
            .flatMap((chunk) =>
              extractHealthFlags(
                chunk.text,
                chunk.chunkIndex,
                chunk.pageNumber,
              ),
            )
            .concat(ocr.flags),
        };
      } finally {
        await parser.destroy();
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth") as {
        extractRawText: (opts: {
          buffer: Buffer;
        }) => Promise<{ value: string }>;
      };
      const result = await mammoth.extractRawText({ buffer });
      const chunk: TextChunk = { chunkIndex: 0, text: result.value.trim() };
      return {
        chunks: [chunk],
        healthFlags: extractHealthFlags(chunk.text, 0),
      };
    }
  } catch (err) {
    return { chunks: [], healthFlags: [], error: String(err) };
  }
}
