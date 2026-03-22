-- CreateTable
CREATE TABLE "HarmonizedRequirement" (
    "id" TEXT NOT NULL,
    "clauseNumber" TEXT NOT NULL,
    "clauseTitle" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HarmonizedRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HarmonizedEvidence" (
    "id" TEXT NOT NULL,
    "harmonizedRequirementId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "evidenceType" TEXT NOT NULL,
    "fileUrl" TEXT,
    "externalUrl" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HarmonizedEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HarmonizedRequirement_clauseNumber_key" ON "HarmonizedRequirement"("clauseNumber");

-- CreateIndex
CREATE INDEX "HarmonizedEvidence_harmonizedRequirementId_idx" ON "HarmonizedEvidence"("harmonizedRequirementId");

-- AlterTable: Add harmonizedGroupId to ControlMapping
ALTER TABLE "ControlMapping" ADD COLUMN "harmonizedGroupId" TEXT;

-- AddForeignKey
ALTER TABLE "ControlMapping" ADD CONSTRAINT "ControlMapping_harmonizedGroupId_fkey" FOREIGN KEY ("harmonizedGroupId") REFERENCES "HarmonizedRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarmonizedEvidence" ADD CONSTRAINT "HarmonizedEvidence_harmonizedRequirementId_fkey" FOREIGN KEY ("harmonizedRequirementId") REFERENCES "HarmonizedRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarmonizedEvidence" ADD CONSTRAINT "HarmonizedEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
