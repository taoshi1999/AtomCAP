"use client"

import { useState, useMemo } from "react"
import {
  Search,
  FileText,
  ChevronRight,
  ChevronDown,
  ListChecks,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Plus,
  Link2,
  FileCheck,
  ArrowLeft,
  Eye,
  Trash2,
  Pencil,
  User,
  X,
  Upload,
} from "lucide-react"
import { Badge } from "@/src/components/ui/badge"
import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { ScrollArea } from "@/src/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog"
import { cn } from "@/src/lib/utils"
import type { CommitteeDecisionFormData, VerificationFormData } from "./workflow"
import type { StrategyMaterial } from "./strategies-grid"

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */
export interface HypothesisTableItem {
  id: string
  direction: string  // 假设方向 (一级类目)
  category: string   // 假设类别 (二级类目)
  name: string       // 假设名称
  owner: string      // 负责人
  createdAt: string  // 创建时间
  updatedAt: string  // 更改时间
  status: "verified" | "pending" | "risky"
}

// 个人信息
interface PersonInfo {
  name: string
  role: string
  avatar?: string
}

// 价值点
export interface ValuePoint {
  id: string
  title: string
  evidence: {
    description: string
    files: { name: string; size: string; date: string }[]
  }
  analysis: {
    content: string
    creator: PersonInfo
    reviewers: PersonInfo[]
    createdAt: string
  }
  comments: { author: string; content: string; time: string }[]
}

// 风险点
export interface RiskPoint {
  id: string
  title: string
  evidence: {
    description: string
    files: { name: string; size: string; date: string }[]
  }
  analysis: {
    content: string
    creator: PersonInfo
    reviewers: PersonInfo[]
    createdAt: string
  }
  comments: { author: string; content: string; time: string }[]
}

// 投委决议
interface CommitteeDecision {
  conclusion: string
  status: "approved" | "rejected" | "pending"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

// 验证情况
interface Verification {
  conclusion: string
  status: "confirmed" | "invalidated" | "pending"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

// 关联条款
interface LinkedTerm {
  id: string
  title: string
  termId: string
  status: "approved" | "pending" | "rejected"
}

// 假设详情
export interface HypothesisDetail {
  id: string
  title: string
  qaId: string
  createdAt: string
  updatedAt: string
  status: "verified" | "pending" | "risky"
  creator: PersonInfo
  valuePoints: ValuePoint[]
  riskPoints: RiskPoint[]
  committeeDecision: CommitteeDecision
  verification: Verification
  linkedTerms: LinkedTerm[]
}

/* ------------------------------------------------------------------ */
/*  项目人员数据                                                        */
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
/*  假设清单数据                                            */
/* ------------------------------------------------------------------ */
const hypothesisTableData: HypothesisTableItem[] = [
  {
    id: "tech-bg",
    direction: "团队与组织能力",
    category: "创始人闫俊杰",
    name: "创始人闫俊杰具有扎实的人工智能学术背景",
    owner: "张伟",
    createdAt: "2026-01-15",
    updatedAt: "2026-02-20",
    status: "verified",
  },
  {
    id: "biz-exp",
    direction: "团队与组织能力",
    category: "创始人闫俊杰",
    name: "创始人具备丰富的AI产品商业化经验",
    owner: "李四",
    createdAt: "2026-01-15",
    updatedAt: "2026-02-18",
    status: "pending",
  },
  {
    id: "leadership",
    direction: "团队与组织能力",
    category: "创始人闫俊杰",
    name: "创始人展现出强大的团队凝聚力和战略规划能力",
    owner: "张伟",
    createdAt: "2026-01-16",
    updatedAt: "2026-02-19",
    status: "pending",
  },
  {
    id: "tech-team",
    direction: "团队与组织能力",
    category: "核心团队",
    name: "技术团队在大模型训练和推理优化方面具备业界领先水平",
    owner: "王五",
    createdAt: "2026-01-17",
    updatedAt: "2026-02-21",
    status: "pending",
  },
  {
    id: "market-team",
    direction: "团队与组织能力",
    category: "核心团队",
    name: "市场团队拥有深厚的企业客户资源和渠道网络",
    owner: "李四",
    createdAt: "2026-01-18",
    updatedAt: "2026-02-22",
    status: "pending",
  },
  {
    id: "tam",
    direction: "市场机会",
    category: "市场规模",
    name: "中国大模型市场总规模在2025年将达到500亿元",
    owner: "张伟",
    createdAt: "2026-01-20",
    updatedAt: "2026-02-25",
    status: "pending",
  },
  {
    id: "sam",
    direction: "市场机会",
    category: "市场规模",
    name: "企业级AI应用市场可服务规模达到200亿元",
    owner: "李四",
    createdAt: "2026-01-21",
    updatedAt: "2026-02-26",
    status: "risky",
  },
  {
    id: "som",
    direction: "市场机会",
    category: "市场规模",
    name: "MiniMax可触达市场规模约50亿元",
    owner: "王五",
    createdAt: "2026-01-22",
    updatedAt: "2026-02-27",
    status: "pending",
  },
]

/* ------------------------------------------------------------------ */
/*  Mock data - detail                                                 */
/* ------------------------------------------------------------------ */
const hypothesisDetails: Record<string, HypothesisDetail> = {
  "ai-h1": {
    id: "ai-h1",
    title: "国产AI芯片在推理场景下可替代英伟达方案",
    qaId: "QA-2026-001",
    createdAt: "2026-01-10",
    updatedAt: "2026-02-15",
    status: "pending",
    creator: PEOPLE.zhangwei,
    valuePoints: [],
    riskPoints: [],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.zhangwei,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "ai-h2": {
    id: "ai-h2",
    title: "云端AI芯片市场将在3年内达到500亿美元规模",
    qaId: "QA-2026-002",
    createdAt: "2026-01-12",
    updatedAt: "2026-02-18",
    status: "pending",
    creator: PEOPLE.lisi,
    valuePoints: [],
    riskPoints: [],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.lisi,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "ai-h3": {
    id: "ai-h3",
    title: "开源大模型训练框架将成为主流技术路线",
    qaId: "QA-2026-003",
    createdAt: "2026-01-15",
    updatedAt: "2026-02-20",
    status: "pending",
    creator: PEOPLE.wangwu,
    valuePoints: [],
    riskPoints: [],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangwu,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "ai-h4": {
    id: "ai-h4",
    title: "分布式训练效率提升是大模型竞争关键",
    qaId: "QA-2026-004",
    createdAt: "2026-01-18",
    updatedAt: "2026-02-22",
    status: "pending",
    creator: PEOPLE.zhangwei,
    valuePoints: [],
    riskPoints: [],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.zhangwei,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "ai-h5": {
    id: "ai-h5",
    title: "AI编译器将成为新的基础软件投资赛道",
    qaId: "QA-2026-005",
    createdAt: "2026-01-20",
    updatedAt: "2026-02-25",
    status: "pending",
    creator: PEOPLE.lisi,
    valuePoints: [],
    riskPoints: [],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.lisi,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "ai-h6": {
    id: "ai-h6",
    title: "MLOps平台市场需求将快速增长",
    qaId: "QA-2026-006",
    createdAt: "2026-01-22",
    updatedAt: "2026-02-28",
    status: "pending",
    creator: PEOPLE.wangwu,
    valuePoints: [],
    riskPoints: [],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangwu,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "ai-h7": {
    id: "ai-h7",
    title: "创始人具备丰富的AI产品商业化经验。",
    qaId: "QA-2026-007",
    createdAt: "2026-01-22",
    updatedAt: "2026-02-28",
    status: "pending",
    creator: PEOPLE.wangwu,
    valuePoints: [],
    riskPoints: [],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangwu,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "tech-bg": {
    id: "tech-bg",
    title: "创始人闫俊杰具有扎实的人工智能学术背景",
    qaId: "QA-2024-001",
    createdAt: "2026-01-15",
    updatedAt: "2026-02-20",
    status: "verified",
    creator: PEOPLE.zhangwei,
    valuePoints: [
      {
        id: "vp1",
        title: "价值点1",
        evidence: {
          description: "创始人拥有博士学位，在AI领域发表过15篇高质量学术论文",
          files: [
            { name: "闫俊杰_CV.pdf", size: "2.4 MB", date: "2024-01-18" },
            { name: "Google Scholar 引用数据.xlsx", size: "1.8 MB", date: "2024-01-19" },
          ],
        },
        analysis: {
          content: "创始人拥有博士学位，为该领域高学历人才。在人工智能领域发表过15篇高质量学术论文，其中5篇发表在顶级期刊上。曾获得国家自然科学基金青年项目资助，具备扎实的理论基础和研究能力。",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi, PEOPLE.wangwu, PEOPLE.chenzong],
          createdAt: "2024-01-18",
        },
        comments: [
          { author: "王五", content: "建议补充创始人在工业界的实际项目经验资料", time: "2024-01-19 14:30" },
        ],
      },
      {
        id: "vp2",
        title: "价值点2",
        evidence: {
          description: "在Google Scholar上的H指数为8，总引用次数超过500次，证明其研究成果具有较高的学术影响力",
          files: [
            { name: "学术影响力报告.pdf", size: "3.1 MB", date: "2024-01-19" },
          ],
        },
        analysis: {
          content: "H指数达到8，在同龄学者中处于较高水平。其研究成果被多家知名企业引用并应用于实际产品中，证明其学术研究具有很高的实用价值。",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi, PEOPLE.zhaoliu],
          createdAt: "2024-01-19",
        },
        comments: [],
      },
    ],
    riskPoints: [
      {
        id: "rp1",
        title: "风险点1",
        evidence: {
          description: "学术背景较强但商业转化经验相对有限，需关注从学术到产业的过渡能力",
          files: [
            { name: "行业对标分析.pdf", size: "1.5 MB", date: "2024-01-20" },
          ],
        },
        analysis: {
          content: "创始人在商业化方面的经验主要集中在技术转让和专利授权领域，尚未有过完整的产品商业化经历。建议关注其团队中是否有强有力的商业运营搭档补足这一短板。",
          creator: PEOPLE.lisi,
          reviewers: [PEOPLE.zhangwei, PEOPLE.wangwu],
          createdAt: "2024-01-20",
        },
        comments: [
          { author: "张伟", content: "同意这一风险评估，COO张鹏的加入在一定程度上弥补了这一缺陷", time: "2024-01-20 16:00" },
        ],
      },
    ],
    committeeDecision: {
      conclusion: "成立",
      status: "approved",
      content: "经投委会审议，创始人的学术背景得到充分验证，其在AI领域的研究深度和影响力均达到行业领先水平。虽然商业化经验存在一定风险，但团队整体配置可以弥补。建议持续跟踪其商业化进展。",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhangwei, PEOPLE.lisi],
      createdAt: "2026-01-22",
      comments: [
        { author: "张伟", content: "同意投委结论，建议在条款中加入创始人竞业禁止条款", time: "2024-01-22 15:00" },
      ],
    },
    verification: {
      conclusion: "符合预期",
      status: "confirmed",
      content: "投资后6个月跟踪显示，创始人的学术背景为公司招募顶级人才提供了重要背书，已成功吸引多名顶级学者加入。技术团队在大模型训练优化方面取得突破性进展，与创始人的学术积累密切相关。",
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.lisi, PEOPLE.wangwu],
      createdAt: "2026-03-15",
      comments: [],
    },
    linkedTerms: [
      { id: "lt1", title: "投资方有权委派一名董事进入公司董事会", termId: "TM-2024-001", status: "approved" },
      { id: "lt2", title: "投资方有权委派一名观察员列席董事会会议", termId: "TM-2024-002", status: "approved" },
    ],
  },
  "biz-exp": {
    id: "biz-exp",
    title: "创始人具备丰富的AI产品商业化经验",
    qaId: "QA-2024-002",
    createdAt: "2026-01-15",
    updatedAt: "2026-02-18",
    status: "pending",
    creator: PEOPLE.lisi,
    valuePoints: [
      {
        id: "biz-vp1",
        title: "曾主导多款AI产品从0到1的商业化落地",
        evidence: {
          description: "创始人在加入MiniMax前曾在头部AI公司担任产品负责人，主导完成3款to B AI产品的商业化，累计ARR超过5000万元",
          files: [
            { name: "商业化案例汇总.pdf", size: "3.2 MB", date: "2024-02-10" },
          ],
        },
        analysis: {
          content: "创始人的商业化经验覆盖了企业客户获取、定价策略制定和销售体系搭建，对当前MiniMax的to B战略具有直接参考价值。",
          creator: PEOPLE.lisi,
          reviewers: [PEOPLE.zhangwei, PEOPLE.wangwu],
          createdAt: "2024-02-10",
        },
        comments: [],
      },
    ],
    riskPoints: [
      {
        id: "biz-rp1",
        title: "过往经验集中在特定垂直赛道，横向迁移能力待验证",
        evidence: {
          description: "商业化经验主要集中在医疗AI和金融AI领域，而MiniMax定位为通用大模型，业务场景差异较大",
          files: [],
        },
        analysis: {
          content: "垂直赛道的商业化方法论与通用大模型的开放生态策略存在较大差异，需关注创始人能否有效迁移其经验。",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi],
          createdAt: "2024-02-12",
        },
        comments: [],
      },
    ],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.lisi,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "leadership": {
    id: "leadership",
    title: "创始人展现出强大的团队凝聚力和战略规划能力",
    qaId: "QA-2024-003",
    createdAt: "2026-01-16",
    updatedAt: "2026-02-19",
    status: "pending",
    creator: PEOPLE.zhangwei,
    valuePoints: [
      {
        id: "lead-vp1",
        title: "核心团队稳定性高，关键人员任职均超过2年",
        evidence: {
          description: "MiniMax核心团队10人中，有8人跟随创始人超过2年，团队离职率显著低于行业平均水平",
          files: [
            { name: "核心团队背景调查.pdf", size: "2.1 MB", date: "2024-02-15" },
          ],
        },
        analysis: {
          content: "核心团队的高稳定性是创始人领导力的直接体现，也为公司的长期战略执行提供了重要保障。",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi, PEOPLE.wangwu],
          createdAt: "2024-02-15",
        },
        comments: [],
      },
    ],
    riskPoints: [],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.zhangwei,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "tech-team": {
    id: "tech-team",
    title: "技术团队在大模型训练和推理优化方面具备业界领先水平",
    qaId: "QA-2024-004",
    createdAt: "2026-01-17",
    updatedAt: "2026-02-21",
    status: "pending",
    creator: PEOPLE.wangwu,
    valuePoints: [
      {
        id: "tt-vp1",
        title: "团队成员来自顶尖高校及头部AI企业",
        evidence: {
          description: "技术团队中有6名PhD，分别来自清华、北大、CMU等顶尖高校，并有多名前百度、字节核心技术人员",
          files: [
            { name: "技术团队学历背景.xlsx", size: "1.3 MB", date: "2024-02-20" },
          ],
        },
        analysis: {
          content: "顶尖的学历背景与工业界经验的结合，使MiniMax的技术团队在大模型领域具备了稀缺的复合型能力。",
          creator: PEOPLE.wangwu,
          reviewers: [PEOPLE.zhangwei, PEOPLE.lisi],
          createdAt: "2024-02-20",
        },
        comments: [],
      },
    ],
    riskPoints: [
      {
        id: "tt-rp1",
        title: "核心技术人员存在被竞争对手挖角的风险",
        evidence: {
          description: "大模型赛道竞争激烈，多家头部公司正在积极扩张技术团队，MiniMax核心技术人员薪酬面临竞争压力",
          files: [],
        },
        analysis: {
          content: "建议在投资条款中加入关键人员锁定条款，并关注员工持股计划的激励效果。",
          creator: PEOPLE.lisi,
          reviewers: [PEOPLE.zhangwei],
          createdAt: "2024-02-22",
        },
        comments: [],
      },
    ],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangwu,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "market-team": {
    id: "market-team",
    title: "市场团队拥有深厚的企业客户资源和渠道网络",
    qaId: "QA-2024-005",
    createdAt: "2026-01-18",
    updatedAt: "2026-02-22",
    status: "pending",
    creator: PEOPLE.lisi,
    valuePoints: [],
    riskPoints: [
      {
        id: "mt-rp1",
        title: "企业客户资源主要依赖少数关键销售人员",
        evidence: {
          description: "初步调研显示，市场团队约70%的客户资源集中在2-3名核心销售人员手中，存在单点依赖风险",
          files: [],
        },
        analysis: {
          content: "需关注关键销售人员离职对客户资源的影响，建议在尽调中进一步核实客户关系的沉淀情况。",
          creator: PEOPLE.lisi,
          reviewers: [PEOPLE.zhangwei],
          createdAt: "2024-02-25",
        },
        comments: [],
      },
    ],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.lisi,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "tam": {
    id: "tam",
    title: "中国大中型市场总规模在2025年将达到500亿元",
    qaId: "QA-2024-006",
    createdAt: "2026-01-20",
    updatedAt: "2026-02-25",
    status: "pending",
    creator: PEOPLE.zhangwei,
    valuePoints: [
      {
        id: "tam-vp1",
        title: "多家权威机构预测数据相互印证",
        evidence: {
          description: "IDC、艾瑞咨询、Gartner等机构对2025年中国大模型市场规模的预测区间均在400-600亿元之间",
          files: [
            { name: "市场规模研究报告汇总.pdf", size: "5.8 MB", date: "2024-03-01" },
          ],
        },
        analysis: {
          content: "多家权威机构的数据相互印证，市场规模预测具有较高可信度，500亿元是相对保守的中位估计。",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi, PEOPLE.wangwu],
          createdAt: "2024-03-01",
        },
        comments: [],
      },
    ],
    riskPoints: [],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.zhangwei,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "sam": {
    id: "sam",
    title: "企业级AI应用市场可服务规模达到200亿元",
    qaId: "QA-2024-007",
    createdAt: "2026-01-21",
    updatedAt: "2026-02-26",
    status: "risky",
    creator: PEOPLE.lisi,
    valuePoints: [],
    riskPoints: [
      {
        id: "sam-rp1",
        title: "企业级市场渗透率被高估，实际可服务规模存在较大不确定性",
        evidence: {
          description: "对20家目标企业客户的访谈显示，其中仅35%表示有明确的AI采购预算，实际可服务规模可能在80-120亿元区间",
          files: [
            { name: "企业客户访谈报告.pdf", size: "4.2 MB", date: "2024-03-05" },
          ],
        },
        analysis: {
          content: "企业级AI市场的渗透速度受限于客户数字化成熟度、数据安全顾虑和采购决策周期，200亿元的预测偏于乐观。",
          creator: PEOPLE.lisi,
          reviewers: [PEOPLE.zhangwei, PEOPLE.wangwu],
          createdAt: "2024-03-05",
        },
        comments: [
          { author: "张伟", content: "同意这一风险判断，建议重新评估市场空间假设", time: "2024-03-06 10:00" },
        ],
      },
    ],
    committeeDecision: {
      conclusion: "假设不成立",
      status: "rejected",
      content: "经投委会审议，企业级AI市场可服务规模200亿元的假设被认定为不成立。基于对标企业数据和客户访谈，实际SAM更可能在100亿元左右。建议修订商业计划中的市场空间假设，并重新评估营收预测。",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhangwei],
      createdAt: "2026-02-15",
      comments: [
        { author: "张伟", content: "投委会结论与我们的实地调研结果一致", time: "2026-02-15 17:00" },
      ],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.lisi,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "som": {
    id: "som",
    title: "MiniMax可触达市场规模约50亿元",
    qaId: "QA-2024-008",
    createdAt: "2026-01-22",
    updatedAt: "2026-02-27",
    status: "pending",
    creator: PEOPLE.wangwu,
    valuePoints: [
      {
        id: "som-vp1",
        title: "现有客户管道已覆盖预期SOM的30%",
        evidence: {
          description: "MiniMax目前已有意向客户合同金额累计约15亿元，占预期50亿SOM的30%，验证了可触达性",
          files: [
            { name: "销售管道数据.xlsx", size: "2.0 MB", date: "2024-03-10" },
          ],
        },
        analysis: {
          content: "现有销售管道数据为SOM预测提供了一定的实证支撑，但最终转化率和时间周期仍需持续跟踪。",
          creator: PEOPLE.wangwu,
          reviewers: [PEOPLE.zhangwei],
          createdAt: "2024-03-10",
        },
        comments: [],
      },
    ],
    riskPoints: [],
    committeeDecision: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangzong,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "",
      status: "pending",
      content: "",
      creator: PEOPLE.wangwu,
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
const statusConfig = {
  verified: { label: "成立", color: "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]" },
  pending: { label: "待验证", color: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]" },
  risky: { label: "不成立", color: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]" },
}

/* ------------------------------------------------------------------ */
/*  AI基础设施策略模板假设数据                                          */
/* ------------------------------------------------------------------ */
const aiInfrastructureHypotheses: HypothesisTableItem[] = [
  {
    id: "ai-h1",
    direction: "技术攻关",
    category: "算力与芯片",
    name: "国产AI芯片在推理场景下可替代英伟达方案",
    owner: "张伟",
    createdAt: "2026-01-10",
    updatedAt: "2026-02-15",
    status: "pending",
  },
  {
    id: "ai-h2",
    direction: "技术攻关",
    category: "算力与芯片",
    name: "云端AI芯片市场将在3年内达到500亿美元规模",
    owner: "李四",
    createdAt: "2026-01-12",
    updatedAt: "2026-02-18",
    status: "pending",
  },
  {
    id: "ai-h3",
    direction: "技术攻关",
    category: "模型训练框架",
    name: "开源大模型训练框架将成为主流技术路线",
    owner: "王五",
    createdAt: "2026-01-15",
    updatedAt: "2026-02-20",
    status: "pending",
  },
  {
    id: "ai-h4",
    direction: "技术攻关",
    category: "模型训练框架",
    name: "分布式训练效率提升是大模型竞争关键",
    owner: "张伟",
    createdAt: "2026-01-18",
    updatedAt: "2026-02-22",
    status: "pending",
  },
  {
    id: "ai-h5",
    direction: "技术攻关",
    category: "基础软件生态",
    name: "AI编译器将成为新的基础软件投资赛道",
    owner: "李四",
    createdAt: "2026-01-20",
    updatedAt: "2026-02-25",
    status: "pending",
  },
  {
    id: "ai-h6",
    direction: "技术攻关",
    category: "基础软件生态",
    name: "MLOps平台市场需求将快速增长",
    owner: "王五",
    createdAt: "2026-01-22",
    updatedAt: "2026-02-28",
    status: "pending",
  },
  {
    id: "ai-h7",
    direction: "团队能力",
    category: "创始人",
    name: "创始人具备丰富的AI产品商业化经验",
    owner: "王五",
    createdAt: "2026-01-22",
    updatedAt: "2026-02-28",
    status: "pending",
  },
]

/** 投中期新增假设 — 仅在投决通过后合并到项目假设清单 */
export const midInvestmentHypotheses: HypothesisTableItem[] = [
  {
    id: "ai-h10",
    direction: "团队能力",
    category: "核心团队",
    name: "研发团队规模雄厚，人才配置全面，技术栈完善",
    owner: "王五",
    createdAt: "2026-02-02",
    updatedAt: "2026-03-06",
    status: "pending",
  },
  {
    id: "ai-h11",
    direction: "团队能力",
    category: "核心团队",
    name: "商业化团队经验丰富，有较强产品商业化能力",
    owner: "张伟",
    createdAt: "2026-02-02",
    updatedAt: "2026-03-06",
    status: "pending",
  },
  {
    id: "ai-h12",
    direction: "团队能力",
    category: "组织效率",
    name: "团队组织架构精简，变动调整灵活",
    owner: "李四",
    createdAt: "2026-02-03",
    updatedAt: "2026-03-07",
    status: "pending",
  },
  {
    id: "ai-h13",
    direction: "团队能力",
    category: "组织效率",
    name: "团队管理效率高，管理成本可控",
    owner: "王五",
    createdAt: "2026-02-03",
    updatedAt: "2026-03-07",
    status: "pending",
  },
  {
    id: "ai-h14",
    direction: "团队能力",
    category: "人才吸引力",
    name: "薪酬福利好，奖励体系完善，绑定员工发展与企业发展",
    owner: "张伟",
    createdAt: "2026-02-04",
    updatedAt: "2026-03-08",
    status: "pending",
  },
  {
    id: "ai-h15",
    direction: "团队能力",
    category: "人才吸引力",
    name: "团队提供广阔发展平台与协作、包容的组织文化，为员工发展提供上升空间",
    owner: "李四",
    createdAt: "2026-02-04",
    updatedAt: "2026-03-08",
    status: "pending",
  },
  {
    id: "ai-h16",
    direction: "财务",
    category: "资金使用效率",
    name: "营运能力强，固定资产周转率强",
    owner: "王五",
    createdAt: "2026-02-05",
    updatedAt: "2026-03-09",
    status: "pending",
  },
  {
    id: "ai-h17",
    direction: "财务",
    category: "资金使用效率",
    name: "盈利质量好，亏损幅度逐步收窄",
    owner: "张伟",
    createdAt: "2026-02-05",
    updatedAt: "2026-03-09",
    status: "pending",
  },
  {
    id: "ai-h18",
    direction: "财务",
    category: "资金使用效率",
    name: "投资效率高，兼具稳定性与收益性",
    owner: "李四",
    createdAt: "2026-02-06",
    updatedAt: "2026-03-10",
    status: "pending",
  },
  {
    id: "ai-h19",
    direction: "财务",
    category: "资产结构",
    name: "资产质量良好，受限资金主要以现金形式存在，规模可控",
    owner: "王五",
    createdAt: "2026-02-06",
    updatedAt: "2026-03-10",
    status: "pending",
  },
  {
    id: "ai-h20",
    direction: "财务",
    category: "资产结构",
    name: "资产流动性强，大部分资产可快速变现",
    owner: "张伟",
    createdAt: "2026-02-07",
    updatedAt: "2026-03-11",
    status: "pending",
  },
  {
    id: "ai-h21",
    direction: "财务",
    category: "资产结构",
    name: "债务规模可控，资金流稳定",
    owner: "李四",
    createdAt: "2026-02-07",
    updatedAt: "2026-03-11",
    status: "pending",
  },
]

/* ------------------------------------------------------------------ */
/*  Template helper                                                    */
/* ------------------------------------------------------------------ */
/** 返回指定策略模板的假设列表，全部状态重置为"待验证" */
export function getTemplateHypothesesForStrategy(strategyId: string): HypothesisTableItem[] {
  if (strategyId === "1") {
    return aiInfrastructureHypotheses.map((h) => ({ ...h, status: "pending" as const }))
  }
  return []
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface HypothesisChecklistProps {
  isNewProject?: boolean
  isInDuration?: boolean
  isExited?: boolean
  isMidInvestment?: boolean
  isPostInvestment?: boolean
  project?: { strategyId?: string; strategyName?: string; id?: string; name?: string }
  projectMaterials?: StrategyMaterial[]
  inheritedHypotheses?: HypothesisTableItem[]
  extraDetails?: Record<string, HypothesisDetail>
  onAddValuePoint?: (hypothesisId: string, vp: ValuePoint) => void
  onAddRiskPoint?: (hypothesisId: string, rp: RiskPoint) => void
  onCreateCommitteeDecision?: (hypothesisId: string, hypothesisName: string, data: CommitteeDecisionFormData) => void
  onCreateVerification?: (hypothesisId: string, hypothesisName: string, data: VerificationFormData) => void
  onCreateHypothesis?: (data: { title: string; direction: string; category: string; owner: string }) => void
  onDeleteHypothesis?: (id: string) => void
}

export function HypothesisChecklist({ isNewProject = false, isInDuration = false, isExited = false, isMidInvestment = false, isPostInvestment = false, project, projectMaterials, inheritedHypotheses, extraDetails, onAddValuePoint, onAddRiskPoint, onCreateCommitteeDecision, onCreateVerification, onCreateHypothesis, onDeleteHypothesis }: HypothesisChecklistProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showTemplateBanner, setShowTemplateBanner] = useState(true)

  // Comment input state: key = `{hypothesisId}-{pointId}`
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  // Extra comments added by user: key = `{hypothesisId}-{pointId}`, value = array of comment objects
  const [extraComments, setExtraComments] = useState<Record<string, { author: string; content: string; time: string }[]>>({})
  // Locally added value/risk points: keyed by hypothesisId for immediate display
  const [localValuePoints, setLocalValuePoints] = useState<Record<string, ValuePoint[]>>({})
  const [localRiskPoints, setLocalRiskPoints] = useState<Record<string, RiskPoint[]>>({})

  // Add value point dialog state
  const [showAddVP, setShowAddVP] = useState(false)
  const [vpForm, setVpForm] = useState({ title: "", evidenceDescription: "", analysisContent: "" })

  // Add risk point dialog state
  const [showAddRP, setShowAddRP] = useState(false)
  const [rpForm, setRpForm] = useState({ title: "", evidenceDescription: "", analysisContent: "" })

  // Add committee decision dialog state
  const [showAddCD, setShowAddCD] = useState(false)
  const [cdContent, setCdContent] = useState("")
  const [cdConclusion, setCdConclusion] = useState<"假设成立" | "假设不成立">("假设成立")
  const [cdReviewers, setCdReviewers] = useState<string[]>([])
  const [cdSearchQuery, setCdSearchQuery] = useState("")

  // Add verification dialog state
  const [showAddVF, setShowAddVF] = useState(false)
  const [vfContent, setVfContent] = useState("")
  const [vfConclusion, setVfConclusion] = useState<"符合预期" | "不符合预期">("符合预期")
  const [vfMaterials, setVfMaterials] = useState<string[]>([])
  const [vfResponsibles, setVfResponsibles] = useState<string[]>([])
  const [vfSearch, setVfSearch] = useState("")

  // Add hypothesis dialog state
  const [showAddHypothesis, setShowAddHypothesis] = useState(false)
  const [newHypoForm, setNewHypoForm] = useState({ title: "", direction: "", category: "", owner: "张伟" })

  // Priority: inherited (from approved project) > template > existing mock data
  const sourceData = inheritedHypotheses
    ? inheritedHypotheses
    : isNewProject && project?.strategyId === "1"
      ? aiInfrastructureHypotheses
      : hypothesisTableData

  // Filter data
  const filteredData = sourceData
    .filter((item) => {
      const matchSearch = searchQuery === "" || (
        item.direction.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.owner.toLowerCase().includes(searchQuery.toLowerCase())
      )
      const matchStatus = filterStatus === "ALL" || item.status === filterStatus
      return matchSearch && matchStatus
    })
    .sort((a, b) => {
      const order: Record<string, number> = { verified: 0, risky: 1, pending: 2 }
      return (order[a.status] ?? 2) - (order[b.status] ?? 2)
    })

  // Get detail for selected item
  const selectedDetail = useMemo(() => {
    if (!selectedId) return null
    
    // 1. Try extraDetails/mocks (for old data)
    let detail = extraDetails?.[selectedId] ?? hypothesisDetails[selectedId]
    
    // 2. If not found, try to reconstruct from sourceData (for new DB data)
    if (!detail) {
      const basicInfo = sourceData.find(h => h.id === selectedId)
      if (basicInfo) {
        detail = {
          id: basicInfo.id,
          qaId: `HA-${basicInfo.id.slice(-4).toUpperCase()}`, // Mock a QA ID
          title: basicInfo.name,
          createdAt: basicInfo.createdAt,
          updatedAt: basicInfo.updatedAt,
          creator: { name: basicInfo.owner, role: "投资经理" },
          status: basicInfo.status,
          valuePoints: [],
          riskPoints: [],
          committeeDecision: {
            content: "",
            reviewers: [],
            comments: []
          },
          verification: {
            content: "",
            materials: [],
            responsibles: [],
            comments: []
          },
          linkedTerms: []
        } as any
      }
    }
    
    return detail || null
  }, [selectedId, extraDetails, sourceData])

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
    if (window.confirm("确定要删除这条假设吗？")) {
      onDeleteHypothesis?.(id)
    }
  }

  function handleSubmitHypothesis() {
    if (!newHypoForm.title.trim()) return
    onCreateHypothesis?.(newHypoForm)
    setNewHypoForm({ title: "", direction: "", category: "", owner: "张伟" })
    setShowAddHypothesis(false)
  }

  // Comment helpers
  function getCommentKey(pointId: string) {
    return `${selectedId}-${pointId}`
  }

  function handleCommentInput(pointId: string, value: string) {
    setCommentInputs((prev) => ({ ...prev, [getCommentKey(pointId)]: value }))
  }

  function handleSendComment(pointId: string) {
    const key = getCommentKey(pointId)
    const text = (commentInputs[key] || "").trim()
    if (!text) return
    const now = new Date()
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    setExtraComments((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), { author: "张伟", content: text, time: timeStr }],
    }))
    setCommentInputs((prev) => ({ ...prev, [key]: "" }))
  }

  function handleSubmitValuePoint() {
    if (!selectedId || !vpForm.title.trim()) return
    const today = new Date().toISOString().split("T")[0]
    const newVP: ValuePoint = {
      id: `vp-${Date.now()}`,
      title: vpForm.title,
      evidence: { description: vpForm.evidenceDescription, files: [] },
      analysis: {
        content: vpForm.analysisContent,
        creator: { name: "张伟", role: "投资经理" },
        reviewers: [],
        createdAt: today,
      },
      comments: [],
    }
    // Update local state for immediate display
    setLocalValuePoints((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), newVP],
    }))
    onAddValuePoint?.(selectedId, newVP)
    setVpForm({ title: "", evidenceDescription: "", analysisContent: "" })
    setShowAddVP(false)
  }

  function handleSubmitRiskPoint() {
    if (!selectedId || !rpForm.title.trim()) return
    const today = new Date().toISOString().split("T")[0]
    const newRP: RiskPoint = {
      id: `rp-${Date.now()}`,
      title: rpForm.title,
      evidence: { description: rpForm.evidenceDescription, files: [] },
      analysis: {
        content: rpForm.analysisContent,
        creator: { name: "张伟", role: "投资经理" },
        reviewers: [],
        createdAt: today,
      },
      comments: [],
    }
    // Update local state for immediate display
    setLocalRiskPoints((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), newRP],
    }))
    onAddRiskPoint?.(selectedId, newRP)
    setRpForm({ title: "", evidenceDescription: "", analysisContent: "" })
    setShowAddRP(false)
  }

  function handleSubmitCommitteeDecision() {
    if (!selectedId || !cdContent.trim() || cdReviewers.length === 0 || !selectedDetail) return
    const data: CommitteeDecisionFormData = {
      content: cdContent,
      conclusion: cdConclusion,
      reviewers: cdReviewers.map((k) => PEOPLE[k]).filter(Boolean),
    }
    onCreateCommitteeDecision?.(selectedId, selectedDetail.title, data)
    setCdContent("")
    setCdConclusion("假设成立")
    setCdReviewers([])
    setCdSearchQuery("")
    setShowAddCD(false)
  }

  function toggleCdReviewer(key: string) {
    setCdReviewers((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  function handleSubmitVerification() {
    if (!selectedId || !vfContent.trim() || vfResponsibles.length === 0 || !selectedDetail) return
    const data: VerificationFormData = {
      content: vfContent,
      conclusion: vfConclusion,
      materials: vfMaterials,
      responsibles: vfResponsibles.map((k) => PEOPLE[k]).filter(Boolean),
    }
    onCreateVerification?.(selectedId, selectedDetail.title, data)
    setVfContent("")
    setVfConclusion("符合预期")
    setVfMaterials([])
    setVfResponsibles([])
    setVfSearch("")
    setShowAddVF(false)
  }

  function toggleVfMaterial(id: string) {
    setVfMaterials((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  function toggleVfResponsible(key: string) {
    setVfResponsibles((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  // For new projects without a strategy template, show empty state
  if (isNewProject && !project?.strategyId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <ListChecks className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无假设清单</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            这是一个新创建的项目，还没有添加任何假设。点击下方按钮开始创建您的第一个投资假设。
          </p>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" />
            创建第一个假设
          </button>
        </div>
      </div>
    )
  }

  // Detail view - shows hypothesis details when a row is selected
  if (showDetail && selectedDetail) {
    return (
      <div className="h-full overflow-auto bg-[#F9FAFB]">
        <div className="px-6 py-6">
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
            <span className="text-[#111827]">假设清单</span>
          </div>

          {/* Detail header */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-xl font-bold text-[#111827]">{selectedDetail.title}</h1>
              {(() => {
                const item = sourceData.find(h => h.id === selectedId)
                const st = item?.status || selectedDetail.status
                return (
                  <Badge className={cn("text-xs", statusConfig[st].color)}>
                    {statusConfig[st].label}
                  </Badge>
                )
              })()}
            </div>
            <p className="text-sm text-[#6B7280] mb-3">
              ID: {selectedDetail.qaId} | 创建时间: {selectedDetail.createdAt} | 更新时间: {selectedDetail.updatedAt}
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

          {/* Value points section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-[#22C55E]" />
                <h2 className="text-base font-semibold text-[#22C55E]">价值点</h2>
              </div>
              {isNewProject && (
                <button
                  onClick={() => setShowAddVP(true)}
                  className="flex items-center gap-1 rounded-lg bg-[#F0FDF4] px-3 py-1.5 text-xs font-medium text-[#16A34A] hover:bg-[#DCFCE7] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增价值点
                </button>
              )}
            </div>
            {[...selectedDetail.valuePoints, ...(localValuePoints[selectedId ?? ""] || [])].map((vp) => (
              <div key={vp.id} className="bg-white rounded-xl border border-[#E5E7EB] mb-4 overflow-hidden">
                <div className="border-l-4 border-[#22C55E] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-[#22C55E]">{vp.title}</h3>
                    {isNewProject && (
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

                  {/* Evidence */}
                  <div className="mb-4">
                    <p className="text-xs text-[#6B7280] mb-1">论据支持</p>
                    <p className="text-sm text-[#111827] mb-3">{vp.evidence.description}</p>
                    {vp.evidence.files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-[#F9FAFB] rounded-lg">
                        <FileText className="h-4 w-4 text-[#2563EB]" />
                        <span className="text-sm text-[#2563EB]">{file.name}</span>
                        <span className="text-xs text-[#9CA3AF]">{file.size} · {file.date}</span>
                      </div>
                    ))}
                  </div>

                  {/* Analysis */}
                  <div className="mb-4">
                    <p className="text-xs text-[#6B7280] mb-1">论证分析</p>
                    <div className="p-3 bg-[#F9FAFB] rounded-lg">
                      <p className="text-sm text-[#374151] leading-relaxed">{vp.analysis.content}</p>
                    </div>
                  </div>

                  {/* Creator & Reviewers */}
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                        <span className="text-[8px] text-white">{vp.analysis.creator.name.slice(0, 1)}</span>
                      </div>
                      <span>创建: {vp.analysis.creator.name}</span>
                    </div>
                    <span>审批:</span>
                    {vp.analysis.reviewers.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                          <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                        </div>
                        <span>{r.name}</span>
                      </div>
                    ))}
                    <span>{vp.analysis.createdAt}</span>
                  </div>

                  {/* Comments */}
                  <div>
                    <p className="text-xs text-[#6B7280] mb-2">评论</p>
                    {[...vp.comments, ...(extraComments[getCommentKey(vp.id)] || [])].map((c, idx) => (
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
                        value={commentInputs[getCommentKey(vp.id)] || ""}
                        onChange={(e) => handleCommentInput(vp.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSendComment(vp.id) }}
                        className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                      />
                      <button
                        onClick={() => handleSendComment(vp.id)}
                        className="p-2 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Risk points section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-[#EF4444]" />
                <h2 className="text-base font-semibold text-[#EF4444]">风险点</h2>
              </div>
              {isNewProject && (
                <button
                  onClick={() => setShowAddRP(true)}
                  className="flex items-center gap-1 rounded-lg bg-[#FEF2F2] px-3 py-1.5 text-xs font-medium text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增风险点
                </button>
              )}
            </div>
            {[...selectedDetail.riskPoints, ...(localRiskPoints[selectedId ?? ""] || [])].map((rp) => (
              <div key={rp.id} className="bg-white rounded-xl border border-[#E5E7EB] mb-4 overflow-hidden">
                <div className="border-l-4 border-[#EF4444] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-[#EF4444]">{rp.title}</h3>
                    {isNewProject && (
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

                  {/* Evidence */}
                  <div className="mb-4">
                    <p className="text-xs text-[#6B7280] mb-1">论据支持</p>
                    <p className="text-sm text-[#111827] mb-3">{rp.evidence.description}</p>
                    {rp.evidence.files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-[#F9FAFB] rounded-lg">
                        <FileText className="h-4 w-4 text-[#2563EB]" />
                        <span className="text-sm text-[#2563EB]">{file.name}</span>
                        <span className="text-xs text-[#9CA3AF]">{file.size} · {file.date}</span>
                      </div>
                    ))}
                  </div>

                  {/* Analysis */}
                  <div className="mb-4">
                    <p className="text-xs text-[#6B7280] mb-1">论证分析</p>
                    <div className="p-3 bg-[#F9FAFB] rounded-lg">
                      <p className="text-sm text-[#374151] leading-relaxed">{rp.analysis.content}</p>
                    </div>
                  </div>

                  {/* Creator & Reviewers */}
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                        <span className="text-[8px] text-white">{rp.analysis.creator.name.slice(0, 1)}</span>
                      </div>
                      <span>创建: {rp.analysis.creator.name}</span>
                    </div>
                    <span>审批:</span>
                    {rp.analysis.reviewers.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                          <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                        </div>
                        <span>{r.name}</span>
                      </div>
                    ))}
                    <span>{rp.analysis.createdAt}</span>
                  </div>

                  {/* Comments */}
                  <div>
                    <p className="text-xs text-[#6B7280] mb-2">评论</p>
                    {[...rp.comments, ...(extraComments[getCommentKey(rp.id)] || [])].map((c, idx) => (
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
                        value={commentInputs[getCommentKey(rp.id)] || ""}
                        onChange={(e) => handleCommentInput(rp.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSendComment(rp.id) }}
                        className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                      />
                      <button
                        onClick={() => handleSendComment(rp.id)}
                        className="p-2 text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Committee decision section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-[#2563EB]" />
                <h2 className="text-base font-semibold text-[#2563EB]">投委会审议结果</h2>
              </div>
              {isNewProject && (
                <button
                  onClick={() => setShowAddCD(true)}
                  className="flex items-center gap-1 rounded-lg bg-[#EFF6FF] px-3 py-1.5 text-xs font-medium text-[#2563EB] hover:bg-[#DBEAFE] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增审议结果
                </button>
              )}
            </div>
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="border-l-4 border-[#2563EB] p-5">
                {selectedDetail.committeeDecision.content ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-[#111827]">审议结论</span>
                      <div className="flex items-center gap-2">
                        {selectedDetail.committeeDecision.conclusion && (
                          <Badge className={cn(
                            "text-xs",
                            selectedDetail.committeeDecision.conclusion === "假设成立"
                              ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
                              : "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"
                          )}>
                            {selectedDetail.committeeDecision.conclusion}
                          </Badge>
                        )}
                        {isNewProject && (
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
                      <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.committeeDecision.content}</p>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center text-sm text-[#9CA3AF] mb-4">暂无审议结果</div>
                )}

                {/* Creator & Reviewers */}
                {selectedDetail.committeeDecision.content && selectedDetail.committeeDecision.creator?.name && (
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                        <span className="text-[8px] text-white">{selectedDetail.committeeDecision.creator.name.slice(0, 1)}</span>
                      </div>
                      <span>创建: {selectedDetail.committeeDecision.creator.name}</span>
                    </div>
                    <span>审批:</span>
                    {selectedDetail.committeeDecision.reviewers.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                          <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                        </div>
                        <span>{r.name}</span>
                      </div>
                    ))}
                    <span>{selectedDetail.committeeDecision.createdAt}</span>
                  </div>
                )}

                {/* Comments */}
                <div>
                  <p className="text-xs text-[#6B7280] mb-2">评论</p>
                  {selectedDetail.committeeDecision.comments.map((c, idx) => (
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

          {/* Verification section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-[#8B5CF6]" />
                <h2 className="text-base font-semibold text-[#8B5CF6]">验证情况</h2>
              </div>
              {isNewProject && isInDuration && (
                <button
                  onClick={() => setShowAddVF(true)}
                  className="flex items-center gap-1 rounded-lg bg-[#F5F3FF] px-3 py-1.5 text-xs font-medium text-[#8B5CF6] hover:bg-[#EDE9FE] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增验证情况
                </button>
              )}
            </div>
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="border-l-4 border-[#8B5CF6] p-5">
                {selectedDetail.verification.content ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-[#111827]">验证结论</span>
                      <div className="flex items-center gap-2">
                        {selectedDetail.verification.conclusion && (
                          <Badge className={cn(
                            "text-xs",
                            selectedDetail.verification.conclusion === "符合预期"
                              ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
                              : "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"
                          )}>
                            {selectedDetail.verification.conclusion}
                          </Badge>
                        )}
                        {isNewProject && (
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
                      <p className="text-sm text-[#374151] leading-relaxed">{selectedDetail.verification.content}</p>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center text-sm text-[#9CA3AF] mb-4">暂无验证评估</div>
                )}

                {/* Creator & Reviewers */}
                {selectedDetail.verification.content && selectedDetail.verification.creator?.name && (
                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                    <div className="flex items-center gap-1">
                      <div className="h-5 w-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                        <span className="text-[8px] text-white">{selectedDetail.verification.creator.name.slice(0, 1)}</span>
                      </div>
                      <span>创建: {selectedDetail.verification.creator.name}</span>
                    </div>
                    <span>审批:</span>
                    {selectedDetail.verification.reviewers.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-[#6B7280] flex items-center justify-center">
                          <span className="text-[8px] text-white">{r.name.slice(0, 1)}</span>
                        </div>
                        <span>{r.name}</span>
                      </div>
                    ))}
                    <span>{selectedDetail.verification.createdAt}</span>
                  </div>
                )}

                {/* Comments */}
                <div>
                  <p className="text-xs text-[#6B7280] mb-2">评论</p>
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="添加评论..."
                      className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                    />
                    <button className="p-2 text-[#8B5CF6] hover:bg-[#F5F3FF] rounded-lg transition-colors">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Linked terms section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-1 rounded-full bg-[#6B7280]" />
              <h2 className="text-base font-semibold text-[#111827]">该假设所支持的条款</h2>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              {selectedDetail.linkedTerms.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">暂无关联条款</p>
              ) : (
                <div className="space-y-3">
                  {selectedDetail.linkedTerms.map((term) => (
                    <div key={term.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileCheck className="h-4 w-4 text-[#6B7280]" />
                        <div>
                          <span className="text-sm text-[#111827]">{term.title}</span>
                          <p className="text-xs text-[#9CA3AF]">ID: {term.termId}</p>
                        </div>
                      </div>
                      <Badge className={cn(
                        "text-xs",
                        term.status === "approved"
                          ? "bg-[#DCFCE7] text-[#166534]"
                          : term.status === "rejected"
                            ? "bg-[#FEE2E2] text-[#991B1B]"
                            : "bg-[#FEF3C7] text-[#92400E]"
                      )}>
                        {term.status === "approved" ? "通过" : term.status === "rejected" ? "拒绝" : "待审"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Value Point Dialog */}
        <Dialog open={showAddVP} onOpenChange={setShowAddVP}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#111827]">新增价值点</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">价值点标题 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="请输入价值点标题..."
                  value={vpForm.title}
                  onChange={(e) => setVpForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">论据支持</label>
                <textarea
                  placeholder="请输入论据支持描述..."
                  value={vpForm.evidenceDescription}
                  onChange={(e) => setVpForm((f) => ({ ...f, evidenceDescription: e.target.value }))}
                  rows={3}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">论证分析</label>
                <textarea
                  placeholder="请输入论证分析内容..."
                  value={vpForm.analysisContent}
                  onChange={(e) => setVpForm((f) => ({ ...f, analysisContent: e.target.value }))}
                  rows={3}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowAddVP(false); setVpForm({ title: "", evidenceDescription: "", analysisContent: "" }) }}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitValuePoint}
                disabled={!vpForm.title.trim()}
                className="rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-medium text-white hover:bg-[#16A34A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                新增
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Risk Point Dialog */}
        <Dialog open={showAddRP} onOpenChange={setShowAddRP}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#111827]">新增风险点</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">风险点标题 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="请输入风险点标题..."
                  value={rpForm.title}
                  onChange={(e) => setRpForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#EF4444]/20 focus:border-[#EF4444]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">论据支持</label>
                <textarea
                  placeholder="请输入论据支持描述..."
                  value={rpForm.evidenceDescription}
                  onChange={(e) => setRpForm((f) => ({ ...f, evidenceDescription: e.target.value }))}
                  rows={3}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#EF4444]/20 focus:border-[#EF4444] resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">论证分析</label>
                <textarea
                  placeholder="请输入论证分析内容..."
                  value={rpForm.analysisContent}
                  onChange={(e) => setRpForm((f) => ({ ...f, analysisContent: e.target.value }))}
                  rows={3}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#EF4444]/20 focus:border-[#EF4444] resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowAddRP(false); setRpForm({ title: "", evidenceDescription: "", analysisContent: "" }) }}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitRiskPoint}
                disabled={!rpForm.title.trim()}
                className="rounded-lg bg-[#EF4444] px-4 py-2 text-sm font-medium text-white hover:bg-[#DC2626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                新增
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Committee Decision Dialog */}
        <Dialog open={showAddCD} onOpenChange={setShowAddCD}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#111827]">新增审议结果</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">审议内容 <span className="text-red-500">*</span></label>
                <textarea
                  placeholder="请输入审议内容..."
                  value={cdContent}
                  onChange={(e) => setCdContent(e.target.value)}
                  rows={4}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">审议结果 <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCdConclusion("假设成立")}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                      cdConclusion === "假设成立"
                        ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
                    )}
                  >
                    成立
                  </button>
                  <button
                    onClick={() => setCdConclusion("假设不成立")}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                      cdConclusion === "假设不成立"
                        ? "border-[#EF4444] bg-[#FEF2F2] text-[#DC2626]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
                    )}
                  >
                    不成立
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">审议人 <span className="text-red-500">*</span></label>
                <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <div className="flex items-center gap-2">
                      <Search className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" />
                      <input
                        type="text"
                        placeholder="搜索审议人..."
                        value={cdSearchQuery}
                        onChange={(e) => setCdSearchQuery(e.target.value)}
                        className="flex-1 text-sm bg-transparent outline-none text-[#374151] placeholder:text-[#9CA3AF]"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-[#F3F4F6] max-h-[200px] overflow-y-auto">
                    {Object.entries(PEOPLE)
                      .filter(([, p]) =>
                        p.name.includes(cdSearchQuery) || p.role.includes(cdSearchQuery)
                      )
                      .map(([key, person]) => (
                        <button
                          key={key}
                          onClick={() => toggleCdReviewer(key)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                            cdReviewers.includes(key) ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                            cdReviewers.includes(key)
                              ? "border-[#2563EB] bg-[#2563EB]"
                              : "border-[#D1D5DB] bg-white"
                          )}>
                            {cdReviewers.includes(key) && (
                              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div className="h-7 w-7 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0">
                            <span className="text-[10px] text-white font-medium">{person.name.slice(0, 1)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#111827]">{person.name}</p>
                            <p className="text-xs text-[#6B7280]">{person.role}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
                {cdReviewers.length > 0 && (
                  <p className="text-xs text-[#6B7280] mt-1.5">已选择 {cdReviewers.length} 位审议人</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowAddCD(false); setCdContent(""); setCdConclusion("假设成立"); setCdReviewers([]); setCdSearchQuery("") }}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitCommitteeDecision}
                disabled={!cdContent.trim() || cdReviewers.length === 0}
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                新增
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Verification Dialog */}
        <Dialog open={showAddVF} onOpenChange={setShowAddVF}>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#111827]">新增验证情况</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* 验证内容 */}
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">验证内容 <span className="text-red-500">*</span></label>
                <textarea
                  placeholder="请输入验证内容..."
                  value={vfContent}
                  onChange={(e) => setVfContent(e.target.value)}
                  rows={4}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] resize-none"
                />
              </div>
              {/* 验证结果 */}
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">验证结果 <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setVfConclusion("符合预期")}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                      vfConclusion === "符合预期"
                        ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
                    )}
                  >
                    符合预期
                  </button>
                  <button
                    onClick={() => setVfConclusion("不符合预期")}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                      vfConclusion === "不符合预期"
                        ? "border-[#EF4444] bg-[#FEF2F2] text-[#DC2626]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
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
                  <button
                    className="flex items-center gap-1 text-xs text-[#8B5CF6] hover:text-[#7C3AED] transition-colors"
                    onClick={() => {/* 上传功能展示用，不实现 */ }}
                  >
                    <Upload className="h-3 w-3" />
                    上传材料
                  </button>
                </div>
                <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                  {projectMaterials && projectMaterials.length > 0 ? (
                    <div className="divide-y divide-[#F3F4F6] max-h-[160px] overflow-y-auto">
                      {projectMaterials.map((material) => (
                        <button
                          key={material.id}
                          onClick={() => toggleVfMaterial(material.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                            vfMaterials.includes(material.id) ? "bg-[#F5F3FF]" : "hover:bg-[#F9FAFB]"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                            vfMaterials.includes(material.id)
                              ? "border-[#8B5CF6] bg-[#8B5CF6]"
                              : "border-[#D1D5DB] bg-white"
                          )}>
                            {vfMaterials.includes(material.id) && (
                              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <FileText className="h-4 w-4 text-[#8B5CF6] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#111827] truncate">{material.name}</p>
                            <p className="text-xs text-[#9CA3AF]">{material.format} · {material.size}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center text-sm text-[#9CA3AF]">暂无项目材料</div>
                  )}
                </div>
                {vfMaterials.length > 0 && (
                  <p className="text-xs text-[#6B7280] mt-1.5">已选择 {vfMaterials.length} 份材料</p>
                )}
              </div>
              {/* 负责人 */}
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">负责人 <span className="text-red-500">*</span></label>
                <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <div className="flex items-center gap-2">
                      <Search className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" />
                      <input
                        type="text"
                        placeholder="搜索负责人..."
                        value={vfSearch}
                        onChange={(e) => setVfSearch(e.target.value)}
                        className="flex-1 text-sm bg-transparent outline-none text-[#374151] placeholder:text-[#9CA3AF]"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-[#F3F4F6] max-h-[160px] overflow-y-auto">
                    {Object.entries(PEOPLE)
                      .filter(([, p]) =>
                        p.name.includes(vfSearch) || p.role.includes(vfSearch)
                      )
                      .map(([key, person]) => (
                        <button
                          key={key}
                          onClick={() => toggleVfResponsible(key)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                            vfResponsibles.includes(key) ? "bg-[#F5F3FF]" : "hover:bg-[#F9FAFB]"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                            vfResponsibles.includes(key)
                              ? "border-[#8B5CF6] bg-[#8B5CF6]"
                              : "border-[#D1D5DB] bg-white"
                          )}>
                            {vfResponsibles.includes(key) && (
                              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div className="h-7 w-7 rounded-full bg-[#8B5CF6] flex items-center justify-center shrink-0">
                            <span className="text-[10px] text-white font-medium">{person.name.slice(0, 1)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#111827]">{person.name}</p>
                            <p className="text-xs text-[#6B7280]">{person.role}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
                {vfResponsibles.length > 0 && (
                  <p className="text-xs text-[#6B7280] mt-1.5">已选择 {vfResponsibles.length} 位负责人</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowAddVF(false); setVfContent(""); setVfConclusion("符合预期"); setVfMaterials([]); setVfResponsibles([]); setVfSearch("") }}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitVerification}
                disabled={!vfContent.trim() || vfResponsibles.length === 0}
                className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7C3AED] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                新增
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Hypothesis Dialog */}
        <Dialog open={showAddHypothesis} onOpenChange={setShowAddHypothesis}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#111827]">新建假设</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">假设名称 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="请输入假设名称..."
                  value={newHypoForm.title}
                  onChange={(e) => setNewHypoForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#374151] mb-1.5 block">假设方向</label>
                  <input
                    type="text"
                    placeholder="如: 技术攻关"
                    value={newHypoForm.direction}
                    onChange={(e) => setNewHypoForm((f) => ({ ...f, direction: e.target.value }))}
                    className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#374151] mb-1.5 block">假设类别</label>
                  <input
                    type="text"
                    placeholder="如: 算力与芯片"
                    value={newHypoForm.category}
                    onChange={(e) => setNewHypoForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151] mb-1.5 block">负责人</label>
                <select
                  value={newHypoForm.owner}
                  onChange={(e) => setNewHypoForm((f) => ({ ...f, owner: e.target.value }))}
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                >
                  {Object.entries(PEOPLE).map(([key, p]) => (
                    <option key={key} value={p.name}>{p.name} ({p.role})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddHypothesis(false)}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitHypothesis}
                disabled={!newHypoForm.title.trim()}
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </DialogContent>
        </Dialog>
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
                <ListChecks className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1E40AF]">
                  基于「{project.strategyName}」策略模板
                </p>
                <p className="text-xs text-[#3B82F6]">
                  以下假设清单继承自所选策略模板，您可以根据项目实际情况进行调整
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">假设清单</h1>
            {isExited ? (
              <p className="mt-1 text-sm text-[#EF4444] font-medium">项目已退出，所有信息不可更改。</p>
            ) : isPostInvestment ? (
              <p className="mt-1 text-sm text-[#D97706] font-medium">项目已进入投后期，不可新建或删除假设，现有假设仍可更改。</p>
            ) : isMidInvestment ? (
              <p className="mt-1 text-sm text-[#D97706] font-medium">项目已进入投中期，不可新建假设，现有假设仍可更改。</p>
            ) : (
              <p className="mt-1 text-sm text-[#6B7280]">管理和跟踪项目投资假设</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <Input
                type="text"
                placeholder="搜索假设..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9 bg-white border-[#E5E7EB]"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 w-28 rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm text-[#374151] outline-none hover:border-[#D1D5DB] focus:border-[#2563EB] transition-all cursor-pointer"
            >
              <option value="ALL">所有状态</option>
              <option value="pending">待验证</option>
              <option value="verified">成立</option>
              <option value="risky">不成立</option>
            </select>
            {!isInDuration && (
              <Button 
                onClick={() => setShowAddHypothesis(true)}
                className="bg-[#2563EB] hover:bg-[#1D4ED8]"
              >
                <Plus className="h-4 w-4 mr-2" />
                新建假设
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1E3A5F] text-white">
                <th className="px-4 py-3 text-left text-sm font-medium">假设方向</th>
                <th className="px-4 py-3 text-left text-sm font-medium">假设类别</th>
                <th className="px-4 py-3 text-left text-sm font-medium">假设名称</th>
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
                      {!isPostInvestment && !isExited && (
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
              <ListChecks className="mx-auto h-12 w-12 text-[#D1D5DB]" />
              <p className="mt-4 text-sm text-[#6B7280]">暂无匹配的假设</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
