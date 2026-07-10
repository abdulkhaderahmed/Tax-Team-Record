-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "clerkOrgId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clerkUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_clerkOrgId_key" ON "Organisation"("clerkOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
