-- 创建项目表
CREATE TABLE IF NOT EXISTS "projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT '待立项',
    "valuation" TEXT,
    "round" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "strategyId" TEXT,
    "strategyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "projects_code_key" UNIQUE ("code")
);

-- 创建索引
CREATE INDEX IF NOT EXISTS "projects_code_idx" ON "projects"("code");
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects"("status");
CREATE INDEX IF NOT EXISTS "projects_ownerId_idx" ON "projects"("ownerId");
CREATE INDEX IF NOT EXISTS "projects_strategyId_idx" ON "projects"("strategyId");
CREATE INDEX IF NOT EXISTS "projects_createdAt_idx" ON "projects"("createdAt");
