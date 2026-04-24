"use client"

import { useState } from "react"
import {
  Search,
  FileText,
  Plus,
  Link2,
  Eye,
  Trash2,
  User,
  X,
  ChevronRight,
  Send,
  Target,
  FileCheck,
  AlertTriangle,
  Shield,
  Handshake,
  CheckCircle,
  ClipboardCheck,
  Upload,
  Pencil,
} from "lucide-react"
import { Badge } from "@/src/components/ui/badge"
import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { cn } from "@/src/lib/utils"
import type { NegotiationDecisionFormData, ImplementationStatusFormData } from "@/src/components/pages/workflow"
import type { StrategyMaterial } from "@/src/components/pages/strategies-grid"

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */
export interface TermTableItem {
  id: string
  direction: string  // 条款方向 (一级类目)
  category: string   // 条款类别 (二级类目)
  name: string       // 条款名称
  owner: string      // 负责人
  createdAt: string  // 创建时间
  updatedAt: string  // 更改时间
  status: "approved" | "pending" | "rejected"
}

interface PersonInfo {
  name: string
  role: string
}

interface LinkedHypothesis {
  id: string
  title: string
  status: "verified" | "pending" | "risky"
}

interface SectionContent {
  content: string
  files?: { name: string; size: string; date: string }[]
  linkedHypotheses?: LinkedHypothesis[]
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface NegotiationResult {
  conclusion: string
  status: "agreed" | "partial" | "rejected"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface ImplementationStatus {
  status: "implemented" | "in-progress" | "not-started"
  conclusion?: string
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

export interface TermDetail {
  id: string
  title: string
  termId: string
  createdAt: string
  updatedAt: string
  status: "approved" | "pending" | "rejected"
  creator: PersonInfo
  ourDemand: SectionContent           // 我方诉求
  ourBasis: SectionContent            // 我方依据
  bilateralConflict: SectionContent   // 双方冲突
  ourBottomLine: SectionContent       // 我方底线
  compromiseSpace: SectionContent     // 妥协空间
  negotiationResult: NegotiationResult // 谈判结果
  implementationStatus: ImplementationStatus // 落实情况
}

/* ------------------------------------------------------------------ */
/*  Mock people                                                        */
/* ------------------------------------------------------------------ */
const PEOPLE: Record<string, PersonInfo> = {
  zhangwei: { name: "张伟", role: "投资经理" },
  lisi: { name: "李四", role: "高级分析师" },
  wangwu: { name: "王五", role: "合伙人" },
  wangzong: { name: "王总", role: "投委会主席" },
  chenzong: { name: "陈总", role: "风控总监" },
  zhaoliu: { name: "赵六", role: "法务顾问" },
}

/* ------------------------------------------------------------------ */
/*  Mock data - table items                                            */
/* ------------------------------------------------------------------ */
const termTableData: TermTableItem[] = [
  {
    id: "board-seat",
    direction: "控制权条款",
    category: "董事会条款",
    name: "投资方有权委派一名董事进入公司董事会",
    owner: "张伟",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "approved",
  },
  {
    id: "observer-right",
    direction: "控制权条款",
    category: "董事会条款",
    name: "投资方有权委派一名观察员列席董事会会议",
    owner: "李四",
    createdAt: "2024-01-16",
    updatedAt: "2024-02-21",
    status: "approved",
  },
  {
    id: "major-veto",
    direction: "控制权条款",
    category: "否决权条款",
    name: "对公司章程修改、增减注册资本等重大事项享有一票否决权",
    owner: "王五",
    createdAt: "2024-01-17",
    updatedAt: "2024-02-22",
    status: "pending",
  },
  {
    id: "related-party-veto",
    direction: "控制权条款",
    category: "否决权条款",
    name: "对超过100万元的关联交易享有否决权",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-23",
    status: "pending",
  },
  {
    id: "liquidation-pref",
    direction: "经济条款",
    category: "清算优先权",
    name: "投资方有权优先于普通股股东获得投资金额1.5倍的回报",
    owner: "李四",
    createdAt: "2024-01-19",
    updatedAt: "2024-02-24",
    status: "approved",
  },
  {
    id: "participation",
    direction: "经济条款",
    category: "清算优先权",
    name: "投资方在获得优先清算后可参与剩余资产的按比例分配",
    owner: "王五",
    createdAt: "2024-01-20",
    updatedAt: "2024-02-25",
    status: "approved",
  },
  {
    id: "weighted-average",
    direction: "经济条款",
    category: "反稀释保护",
    name: "采用加权平均反稀释公式保护投资方股权比例",
    owner: "张伟",
    createdAt: "2024-01-21",
    updatedAt: "2024-02-26",
    status: "pending",
  },
  {
    id: "drag-along",
    direction: "退出条款",
    category: "领售权",
    name: "在特定条件下投资方有权要求创始人一同出售股份",
    owner: "李四",
    createdAt: "2024-01-22",
    updatedAt: "2024-02-27",
    status: "rejected",
  },
]

/* ------------------------------------------------------------------ */
/*  Mock data - detail                                                 */
/* ------------------------------------------------------------------ */
const termDetails: Record<string, TermDetail> = {
  "board-seat": {
    id: "board-seat",
    title: "投资方有权委派一名董事进入公司董事会",
    termId: "TM-2024-001",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "approved",
    creator: PEOPLE.zhangwei,
    ourDemand: {
      content: "投资方要求在公司董事会中获得一个正式董事席位，该董事享有与其他董事同等的表决权和知情权，参与公司所有重大经营决策的审议和表决。",
      files: [
        { name: "投资条款清单_v1.pdf", size: "2.1 MB", date: "2024-01-10" },
        { name: "董事会席位要求说明.docx", size: "156 KB", date: "2024-01-12" },
      ],
      linkedHypotheses: [
        { id: "h1", title: "创始人闫俊杰具有扎实的人工智能学术背景", status: "verified" },
      ],
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.lisi, PEOPLE.wangwu],
      createdAt: "2024-01-15",
      comments: [
        { author: "王五", content: "建议同时要求列席技术委员会的权利", time: "2024-01-15 14:30" },
      ],
    },
    ourBasis: {
      content: "基于本轮投资金额（5000万美元）及持股比例（15%），按照行业惯例，该投资规模的股东通常可获得董事会席位。参考同类型投资案例，如红杉资本在字节跳动B轮的类似安排。此外，作为战略投资方，我们的行业资源和技术能力可为公司发展提供重要支持，董事席位有助于更好地发挥协同效应。",
      files: [
        { name: "行业对标分析报告.pdf", size: "3.2 MB", date: "2024-01-14" },
        { name: "投资权益条款对比表.xlsx", size: "890 KB", date: "2024-01-14" },
      ],
      linkedHypotheses: [
        { id: "h2", title: "公司治理结构需要外部监督", status: "verified" },
      ],
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.lisi],
      createdAt: "2024-01-16",
      comments: [],
    },
    bilateralConflict: {
      content: "创始团队担忧：1）外部董事可能干预公司日常运营决策，影响管理层独立性；2）涉及核心技术和商业机密的讨论可能因外部董事参与而存在信息泄露风险；3）董事会决策效率可能因新增成员而降低。公司律师建议限制投资方董事的表决事项范围。",
      files: [
        { name: "公司方反馈意见.pdf", size: "1.1 MB", date: "2024-01-18" },
      ],
      linkedHypotheses: [],
      creator: PEOPLE.lisi,
      reviewers: [PEOPLE.zhangwei, PEOPLE.zhaoliu],
      createdAt: "2024-01-18",
      comments: [
        { author: "赵六", content: "法务角度看，信息泄露风险可通过保密协议约束", time: "2024-01-18 16:00" },
      ],
    },
    ourBottomLine: {
      content: "必须获得至少一个董事会席位，且该席位必须是正式董事而非观察员。董事必须有权参与所有重大事项的表决，包括但不限于：年度预算审批、重大投资决策、核心高管任免、关联交易审批等。不接受仅限于特定事项的表决权限制。",
      files: [],
      linkedHypotheses: [],
      creator: PEOPLE.wangwu,
      reviewers: [PEOPLE.zhangwei, PEOPLE.chenzong],
      createdAt: "2024-01-19",
      comments: [],
    },
    compromiseSpace: {
      content: "可接受的妥协方案：1）同意签署严格的保密协议，明确信息使用范围和泄露责任；2）同意在涉及创始人个人利益的事项上回避表决；3）同意首年仅以观察员身份参与，但需在协议中明确一年后自动转为正式董事；4）可考虑将部分敏感技术讨论单独安排，投资方董事不参与该部分会议。",
      files: [
        { name: "妥协方案备选.docx", size: "456 KB", date: "2024-01-20" },
      ],
      linkedHypotheses: [],
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.lisi, PEOPLE.wangwu],
      createdAt: "2024-01-20",
      comments: [
        { author: "李四", content: "方案3可作为最后的谈判筹码", time: "2024-01-20 10:30" },
      ],
    },
    negotiationResult: {
      conclusion: "谈判达成",
      status: "agreed",
      content: "经过三轮谈判，双方达成一致：投资方获得一个正式董事席位，享有完整表决权。作为交换条件：1）投资方董事签署保密协议，承诺不向竞争对手披露任何公司信息；2）在涉及创始团队个人薪酬和股权激励的事项上，投资方董事回避表决；3）公司承诺每月向投资方提供经营简报，确保信息透明。",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhangwei, PEOPLE.lisi],
      createdAt: "2024-01-25",
      comments: [
        { author: "陈总", content: "风控角度认可该方案，保密条款保护到位", time: "2024-01-25 15:00" },
        { author: "张伟", content: "已将谈判结果更新至投资协议草案", time: "2024-01-25 17:30" },
      ],
    },
    implementationStatus: {
      status: "implemented",
      content: "该条款已在投资协议正式条款中体现（第5.2条），并于2024年2月15日完成签署。张伟已正式被任命为公司董事，参加了2024年3月的首次董事会会议。保密协议已于2024年2月20日签署完毕，相关备案手续已完成。",
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.zhaoliu],
      createdAt: "2024-03-01",
      comments: [],
    },
  },
}

/* ------------------------------------------------------------------ */
/*  Default detail entries for AI基础设施 template terms               */
/* ------------------------------------------------------------------ */
const emptySection = (creator: PersonInfo): SectionContent => ({
  content: "",
  files: [],
  linkedHypotheses: [],
  creator,
  reviewers: [],
  createdAt: "",
  comments: [],
})

const emptyNegotiation: NegotiationResult = {
  conclusion: "",
  status: "partial",
  content: "",
  creator: PEOPLE.zhangwei,
  reviewers: [],
  createdAt: "",
  comments: [],
}

const emptyImplementation: ImplementationStatus = {
  status: "not-started",
  content: "",
  creator: PEOPLE.zhangwei,
  reviewers: [],
  createdAt: "",
  comments: [],
}

  ;["ai-t1", "ai-t2", "ai-t3", "ai-t4", "ai-t5", "ai-t6"].forEach((tid, i) => {
    const item = [
      { name: "投资方有权获取被投企业月度财务报告", termId: "TM-2026-001", createdAt: "2026-01-10" },
      { name: "投资方有权对重大技术决策进行知情和建议", termId: "TM-2026-002", createdAt: "2026-01-12" },
      { name: "采用完全棘轮反稀释条款保护投资方权益", termId: "TM-2026-003", createdAt: "2026-01-15" },
      { name: "投资方有权委派一名董事参与公司董事会", termId: "TM-2026-004", createdAt: "2026-01-18" },
      { name: "对核心技术IP转让和授权享有一票否决权", termId: "TM-2026-005", createdAt: "2026-01-20" },
      { name: "若公司未能在5年内实现IPO，投资方有权要求回购", termId: "TM-2026-006", createdAt: "2026-01-22" },
    ][i]
    termDetails[tid] = {
      id: tid,
      title: item.name,
      termId: item.termId,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
      status: "pending",
      creator: PEOPLE.zhangwei,
      ourDemand: emptySection(PEOPLE.zhangwei),
      ourBasis: emptySection(PEOPLE.zhangwei),
      bilateralConflict: emptySection(PEOPLE.lisi),
      ourBottomLine: emptySection(PEOPLE.wangwu),
      compromiseSpace: emptySection(PEOPLE.zhangwei),
      negotiationResult: emptyNegotiation,
      implementationStatus: emptyImplementation,
    }
  })

/* ------------------------------------------------------------------ */
/*  AI基础设施策略模板条款数据                                          */
/* ------------------------------------------------------------------ */
const aiInfrastructureTerms: TermTableItem[] = [
  {
    id: "ai-t1",
    direction: "投资保护条款",
    category: "信息权",
    name: "投资方有权获取被投企业月度财务报告",
    owner: "张伟",
    createdAt: "2024-01-10",
    updatedAt: "2024-02-15",
    status: "approved",
  },
  {
    id: "ai-t2",
    direction: "投资保护条款",
    category: "信息权",
    name: "投资方有权对重大技术决策进行知情和建议",
    owner: "李四",
    createdAt: "2024-01-12",
    updatedAt: "2024-02-18",
    status: "approved",
  },
  {
    id: "ai-t3",
    direction: "投资保护条款",
    category: "反稀释条款",
    name: "采用完全棘轮反稀释条款保护投资方权益",
    owner: "王五",
    createdAt: "2024-01-15",
    updatedAt: "2024-02-20",
    status: "pending",
  },
  {
    id: "ai-t4",
    direction: "控制权条款",
    category: "董事会席位",
    name: "投资方有权委派一名董事参与公司董事会",
    owner: "张伟",
    createdAt: "2024-01-18",
    updatedAt: "2024-02-22",
    status: "approved",
  },
  {
    id: "ai-t5",
    direction: "控制权条款",
    category: "重大事项否决权",
    name: "对核心技术IP转让和授权享有一票否决权",
    owner: "李四",
    createdAt: "2024-01-20",
    updatedAt: "2024-02-25",
    status: "pending",
  },
  {
    id: "ai-t6",
    direction: "退出条款",
    category: "回购条款",
    name: "若公司未能在5年内实现IPO，投资方有权要求回购",
    owner: "王五",
    createdAt: "2024-01-22",
    updatedAt: "2024-02-28",
    status: "rejected",
  },
]

/* ------------------------------------------------------------------ */
/*  Mid-investment terms (added when 投决 is approved)                 */
/* ------------------------------------------------------------------ */
export const midInvestmentTerms: TermTableItem[] = [
  {
    id: "mid-t1",
    direction: "资本安全与下行保护",
    category: "优先清偿权",
    name: "在公司发生任何清算事件时，优先股股东有权就公司可依法分配的资产，优先获得相当于其所持 A 轮优先股原始发行价格 100%的清偿金额",
    owner: "张伟",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-10",
    status: "approved",
  },
  {
    id: "mid-t2",
    direction: "资本安全与下行保护",
    category: "优先清偿权",
    name: "每一名 A 轮优先股股东均有权自行选择放弃其优先清偿金额，并按其所持优先股视同转换为普通股后的比例参与公司资产分配",
    owner: "李四",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-10",
    status: "approved",
  },
  {
    id: "mid-t3",
    direction: "资本安全与下行保护",
    category: "股权安排",
    name: "股利为投资额百分比10%；A 轮优先股股东有权按照其原始投资额的年化 10%，享有优先股股利的分配权利。A 轮优先股股东每年最多可以拿到的股利上限，原始投资额 × 10%温和数字",
    owner: "张伟",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-10",
    status: "approved",
  },
  {
    id: "mid-t4",
    direction: "资本安全与下行保护",
    category: "股权安排",
    name: "非自动股利。前述股利仅在董事会依法宣告并决定分配股利的情况下方可支付，公司未宣告分配股利的，任何股东均不得主张强制支付",
    owner: "王五",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-10",
    status: "approved",
  },
  {
    id: "mid-t5",
    direction: "资本安全与下行保护",
    category: "股权安排",
    name: "非累计股利。若公司在任何会计年度未宣告或未支付股利，则该年度未支付的股利不予累计，亦不计入后续年度的股利计算基础。失败不被复利惩罚，成功不被事后剥夺",
    owner: "李四",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-10",
    status: "rejected",
  },
  {
    id: "mid-t6",
    direction: "资本安全与下行保护",
    category: "防稀释条款",
    name: "股份数量不变。防稀释调整仅涉及 A 轮优先股的转换价格及转换比例，并不导致 A 轮优先股股份数量的增加",
    owner: "张伟",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-10",
    status: "rejected",
  },
  {
    id: "mid-t7",
    direction: "资本安全与下行保护",
    category: "防稀释条款",
    name: "在后续融资中，A 轮优先股股东依法享有优先购买权；其行使或不行使优先购买权，不影响其依本条款享有的防稀释调整权利",
    owner: "王五",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-10",
    status: "pending",
  },
]

/* ------------------------------------------------------------------ */
/*  投后期新增条款 (划款通过后合并)                                      */
/* ------------------------------------------------------------------ */
export const postInvestmentTerms: TermTableItem[] = [
  {
    id: "post-t1",
    direction: "控制权与治理稳定",
    category: "董事会安排",
    name: "董事会由五名董事组成，投资人董事一名，创始人有权提名三名董事（其中应包括创始人本人），由股东会选举任命，全体股东共同提名一名独立董事，独立董事应未曾任职于公司、创始人或投资人的关联方，并具备人工智能/企业运营领域的资深经验，其任命需经股东会审议并通过，且必须获得投资人董事的同意票。",
    owner: "张伟",
    createdAt: "2026-03-20",
    updatedAt: "2026-03-20",
    status: "pending",
  },
  {
    id: "post-t2",
    direction: "控制权与治理稳定",
    category: "董事会安排",
    name: "会议每季度召开一次。经任何一名董事书面提议，可召开临时董事会会议投资人董事有权以电话会议或视频会议方式参会，该等参会方式应被视为亲自出席",
    owner: "李四",
    createdAt: "2026-03-20",
    updatedAt: "2026-03-20",
    status: "pending",
  },
  {
    id: "post-t3",
    direction: "控制权与治理稳定",
    category: "竞业禁止协议",
    name: "防范核心人员对公司业务造成伤害。我方要求营业禁止期为9个月",
    owner: "王五",
    createdAt: "2026-03-20",
    updatedAt: "2026-03-20",
    status: "pending",
  },
  {
    id: "post-t4",
    direction: "控制权与治理稳定",
    category: "竞业禁止协议",
    name: "创始人会争取更优厚的竞业补偿；要求投资方内部公司关键信息。对方公司要求我放机构内部设立防火墙，屏蔽公司关键信息",
    owner: "张伟",
    createdAt: "2026-03-20",
    updatedAt: "2026-03-20",
    status: "pending",
  },
  {
    id: "post-t5",
    direction: "激励与长期一致性",
    category: "股权兑现条款",
    name: "创始人股份，自交割日起按照四年的期限进行兑现。其中25%的创始人股份于交割日满一周年时一次性兑现，其余75%的股份在随后36 个月内按月等比例兑现。",
    owner: "李四",
    createdAt: "2026-03-20",
    updatedAt: "2026-03-20",
    status: "pending",
  },
  {
    id: "post-t6",
    direction: "激励与长期一致性",
    category: "股权兑现条款",
    name: "尽管存在前述兑现安排，创始人仍有权就其持有的全部创始人股份（无论是否已兑现）行使表决权。",
    owner: "王五",
    createdAt: "2026-03-20",
    updatedAt: "2026-03-20",
    status: "pending",
  },
  {
    id: "post-t7",
    direction: "激励与长期一致性",
    category: "期权池",
    name: "公司在本轮融资交割完成前，预留不超过公司全面摊薄股本的15%作为员工期权池。",
    owner: "张伟",
    createdAt: "2026-03-20",
    updatedAt: "2026-03-20",
    status: "pending",
  },
  {
    id: "post-t8",
    direction: "激励与长期一致性",
    category: "期权池",
    name: "期权池仅限用于向公司员工、管理层及经董事会批准的关键技术或业务人员授予股权激励，不得用于向任何投资人或其关联方授予。",
    owner: "李四",
    createdAt: "2026-03-20",
    updatedAt: "2026-03-20",
    status: "pending",
  },
]

/* ------------------------------------------------------------------ */
/*  Template helper                                                    */
/* ------------------------------------------------------------------ */
/** 返回指定策略模板的条款列表，全部状态重置为"待审批" */
export function getTemplateTermsForStrategy(strategyId: string): TermTableItem[] {
  if (strategyId === "1") {
    return aiInfrastructureTerms.map((t) => ({ ...t, status: "pending" as const }))
  }
  return []
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
const statusConfig = {
  approved: { label: "通过", color: "bg-[#DCFCE7] text-[#166534]" },
  pending: { label: "待审批", color: "bg-[#FEF3C7] text-[#92400E]" },
  rejected: { label: "否决", color: "bg-[#FEE2E2] text-[#991B1B]" },
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface TermSheetProps {
  isNewProject?: boolean
  isInDuration?: boolean
  isExited?: boolean
  termLockPeriod?: string
  project?: { strategyId?: string; strategyName?: string; id?: string; name?: string }
  projectMaterials?: StrategyMaterial[]
  inheritedTerms?: TermTableItem[]
  extraDetails?: Record<string, TermDetail>
  linkedHypothesesMap?: Record<string, LinkedHypothesis[]>
  availableHypotheses?: { id: string; title: string; status: string }[]
  onAddHypothesisLink?: (termId: string, hypothesisId: string) => void
  onRemoveHypothesisLink?: (linkId: string) => void
  onNavigateToHypothesis?: (hypothesisId: string) => void
  onCreateNegotiationDecision?: (termId: string, termName: string, data: NegotiationDecisionFormData) => void
  onCreateImplementationStatus?: (termId: string, termName: string, data: ImplementationStatusFormData) => void
}

export function TermSheet({ isNewProject = false, isInDuration = false, isExited = false, termLockPeriod, project, projectMaterials, inheritedTerms, extraDetails, linkedHypothesesMap, availableHypotheses, onAddHypothesisLink, onRemoveHypothesisLink, onNavigateToHypothesis, onCreateNegotiationDecision, onCreateImplementationStatus }: TermSheetProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showTemplateBanner, setShowTemplateBanner] = useState(true)

  // Negotiation decision dialog state
  const [showNegotiationDialog, setShowNegotiationDialog] = useState(false)
  const [ndForm, setNdForm] = useState({ content: "", conclusion: "通过" as "通过" | "否决" })
  const [ndReviewerSearch, setNdReviewerSearch] = useState("")
  const [ndSelectedReviewers, setNdSelectedReviewers] = useState<{ name: string; role: string }[]>([])

  // Implementation status dialog state
  const [showAddIS, setShowAddIS] = useState(false)
  const [isContent, setIsContent] = useState("")
  const [isConclusion, setIsConclusion] = useState<"符合预期" | "待定" | "不符合预期">("符合预期")
  const [isMaterials, setIsMaterials] = useState<string[]>([])
  const [isResponsibles, setIsResponsibles] = useState<string[]>([])
  const [isSearch, setIsSearch] = useState("")

  // Hypothesis selector dialog state
  const [showHypoSelector, setShowHypoSelector] = useState(false)
  const [hypoSearch, setHypoSearch] = useState("")

  const ALL_REVIEWERS = [
    { name: "张伟", role: "投资经理" },
    { name: "李四", role: "高级分析师" },
    { name: "王五", role: "合伙人" },
    { name: "王总", role: "投委会主席" },
    { name: "陈总", role: "风控总监" },
    { name: "赵六", role: "法务顾问" },
  ]

  const filteredNdReviewers = ALL_REVIEWERS.filter((r) =>
    r.name.includes(ndReviewerSearch) || r.role.includes(ndReviewerSearch)
  )

  const filteredISPeople = ALL_REVIEWERS.filter((r) =>
    r.name.includes(isSearch) || r.role.includes(isSearch)
  )

  function handleOpenNegotiationDialog() {
    setNdForm({ content: "", conclusion: "通过" })
    setNdReviewerSearch("")
    setNdSelectedReviewers([])
    setShowNegotiationDialog(true)
  }

  function handleToggleNdReviewer(person: { name: string; role: string }) {
    setNdSelectedReviewers((prev) =>
      prev.some((r) => r.name === person.name)
        ? prev.filter((r) => r.name !== person.name)
        : [...prev, person]
    )
  }

  function handleSubmitNegotiationDecision() {
    if (!selectedId || !ndForm.content.trim() || ndSelectedReviewers.length === 0) return
    const item = sourceData.find((t) => t.id === selectedId)
    onCreateNegotiationDecision?.(selectedId, item?.name || "", {
      content: ndForm.content,
      conclusion: ndForm.conclusion,
      reviewers: ndSelectedReviewers,
    })
    setShowNegotiationDialog(false)
  }

  function handleOpenISDialog() {
    setIsContent("")
    setIsConclusion("符合预期")
    setIsMaterials([])
    setIsResponsibles([])
    setIsSearch("")
    setShowAddIS(true)
  }

  function toggleISMaterial(id: string) {
    setIsMaterials((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id])
  }

  function toggleISResponsible(name: string) {
    setIsResponsibles((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])
  }

  function handleSubmitIS() {
    if (!selectedId || !isContent.trim() || isResponsibles.length === 0) return
    const item = sourceData.find((t) => t.id === selectedId)
    onCreateImplementationStatus?.(selectedId, item?.name || "", {
      content: isContent,
      conclusion: isConclusion,
      materials: isMaterials,
      responsibles: isResponsibles.map((name) => {
        const person = ALL_REVIEWERS.find((p) => p.name === name)
        return { name, role: person?.role || "" }
      }),
    })
    setShowAddIS(false)
  }

  // Priority: inherited (from approved project) > template > existing mock data
  const sourceData = inheritedTerms
    ? inheritedTerms
    : isNewProject && project?.strategyId === "1"
      ? aiInfrastructureTerms
      : termTableData

  // Filter data
  const filteredData = sourceData
    .filter((item) => {
      const query = searchQuery.toLowerCase()
      return (
        item.direction.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.owner.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      const order: Record<string, number> = { approved: 0, rejected: 1, pending: 2 }
      return (order[a.status] ?? 2) - (order[b.status] ?? 2)
    })

  // Get detail for selected item — extraDetails takes priority over built-in mock data
  const selectedDetail = selectedId
    ? (extraDetails?.[selectedId] ?? termDetails[selectedId] ?? null)
    : null

  // Handle view detail
  function handleViewDetail(id: string) {
    setSelectedId(id)
    setShowDetail(true)
  }

  // Handle back to list
  function handleBackToList() {
    setShowDetail(false)
    setSelectedId(null)
  }

  // Handle delete
  function handleDelete(id: string) {
    console.log("[v0] Delete term:", id)
  }

  // For new projects without a strategy template, show empty state
  if (isNewProject && !project?.strategyId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <FileText className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无条款清单</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            这是一个新创建的项目，还没有添加任何条款。点击下方按钮开始创建您的第一个投资条款。
          </p>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" />
            创建第一个条款
          </button>
        </div>
      </div>
    )
  }

  // Reusable section component for term detail
  const renderSection = (
    title: string,
    icon: React.ReactNode,
    borderColor: string,
    titleColor: string,
    section: SectionContent
  ) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={cn("h-1 w-1 rounded-full", borderColor.replace("border-", "bg-"))} />
        <h2 className={cn("text-base font-semibold", titleColor)}>{title}</h2>
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className={cn("border-l-4 p-5", borderColor)}>
          {/* Edit/Delete actions */}
          {isNewProject && !isInDuration && (
            <div className="flex justify-end gap-1 mb-3">
              <button className="p-1 rounded text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors" title="编辑">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button className="p-1 rounded text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-colors" title="删除">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {/* Content */}
          <div className="p-3 bg-[#F9FAFB] rounded-lg mb-4">
            <p className="text-sm text-[#374151] leading-relaxed">{section.content}</p>
          </div>

          {/* Files */}
          {section.files && section.files.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-[#6B7280] mb-2">附件</p>
              {section.files.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-[#F9FAFB] rounded-lg">
                  <FileText className="h-4 w-4 text-[#2563EB]" />
                  <span className="text-sm text-[#2563EB]">{file.name}</span>
                  <span className="text-xs text-[#9CA3AF]">{file.size} · {file.date}</span>
                </div>
              ))}
            </div>
          )}

          {/* Linked Hypotheses */}
          {section.linkedHypotheses && section.linkedHypotheses.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-[#6B7280] mb-2">关联假设</p>
              <div className="flex flex-wrap gap-2">
                {section.linkedHypotheses.map((h) => (
                  <span key={h.id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#EFF6FF] rounded text-xs text-[#2563EB]">
                    <Link2 className="h-3 w-3" />
                    {h.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Creator & Reviewers */}
          <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
            <div className="flex items-center gap-1">
              <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                <span className="text-[8px] text-white">{section.creator.name.slice(0, 1)}</span>
              </div>
              <span>创建: {section.creator.name}</span>
            </div>
            <span>审批:</span>
            {section.reviewers.map((r, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                  <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                </div>
                <span>{r.name}</span>
              </div>
            ))}
            <span>{section.createdAt}</span>
          </div>

          {/* Comments */}
          <div>
            <p className="text-xs text-[#6B7280] mb-2">评论</p>
            {section.comments.map((c, idx) => (
              <div key={idx} className="flex items-start gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-[#E5E7EB] flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-[#6B7280]">{c.author.slice(0, 1)}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#111827]">{c.author}</span>
                    <span className="text-xs text-[#9CA3AF]">{c.time}</span>
                  </div>
                  <p className="text-sm text-[#374151]">{c.content}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                placeholder="添加评论..."
                className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
              <button className="p-2 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Detail view
  if (showDetail && selectedDetail) {
    return (
      <div className="h-full overflow-auto bg-[#F9FAFB]">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-2 text-sm text-[#6B7280]">
            <button onClick={handleBackToList} className="hover:text-[#2563EB] transition-colors">
              项目库
            </button>
            <ChevronRight className="h-4 w-4" />
            <button onClick={handleBackToList} className="hover:text-[#2563EB] transition-colors">
              MiniMax
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-[#111827]">条款清单</span>
          </div>

          {/* Detail header */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-xl font-bold text-[#111827]">{selectedDetail.title}</h1>
              {(() => {
                const listItem = sourceData.find((t) => t.id === selectedId)
                const st = listItem?.status || selectedDetail.status
                return (
                  <Badge className={cn("text-xs", statusConfig[st].color)}>
                    {statusConfig[st].label}
                  </Badge>
                )
              })()}
            </div>
            <p className="text-sm text-[#6B7280] mb-3">
              ID: {selectedDetail.termId} | 创建时间: {selectedDetail.createdAt} | 更新时间: {selectedDetail.updatedAt}
            </p>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-[#2563EB] flex items-center justify-center">
                <span className="text-[10px] text-white font-medium">
                  {selectedDetail.creator.name.slice(0, 1)}
                </span>
              </div>
              <span className="text-sm text-[#6B7280]">创建者: {selectedDetail.creator.name}</span>
            </div>
          </div>

          {/* 我方诉求 */}
          {renderSection(
            "我方诉求",
            <Target className="h-4 w-4" />,
            "border-[#2563EB]",
            "text-[#2563EB]",
            selectedDetail.ourDemand
          )}

          {/* 我方依据 */}
          {renderSection(
            "我方依据",
            <FileCheck className="h-4 w-4" />,
            "border-[#22C55E]",
            "text-[#22C55E]",
            selectedDetail.ourBasis
          )}

          {/* 双方冲突 */}
          {renderSection(
            "双方冲突",
            <AlertTriangle className="h-4 w-4" />,
            "border-[#EF4444]",
            "text-[#EF4444]",
            selectedDetail.bilateralConflict
          )}

          {/* 我方底线 */}
          {renderSection(
            "我方底线",
            <Shield className="h-4 w-4" />,
            "border-[#F59E0B]",
            "text-[#F59E0B]",
            selectedDetail.ourBottomLine
          )}

          {/* 妥协空间 */}
          {renderSection(
            "妥协空间",
            <Handshake className="h-4 w-4" />,
            "border-[#8B5CF6]",
            "text-[#8B5CF6]",
            selectedDetail.compromiseSpace
          )}

          {/* Negotiation Decision Dialog */}
          {showNegotiationDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#E5E7EB]">
                  <h3 className="text-base font-semibold text-[#111827]">新增谈判结果</h3>
                  <button onClick={() => setShowNegotiationDialog(false)} className="p-1 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {/* 谈判内容 */}
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">
                      谈判内容 <span className="text-[#EF4444]">*</span>
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                      rows={4}
                      placeholder="请输入谈判内容..."
                      value={ndForm.content}
                      onChange={(e) => setNdForm((f) => ({ ...f, content: e.target.value }))}
                    />
                  </div>
                  {/* 谈判结果 */}
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">
                      谈判结果 <span className="text-[#EF4444]">*</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNdForm((f) => ({ ...f, conclusion: "通过" }))}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                          ndForm.conclusion === "通过"
                            ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
                            : "bg-white text-[#374151] border-[#E5E7EB] hover:bg-[#F9FAFB]"
                        )}
                      >
                        通过
                      </button>
                      <button
                        onClick={() => setNdForm((f) => ({ ...f, conclusion: "否决" }))}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                          ndForm.conclusion === "否决"
                            ? "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"
                            : "bg-white text-[#374151] border-[#E5E7EB] hover:bg-[#F9FAFB]"
                        )}
                      >
                        否决
                      </button>
                    </div>
                  </div>
                  {/* 谈判人 */}
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">
                      谈判人 <span className="text-[#EF4444]">*</span>
                    </label>
                    <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#E5E7EB]">
                        <Search className="h-4 w-4 text-[#9CA3AF] shrink-0" />
                        <input
                          type="text"
                          placeholder="搜索谈判人..."
                          className="flex-1 text-sm outline-none text-[#111827] placeholder:text-[#9CA3AF]"
                          value={ndReviewerSearch}
                          onChange={(e) => setNdReviewerSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-36 overflow-y-auto">
                        {filteredNdReviewers.map((person) => {
                          const selected = ndSelectedReviewers.some((r) => r.name === person.name)
                          return (
                            <button
                              key={person.name}
                              onClick={() => handleToggleNdReviewer(person)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#F9FAFB]"
                            >
                              <div className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                selected ? "bg-[#2563EB] border-[#2563EB]" : "border-[#D1D5DB] bg-white"
                              )}>
                                {selected && <CheckCircle className="h-3 w-3 text-white" />}
                              </div>
                              <div className="h-7 w-7 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0">
                                <span className="text-[10px] text-white font-medium">{person.name.slice(0, 1)}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#111827]">{person.name}</p>
                                <p className="text-xs text-[#6B7280]">{person.role}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB]">
                  <button
                    onClick={() => setShowNegotiationDialog(false)}
                    className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmitNegotiationDecision}
                    disabled={!ndForm.content.trim() || ndSelectedReviewers.length === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    新增
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 谈判结果 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-[#0EA5E9]" />
                <h2 className="text-base font-semibold text-[#0EA5E9]">谈判结果</h2>
              </div>
              {isNewProject && !isInDuration && (
                <button
                  onClick={handleOpenNegotiationDialog}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0EA5E9] border border-[#0EA5E9] rounded-lg hover:bg-[#F0F9FF] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增谈判结果
                </button>
              )}
            </div>
            {selectedDetail.negotiationResult.content ? (
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="border-l-4 border-[#0EA5E9] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-[#111827]">最终结论</h3>
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "text-xs",
                        selectedDetail.negotiationResult.status === "agreed"
                          ? "bg-[#DCFCE7] text-[#166534]"
                          : selectedDetail.negotiationResult.status === "partial"
                            ? "bg-[#FEF3C7] text-[#92400E]"
                            : "bg-[#FEE2E2] text-[#991B1B]"
                      )}>
                        {selectedDetail.negotiationResult.conclusion}
                      </Badge>
                      {isNewProject && !isInDuration && (
                        <div className="flex items-center gap-1">
                          <button className="p-1 rounded text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors" title="编辑">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button className="p-1 rounded text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-colors" title="删除">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-[#F9FAFB] rounded-lg mb-4">
                    <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.negotiationResult.content}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                        <span className="text-[8px] text-white">{selectedDetail.negotiationResult.creator.name.slice(0, 1)}</span>
                      </div>
                      <span>创建: {selectedDetail.negotiationResult.creator.name}</span>
                    </div>
                    <span>审批:</span>
                    {selectedDetail.negotiationResult.reviewers.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                          <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                        </div>
                        <span>{r.name}</span>
                      </div>
                    ))}
                    <span>{selectedDetail.negotiationResult.createdAt}</span>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280] mb-2">评论</p>
                    {selectedDetail.negotiationResult.comments.map((c, idx) => (
                      <div key={idx} className="flex items-start gap-2 mb-2">
                        <div className="h-6 w-6 rounded-full bg-[#E5E7EB] flex items-center justify-center shrink-0">
                          <span className="text-[10px] text-[#6B7280]">{c.author.slice(0, 1)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[#111827]">{c.author}</span>
                            <span className="text-xs text-[#9CA3AF]">{c.time}</span>
                          </div>
                          <p className="text-sm text-[#374151]">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-3">
                      <input type="text" placeholder="添加评论..." className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                      <button className="p-2 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="border-l-4 border-[#0EA5E9] p-5">
                  <div className="py-6 text-center text-sm text-[#9CA3AF] mb-4">暂无谈判结果</div>
                  <div>
                    <p className="text-xs text-[#6B7280] mb-2">评论</p>
                    <div className="flex items-center gap-2 mt-3">
                      <input type="text" placeholder="添加评论..." className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9]" />
                      <button className="p-2 text-[#0EA5E9] hover:bg-[#F0F9FF] rounded-lg transition-colors">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 落实情况 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-[#10B981]" />
                <h2 className="text-base font-semibold text-[#10B981]">落实情况</h2>
              </div>
              {isNewProject && isInDuration && (
                <button
                  onClick={handleOpenISDialog}
                  className="flex items-center gap-1 rounded-lg bg-[#ECFDF5] px-3 py-1.5 text-xs font-medium text-[#10B981] hover:bg-[#D1FAE5] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增落实情况
                </button>
              )}
            </div>
            {selectedDetail.implementationStatus.content ? (
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="border-l-4 border-[#10B981] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-[#111827]">落实结论</span>
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "text-xs",
                        selectedDetail.implementationStatus.conclusion === "符合预期"
                          ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
                          : selectedDetail.implementationStatus.conclusion === "待定"
                            ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                            : selectedDetail.implementationStatus.conclusion === "不符合预期"
                              ? "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"
                              : selectedDetail.implementationStatus.status === "implemented"
                                ? "bg-[#DCFCE7] text-[#166534]"
                                : selectedDetail.implementationStatus.status === "in-progress"
                                  ? "bg-[#FEF3C7] text-[#92400E]"
                                  : "bg-[#F3F4F6] text-[#6B7280]"
                      )}>
                        {selectedDetail.implementationStatus.conclusion ||
                          (selectedDetail.implementationStatus.status === "implemented" ? "已落实"
                            : selectedDetail.implementationStatus.status === "in-progress" ? "执行中"
                              : "未开始")}
                      </Badge>
                      {isNewProject && !isInDuration && (
                        <div className="flex items-center gap-1">
                          <button className="p-1 rounded text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors" title="编辑">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button className="p-1 rounded text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-colors" title="删除">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-[#F9FAFB] rounded-lg mb-4">
                    <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.implementationStatus.content}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                        <span className="text-[8px] text-white">{selectedDetail.implementationStatus.creator.name.slice(0, 1)}</span>
                      </div>
                      <span>创建: {selectedDetail.implementationStatus.creator.name}</span>
                    </div>
                    <span>审批:</span>
                    {selectedDetail.implementationStatus.reviewers.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                          <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                        </div>
                        <span>{r.name}</span>
                      </div>
                    ))}
                    <span>{selectedDetail.implementationStatus.createdAt}</span>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280] mb-2">评论</p>
                    <div className="flex items-center gap-2 mt-3">
                      <input type="text" placeholder="添加评论..." className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 focus:border-[#10B981]" />
                      <button className="p-2 text-[#10B981] hover:bg-[#ECFDF5] rounded-lg transition-colors">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="border-l-4 border-[#10B981] p-5">
                  <div className="py-6 text-center text-sm text-[#9CA3AF] mb-4">暂无落实情况</div>
                  <div>
                    <p className="text-xs text-[#6B7280] mb-2">评论</p>
                    <div className="flex items-center gap-2 mt-3">
                      <input type="text" placeholder="添加评论..." className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 focus:border-[#10B981]" />
                      <button className="p-2 text-[#10B981] hover:bg-[#ECFDF5] rounded-lg transition-colors">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 关联假设 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-[#8B5CF6]" />
                <h2 className="text-base font-semibold text-[#8B5CF6]">关联假设</h2>
              </div>
              <button
                onClick={() => { setHypoSearch(""); setShowHypoSelector(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#8B5CF6] border border-[#8B5CF6] rounded-lg hover:bg-[#F5F3FF] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                添加关联
              </button>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="border-l-4 border-[#8B5CF6] p-5">
                {(() => {
                  const linked = linkedHypothesesMap?.[selectedId ?? ""] || []
                  return linked.length === 0 ? (
                    <p className="text-sm text-[#9CA3AF]">暂无关联假设</p>
                  ) : (
                    <div className="space-y-3">
                      {linked.map((h) => (
                        <div key={h.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                          <button
                            onClick={() => onNavigateToHypothesis?.(h.id)}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                          >
                            <Link2 className="h-4 w-4 text-[#8B5CF6]" />
                            <div className="text-left">
                              <span className="text-sm text-[#111827] hover:text-[#2563EB]">{h.title}</span>
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <Badge className={cn(
                              "text-xs",
                              h.status === "verified"
                                ? "bg-[#DCFCE7] text-[#166534]"
                                : h.status === "risky"
                                  ? "bg-[#FEE2E2] text-[#991B1B]"
                                  : "bg-[#FEF3C7] text-[#92400E]"
                            )}>
                              {h.status === "verified" ? "已验证" : h.status === "risky" ? "有风险" : "待验证"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* Hypothesis Selector Dialog */}
          {showHypoSelector && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#E5E7EB] shrink-0">
                  <h3 className="text-base font-semibold text-[#111827]">选择假设</h3>
                  <button onClick={() => setShowHypoSelector(false)} className="p-1 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-6 py-4 flex-1 overflow-y-auto">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder="搜索假设..."
                      value={hypoSearch}
                      onChange={(e) => setHypoSearch(e.target.value)}
                      className="w-full pl-9 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                    />
                  </div>
                  {(() => {
                    const linked = linkedHypothesesMap?.[selectedId ?? ""] || []
                    const linkedIds = new Set(linked.map((l) => l.id))
                    const filtered = (availableHypotheses || []).filter((h) =>
                      !linkedIds.has(h.id) &&
                      (hypoSearch === "" || h.title.toLowerCase().includes(hypoSearch.toLowerCase()))
                    )
                    return filtered.length === 0 ? (
                      <p className="text-sm text-[#9CA3AF] text-center py-6">没有可关联的假设</p>
                    ) : (
                      <div className="space-y-2">
                        {filtered.map((h) => (
                          <button
                            key={h.id}
                            onClick={() => {
                              if (selectedId) onAddHypothesisLink?.(selectedId, h.id)
                              setShowHypoSelector(false)
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F5F3FF] hover:border-[#8B5CF6] transition-colors text-left"
                          >
                            <Link2 className="h-4 w-4 text-[#8B5CF6] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#111827] truncate">{h.title}</p>
                            </div>
                            <Badge className={cn(
                              "text-xs shrink-0",
                              h.status === "verified"
                                ? "bg-[#DCFCE7] text-[#166534]"
                                : h.status === "risky"
                                  ? "bg-[#FEE2E2] text-[#991B1B]"
                                  : "bg-[#FEF3C7] text-[#92400E]"
                            )}>
                              {h.status === "verified" ? "已验证" : h.status === "risky" ? "有风险" : "待验证"}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Implementation Status Dialog */}
          {showAddIS && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#E5E7EB] shrink-0">
                  <h3 className="text-base font-semibold text-[#111827]">新增落实情况</h3>
                  <button onClick={() => setShowAddIS(false)} className="p-1 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                  {/* 落实内容 */}
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">
                      落实内容 <span className="text-[#EF4444]">*</span>
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] resize-none focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 focus:border-[#10B981]"
                      rows={4}
                      placeholder="请输入落实内容..."
                      value={isContent}
                      onChange={(e) => setIsContent(e.target.value)}
                    />
                  </div>
                  {/* 落实结果 */}
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">
                      落实结果 <span className="text-[#EF4444]">*</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsConclusion("符合预期")}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                          isConclusion === "符合预期"
                            ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
                            : "bg-white text-[#374151] border-[#E5E7EB] hover:bg-[#F9FAFB]"
                        )}
                      >
                        符合预期
                      </button>
                      <button
                        onClick={() => setIsConclusion("待定")}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                          isConclusion === "待定"
                            ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                            : "bg-white text-[#374151] border-[#E5E7EB] hover:bg-[#F9FAFB]"
                        )}
                      >
                        待定
                      </button>
                      <button
                        onClick={() => setIsConclusion("不符合预期")}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                          isConclusion === "不符合预期"
                            ? "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"
                            : "bg-white text-[#374151] border-[#E5E7EB] hover:bg-[#F9FAFB]"
                        )}
                      >
                        不符合预期
                      </button>
                    </div>
                  </div>
                  {/* 相关材料 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-[#374151]">相关材料</label>
                      <button className="flex items-center gap-1 text-xs text-[#6B7280] border border-[#E5E7EB] rounded-md px-2 py-1 hover:bg-[#F9FAFB] transition-colors">
                        <Upload className="h-3 w-3" />
                        上传材料
                      </button>
                    </div>
                    {projectMaterials && projectMaterials.length > 0 ? (
                      <div className="border border-[#E5E7EB] rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                        {projectMaterials.map((mat) => {
                          const selected = isMaterials.includes(mat.id)
                          return (
                            <button
                              key={mat.id}
                              onClick={() => toggleISMaterial(mat.id)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#F9FAFB]"
                            >
                              <div className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                selected ? "bg-[#10B981] border-[#10B981]" : "border-[#D1D5DB] bg-white"
                              )}>
                                {selected && <CheckCircle className="h-3 w-3 text-white" />}
                              </div>
                              <FileText className="h-4 w-4 text-[#9CA3AF] shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#111827] truncate">{mat.name}</p>
                                <p className="text-xs text-[#9CA3AF]">{mat.format} · {mat.size || "—"}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="border border-[#E5E7EB] rounded-lg px-4 py-3 text-sm text-[#9CA3AF] text-center">暂无项目材料</div>
                    )}
                  </div>
                  {/* 负责人 */}
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">
                      负责人 <span className="text-[#EF4444]">*</span>
                    </label>
                    <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#E5E7EB]">
                        <Search className="h-4 w-4 text-[#9CA3AF] shrink-0" />
                        <input
                          type="text"
                          placeholder="搜索负责人..."
                          className="flex-1 text-sm outline-none text-[#111827] placeholder:text-[#9CA3AF]"
                          value={isSearch}
                          onChange={(e) => setIsSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-36 overflow-y-auto">
                        {filteredISPeople.map((person) => {
                          const selected = isResponsibles.includes(person.name)
                          return (
                            <button
                              key={person.name}
                              onClick={() => toggleISResponsible(person.name)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#F9FAFB]"
                            >
                              <div className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                selected ? "bg-[#10B981] border-[#10B981]" : "border-[#D1D5DB] bg-white"
                              )}>
                                {selected && <CheckCircle className="h-3 w-3 text-white" />}
                              </div>
                              <div className="h-7 w-7 rounded-full bg-[#10B981] flex items-center justify-center shrink-0">
                                <span className="text-[10px] text-white font-medium">{person.name.slice(0, 1)}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#111827]">{person.name}</p>
                                <p className="text-xs text-[#6B7280]">{person.role}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] shrink-0">
                  <button
                    onClick={() => setShowAddIS(false)}
                    className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmitIS}
                    disabled={!isContent.trim() || isResponsibles.length === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    新增
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Table view
  return (
    <div className="h-full overflow-auto bg-[#F9FAFB]">
      <div className="px-6 py-6">
        {/* Strategy template banner for new projects */}
        {isNewProject && project?.strategyName && showTemplateBanner && (
          <div className="mb-4 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] p-4 relative">
            <button
              onClick={() => setShowTemplateBanner(false)}
              className="absolute top-3 right-3 p-1 rounded-md text-[#3B82F6] hover:bg-[#DBEAFE] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 pr-8">
              <div className="h-8 w-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1E40AF]">
                  基于「{project.strategyName}」策略模板
                </p>
                <p className="text-xs text-[#3B82F6]">
                  以下条款清单继承自所选策略模板，您可以根据项目实际情况进行调整
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">条款清单</h1>
            {isNewProject && isInDuration ? (
              <p className="mt-1 text-sm text-[#EF4444] font-medium">
                {isExited ? "项目已退出，所有信息不可更改。" : `项目已进入${termLockPeriod ?? "存续期"}，已有条款不可更改。`}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[#6B7280]">管理和跟踪项目投资条款</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input
                type="text"
                placeholder="搜索条款..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9 bg-white border-[#E5E7EB]"
              />
            </div>
            {!(isNewProject && isInDuration) && (
              <Button className="bg-[#2563EB] hover:bg-[#1D4ED8]">
                <Plus className="h-4 w-4 mr-2" />
                新建条款
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1E3A5F] text-white">
                <th className="px-4 py-3 text-left text-sm font-medium">条款方向</th>
                <th className="px-4 py-3 text-left text-sm font-medium">条款类别</th>
                <th className="px-4 py-3 text-left text-sm font-medium">条款名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">负责人</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">更改时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, index) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors",
                    index % 2 === 1 && "bg-[#F9FAFB]"
                  )}
                >
                  <td className="px-4 py-3 text-sm text-[#374151]">{item.direction}</td>
                  <td className="px-4 py-3 text-sm text-[#374151]">{item.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#111827]">{item.name}</span>
                      <Badge className={cn("text-[10px]", statusConfig[item.status].color)}>
                        {statusConfig[item.status].label}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#E5E7EB] flex items-center justify-center">
                        <User className="h-3 w-3 text-[#6B7280]" />
                      </div>
                      <span className="text-sm text-[#374151]">{item.owner}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{item.createdAt}</td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{item.updatedAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(item.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF] rounded transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        详情
                      </button>
                      {!(isNewProject && isInDuration) && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#EF4444] hover:bg-[#FEF2F2] rounded transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredData.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-[#D1D5DB]" />
              <p className="mt-4 text-sm text-[#6B7280]">暂无匹配的条款</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
