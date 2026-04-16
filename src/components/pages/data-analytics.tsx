"use client"

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/src/components/ui/chart"

const valuationData = [
  { name: "MiniMax", valuation: 100, color: "#2563EB" },
  { name: "智谱AI", valuation: 85, color: "#6366F1" },
  { name: "百川智能", valuation: 60, color: "#8B5CF6" },
  { name: "月之暗面", valuation: 75, color: "#A855F7" },
  { name: "零一万物", valuation: 45, color: "#C084FC" },
]

const revenueData = [
  { quarter: "2023Q1", actual: 1.2, predicted: 1.0 },
  { quarter: "2023Q2", actual: 2.1, predicted: 1.8 },
  { quarter: "2023Q3", actual: 3.5, predicted: 3.0 },
  { quarter: "2023Q4", actual: 5.2, predicted: 4.5 },
  { quarter: "2024Q1", actual: null, predicted: 6.8 },
  { quarter: "2024Q2", actual: null, predicted: 9.2 },
  { quarter: "2024Q3", actual: null, predicted: 12.0 },
  { quarter: "2024Q4", actual: null, predicted: 15.5 },
]

export function DataAnalytics() {
  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-6xl px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">数据分析</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            {"投资项目数据可视化与趋势分析"}
          </p>
        </div>

        {/* Valuation Comparison - Bar Chart */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-1 text-base font-semibold text-[#111827]">
            竞品估值对比
          </h3>
          <p className="mb-6 text-sm text-[#6B7280]">
            {"AI 大模型赛道主要竞品估值比较（亿 USD）"}
          </p>
          <ChartContainer
            config={{
              valuation: {
                label: "估值 (亿 USD)",
                color: "#2563EB",
              },
            }}
            className="h-[350px]"
          >
            <BarChart
              data={valuationData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#6B7280" }}
                axisLine={{ stroke: "#E5E7EB" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#6B7280" }}
                axisLine={{ stroke: "#E5E7EB" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="valuation"
                fill="#2563EB"
                radius={[6, 6, 0, 0]}
                name="估值 (亿 USD)"
              />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Revenue Forecast - Line Chart */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-1 text-base font-semibold text-[#111827]">
            营收预测趋势
          </h3>
          <p className="mb-6 text-sm text-[#6B7280]">
            {"MiniMax 季度营收及预测（亿 RMB）"}
          </p>
          <ChartContainer
            config={{
              actual: {
                label: "实际营收",
                color: "#2563EB",
              },
              predicted: {
                label: "预测营收",
                color: "#9CA3AF",
              },
            }}
            className="h-[350px]"
          >
            <LineChart
              data={revenueData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="quarter"
                tick={{ fontSize: 12, fill: "#6B7280" }}
                axisLine={{ stroke: "#E5E7EB" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#6B7280" }}
                axisLine={{ stroke: "#E5E7EB" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ fill: "#2563EB", r: 4 }}
                name="实际营收"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#9CA3AF"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ fill: "#9CA3AF", r: 4 }}
                name="预测营收"
              />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  )
}
