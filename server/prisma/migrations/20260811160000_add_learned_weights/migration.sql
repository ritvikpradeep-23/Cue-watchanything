-- CreateTable
CREATE TABLE "LearnedWeights" (
    "id" TEXT NOT NULL,
    "weights" TEXT NOT NULL,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainingRowCount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LearnedWeights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearnedWeights_isActive_idx" ON "LearnedWeights"("isActive");
