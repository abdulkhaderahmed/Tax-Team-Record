-- AlterTable
ALTER TABLE "ManualObligation" ADD COLUMN     "calculationBasis" TEXT,
ADD COLUMN     "draftNote" TEXT,
ADD COLUMN     "draftReviewStatus" TEXT,
ADD COLUMN     "generationBatchId" TEXT,
ADD COLUMN     "humanExplanation" TEXT,
ADD COLUMN     "ruleId" TEXT;
