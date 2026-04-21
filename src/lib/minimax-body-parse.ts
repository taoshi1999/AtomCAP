/**
 * MiniMax/花旗双清单「行式」正文解析（与 `prisma/minimax-dual-list.seed-data.ts`、
 * `project_hypotheses.body` / `project_terms.body` 一致）。
 * 先尝试【】结构，再尝试 价值1/○论据/风险/意见/一致性评价 等行式结构。
 */

export type LineBodySection = {
  title: string
  content: string
}

/** 花旗条款矩阵：整行小标题（可无正文），与 minimax seed 中 BODY_TERM_PROTECTIVE 等对齐 */
const TERM_MATRIX_HEADER_LINE =
  /^(我方诉求|我方依据|双方冲突|我方底线|妥协空间|谈判结果|落实情况)$/

export type ParseMiniMaxBodyOptions = {
  /** 解析矩阵占位行；仅建议在条款清单 `parseTermBodyLineSections` 中开启 */
  termMatrixHeaders?: boolean
}

function parseBracketSections(body: string): LineBodySection[] {
  const sections: LineBodySection[] = []
  const regex = /【([^】]+)】\n?([\s\S]*?)(?=\n【|$)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(body)) !== null) {
    const title = match[1]?.trim()
    const content = match[2]?.trim()
    if (title && content) sections.push({ title, content })
  }
  return sections
}

function expandValueRiskBlob(label: string, blob: string): LineBodySection[] {
  const trimmed = blob.trim()
  if (!trimmed) return []
  if (!trimmed.includes("○")) {
    return [{ title: label, content: trimmed }]
  }
  const parts = trimmed.split(/\n(?=○)/)
  const out: LineBodySection[] = []
  const head = parts[0]?.trim()
  if (head) out.push({ title: label, content: head })
  const start = head ? 1 : 0
  for (let k = start; k < parts.length; k++) {
    const p = parts[k]!.trim()
    const firstLine = p.split("\n")[0] ?? ""
    const m = firstLine.match(/^○(论据|论证|论点)[：:]\s*/)
    const displayTitle = m ? `○${m[1]}` : "○依据"
    out.push({ title: displayTitle, content: p })
  }
  return out.length > 0 ? out : [{ title: label, content: trimmed }]
}

export function parseMiniMaxDualListBody(
  body: string,
  options?: ParseMiniMaxBodyOptions,
): LineBodySection[] {
  const normalized = body.replace(/\r\n/g, "\n").trim()
  if (!normalized) return []

  const lines = normalized.split("\n")
  const sections: LineBodySection[] = []
  let i = 0

  while (i < lines.length) {
    const lineRaw = lines[i]!
    const line = lineRaw.trimEnd()
    const t = line.trim()
    if (!t) {
      i++
      continue
    }

    const vr = t.match(/^(价值\d*|风险\d*)[：:]\s*(.*)$/)
    if (vr) {
      const label = vr[1]!
      const chunk: string[] = []
      const first = vr[2]?.trim()
      if (first) chunk.push(first)
      i++
      while (i < lines.length) {
        const L = lines[i]!.trimEnd()
        const u = L.trim()
        if (!u) {
          i++
          continue
        }
        if (/^(价值\d*|风险\d*)[：:]/.test(u)) break
        if (u === "意见" || /^意见[：：]/.test(u)) break
        if (/^一致性评价/.test(u)) break
        if (/^(技术背景|组织架构)[：:]/.test(u)) break
        chunk.push(L.trimEnd())
        i++
      }
      const blob = chunk.join("\n").trim()
      expandValueRiskBlob(label, blob).forEach((s) => sections.push(s))
      continue
    }

    if (t === "意见" || /^意见[：：]/.test(t)) {
      const chunk: string[] = []
      const rest = t.replace(/^意见[：：]?\s*/, "").trim()
      if (rest) chunk.push(rest)
      i++
      while (i < lines.length) {
        const u = lines[i]!.trimEnd().trim()
        if (!u) {
          i++
          continue
        }
        if (/^(价值\d*|风险\d*)[：:]/.test(u)) break
        if (/^一致性评价/.test(u)) break
        if (/^(技术背景|组织架构)[：:]/.test(u)) break
        chunk.push(lines[i]!.trimEnd())
        i++
      }
      sections.push({ title: "意见", content: chunk.join("\n").trim() })
      continue
    }

    if (options?.termMatrixHeaders && TERM_MATRIX_HEADER_LINE.test(t)) {
      const matrixTitle = t
      const chunk: string[] = []
      i++
      while (i < lines.length) {
        const u = lines[i]!.trimEnd().trim()
        if (!u) {
          i++
          continue
        }
        if (TERM_MATRIX_HEADER_LINE.test(u)) break
        if (/^(价值\d*|风险\d*)[：:]/.test(u)) break
        if (u === "意见" || /^意见[：：]/.test(u)) break
        if (/^一致性评价/.test(u)) break
        if (/^(技术背景|组织架构)[：:]/.test(u)) break
        chunk.push(lines[i]!.trimEnd())
        i++
      }
      sections.push({
        title: matrixTitle,
        content: chunk.join("\n").trim(),
      })
      continue
    }

    if (/^一致性评价/.test(t)) {
      const chunk: string[] = []
      const rest = t.replace(/^一致性评价[：：]?\s*/, "").trim()
      if (rest) chunk.push(rest)
      i++
      while (i < lines.length) {
        const u = lines[i]!.trimEnd().trim()
        if (!u) {
          i++
          continue
        }
        if (/^(价值\d*|风险\d*)[：:]/.test(u)) break
        if (u === "意见" || /^意见[：：]/.test(u)) break
        chunk.push(lines[i]!.trimEnd())
        i++
      }
      sections.push({ title: "一致性评价", content: chunk.join("\n").trim() })
      continue
    }

    if (/^(技术背景|组织架构)[：:]/.test(t)) {
      const m = t.match(/^(技术背景|组织架构)[：:]\s*(.*)$/)
      const title = m?.[1] ?? "段落"
      const chunk: string[] = []
      const rest = m?.[2]?.trim()
      if (rest) chunk.push(rest)
      i++
      while (i < lines.length) {
        const u = lines[i]!.trimEnd().trim()
        if (!u) {
          i++
          continue
        }
        if (/^(价值\d*|风险\d*)[：:]/.test(u)) break
        if (u === "意见" || /^意见[：：]/.test(u)) break
        if (/^一致性评价/.test(u)) break
        chunk.push(lines[i]!.trimEnd())
        i++
      }
      sections.push({ title, content: chunk.join("\n").trim() })
      continue
    }

    /** 营运能力：…、章节标题等非价值/风险开头的段落（种子常见） */
    const sep =
      t.indexOf("：") >= 0
        ? "："
        : t.indexOf(":") >= 0
          ? ":"
          : ""
    const idx = sep ? t.indexOf(sep) : -1
    const looksLikeNamedParagraph =
      idx > 0 &&
      !/^(价值\d*|风险\d*)[：:]/.test(t) &&
      !/^意见/.test(t) &&
      !/^一致性评价/.test(t) &&
      !/^(技术背景|组织架构)[：:]/.test(t) &&
      !t.startsWith("○")
    if (looksLikeNamedParagraph && sep) {
      const titlePart = idx >= 0 ? t.slice(0, idx).trim() : t
      const restPart = idx >= 0 ? t.slice(idx + sep.length).trim() : ""
      const chunk: string[] = []
      if (restPart) chunk.push(restPart)
      i++
      while (i < lines.length) {
        const u = lines[i]!.trimEnd().trim()
        if (!u) {
          i++
          continue
        }
        if (/^(价值\d*|风险\d*)[：:]/.test(u)) break
        if (u === "意见" || /^意见[：：]/.test(u)) break
        if (/^一致性评价/.test(u)) break
        chunk.push(lines[i]!.trimEnd())
        i++
      }
      sections.push({ title: titlePart, content: chunk.join("\n").trim() })
      continue
    }

    if (t.startsWith("○")) {
      const chunk: string[] = [line.trimEnd()]
      i++
      while (i < lines.length) {
        const u = lines[i]!.trimEnd().trim()
        if (!u) {
          i++
          continue
        }
        if (/^(价值\d*|风险\d*)[：:]/.test(u)) break
        if (u === "意见" || /^意见[：：]/.test(u)) break
        if (/^一致性评价/.test(u)) break
        if (/^(技术背景|组织架构)[：:]/.test(u)) break
        if (u.startsWith("○")) {
          chunk.push(lines[i]!.trimEnd())
          i++
          continue
        }
        chunk.push(lines[i]!.trimEnd())
        i++
      }
      const first = chunk[0]!.match(/^○(论据|论证|论点)[：:]/)
      sections.push({
        title: first ? `○${first[1]}` : "○依据",
        content: chunk.join("\n").trim(),
      })
      continue
    }

    i++
  }

  return sections.filter((s) => {
    const c = (s.content ?? "").trim()
    if (c.length > 0) return true
    if (options?.termMatrixHeaders && TERM_MATRIX_HEADER_LINE.test(s.title.trim()))
      return true
    return false
  })
}

/** 假设清单：【】优先，其次行式，否则整段「详情」 */
export function parseHypothesisBodySections(body?: string): LineBodySection[] {
  if (!body?.trim()) return []
  const bracket = parseBracketSections(body)
  if (bracket.length > 0) return bracket
  const minimax = parseMiniMaxDualListBody(body)
  if (minimax.length > 0) return minimax
  return [{ title: "详情", content: body.trim() }]
}

/** 条款清单：【】优先，其次行式，否则整段「条款细则」 */
export function parseTermBodyLineSections(body?: string): LineBodySection[] {
  if (!body?.trim()) return []
  const bracket = parseBracketSections(body)
  if (bracket.length > 0) return bracket
  const minimax = parseMiniMaxDualListBody(body, { termMatrixHeaders: true })
  if (minimax.length > 0) return minimax
  return [{ title: "条款细则", content: body.trim() }]
}
