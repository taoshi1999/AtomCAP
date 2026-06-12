/**
 * AI 硬件赛道 mock Thesis —— 内容取自《赛道前瞻Agent》设计文档示例。
 * 用途：Phase 0 验收（六区 UI 渲染）与前端独立开发，Phase 1 后由真实 API 替代。
 */
import type { Thesis } from "../lib/types";

const fit = (total: number, rationale: string) => ({
  track_preference: 90,
  stage_match: 85,
  moat_match: 78,
  geo_match: 70,
  risk_appetite_match: 80,
  history_similarity: 65,
  exclusion_penalty: 0,
  total,
  rationale,
});

export const mockThesis: Thesis = {
  schema_version: 1,
  thesis_name: "AI 硬件",
  one_line_view:
    "AI 硬件正在从“终端概念验证”进入“供应链环节分化”阶段。相比直接押注整机品牌，当前更值得关注低功耗推理、光学交互、机器人感知模组等确定性更强的上游环节。",
  opportunity_level: "高",
  risk_level: "中高",
  advice: "重点关注上游组件和端侧计算方向",
  sub_directions: [
    {
      name: "AI 眼镜光学与交互模组",
      detail: "终端形态尚未完全确定，光学、声学、低功耗交互是供应链确定性更强的环节。",
      investment_reasons: [
        { text: "终端形态未定，但光学/声学/低功耗交互环节供应链确定性强", evidence_ids: ["ev-1"], inferred: false },
      ],
      representative_companies: [{ name: "示例光学模组公司" }],
      key_risks: [{ text: "供应链同质化严重", evidence_ids: [], inferred: true }],
      suitable_stage: "A轮",
      fit_score: fit(86, "与机构硬科技偏好高度匹配，阶段契合"),
    },
    {
      name: "端侧推理芯片与模组",
      detail: "模型小型化与本地推理需求上升，低功耗算力成为关键瓶颈。",
      investment_reasons: [
        { text: "模型小型化趋势下低功耗算力是关键瓶颈", evidence_ids: ["ev-2"], inferred: false },
      ],
      representative_companies: [{ name: "示例端侧芯片公司" }],
      key_risks: [{ text: "大厂可能压缩创业公司空间", evidence_ids: [], inferred: true }],
      suitable_stage: "A/B轮",
      fit_score: fit(82, "技术壁垒匹配，地域适中"),
    },
    {
      name: "AI 陪伴硬件 / AI 玩具",
      detail: "大模型降低内容生成成本，但产品生命周期、渠道和复购仍需验证。",
      investment_reasons: [
        { text: "大模型显著降低内容生成成本", evidence_ids: ["ev-3"], inferred: false },
      ],
      representative_companies: [{ name: "示例 AI 玩具公司" }],
      key_risks: [{ text: "消费者付费意愿仍不确定", evidence_ids: [], inferred: true }],
      suitable_stage: "天使/Pre-A",
      fit_score: fit(68, "偏消费属性，与机构硬科技偏好部分匹配"),
    },
    {
      name: "机器人感知与边缘计算组件",
      detail: "具身智能带动传感器、视觉模组、边缘计算单元需求。",
      investment_reasons: [
        { text: "具身智能带动传感器/视觉模组/边缘计算需求", evidence_ids: ["ev-4"], inferred: false },
      ],
      representative_companies: [{ name: "示例视觉模组公司" }],
      key_risks: [{ text: "下游放量节奏不确定", evidence_ids: [], inferred: true }],
      suitable_stage: "A轮",
      fit_score: fit(84, "与已投项目协同性强"),
    },
    {
      name: "AI 终端操作系统与开发工具链",
      detail: "若 AI 硬件分化为多设备生态，OS 和应用开发层可能出现平台机会。",
      investment_reasons: [
        { text: "多设备生态分化将催生 OS 与开发工具平台机会", evidence_ids: [], inferred: true },
      ],
      representative_companies: [],
      key_risks: [{ text: "平台机会依赖终端放量，时点难判", evidence_ids: [], inferred: true }],
      suitable_stage: "天使",
      fit_score: fit(61, "前瞻性方向，风险偏好要求高"),
    },
  ],
  investment_reason: [
    { text: "供应链环节分化期更适合机构的上游组件投资偏好", evidence_ids: ["ev-1"], inferred: false },
  ],
  institution_fit_score: fit(82, "赛道偏好与阶段高度匹配，历史项目有协同"),
  value_chain: {
    upstream: [
      { name: "芯片", margin_potential: "高", entry_difficulty: "高", suitable_stage: "A/B轮" },
      { name: "传感器" },
      { name: "光学模组" },
      { name: "电池" },
    ],
    midstream: [{ name: "端侧模型部署" }, { name: "操作系统" }, { name: "交互方案" }, { name: "硬件集成" }],
    downstream: [{ name: "AI 眼镜" }, { name: "机器人" }, { name: "AI 玩具" }, { name: "工业终端" }],
    customers: ["消费者", "企业", "产业客户"],
  },
  recent_signals: [
    {
      kind: "structural",
      title: "端侧推理成本持续下降",
      summary: { text: "低功耗推理芯片单位算力成本同比下降", evidence_ids: ["ev-2"], inferred: false },
      signal_date: "2026-05-20",
    },
    {
      kind: "heat",
      title: "AI 眼镜新品密集发布",
      summary: { text: "多家大厂与创业公司发布新一代 AI 眼镜", evidence_ids: ["ev-1"], inferred: false },
      signal_date: "2026-05-08",
    },
  ],
  representative_companies: [{ name: "示例整机品牌" }, { name: "示例模组公司" }],
  key_risks: [
    { text: "终端需求可能被高估", evidence_ids: [], inferred: true },
    { text: "硬件毛利率和库存风险较高", evidence_ids: [], inferred: true },
    { text: "供应链同质化严重", evidence_ids: [], inferred: true },
    { text: "大厂可能压缩创业公司空间", evidence_ids: [], inferred: true },
  ],
  recommended_actions: ["generate_deal_pool", "follow_track", "generate_briefing", "re_recommend"],
  status: "draft",
};
