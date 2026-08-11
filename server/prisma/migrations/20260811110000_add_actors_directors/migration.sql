-- AlterTable
ALTER TABLE "Title" ADD COLUMN     "directors" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "Actor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "industry" TEXT NOT NULL,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitleActor" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,

    CONSTRAINT "TitleActor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Director" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "industry" TEXT NOT NULL,
    "knownForStyles" TEXT NOT NULL DEFAULT '[]',
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Director_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitleDirector" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "directorId" TEXT NOT NULL,

    CONSTRAINT "TitleDirector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Actor_name_idx" ON "Actor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TitleActor_titleId_actorId_key" ON "TitleActor"("titleId", "actorId");

-- CreateIndex
CREATE INDEX "TitleActor_actorId_idx" ON "TitleActor"("actorId");

-- CreateIndex
CREATE INDEX "Director_name_idx" ON "Director"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TitleDirector_titleId_directorId_key" ON "TitleDirector"("titleId", "directorId");

-- CreateIndex
CREATE INDEX "TitleDirector_directorId_idx" ON "TitleDirector"("directorId");

-- AddForeignKey
ALTER TABLE "TitleActor" ADD CONSTRAINT "TitleActor_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleActor" ADD CONSTRAINT "TitleActor_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleDirector" ADD CONSTRAINT "TitleDirector_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleDirector" ADD CONSTRAINT "TitleDirector_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "Director"("id") ON DELETE CASCADE ON UPDATE CASCADE;
