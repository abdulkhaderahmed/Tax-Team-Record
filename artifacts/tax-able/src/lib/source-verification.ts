import type {
  PageAwareBlock,
  SourcePageSegment,
} from "./page-aware-extraction";

export interface SourceReference {
  sourceBlockId: string;
  sourcePageNumber: number | null;
  sourceText: string;
}

export interface VerifiedSourceReference extends SourceReference {
  valid: boolean;
  corrected: boolean;
  reason?:
    | "empty_quote"
    | "unknown_block"
    | "quote_not_found"
    | "ambiguous_quote";
}

export function normaliseSourceText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function pageMatchesQuote(
  page: SourcePageSegment,
  normalisedQuote: string,
): boolean {
  return normaliseSourceText(page.text).includes(normalisedQuote);
}

/**
 * Verifies model provenance against the exact blocks that were supplied. If the model names the
 * wrong page/block but its quote occurs on exactly one physical page, the server derives and
 * corrects that page. Fabricated or ambiguous quotes remain unverified.
 */
export function verifySourceReference(
  reference: SourceReference,
  blocks: PageAwareBlock[],
): VerifiedSourceReference {
  const normalisedQuote = normaliseSourceText(reference.sourceText);
  if (!normalisedQuote)
    return {
      ...reference,
      valid: false,
      corrected: false,
      reason: "empty_quote",
    };

  const claimedBlock = blocks.find(
    (block) => block.id === reference.sourceBlockId,
  );
  if (claimedBlock) {
    const claimedMatches = claimedBlock.pages.filter(
      (page) =>
        page.pageNumber === reference.sourcePageNumber &&
        pageMatchesQuote(page, normalisedQuote),
    );
    if (claimedMatches.length > 0)
      return { ...reference, valid: true, corrected: false };
  }

  const matches = blocks.flatMap((block) =>
    block.pages
      .filter((page) => pageMatchesQuote(page, normalisedQuote))
      .map((page) => ({
        blockId: block.id,
        pageNumber: page.pageNumber ?? null,
      })),
  );
  const physicalPages = new Set(
    matches.map((match) =>
      match.pageNumber == null
        ? `block:${match.blockId}`
        : `page:${match.pageNumber}`,
    ),
  );

  if (physicalPages.size === 1 && matches.length > 0) {
    const match = matches[0];
    return {
      ...reference,
      sourceBlockId: match.blockId,
      sourcePageNumber: match.pageNumber,
      valid: true,
      corrected: true,
    };
  }

  return {
    ...reference,
    valid: false,
    corrected: false,
    reason:
      matches.length === 0
        ? claimedBlock
          ? "quote_not_found"
          : "unknown_block"
        : "ambiguous_quote",
  };
}
