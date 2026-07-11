import assert from "node:assert/strict";
import test from "node:test";
import { extractionRetryDelayMs } from "./extraction-worker";
import {
  buildPageAwareBlocks,
  formatPageAwareBlock,
} from "./page-aware-extraction";
import { pageNeedsOcr, selectBestPageText } from "./ocr";
import { verifySourceReference } from "./source-verification";
import { pdfTextResultToChunks } from "./text-extraction";

test("PDF extraction preserves every physical page, including blank pages", () => {
  const chunks = pdfTextResultToChunks({
    total: 3,
    text: "first\n\n\n\nlast",
    pages: [
      { num: 1, text: " first " },
      { num: 2, text: "" },
      { num: 3, text: " last " },
    ],
  });

  assert.deepEqual(chunks, [
    { chunkIndex: 0, pageNumber: 1, text: "first" },
    { chunkIndex: 1, pageNumber: 2, text: "" },
    { chunkIndex: 2, pageNumber: 3, text: "last" },
  ]);
});

test("OCR is requested for sparse pages and only replaces native text when it adds content", () => {
  assert.equal(pageNeedsOcr("Title and footer only"), true);
  assert.equal(
    pageNeedsOcr(Array.from({ length: 30 }, () => "word").join(" ")),
    false,
  );
  assert.deepEqual(
    selectBestPageText(
      "Short title",
      "Short title plus a table with many recovered tax rows",
    ),
    {
      text: "Short title plus a table with many recovered tax rows",
      usedOcr: true,
    },
  );
  assert.deepEqual(
    selectBestPageText(
      "Native text already has enough useful content",
      "noise",
    ),
    {
      text: "Native text already has enough useful content",
      usedOcr: false,
    },
  );
});

test("page-aware blocks include final pages beyond the former 40k boundary", () => {
  const pages = Array.from({ length: 12 }, (_, index) => ({
    sourceId: `db-page-${index + 1}`,
    pageNumber: index + 1,
    text: `Physical page ${index + 1}\n${"x".repeat(4_900)}${index === 11 ? "\nFINAL_PAGE_SENTINEL" : ""}`,
  }));
  assert.ok(pages.reduce((sum, page) => sum + page.text.length, 0) > 40_000);

  const blocks = buildPageAwareBlocks(pages);
  const representedPages = new Set(
    blocks.flatMap((block) => block.pages.map((page) => page.pageNumber)),
  );

  assert.equal(representedPages.size, 12);
  assert.equal(representedPages.has(12), true);
  assert.equal(
    blocks.every((block) => block.contentCharCount <= 12_000),
    true,
  );
  assert.equal(
    blocks.map(formatPageAwareBlock).join("\n").includes("FINAL_PAGE_SENTINEL"),
    true,
  );
});

test("block IDs are content-stable and change when source content changes", () => {
  const pages = [{ pageNumber: 1, text: "A stable source page" }];
  const first = buildPageAwareBlocks(pages)[0].id;
  const second = buildPageAwareBlocks([
    { ...pages[0], sourceId: "different-database-id" },
  ])[0].id;
  const changed = buildPageAwareBlocks([
    { pageNumber: 1, text: "Changed source page" },
  ])[0].id;

  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test("source verification corrects a wrong claimed page when the quote has one source page", () => {
  const blocks = buildPageAwareBlocks(
    [
      { pageNumber: 1, text: "Introductory text only." },
      {
        pageNumber: 2,
        text: "The return must be filed within 14 days of the share issue.",
      },
    ],
    { minChars: 10, maxChars: 100, overlapChars: 2 },
  );

  const verified = verifySourceReference(
    {
      sourceBlockId: blocks[0].id,
      sourcePageNumber: 1,
      sourceText: "must be filed within 14 days",
    },
    blocks,
  );

  assert.equal(verified.valid, true);
  assert.equal(verified.corrected, true);
  assert.equal(verified.sourcePageNumber, 2);
});

test("source verification rejects fabricated and ambiguous quotes", () => {
  const blocks = buildPageAwareBlocks(
    [
      { pageNumber: 1, text: "The same repeated qualification applies." },
      { pageNumber: 2, text: "The same repeated qualification applies." },
    ],
    { minChars: 10, maxChars: 100, overlapChars: 2 },
  );

  const fabricated = verifySourceReference(
    {
      sourceBlockId: blocks[0].id,
      sourcePageNumber: 1,
      sourceText: "This sentence was invented.",
    },
    blocks,
  );
  const ambiguous = verifySourceReference(
    {
      sourceBlockId: "wrong-block",
      sourcePageNumber: null,
      sourceText: "repeated qualification applies",
    },
    blocks,
  );

  assert.equal(fabricated.valid, false);
  assert.equal(fabricated.reason, "quote_not_found");
  assert.equal(ambiguous.valid, false);
  assert.equal(ambiguous.reason, "ambiguous_quote");
});

test("worker retries back off and remain capped", () => {
  assert.equal(extractionRetryDelayMs(1), 30_000);
  assert.equal(extractionRetryDelayMs(2), 60_000);
  assert.equal(extractionRetryDelayMs(20), 15 * 60_000);
});
