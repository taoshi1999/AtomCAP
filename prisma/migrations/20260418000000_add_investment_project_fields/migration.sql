-- DropIndex
DROP INDEX IF EXISTS "projects_creator_id_idx";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN IF EXISTS "priority";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "industry";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "stage";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "budget";

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "logo" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "valuation" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "round" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "owner_id" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "owner_name" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "strategy_id" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "strategy_name" TEXT;

-- Update status default
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT '待立项';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_code_idx" ON "projects"("code");
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects"("status");
CREATE INDEX IF NOT EXISTS "projects_owner_id_idx" ON "projects"("owner_id");
CREATE INDEX IF NOT EXISTS "projects_strategy_id_idx" ON "projects"("strategy_id");
CREATE INDEX IF NOT EXISTS "projects_created_at_idx" ON "projects"("created_at");

-- Generate code for existing projects (if any)
UPDATE "projects" SET "code" = 'PRJ' || to_char("created_at", 'YYMMDD') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0') WHERE "code" IS NULL;

-- Make code NOT NULL after filling existing records
ALTER TABLE "projects" ALTER COLUMN "code" SET NOT NULL;
