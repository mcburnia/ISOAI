-- CreateTable
CREATE TABLE "ScheduledObligation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "standardCode" TEXT NOT NULL,
    "clauseRef" TEXT,
    "frequency" TEXT NOT NULL,
    "customDays" INTEGER,
    "anchorDate" TIMESTAMP(3) NOT NULL,
    "assigneeId" TEXT,
    "linkedEntityId" TEXT,
    "linkedEntityType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObligationInstance" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "linkedRecordId" TEXT,
    "linkedRecordType" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObligationInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledObligation_standardCode_idx" ON "ScheduledObligation"("standardCode");

-- CreateIndex
CREATE INDEX "ScheduledObligation_status_idx" ON "ScheduledObligation"("status");

-- CreateIndex
CREATE INDEX "ObligationInstance_obligationId_idx" ON "ObligationInstance"("obligationId");

-- CreateIndex
CREATE INDEX "ObligationInstance_dueDate_idx" ON "ObligationInstance"("dueDate");

-- CreateIndex
CREATE INDEX "ObligationInstance_status_idx" ON "ObligationInstance"("status");

-- AddForeignKey
ALTER TABLE "ScheduledObligation" ADD CONSTRAINT "ScheduledObligation_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationInstance" ADD CONSTRAINT "ObligationInstance_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ScheduledObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationInstance" ADD CONSTRAINT "ObligationInstance_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
