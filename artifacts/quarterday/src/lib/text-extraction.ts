import { HEALTH_MARKERS } from "./doc-constants";

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

function extractHealthFlags(text: string, chunkIndex: number, pageNumber?: number): HealthFlag[] {
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

export async function extractText(
  buffer: Buffer,
  fileType: "pdf" | "docx"
): Promise<ExtractionResult> {
  try {
    if (fileType === "pdf") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
      const result = await pdfParse(buffer);
      const chunk: TextChunk = { chunkIndex: 0, text: result.text.trim() };
      return {
        chunks: [chunk],
        healthFlags: extractHealthFlags(chunk.text, 0),
      };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth") as {
        extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
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
