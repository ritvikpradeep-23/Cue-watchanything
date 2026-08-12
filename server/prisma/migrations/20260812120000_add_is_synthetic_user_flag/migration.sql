-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSynthetic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_isSynthetic_idx" ON "User"("isSynthetic");
