/**
 * 表格与详情中的日期时间展示（兼容 ISO 与 YYYY-MM-DD）
 */
export function formatDisplayDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—"
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}
