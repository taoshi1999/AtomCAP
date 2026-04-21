/**
 * MiniMax / 花旗双清单：正文分段 → UI 维度（价值 / 风险 / 评论 / 依据 / 其他）
 * 假设清单与条款清单共用核心规则；条款清单额外识别谈判矩阵小标题。
 */

export type MiniMaxSectionKind = "value" | "risk" | "opinion" | "support" | "other"

export function classifyHypothesisBodySection(section: {
  title: string
  content: string
}): MiniMaxSectionKind {
  return classifyMiniMaxSection(section, "hypothesis")
}

export function classifyTermBodySection(section: {
  title: string
  content: string
}): MiniMaxSectionKind {
  return classifyMiniMaxSection(section, "term")
}

function classifyMiniMaxSection(
  section: { title: string; content: string },
  variant: "hypothesis" | "term",
): MiniMaxSectionKind {
  const c = section.content
  const t = section.title.replace(/\s+/g, "").trim()
  const tNoCircle = t.replace(/^○+/, "")

  // 条款谈判矩阵（与 BODY_TERM_PROTECTIVE 等「我方诉求/我方依据」占位行一致）
  if (variant === "term") {
    if (/^(我方诉求|我方主张)/.test(tNoCircle)) return "value"
    if (/^(我方依据)/.test(tNoCircle)) return "support"
    if (/^(双方冲突)/.test(tNoCircle)) return "risk"
    if (/^(我方底线)/.test(tNoCircle)) return "risk"
    if (/^(妥协空间)/.test(tNoCircle)) return "opinion"
    if (/^(谈判结果|落实情况)$/.test(tNoCircle)) return "other"
  }

  // 依据链（○论据/○论证 及解析器生成的 ○依据）
  if (/^(原文章节|论据|论证|论点)/.test(tNoCircle)) return "support"
  if (/^(背景|数据|引用|附录)/.test(tNoCircle)) return "support"
  if (/^依据$/.test(tNoCircle) || t === "○依据") return "support"

  // 评论 / 一致性（先于「标题中含风险一词」判断）
  if (t.includes("一致性评价") || /^一致性/.test(t)) return "opinion"
  if (/^(意见|评论)/.test(t) || /^(意见|评论)/.test(tNoCircle)) return "opinion"
  if (t.includes("投委意见") || t.includes("内部意见")) return "opinion"
  if (tNoCircle === "意见") return "opinion"

  // 数字标题 价值n / 风险n（与行式解析器产生的 title 一致）
  if (/^价值\d+/.test(tNoCircle)) return "value"
  if (/^风险\d+/.test(tNoCircle)) return "risk"

  // 无编号但以「价值」「风险」开头的行式标题（避免「…减值风险…」整句标题误判）
  if (/^价值([：:]|$)/.test(tNoCircle) || tNoCircle === "价值") return "value"
  if (/^风险([：:]|$)/.test(tNoCircle) || tNoCircle === "风险") return "risk"

  // 条款：「条款依据」「法律依据」等归入依据，而非泛化「价值」
  if (variant === "term") {
    if (/条款依据|法律依据|事实依据|合同依据/.test(tNoCircle)) return "support"
  }

  // 宽松兜底（旧逻辑，置后以免覆盖结构化标题）
  if (t.includes("增益") || t.includes("诉求")) return "value"
  if (t.includes("冲突") || t.includes("底线")) return "risk"

  if (c.includes("意见：")) return "opinion"

  if (t === "详情" || t === "其他" || t === "说明") return "other"
  if (variant === "term" && t === "条款细则") return "other"

  return "other"
}
