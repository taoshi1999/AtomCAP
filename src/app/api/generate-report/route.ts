import { NextRequest, NextResponse } from "next/server"
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  Table,
  TableRow,
  TableCell,
  ShadingType,
} from "docx"

export async function POST(req: NextRequest) {
  const {
    phaseLabel,
    projectName,
    statusLabel,
    startDate,
    endDate,
    assignee,
    hCount,
    tCount,
    mCount,
    logs,
  } = await req.json()

  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const border = { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" }
  const cellBorders = { top: border, bottom: border, left: border, right: border }

  const sectionRow = (label: string, value: string) =>
    new TableRow({
      children: [
        new TableCell({
          borders: cellBorders,
          width: { size: 2200, type: WidthType.DXA },
          shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 160, right: 160 },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22, font: "Arial" })] })],
        }),
        new TableCell({
          borders: cellBorders,
          width: { size: 7160, type: WidthType.DXA },
          margins: { top: 100, bottom: 100, left: 160, right: 160 },
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 22, font: "Arial" })] })],
        }),
      ],
    })

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Arial", color: "1E3A5F" },
          paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 120 },
          children: [
            new TextRun({
              text: `${phaseLabel} 项目进展汇报`,
              bold: true, size: 48, font: "Arial", color: "111827",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 80 },
          children: [new TextRun({ text: projectName, size: 28, font: "Arial", color: "6B7280" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 480 },
          children: [new TextRun({ text: `生成日期：${today}`, size: 22, font: "Arial", color: "9CA3AF" })],
        }),

        // Section 1: Basic Info
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("一、阶段基本信息")] }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2200, 7160],
          rows: [
            sectionRow("阶段名称", phaseLabel),
            sectionRow("阶段状态", statusLabel),
            sectionRow("起止时间", `${startDate} → ${endDate}`),
            sectionRow("负责人", assignee),
          ],
        }),

        // Section 2: Hypothesis
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480 }, children: [new TextRun("二、假设验证情况")] }),
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({ text: "本阶段共设立 ", size: 22, font: "Arial" }),
            new TextRun({ text: `${hCount} 条`, size: 22, font: "Arial", bold: true, color: "2563EB" }),
            new TextRun({ text: " 投资假设，涵盖市场规模、商业模式、团队能力及竞争格局等核心维度。", size: 22, font: "Arial" }),
          ],
        }),
        new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "重点关注事项：", size: 22, font: "Arial", bold: true })] }),
        new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "• 优先核查关键假设的论证材料完整性", size: 22, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "• 确保每条假设均有对应佐证数据支撑", size: 22, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "• 对验证困难的假设及时调整研究路径", size: 22, font: "Arial" })] }),

        // Section 3: Terms
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480 }, children: [new TextRun("三、条款谈判进度")] }),
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({ text: "本阶段共涉及 ", size: 22, font: "Arial" }),
            new TextRun({ text: `${tCount} 条`, size: 22, font: "Arial", bold: true, color: "2563EB" }),
            new TextRun({ text: " 核心条款，整体谈判进度正常，关键节点均已推进。", size: 22, font: "Arial" }),
          ],
        }),
        new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "谈判要点：", size: 22, font: "Arial", bold: true })] }),
        new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "• 反稀释保护条款：需明确触发条件与保护比例", size: 22, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "• 信息权条款：定期报告频率与格式待双方确认", size: 22, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "• 优先清算权：清算倍数与参与分配方式需进一步协商", size: 22, font: "Arial" })] }),

        // Section 4: Materials
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480 }, children: [new TextRun("四、材料收集情况")] }),
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({ text: "本阶段共收集 ", size: 22, font: "Arial" }),
            new TextRun({ text: `${mCount} 份`, size: 22, font: "Arial", bold: true, color: "2563EB" }),
            new TextRun({ text: " 项目材料，覆盖行业研究、财务数据、尽调文件等主要类别。", size: 22, font: "Arial" }),
          ],
        }),
        new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "待补充材料：", size: 22, font: "Arial", bold: true })] }),
        new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "• 核心团队成员背景及履历材料", size: 22, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "• 最新期财务报表及审计报告", size: 22, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "• 主要竞争对手对标分析报告", size: 22, font: "Arial" })] }),

        // Section 5: Recent activities
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480 }, children: [new TextRun("五、近期动态")] }),
        ...(logs && logs.length > 0
          ? (logs as string[]).map((l: string) =>
              new Paragraph({
                spacing: { before: 80, after: 80 },
                children: [new TextRun({ text: `• ${l}`, size: 22, font: "Arial" })],
              })
            )
          : [new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "• 暂无近期动态记录", size: 22, font: "Arial", color: "9CA3AF" })] })]),

        // Section 6: Next steps
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480 }, children: [new TextRun("六、下一步工作计划")] }),
        new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "• 完成剩余假设的材料收集与验证工作", size: 22, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "• 推进核心条款的深度谈判，明确双方底线区间", size: 22, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "• 召开投资委员会评审会，汇报本阶段调研成果", size: 22, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "• 补充完善尽调材料体系，确保材料覆盖率达标", size: 22, font: "Arial" })] }),

        // Footer note
        new Paragraph({
          spacing: { before: 560, after: 0 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "本报告由 AtomCAP AI 助手自动生成，仅供内部参考使用", size: 18, font: "Arial", color: "9CA3AF", italics: true })],
        }),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)

  const fullFilename = `${phaseLabel}项目进展汇报.docx`
  const encodedFilename = encodeURIComponent(fullFilename)

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="report.docx"; filename*=UTF-8''${encodedFilename}`,
    },
  })
}
