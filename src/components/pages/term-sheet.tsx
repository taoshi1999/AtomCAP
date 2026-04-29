"use client"

import { useState } from "react"
import { api } from "@/src/trpc/react";
import FileUpload from "@/src/components/FileUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";

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
  project?: { strategyId?: string; strategyName?: string }
  projectMaterials?: StrategyMaterial[]
  inheritedTerms?: TermTableItem[]
  extraDetails?: Record<string, TermDetail>
  onCreateNegotiationDecision?: (termId: string, termName: string, data: NegotiationDecisionFormData) => void
  onCreateImplementationStatus?: (termId: string, termName: string, data: ImplementationStatusFormData) => void
}


const SECTIONS = [
  { key: "ourRequest", label: "我方诉求", color: "text-[#2563EB]", border: "border-[#2563EB]" },
  { key: "ourBasis", label: "我方依据", color: "text-[#22C55E]", border: "border-[#22C55E]" },
  { key: "conflict", label: "双方冲突", color: "text-[#EF4444]", border: "border-[#EF4444]" },
  { key: "ourBottomLine", label: "我方底线", color: "text-[#F59E0B]", border: "border-[#F59E0B]" },
  { key: "compromiseSpace", label: "妥协空间", color: "text-[#8B5CF6]", border: "border-[#8B5CF6]" },
  { key: "negotiationResult", label: "谈判结果", color: "text-[#14B8A6]", border: "border-[#14B8A6]" },
  { key: "implementation", label: "落实情况", color: "text-[#06B6D4]", border: "border-[#06B6D4]" },
]

export function TermSheet({ project, ...props }: any) {
  const projectId = project?.id || "1";
  const [searchQuery, setSearchQuery] = useState("")

  const [isCreating, setIsCreating] = useState(false)
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null)
  
  // State for the unified creation form
  const [newTermForm, setNewTermForm] = useState({
    title: "",
    ourRequest: "",
    ourBasis: "",
    conflict: "",
    ourBottomLine: "",
    compromiseSpace: "",
    negotiationResult: "",
    implementation: "",
  })
  
  // Keep track of unsaved attachments in state map
  const [pendingAttachments, setPendingAttachments] = useState<Record<string, {name: string, url: string}[]>>({})

  const utils = api.useUtils()

  const { data: terms = [], isLoading } = api.term.getByProjectId.useQuery({ projectId })
  
  const createMutation = api.term.create.useMutation({
    onSuccess: (data) => {
      utils.term.getByProjectId.invalidate()
      setIsCreating(false)
      setNewTermForm({
        title: "",
        ourRequest: "",
        ourBasis: "",
        conflict: "",
        ourBottomLine: "",
        compromiseSpace: "",
        negotiationResult: "",
        implementation: "",
      })
      setPendingAttachments({})
    }
  })

  // State to track text changes in detail mode
  const [editSectionKey, setEditSectionKey] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")

  const updateMutation = api.term.updateSection.useMutation({
    onSuccess: () => {
      utils.term.getByProjectId.invalidate()
      setEditSectionKey(null)
      setEditContent("")
    }
  })

  const attachmentMutation = api.term.addAttachment.useMutation({
    onSuccess: () => {
      utils.term.getByProjectId.invalidate()
    }
  })

  const selectedTerm = terms.find((t) => t.id === selectedTermId)

  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedTermId(null)
    setNewTermForm({
      title: "",
      ourRequest: "",
      ourBasis: "",
      conflict: "",
      ourBottomLine: "",
      compromiseSpace: "",
      negotiationResult: "",
      implementation: "",
    })
    setPendingAttachments({})
  }

  const handleCreate = () => {
    if (!newTermForm.title) return

    const attachmentsToSave: {name: string, url: string, section: string}[] = []
    
    // Flatten pendingAttachments into the API expected parameter
    for (const [sectionKey, files] of Object.entries(pendingAttachments)) {
       for (const file of files) {
         attachmentsToSave.push({
           name: file.name,
           url: file.url,
           section: sectionKey,
         })
       }
    }

    createMutation.mutate({ 
      projectId, 
      title: newTermForm.title,
      ourRequest: newTermForm.ourRequest,
      ourBasis: newTermForm.ourBasis,
      conflict: newTermForm.conflict,
      ourBottomLine: newTermForm.ourBottomLine,
      compromiseSpace: newTermForm.compromiseSpace,
      negotiationResult: newTermForm.negotiationResult,
      implementation: newTermForm.implementation,
      attachments: attachmentsToSave,
    })
  }

  const handlePendingUpload = (sectionKey: string, url: string, name: string) => {
    setPendingAttachments(prev => {
      const existing = prev[sectionKey] || []
      return { ...prev, [sectionKey]: [...existing, { name, url }] }
    })
  }

  const handleSaveSection = (termId: string, sectionKey: string) => {
    updateMutation.mutate({ id: termId, section: sectionKey as any, content: editContent })
  }

  const filteredData = terms.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))

  if (isLoading) return <div className="p-8">加载中...</div>

  return (
    <div className="h-full overflow-auto bg-[#F9FAFB]">
      <div className="px-6 py-6 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">条款清单</h1>
            <p className="mt-1 text-sm text-[#6B7280]">管理和跟踪项目投资条款</p>
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
            <Button onClick={handleStartCreate} className="bg-[#2563EB] hover:bg-[#1D4ED8]">
              <Plus className="h-4 w-4 mr-2" />
              新建条款
            </Button>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1E3A5F] text-white">
                <th className="px-4 py-3 text-left text-sm font-medium">条款名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#111827] font-medium">{item.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">
                     {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                       <button
                        onClick={() => setSelectedTermId(item.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF] rounded transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        详情
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredData.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-[#D1D5DB]" />
              <p className="mt-4 text-sm text-[#6B7280]">暂无条款</p>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal (Dialog) */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建项目条款</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-6">
            {/* Title Input */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm">
              <label className="block text-sm font-bold text-[#374151] mb-2">条款标题 <span className="text-[#EF4444]">*</span></label>
              <Input 
                value={newTermForm.title}
                onChange={(e) => setNewTermForm({ ...newTermForm, title: e.target.value })}
                placeholder=""
                className="w-full"
              />
            </div>

            {/* 7 Sections Input */}
            {SECTIONS.map((sec) => {
              const currentPendingFiles = pendingAttachments[sec.key] || []
              return (
               <div key={sec.key} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
                 <div className={cn("border-l-4 p-4", sec.border)}>
                   <h3 className={cn("text-base font-semibold mb-3", sec.color)}>{sec.label}</h3>
                   <textarea 
                      className="w-full rounded-lg border border-[#E5E7EB] p-3 text-sm min-h-[100px] outline-none focus:border-[#2563EB]"
                      value={(newTermForm as any)[sec.key]}
                      onChange={(e) => setNewTermForm({ ...newTermForm, [sec.key]: e.target.value })}
                      placeholder={`输入${sec.label}内容...`}
                    />
                    
                    <div className="mt-4 border-t border-[#E5E7EB] pt-3">
                      <p className="text-xs font-medium text-[#6B7280] mb-2">附件</p>
                      
                      {currentPendingFiles.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {currentPendingFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-[#F3F4F6] rounded-lg">
                              <FileText className="h-4 w-4 text-[#2563EB]" />
                              <span className="text-sm text-[#2563EB]">{file.name}</span>
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px]">待保存</Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      <FileUpload
                        onUploadSuccess={(url: string, name: string) => {
                          handlePendingUpload(sec.key, url, name)
                        }}
                      />
                    </div>
                 </div>
               </div>
              )
            })}
            
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
               <Button variant="outline" onClick={() => setIsCreating(false)}>取消</Button>
               <Button onClick={handleCreate} disabled={!newTermForm.title || createMutation.isPending} className="bg-[#2563EB]">
                 {createMutation.isPending ? "保存中..." : "确认保存"}
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal (Dialog) */}
      <Dialog open={!!selectedTermId} onOpenChange={(open) => !open && setSelectedTermId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#F9FAFB]">
          <DialogHeader>
             <DialogTitle className="text-xl">{selectedTerm?.title}</DialogTitle>
          </DialogHeader>

          {selectedTerm && (
             <div className="mt-4 space-y-6">
                {SECTIONS.map((sec) => {
                  const content = (selectedTerm as any)[sec.key] || ""
                  const isEditing = editSectionKey === sec.key
                  const sectionAttachments = selectedTerm.attachments.filter(a => a.section === sec.key)

                  return (
                    <div key={sec.key} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
                      <div className={cn("border-l-4 p-5", sec.border)}>
                        <div className="flex items-center justify-between mb-4">
                           <h3 className={cn("text-base font-semibold", sec.color)}>{sec.label}</h3>
                           {!isEditing && (
                             <Button variant="ghost" size="sm" onClick={() => {
                               setEditSectionKey(sec.key)
                               setEditContent(content)
                             }}>编辑内容</Button>
                           )}
                        </div>
                        
                        {isEditing ? (
                          <div className="mb-4">
                            <textarea 
                              className="w-full rounded-lg border border-[#E5E7EB] p-3 text-sm min-h-[100px] outline-none focus:border-[#2563EB] mb-2"
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              placeholder={`输入${sec.label}...`}
                            />
                            <div className="flex justify-end gap-2">
                               <Button variant="ghost" size="sm" onClick={() => setEditSectionKey(null)}>取消</Button>
                               <Button size="sm" onClick={() => handleSaveSection(selectedTerm.id, sec.key)} disabled={updateMutation.isPending}>
                                 {updateMutation.isPending ? "保存中..." : "保存"}
                               </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-[#F9FAFB] rounded-lg p-4 text-sm text-[#374151] whitespace-pre-wrap min-h-[40px] mb-4">
                             {content || "暂无内容"}
                          </div>
                        )}

                        <div className="border-t border-[#E5E7EB] pt-4 mt-4">
                          <p className="text-xs font-medium text-[#6B7280] mb-3">附件列表</p>
                          
                          {sectionAttachments.length > 0 ? (
                            <div className="space-y-2 mb-3">
                              {sectionAttachments.map(att => (
                                <div key={att.id} className="flex items-center gap-2 p-2 bg-[#F3F4F6] rounded-lg">
                                  <FileText className="h-4 w-4 text-[#2563EB]" />
                                  <a href={att.url} target="_blank" rel="noreferrer" className="text-sm text-[#2563EB] hover:underline">
                                    {att.name}
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[#9CA3AF] mb-3">未上传附件</p>
                          )}

                          <FileUpload
                            onUploadSuccess={(url: string, name: string) => {
                              attachmentMutation.mutate({
                                termId: selectedTerm.id,
                                section: sec.key,
                                name,
                                url
                              })
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
             </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
