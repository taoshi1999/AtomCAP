"use client"

import { useState } from "react"
import {
  Search,
  FileText,
  ChevronRight,
  ChevronDown,
  FileCheck,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Plus,
  Link2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */
interface TermNode {
  id: string
  label: string
  fullName?: string
  status: "approved" | "pending" | "rejected"
  children?: TermNode[]
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

interface TermValuePoint {
  id: string
  title: string
  evidence: {
    description: string
    files: { name: string; size: string; date: string }[]
    linkedHypotheses: LinkedHypothesis[]
  }
  analysis: {
    content: string
    creator: PersonInfo
    reviewers: PersonInfo[]
    createdAt: string
  }
  comments: { author: string; content: string; time: string }[]
}

interface TermRiskPoint {
  id: string
  title: string
  evidence: {
    description: string
    files: { name: string; size: string; date: string }[]
    linkedHypotheses: LinkedHypothesis[]
  }
  analysis: {
    content: string
    creator: PersonInfo
    reviewers: PersonInfo[]
    createdAt: string
  }
  comments: { author: string; content: string; time: string }[]
}

interface TermCommitteeDecision {
  conclusion: string
  status: "approved" | "rejected" | "pending"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface TermDetail {
  id: string
  title: string
  termId: string
  createdAt: string
  updatedAt: string
  status: "approved" | "pending" | "rejected"
  creator: PersonInfo
  description: string
  valuePoints: TermValuePoint[]
  riskPoints: TermRiskPoint[]
  committeeDecision: TermCommitteeDecision
}

/* ------------------------------------------------------------------ */
/*  Mock people                                                        */
/* ------------------------------------------------------------------ */
const PEOPLE: Record<string, PersonInfo> = {
  zhangwei: { name: "\u5F20\u4F1F", role: "\u6295\u8D44\u7ECF\u7406" },
  lisi: { name: "\u674E\u56DB", role: "\u9AD8\u7EA7\u5206\u6790\u5E08" },
  wangwu: { name: "\u738B\u4E94", role: "\u5408\u4F19\u4EBA" },
  wangzong: { name: "\u738B\u603B", role: "\u6295\u59D4\u4F1A\u4E3B\u5E2D" },
  chenzong: { name: "\u9648\u603B", role: "\u98CE\u63A7\u603B\u76D1" },
  zhaoliu: { name: "\u8D75\u516D", role: "\u6CD5\u52A1\u987E\u95EE" },
}

/* ------------------------------------------------------------------ */
/*  Mock data - tree                                                   */
/* ------------------------------------------------------------------ */
const termTree: TermNode[] = [
  {
    id: "control",
    label: "\u63A7\u5236\u6743\u6761\u6B3E",
    status: "approved",
    children: [
      {
        id: "board",
        label: "\u8463\u4E8B\u4F1A\u6761\u6B3E",
        status: "approved",
        children: [
          {
            id: "board-seat",
            label: "\u8463\u4E8B\u4F1A\u5E2D\u4F4D",
            fullName: "\u6295\u8D44\u65B9\u6709\u6743\u59D4\u6D3E\u4E00\u540D\u8463\u4E8B\u8FDB\u5165\u516C\u53F8\u8463\u4E8B\u4F1A",
            status: "approved",
          },
          {
            id: "observer-right",
            label: "\u89C2\u5BDF\u5458\u6743\u5229",
            fullName: "\u6295\u8D44\u65B9\u6709\u6743\u59D4\u6D3E\u4E00\u540D\u89C2\u5BDF\u5458\u5217\u5E2D\u8463\u4E8B\u4F1A\u4F1A\u8BAE",
            status: "approved",
          },
        ],
      },
      {
        id: "veto",
        label: "\u5426\u51B3\u6743\u6761\u6B3E",
        status: "pending",
        children: [
          {
            id: "major-veto",
            label: "\u91CD\u5927\u4E8B\u9879\u5426\u51B3\u6743",
            fullName: "\u5BF9\u516C\u53F8\u7AE0\u7A0B\u4FEE\u6539\u3001\u589E\u51CF\u6CE8\u518C\u8D44\u672C\u7B49\u91CD\u5927\u4E8B\u9879\u4EAB\u6709\u4E00\u7968\u5426\u51B3\u6743",
            status: "pending",
          },
          {
            id: "related-party-veto",
            label: "\u5173\u8054\u4EA4\u6613\u5426\u51B3\u6743",
            fullName: "\u5BF9\u8D85\u8FC7100\u4E07\u5143\u7684\u5173\u8054\u4EA4\u6613\u4EAB\u6709\u5426\u51B3\u6743",
            status: "pending",
          },
        ],
      },
    ],
  },
  {
    id: "economic",
    label: "\u7ECF\u6D4E\u6761\u6B3E",
    status: "approved",
    children: [
      {
        id: "liquidation",
        label: "\u6E05\u7B97\u4F18\u5148\u6743",
        status: "approved",
        children: [
          {
            id: "liquidation-pref",
            label: "\u4F18\u5148\u6E05\u7B97\u6761\u6B3E",
            fullName: "\u6295\u8D44\u65B9\u6709\u6743\u4F18\u5148\u4E8E\u666E\u901A\u80A1\u80A1\u4E1C\u83B7\u5F97\u6295\u8D44\u91D1\u989D1.5\u500D\u7684\u56DE\u62A5",
            status: "approved",
          },
          {
            id: "participation",
            label: "\u53C2\u4E0E\u5206\u914D\u6743",
            fullName: "\u6295\u8D44\u65B9\u5728\u83B7\u5F97\u4F18\u5148\u6E05\u7B97\u540E\u53EF\u53C2\u4E0E\u5269\u4F59\u8D44\u4EA7\u7684\u6309\u6BD4\u4F8B\u5206\u914D",
            status: "approved",
          },
        ],
      },
      {
        id: "anti-dilution",
        label: "\u53CD\u7A00\u91CA\u4FDD\u62A4",
        status: "pending",
        children: [
          {
            id: "weighted-avg",
            label: "\u52A0\u6743\u5E73\u5747\u53CD\u7A00\u91CA",
            fullName: "\u540E\u7EED\u4F4E\u4EF7\u878D\u8D44\u65F6\u6295\u8D44\u65B9\u4EAB\u6709\u52A0\u6743\u5E73\u5747\u53CD\u7A00\u91CA\u8C03\u6574\u6743",
            status: "pending",
          },
        ],
      },
    ],
  },
  {
    id: "protective",
    label: "\u4FDD\u62A4\u6027\u6761\u6B3E",
    status: "pending",
    children: [
      {
        id: "info-rights",
        label: "\u4FE1\u606F\u6743\u6761\u6B3E",
        status: "approved",
        children: [
          {
            id: "financial-report",
            label: "\u8D22\u52A1\u62A5\u544A\u6743",
            fullName: "\u6295\u8D44\u65B9\u6709\u6743\u5B9A\u671F\u83B7\u53D6\u516C\u53F8\u8D22\u52A1\u62A5\u8868\u548C\u7ECF\u8425\u6570\u636E",
            status: "approved",
          },
          {
            id: "audit-right",
            label: "\u5BA1\u8BA1\u6743",
            fullName: "\u6295\u8D44\u65B9\u6709\u6743\u59D4\u6D3E\u5BA1\u8BA1\u5E08\u5BF9\u516C\u53F8\u8D22\u52A1\u8FDB\u884C\u5BA1\u8BA1",
            status: "approved",
          },
        ],
      },
      {
        id: "exit-rights",
        label: "\u9000\u51FA\u6761\u6B3E",
        status: "rejected",
        children: [
          {
            id: "drag-along",
            label: "\u9886\u552E\u6743",
            fullName: "\u6295\u8D44\u65B9\u5728\u7279\u5B9A\u6761\u4EF6\u4E0B\u4EAB\u6709\u9886\u552E\u6743\u5F3A\u5236\u5176\u4ED6\u80A1\u4E1C\u5171\u540C\u51FA\u552E",
            status: "rejected",
          },
          {
            id: "tag-along",
            label: "\u968F\u552E\u6743",
            fullName: "\u5176\u4ED6\u80A1\u4E1C\u51FA\u552E\u80A1\u4EFD\u65F6\u6295\u8D44\u65B9\u6709\u6743\u6309\u540C\u7B49\u6761\u4EF6\u53C2\u4E0E\u51FA\u552E",
            status: "approved",
          },
        ],
      },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Mock data - details                                                */
/* ------------------------------------------------------------------ */
const termDetailsMap: Record<string, TermDetail> = {
  "board-seat": {
    id: "board-seat",
    title: "\u6295\u8D44\u65B9\u6709\u6743\u59D4\u6D3E\u4E00\u540D\u8463\u4E8B\u8FDB\u5165\u516C\u53F8\u8463\u4E8B\u4F1A",
    termId: "TM-2024-001",
    createdAt: "2024-01-20",
    updatedAt: "2024-01-25",
    status: "approved",
    creator: PEOPLE.zhaoliu,
    description: "\u6295\u8D44\u65B9\u6709\u6743\u59D4\u6D3E\u4E00\u540D\u8463\u4E8B\u8FDB\u5165\u516C\u53F8\u8463\u4E8B\u4F1A\uFF0C\u4EAB\u6709\u4E0E\u5176\u4ED6\u8463\u4E8B\u540C\u7B49\u7684\u8868\u51B3\u6743\u548C\u77E5\u60C5\u6743\u3002",
    valuePoints: [
      {
        id: "vp1",
        title: "\u4EF7\u503C\u70B91",
        evidence: {
          description: "\u8463\u4E8B\u4F1A\u5E2D\u4F4D\u80FD\u591F\u786E\u4FDD\u6295\u8D44\u65B9\u5BF9\u516C\u53F8\u91CD\u5927\u51B3\u7B56\u7684\u53C2\u4E0E\u6743\u548C\u77E5\u60C5\u6743\uFF0C\u662F\u4FDD\u62A4\u6295\u8D44\u6743\u76CA\u7684\u57FA\u7840\u6761\u6B3E",
          files: [
            { name: "\u8463\u4E8B\u4F1A\u6761\u6B3E\u5BF9\u6807\u5206\u6790.pdf", size: "1.2 MB", date: "2024-01-21" },
          ],
          linkedHypotheses: [
            { id: "tech-bg", title: "\u521B\u59CB\u4EBA\u95EB\u4FCA\u6770\u5177\u6709\u624E\u5B9E\u7684\u4EBA\u5DE5\u667A\u80FD\u5B66\u672F\u80CC\u666F", status: "verified" },
          ],
        },
        analysis: {
          content: "\u4F5C\u4E3AB\u8F6E\u6295\u8D44\u65B9\uFF0C\u83B7\u5F97\u8463\u4E8B\u4F1A\u5E2D\u4F4D\u662F\u884C\u4E1A\u6807\u51C6\u505A\u6CD5\u3002\u901A\u8FC7\u8463\u4E8B\u4F1A\u53C2\u4E0E\uFF0C\u80FD\u591F\u6709\u6548\u76D1\u7763\u521B\u59CB\u4EBA\u7684\u91CD\u5927\u7ECF\u8425\u51B3\u7B56\uFF0C\u5E76\u53CA\u65F6\u4E86\u89E3\u516C\u53F8\u8FD0\u8425\u72B6\u51B5\u3002\u7ED3\u5408\u521B\u59CB\u4EBA\u5B66\u672F\u80CC\u666F\u5047\u8BBE\u7684\u9A8C\u8BC1\u7ED3\u679C\uFF0C\u8463\u4E8B\u4F1A\u53C2\u4E0E\u5C06\u6709\u52A9\u4E8E\u5F15\u5BFC\u516C\u53F8\u6280\u672F\u6218\u7565\u65B9\u5411\u3002",
          creator: PEOPLE.zhaoliu,
          reviewers: [PEOPLE.zhangwei, PEOPLE.wangwu, PEOPLE.chenzong],
          createdAt: "2024-01-22",
        },
        comments: [
          { author: "\u5F20\u4F1F", content: "\u5EFA\u8BAE\u660E\u786E\u8463\u4E8B\u4EFB\u671F\u548C\u66F4\u6362\u673A\u5236", time: "2024-01-23 10:30" },
        ],
      },
    ],
    riskPoints: [
      {
        id: "rp1",
        title: "\u98CE\u9669\u70B91",
        evidence: {
          description: "\u8463\u4E8B\u4F1A\u5E2D\u4F4D\u53EF\u80FD\u5BFC\u81F4\u4E0E\u521B\u59CB\u4EBA\u5728\u6218\u7565\u65B9\u5411\u4E0A\u7684\u5206\u6B67",
          files: [],
          linkedHypotheses: [
            { id: "leadership", title: "\u521B\u59CB\u4EBA\u5C55\u73B0\u51FA\u5F3A\u5927\u7684\u56E2\u961F\u51DD\u805A\u529B\u548C\u6218\u7565\u89C4\u5212\u80FD\u529B", status: "pending" },
          ],
        },
        analysis: {
          content: "\u9700\u8981\u5728\u6761\u6B3E\u4E2D\u660E\u786E\u8463\u4E8B\u7684\u6743\u8D23\u8FB9\u754C\uFF0C\u907F\u514D\u8FC7\u5EA6\u5E72\u9884\u516C\u53F8\u65E5\u5E38\u8FD0\u8425\uFF0C\u540C\u65F6\u786E\u4FDD\u91CD\u5927\u4E8B\u9879\u7684\u77E5\u60C5\u6743\u3002",
          creator: PEOPLE.chenzong,
          reviewers: [PEOPLE.zhaoliu, PEOPLE.wangwu],
          createdAt: "2024-01-23",
        },
        comments: [],
      },
    ],
    committeeDecision: {
      conclusion: "\u901A\u8FC7",
      status: "approved",
      content: "\u7ECF\u6295\u59D4\u4F1A\u5BA1\u8BAE\uFF0C\u8463\u4E8B\u4F1A\u5E2D\u4F4D\u6761\u6B3E\u7B26\u5408\u884C\u4E1A\u6807\u51C6\uFF0C\u5BF9\u4FDD\u62A4\u6295\u8D44\u65B9\u6743\u76CA\u5177\u6709\u91CD\u8981\u4EF7\u503C\u3002\u5EFA\u8BAE\u660E\u786E\u8463\u4E8B\u4EFB\u671F\u4E3A3\u5E74\uFF0C\u5E76\u786E\u4FDD\u4FE1\u606F\u62AB\u9732\u4E49\u52A1\u7684\u5177\u4F53\u8303\u56F4\u3002",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhangwei, PEOPLE.lisi],
      createdAt: "2024-01-26",
      comments: [
        { author: "\u5F20\u4F1F", content: "\u540C\u610F\u6295\u59D4\u51B3\u8BAE\uFF0C\u5DF2\u5C06\u4EFB\u671F\u8981\u6C42\u52A0\u5165\u6761\u6B3E\u8349\u6848", time: "2024-01-26 16:00" },
      ],
    },
  },
  "liquidation-pref": {
    id: "liquidation-pref",
    title: "\u6295\u8D44\u65B9\u6709\u6743\u4F18\u5148\u4E8E\u666E\u901A\u80A1\u80A1\u4E1C\u83B7\u5F97\u6295\u8D44\u91D1\u989D1.5\u500D\u7684\u56DE\u62A5",
    termId: "TM-2024-003",
    createdAt: "2024-01-22",
    updatedAt: "2024-01-28",
    status: "approved",
    creator: PEOPLE.zhaoliu,
    description: "\u5728\u516C\u53F8\u53D1\u751F\u6E05\u7B97\u4E8B\u4EF6\u65F6\uFF0C\u6295\u8D44\u65B9\u6709\u6743\u4F18\u5148\u4E8E\u666E\u901A\u80A1\u80A1\u4E1C\u83B7\u5F97\u5176\u6295\u8D44\u91D1\u989D1.5\u500D\u7684\u56DE\u62A5\u3002",
    valuePoints: [
      {
        id: "vp1",
        title: "\u4EF7\u503C\u70B91",
        evidence: {
          description: "1.5\u500D\u4F18\u5148\u6E05\u7B97\u500D\u6570\u5728B\u8F6E\u6295\u8D44\u4E2D\u5C5E\u4E8E\u5408\u7406\u8303\u56F4\uFF0C\u80FD\u591F\u6709\u6548\u4FDD\u62A4\u6295\u8D44\u65B9\u7684\u4E0B\u884C\u98CE\u9669",
          files: [
            { name: "\u6E05\u7B97\u4F18\u5148\u6743\u884C\u4E1A\u5BF9\u6807.pdf", size: "2.1 MB", date: "2024-01-23" },
          ],
          linkedHypotheses: [
            { id: "api-pricing", title: "API\u8C03\u7528\u6309\u91CF\u8BA1\u8D39\u6A21\u5F0F\u80FD\u591F\u5B9E\u73B0\u53EF\u6301\u7EED\u7684\u6536\u5165\u589E\u957F", status: "pending" },
            { id: "enterprise-license", title: "\u4F01\u4E1A\u7EA7\u8BB8\u53EF\u8BA2\u9605\u6A21\u5F0F\u5177\u6709\u9AD8\u5BA2\u5355\u4EF7\u548C\u5F3A\u7C98\u6027\u7279\u5F81", status: "pending" },
          ],
        },
        analysis: {
          content: "\u57FA\u4E8E\u5F53\u524DB\u8F6E10\u4EBF\u7F8E\u5143\u4F30\u503C\uFF0C1.5\u500D\u6E05\u7B97\u4F18\u5148\u6743\u63D0\u4F9B\u4E86\u5145\u5206\u7684\u4E0B\u884C\u4FDD\u62A4\u3002\u7ED3\u5408\u6536\u5165\u6A21\u5F0F\u5047\u8BBE\u7684\u5206\u6790\uFF0C\u516C\u53F8\u6709\u826F\u597D\u7684\u73B0\u91D1\u6D41\u9884\u671F\uFF0C\u89E6\u53D1\u6E05\u7B97\u7684\u6982\u7387\u8F83\u4F4E\u3002",
          creator: PEOPLE.zhaoliu,
          reviewers: [PEOPLE.chenzong, PEOPLE.wangwu],
          createdAt: "2024-01-24",
        },
        comments: [],
      },
    ],
    riskPoints: [],
    committeeDecision: {
      conclusion: "\u901A\u8FC7",
      status: "approved",
      content: "\u7ECF\u5BA1\u8BAE\uFF0C1.5\u500D\u4F18\u5148\u6E05\u7B97\u500D\u6570\u5728B\u8F6E\u6295\u8D44\u4E2D\u5C5E\u4E8E\u6807\u51C6\u6761\u6B3E\uFF0C\u540C\u610F\u901A\u8FC7\u3002",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhaoliu],
      createdAt: "2024-01-28",
      comments: [],
    },
  },
  "drag-along": {
    id: "drag-along",
    title: "\u6295\u8D44\u65B9\u5728\u7279\u5B9A\u6761\u4EF6\u4E0B\u4EAB\u6709\u9886\u552E\u6743\u5F3A\u5236\u5176\u4ED6\u80A1\u4E1C\u5171\u540C\u51FA\u552E",
    termId: "TM-2024-006",
    createdAt: "2024-02-01",
    updatedAt: "2024-02-05",
    status: "rejected",
    creator: PEOPLE.zhaoliu,
    description: "\u5F53\u6295\u8D44\u65B9\u4E0E\u591A\u6570\u80A1\u4E1C\u540C\u610F\u51FA\u552E\u516C\u53F8\u65F6\uFF0C\u6709\u6743\u5F3A\u5236\u5176\u4F59\u80A1\u4E1C\u4EE5\u76F8\u540C\u6761\u4EF6\u53C2\u4E0E\u51FA\u552E\u3002",
    valuePoints: [
      {
        id: "vp1",
        title: "\u4EF7\u503C\u70B91",
        evidence: {
          description: "\u9886\u552E\u6743\u80FD\u591F\u786E\u4FDD\u5728\u9000\u51FA\u65F6\u4E0D\u4F1A\u56E0\u5C11\u6570\u80A1\u4E1C\u53CD\u5BF9\u800C\u5931\u8D25",
          files: [],
          linkedHypotheses: [
            { id: "tam", title: "\u5168\u7403\u5927\u6A21\u578B\u5E02\u573A\u89C4\u6A21\u5C06\u57282027\u5E74\u8FBE\u52301500\u4EBF\u7F8E\u5143", status: "pending" },
          ],
        },
        analysis: {
          content: "\u9886\u552E\u6743\u662F\u4FDD\u62A4\u6295\u8D44\u65B9\u9000\u51FA\u6743\u76CA\u7684\u91CD\u8981\u6761\u6B3E\uFF0C\u4F46\u53EF\u80FD\u5BF9\u521B\u59CB\u4EBA\u548C\u5C0F\u80A1\u4E1C\u4E0D\u5229\u3002",
          creator: PEOPLE.zhaoliu,
          reviewers: [PEOPLE.zhangwei],
          createdAt: "2024-02-02",
        },
        comments: [],
      },
    ],
    riskPoints: [
      {
        id: "rp1",
        title: "\u98CE\u9669\u70B91",
        evidence: {
          description: "\u521B\u59CB\u4EBA\u5F3A\u70C8\u53CD\u5BF9\u9886\u552E\u6743\u6761\u6B3E\uFF0C\u53EF\u80FD\u5F71\u54CD\u4EA4\u6613\u8C08\u5224\u8FDB\u5EA6",
          files: [
            { name: "\u521B\u59CB\u4EBA\u53CD\u9988\u610F\u89C1.pdf", size: "0.8 MB", date: "2024-02-03" },
          ],
          linkedHypotheses: [
            { id: "leadership", title: "\u521B\u59CB\u4EBA\u5C55\u73B0\u51FA\u5F3A\u5927\u7684\u56E2\u961F\u51DD\u805A\u529B\u548C\u6218\u7565\u89C4\u5212\u80FD\u529B", status: "pending" },
          ],
        },
        analysis: {
          content: "\u521B\u59CB\u4EBA\u8BA4\u4E3A\u9886\u552E\u6743\u4F1A\u5BF9\u56E2\u961F\u58EB\u6C14\u4EA7\u751F\u8D1F\u9762\u5F71\u54CD\uFF0C\u5EFA\u8BAE\u653E\u5F03\u8BE5\u6761\u6B3E\u4EE5\u6362\u53D6\u5176\u4ED6\u4FDD\u62A4\u6027\u6761\u6B3E\u7684\u8BA9\u6B65\u3002",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.wangwu, PEOPLE.chenzong],
          createdAt: "2024-02-04",
        },
        comments: [
          { author: "\u738B\u4E94", content: "\u540C\u610F\u653E\u5F03\u9886\u552E\u6743\uFF0C\u53EF\u4EE5\u5728\u968F\u552E\u6743\u6761\u6B3E\u4E2D\u52A0\u5F3A\u4FDD\u62A4", time: "2024-02-04 15:30" },
        ],
      },
    ],
    committeeDecision: {
      conclusion: "\u5426\u51B3",
      status: "rejected",
      content: "\u7ECF\u6295\u59D4\u4F1A\u5BA1\u8BAE\uFF0C\u8003\u8651\u5230\u521B\u59CB\u4EBA\u7684\u5F3A\u70C8\u53CD\u5BF9\u610F\u89C1\u53CA\u4EA4\u6613\u6574\u4F53\u5E73\u8861\uFF0C\u51B3\u5B9A\u653E\u5F03\u9886\u552E\u6743\u6761\u6B3E\uFF0C\u8F6C\u800C\u52A0\u5F3A\u968F\u552E\u6743\u548C\u4FE1\u606F\u6743\u7684\u4FDD\u62A4\u529B\u5EA6\u3002",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhangwei, PEOPLE.wangwu],
      createdAt: "2024-02-05",
      comments: [],
    },
  },
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
function statusDot(status: "approved" | "pending" | "rejected") {
  const colors = { approved: "bg-emerald-500", pending: "bg-gray-300", rejected: "bg-red-500" }
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", colors[status])} />
}

const statusLabels: Record<string, string> = {
  approved: "\u901A\u8FC7",
  pending: "\u5F85\u5BA1\u8BAE",
  rejected: "\u5426\u51B3",
}

/* ------------------------------------------------------------------ */
/*  Avatar Chip                                                        */
/* ------------------------------------------------------------------ */
function AvatarChip({ person, label }: { person: PersonInfo; label?: string }) {
  if (!person.name) return null
  const initials = person.name.slice(0, 1)
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-2 py-0.5 text-xs text-[#374151] transition-colors hover:bg-[#F3F4F6] hover:border-[#D1D5DB]">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-[10px] font-medium text-white">
              {initials}
            </span>
            {label && <span className="text-[#9CA3AF] mr-0.5">{label}</span>}
            <span className="font-medium">{person.name}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{person.name}</p>
          <p className="text-muted-foreground">{person.role}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function AvatarChipGroup({ people, label }: { people: PersonInfo[]; label?: string }) {
  if (!people || people.length === 0) return null
  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      {label && <span className="text-xs text-[#9CA3AF] mr-0.5">{label}</span>}
      {people.map((p, i) => (
        <AvatarChip key={i} person={p} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tree Node                                                          */
/* ------------------------------------------------------------------ */
function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: TermNode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = node.children && node.children.length > 0
  const isLeaf = !hasChildren
  const isSelected = selectedId === node.id
  const displayLabel = isLeaf && node.fullName ? node.fullName : node.label

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded)
          if (isLeaf) onSelect(node.id)
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left",
          isSelected ? "bg-[#EFF6FF] text-[#2563EB] font-medium" : "text-[#374151] hover:bg-[#F3F4F6]",
          depth === 0 && "font-semibold text-[#111827]"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {isLeaf && statusDot(node.status)}
        <span className={cn(isLeaf ? "line-clamp-2" : "truncate")}>{displayLabel}</span>
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Comment Section                                                    */
/* ------------------------------------------------------------------ */
function CommentSection({ comments }: { comments: { author: string; content: string; time: string }[] }) {
  const [newComment, setNewComment] = useState("")
  return (
    <div className="mt-4 border-t border-[#E5E7EB] pt-4">
      <h5 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3">{"\u8BC4\u8BBA"}</h5>
      {comments.length > 0 && (
        <div className="space-y-3 mb-3">
          {comments.map((c, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-xs font-medium text-[#2563EB]">
                {c.author[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#374151]">{c.author}</span>
                  <span className="text-xs text-[#9CA3AF]">{c.time}</span>
                </div>
                <p className="mt-0.5 text-sm text-[#4B5563] leading-relaxed">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input placeholder={"\u6DFB\u52A0\u8BC4\u8BBA..."} value={newComment} onChange={(e) => setNewComment(e.target.value)} className="text-sm h-8 border-[#E5E7EB]" />
        <Button size="sm" variant="outline" className="h-8 px-2.5 shrink-0">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Author Row                                                         */
/* ------------------------------------------------------------------ */
function AuthorRow({ creator, reviewers, createdAt }: { creator: PersonInfo; reviewers: PersonInfo[]; createdAt: string }) {
  if (!creator.name && reviewers.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      {creator.name && <AvatarChip person={creator} label={"\u521B\u5EFA:"} />}
      {reviewers.length > 0 && <AvatarChipGroup people={reviewers} label={"\u5BA1\u9605:"} />}
      {createdAt && <span className="text-[#9CA3AF] ml-1">{createdAt}</span>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Linked Hypothesis Tag                                              */
/* ------------------------------------------------------------------ */
function LinkedHypothesisTag({ hypothesis }: { hypothesis: LinkedHypothesis }) {
  const statusColors = {
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-gray-50 text-gray-600 border-gray-200",
    risky: "bg-red-50 text-red-700 border-red-200",
  }
  const statusLabel = {
    verified: "\u6210\u7ACB",
    pending: "\u5F85\u51B3\u8BAE",
    risky: "\u4E0D\u6210\u7ACB",
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
      <Link2 className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#2563EB] truncate">{hypothesis.title}</p>
      </div>
      <Badge className={cn("text-[10px] shrink-0", statusColors[hypothesis.status])}>{statusLabel[hypothesis.status]}</Badge>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Point Card (value / risk)                                          */
/* ------------------------------------------------------------------ */
function PointCard({
  title,
  type,
  evidence,
  analysis,
  comments,
}: {
  title: string
  type: "value" | "risk"
  evidence: TermValuePoint["evidence"]
  analysis: TermValuePoint["analysis"]
  comments: TermValuePoint["comments"]
}) {
  const borderColor = type === "value" ? "border-l-emerald-500" : "border-l-amber-500"
  const headerColor = type === "value" ? "text-emerald-700" : "text-amber-700"

  return (
    <div className={cn("rounded-lg border border-[#E5E7EB] bg-white border-l-4", borderColor)}>
      <div className="p-5">
        <h4 className={cn("text-sm font-semibold mb-3", headerColor)}>{title}</h4>

        {/* Evidence */}
        <div className="mb-4">
          <h5 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">{"\u8BBA\u636E\u652F\u6301"}</h5>
          <p className="text-sm text-[#374151] leading-relaxed mb-2">{evidence.description}</p>
          {evidence.files.length > 0 && (
            <div className="space-y-2 mb-2">
              {evidence.files.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2.5 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
                  <FileText className="h-4 w-4 text-[#6B7280] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#374151] truncate">{file.name}</p>
                    <p className="text-xs text-[#9CA3AF]">{file.size}{" \u00b7 "}{file.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Linked Hypotheses */}
          {evidence.linkedHypotheses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#6B7280]">{"\u5173\u8054\u5047\u8BBE:"}</p>
              {evidence.linkedHypotheses.map((h) => (
                <LinkedHypothesisTag key={h.id} hypothesis={h} />
              ))}
            </div>
          )}
        </div>

        {/* Analysis */}
        <div>
          <h5 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">{"\u8BBA\u8BC1\u5206\u6790"}</h5>
          <div className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <p className="text-sm text-[#374151] leading-relaxed">{analysis.content}</p>
          </div>
          <AuthorRow creator={analysis.creator} reviewers={analysis.reviewers} createdAt={analysis.createdAt} />
        </div>

        <CommentSection comments={comments} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Decision Card                                                      */
/* ------------------------------------------------------------------ */
function DecisionCard({
  title,
  conclusion,
  status,
  content,
  creator,
  reviewers,
  createdAt,
  comments,
}: {
  title: string
  conclusion: string
  status: string
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}) {
  const statusColors: Record<string, string> = {
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    pending: "bg-gray-50 text-gray-600 border-gray-200",
  }
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white border-l-4 border-l-[#2563EB]">
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-[#111827]">{title}</h4>
          <Badge className={cn("text-xs", statusColors[status] || statusColors.pending)}>{conclusion}</Badge>
        </div>
        {content && (
          <div className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-3 mb-2">
            <p className="text-sm text-[#374151] leading-relaxed">{content}</p>
          </div>
        )}
        <AuthorRow creator={creator} reviewers={reviewers} createdAt={createdAt} />
        <CommentSection comments={comments} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail Panel                                                       */
/* ------------------------------------------------------------------ */
function DetailPanel({ detail }: { detail: TermDetail }) {
  const statusBadgeColors: Record<string, string> = {
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
    rejected: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
    pending: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50",
  }
  const statusDotColors: Record<string, string> = {
    approved: "bg-emerald-500",
    rejected: "bg-red-500",
    pending: "bg-gray-400",
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-8 py-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-[#6B7280]">
          <span className="hover:text-[#374151] cursor-pointer">{"\u9879\u76EE\u5E93"}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="hover:text-[#374151] cursor-pointer">MiniMax</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#374151] font-medium">{"\u6761\u6B3E\u6E05\u5355"}</span>
        </div>

        {/* Header Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 mr-4">
              <h2 className="text-lg font-semibold text-[#111827]">{detail.title}</h2>
              <p className="mt-1.5 text-sm text-[#6B7280]">
                {"ID: "}{detail.termId}{" | "}{"\u521B\u5EFA\u65F6\u95F4: "}{detail.createdAt}{" | "}{"\u66F4\u65B0\u65F6\u95F4: "}{detail.updatedAt}
              </p>
              {detail.creator && detail.creator.name && (
                <div className="mt-2">
                  <AvatarChip person={detail.creator} label={"\u521B\u5EFA\u8005:"} />
                </div>
              )}
            </div>
            <Badge className={cn("shrink-0", statusBadgeColors[detail.status] || statusBadgeColors.pending)}>
              <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full", statusDotColors[detail.status] || statusDotColors.pending)} />
              {statusLabels[detail.status]}
            </Badge>
          </div>
          {detail.description && (
            <p className="mt-3 text-sm text-[#374151] leading-relaxed border-t border-[#E5E7EB] pt-3">{detail.description}</p>
          )}
        </div>

        {/* Value Points */}
        <div>
          <h3 className="text-base font-semibold text-[#111827] mb-4 flex items-center gap-2">
            <span className="inline-block h-5 w-1 rounded-full bg-emerald-500" />
            {"\u4EF7\u503C\u70B9"}
          </h3>
          <div className="space-y-4">
            {detail.valuePoints.map((vp) => (
              <PointCard key={vp.id} title={vp.title} type="value" evidence={vp.evidence} analysis={vp.analysis} comments={vp.comments} />
            ))}
          </div>
        </div>

        {/* Risk Points */}
        <div>
          <h3 className="text-base font-semibold text-[#111827] mb-4 flex items-center gap-2">
            <span className="inline-block h-5 w-1 rounded-full bg-amber-500" />
            {"\u98CE\u9669\u70B9"}
          </h3>
          <div className="space-y-4">
            {detail.riskPoints.length > 0 ? (
              detail.riskPoints.map((rp) => (
                <PointCard key={rp.id} title={rp.title} type="risk" evidence={rp.evidence} analysis={rp.analysis} comments={rp.comments} />
              ))
            ) : (
              <p className="text-sm text-[#9CA3AF] italic">{"\u6682\u65E0\u98CE\u9669\u70B9"}</p>
            )}
          </div>
        </div>

        {/* Committee Decision */}
        <div>
          <h3 className="text-base font-semibold text-[#111827] mb-4 flex items-center gap-2">
            <span className="inline-block h-5 w-1 rounded-full bg-[#2563EB]" />
            {"\u6295\u59D4\u51B3\u8BAE"}
          </h3>
          <DecisionCard
            title={"\u6295\u59D4\u4F1A\u5BA1\u8BAE\u7ED3\u679C"}
            conclusion={detail.committeeDecision.conclusion}
            status={detail.committeeDecision.status}
            content={detail.committeeDecision.content}
            creator={detail.committeeDecision.creator}
            reviewers={detail.committeeDecision.reviewers}
            createdAt={detail.committeeDecision.createdAt}
            comments={detail.committeeDecision.comments}
          />
        </div>
      </div>
    </ScrollArea>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */
function EmptyPlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center h-full">
      <div className="text-center text-[#9CA3AF]">
        <FileCheck className="mx-auto h-12 w-12 mb-3 text-[#D1D5DB]" />
        <p className="text-sm">{"\u70B9\u51FB\u5DE6\u4FA7\u6761\u6B3E\u4EE5\u67E5\u770B\u8BE6\u60C5"}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export function TermSheet() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [middleCollapsed, setMiddleCollapsed] = useState(false)
  const [middleExpanded, setMiddleExpanded] = useState(false)

  const detail = selectedId ? termDetailsMap[selectedId] ?? null : null
  const hasSelection = selectedId !== null

  function handleSelect(id: string) {
    setSelectedId(id)
    setMiddleCollapsed(false)
    setMiddleExpanded(false)
  }

  function handleExpandRight() {
    setMiddleExpanded(!middleExpanded)
  }

  return (
    <div className="flex h-full">
      {/* Middle Panel: Term Tree */}
      <div
        className={cn(
          "shrink-0 border-r border-[#E5E7EB] bg-white transition-all duration-200 flex flex-col",
          hasSelection
            ? middleCollapsed
              ? "w-12"
              : middleExpanded
                ? "flex-1"
                : "w-[340px]"
            : "flex-1"
        )}
      >
        {/* Header */}
        <div className="border-b border-[#E5E7EB] p-4 flex items-center gap-2">
          {(!hasSelection || !middleCollapsed) && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-[#111827]">{"\u6761\u6B3E\u6E05\u5355"}</h2>
                <button className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8]">
                  <Plus className="h-3.5 w-3.5" />
                  {"\u521B\u5EFA\u6761\u6B3E"}
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  placeholder={"\u641C\u7D22\u6761\u6B3E..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-sm h-9 border-[#E5E7EB]"
                />
              </div>
            </div>
          )}
          {hasSelection && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setMiddleCollapsed(!middleCollapsed)
                  if (!middleCollapsed) setMiddleExpanded(false)
                }}
                className="flex items-center justify-center rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
                title={middleCollapsed ? "\u5C55\u5F00\u6761\u6B3E\u5217\u8868" : "\u6536\u8D77\u6761\u6B3E\u5217\u8868"}
              >
                {middleCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
              {!middleCollapsed && (
                <button
                  onClick={handleExpandRight}
                  className="flex items-center justify-center rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
                  title={middleExpanded ? "\u663E\u793A\u6761\u6B3E\u8BE6\u60C5" : "\u5C55\u5F00\u6761\u6B3E\u5217\u8868"}
                >
                  {middleExpanded ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tree content */}
        {(!hasSelection || !middleCollapsed) && (
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {termTree.map((node) => (
                <TreeNode key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={handleSelect} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Right Panel: Detail */}
      {hasSelection && !middleExpanded && (
        <div className="flex-1 bg-[#F3F4F6] overflow-hidden">
          {detail ? <DetailPanel detail={detail} /> : <EmptyPlaceholder />}
        </div>
      )}
    </div>
  )
}
