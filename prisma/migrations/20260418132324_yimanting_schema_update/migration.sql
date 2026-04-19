-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "irr" DOUBLE PRECISION,
ADD COLUMN     "logo" VARCHAR(20),
ADD COLUMN     "managerId" VARCHAR(100),
ADD COLUMN     "managerName" VARCHAR(100),
ADD COLUMN     "round" VARCHAR(50),
ADD COLUMN     "tags" VARCHAR(50),
ADD COLUMN     "totalInvestment" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "DashboardOverview" (
    "id" TEXT NOT NULL,
    "totalProjectCount" INTEGER NOT NULL DEFAULT 0,
    "totalInvestment" DOUBLE PRECISION,
    "fundCount" INTEGER NOT NULL DEFAULT 0,
    "newProjectCount" INTEGER NOT NULL DEFAULT 0,
    "irrMedian" DOUBLE PRECISION,
    "dpiDistribution" VARCHAR(50),
    "avgReturnMultiple" DOUBLE PRECISION,
    "exitWinRate" DOUBLE PRECISION,
    "avgProjectDuration" INTEGER,
    "invalidEfficiency" DOUBLE PRECISION,
    "approvalPassRate" DOUBLE PRECISION,
    "highRiskProjectCount" INTEGER NOT NULL DEFAULT 0,
    "compliancePendingCount" INTEGER NOT NULL DEFAULT 0,
    "todayMeetingCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardOverview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardChart" (
    "id" TEXT NOT NULL,
    "trackName" VARCHAR(50),
    "trackInvestAmount" DOUBLE PRECISION,
    "trackRatio" DOUBLE PRECISION,
    "stageName" VARCHAR(50),
    "stageProjectCount" INTEGER,
    "statisticMonth" VARCHAR(20),
    "quarter" VARCHAR(20),
    "fundIrr" DOUBLE PRECISION,
    "industryTopIrr" DOUBLE PRECISION,
    "industryAvgIrr" DOUBLE PRECISION,
    "managerName" VARCHAR(50),
    "managerProjectCount" INTEGER,
    "managerAvgCycle" INTEGER,
    "managerEfficiencyScore" INTEGER,

    CONSTRAINT "DashboardChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardTodo" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(50),
    "title" VARCHAR(255),
    "projectName" VARCHAR(255),
    "submitter" VARCHAR(50),
    "submitTime" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "priority" VARCHAR(20),
    "operation" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardTodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "iconName" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "frameworkName" VARCHAR(255),
    "description" TEXT,
    "managerName" VARCHAR(100),
    "projectCount" INTEGER NOT NULL DEFAULT 0,
    "totalInvestment" VARCHAR(50),
    "returnRate" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);
