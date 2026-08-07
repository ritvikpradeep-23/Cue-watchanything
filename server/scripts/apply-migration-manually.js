// One-off: applies a migration's SQL directly via the Prisma query engine (which can reach
// Neon fine here) and records it in _prisma_migrations, because the separate schema-engine
// binary Prisma CLI normally shells out to for `migrate dev`/`db execute` cannot reach the
// network in this environment. Mirrors exactly what `prisma migrate dev` would have written.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const migrationName = process.argv[2];
if (!migrationName) {
  console.error("Usage: node apply-migration-manually.js <migration_folder_name>");
  process.exit(1);
}

const migrationDir = path.join(__dirname, "..", "prisma", "migrations", migrationName);
const sqlPath = path.join(migrationDir, "migration.sql");
const sql = fs.readFileSync(sqlPath, "utf8");
const checksum = crypto.createHash("sha256").update(sql).digest("hex");

const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM _prisma_migrations WHERE migration_name = $1`,
    migrationName,
  );
  if (existing.length > 0) {
    console.log(`Migration ${migrationName} already recorded — skipping.`);
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const stmt of statements) {
        await tx.$executeRawUnsafe(stmt);
      }
    },
    { timeout: 30000 },
  );
  console.log(`Applied ${statements.length} statements from ${migrationName}.`);

  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
     VALUES ($1, $2, $3, $4, $5, 1)`,
    id,
    checksum,
    migrationName,
    now,
    now,
  );
  console.log(`Recorded ${migrationName} in _prisma_migrations (checksum ${checksum}).`);
}

main()
  .catch((e) => {
    console.error("FAILED", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
