import { createHash } from "crypto";

export const DEFAULT_MIN_BLOCK_CHARS = 8_000;
export const DEFAULT_MAX_BLOCK_CHARS = 12_000;
export const DEFAULT_SPLIT_OVERLAP_CHARS = 500;

export interface SourcePage {
  /** Database/source identifier, when one exists. */
  sourceId?: string;
  /** One-based physical PDF page. Null means the source has no stable pages (for example DOCX text). */
  pageNumber?: number | null;
  text: string;
}

export interface SourcePageSegment extends SourcePage {
  sourceIndex: number;
  segmentIndex: number;
}

export interface PageAwareBlock {
  id: string;
  pages: SourcePageSegment[];
  contentCharCount: number;
}

export interface PageAwareBlockOptions {
  minChars?: number;
  maxChars?: number;
  overlapChars?: number;
}

function stableBlockId(pages: SourcePageSegment[]): string {
  const first = pages[0];
  const last = pages[pages.length - 1];
  const firstLabel =
    first.pageNumber == null
      ? `v${first.sourceIndex + 1}`
      : `p${first.pageNumber}`;
  const lastLabel =
    last.pageNumber == null
      ? `v${last.sourceIndex + 1}`
      : `p${last.pageNumber}`;
  const digest = createHash("sha256")
    .update(
      pages
        .map(
          (page) =>
            `${page.pageNumber ?? "virtual"}\u0000${page.segmentIndex}\u0000${page.text}`,
        )
        .join("\u0001"),
    )
    .digest("hex")
    .slice(0, 16);

  return `${firstLabel}-${lastLabel}-${digest}`;
}

function findNaturalBreak(
  text: string,
  start: number,
  hardEnd: number,
  minimumEnd: number,
): number {
  const candidates = ["\n\n", "\n", ". ", " "];
  for (const marker of candidates) {
    const index = text.lastIndexOf(marker, hardEnd);
    if (index >= minimumEnd) return index + marker.length;
  }
  return hardEnd;
}

function splitSourcePage(
  page: SourcePage,
  sourceIndex: number,
  minChars: number,
  maxChars: number,
  overlapChars: number,
): SourcePageSegment[] {
  const text = page.text.trim();
  if (text.length <= maxChars) {
    return [{ ...page, text, sourceIndex, segmentIndex: 0 }];
  }

  const segments: SourcePageSegment[] = [];
  let start = 0;
  let segmentIndex = 0;

  while (start < text.length) {
    const hardEnd = Math.min(text.length, start + maxChars);
    const minimumEnd = Math.min(hardEnd, start + minChars);
    const end =
      hardEnd === text.length
        ? hardEnd
        : findNaturalBreak(text, start, hardEnd, minimumEnd);
    const segmentText = text.slice(start, end).trim();
    if (segmentText) {
      segments.push({ ...page, text: segmentText, sourceIndex, segmentIndex });
      segmentIndex += 1;
    }
    if (end >= text.length) break;

    const nextStart = Math.max(start + 1, end - overlapChars);
    start = nextStart;
  }

  return segments;
}

/**
 * Builds deterministic model-input blocks without dropping tail pages. Blocks target 8-12k
 * characters; the final block may be smaller. Oversized individual pages are split with overlap.
 */
export function buildPageAwareBlocks(
  sourcePages: SourcePage[],
  options: PageAwareBlockOptions = {},
): PageAwareBlock[] {
  const minChars = options.minChars ?? DEFAULT_MIN_BLOCK_CHARS;
  const maxChars = options.maxChars ?? DEFAULT_MAX_BLOCK_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_SPLIT_OVERLAP_CHARS;

  if (minChars <= 0 || maxChars < minChars) {
    throw new Error(
      "Page-aware block sizes must satisfy 0 < minChars <= maxChars.",
    );
  }
  if (overlapChars < 0 || overlapChars >= minChars) {
    throw new Error(
      "overlapChars must be non-negative and smaller than minChars.",
    );
  }

  const orderedPages = [...sourcePages]
    .map((page, originalIndex) => ({ page, originalIndex }))
    .sort((a, b) => {
      if (a.page.pageNumber == null || b.page.pageNumber == null)
        return a.originalIndex - b.originalIndex;
      return a.page.pageNumber - b.page.pageNumber;
    })
    .map(({ page }) => page);

  const segments = orderedPages.flatMap((page, sourceIndex) =>
    splitSourcePage(page, sourceIndex, minChars, maxChars, overlapChars),
  );

  const blocks: PageAwareBlock[] = [];
  let current: SourcePageSegment[] = [];
  let currentChars = 0;

  const flush = () => {
    if (current.length === 0) return;
    blocks.push({
      id: stableBlockId(current),
      pages: current,
      contentCharCount: currentChars,
    });
    current = [];
    currentChars = 0;
  };

  for (const segment of segments) {
    const separatorChars = current.length === 0 ? 0 : 2;
    if (
      current.length > 0 &&
      currentChars + separatorChars + segment.text.length > maxChars
    )
      flush();
    current.push(segment);
    currentChars += (current.length === 1 ? 0 : 2) + segment.text.length;
  }
  flush();

  return blocks;
}

export function formatPageAwareBlock(block: PageAwareBlock): string {
  const body = block.pages
    .map((page) => {
      const label =
        page.pageNumber == null
          ? `DOCUMENT_BLOCK ${page.sourceIndex + 1}`
          : `PDF_PAGE ${page.pageNumber}`;
      const segment =
        page.segmentIndex > 0 ? ` SEGMENT ${page.segmentIndex + 1}` : "";
      return `[${label}${segment}]\n${page.text}`;
    })
    .join("\n\n");

  return `<source_block id="${block.id}">\n${body}\n</source_block>`;
}
