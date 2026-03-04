"use client"

import { useState } from "react"
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
interface HypothesisNode {
  id: string
  label: string
  fullName?: string
  status: "verified" | "pending" | "risky"
  children?: HypothesisNode[]
}

interface PersonInfo {
  name: string
  role: string
  avatar?: string
}

interface ValuePoint {
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

interface RiskPoint {
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

interface CommitteeDecision {
  conclusion: string
  status: "approved" | "rejected" | "pending"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface Verification {
  conclusion: string
  status: "confirmed" | "invalidated" | "pending"
  content: string
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
  comments: { author: string; content: string; time: string }[]
}

interface LinkedTerm {
  id: string
  title: string
  termId: string
  status: "approved" | "pending" | "rejected"
}

interface HypothesisDetail {
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
const hypothesisTree: HypothesisNode[] = [
  {
    id: "team",
    label: "\u56E2\u961F\u4E0E\u7EC4\u7EC7\u80FD\u529B",
    status: "verified",
    children: [
      {
        id: "founder",
        label: "\u521B\u59CB\u4EBA\u95EB\u4FCA\u6770",
        status: "verified",
        children: [
          {
            id: "tech-bg",
            label: "\u6280\u672F\u80CC\u666F",
            fullName: "\u521B\u59CB\u4EBA\u95EB\u4FCA\u6770\u5177\u6709\u624E\u5B9E\u7684\u4EBA\u5DE5\u667A\u80FD\u5B66\u672F\u80CC\u666F",
            status: "verified",
          },
          {
            id: "biz-exp",
            label: "\u5546\u4E1A\u7ECF\u9A8C",
            fullName: "\u521B\u59CB\u4EBA\u5177\u5907\u4E30\u5BCC\u7684AI\u4EA7\u54C1\u5546\u4E1A\u5316\u7ECF\u9A8C",
            status: "pending",
          },
          {
            id: "leadership",
            label: "\u9886\u5BFC\u529B",
            fullName: "\u521B\u59CB\u4EBA\u5C55\u73B0\u51FA\u5F3A\u5927\u7684\u56E2\u961F\u51DD\u805A\u529B\u548C\u6218\u7565\u89C4\u5212\u80FD\u529B",
            status: "pending",
          },
        ],
      },
      {
        id: "core-team",
        label: "\u6838\u5FC3\u56E2\u961F",
        status: "pending",
        children: [
          {
            id: "tech-team",
            label: "\u6280\u672F\u56E2\u961F",
            fullName: "\u6280\u672F\u56E2\u961F\u5728\u5927\u6A21\u578B\u8BAD\u7EC3\u548C\u63A8\u7406\u4F18\u5316\u65B9\u9762\u5177\u5907\u4E1A\u754C\u9886\u5148\u6C34\u5E73",
            status: "pending",
          },
          {
            id: "market-team",
            label: "\u5E02\u573A\u56E2\u961F",
            fullName: "\u5E02\u573A\u56E2\u961F\u62E5\u6709\u6DF1\u539A\u7684\u4F01\u4E1A\u5BA2\u6237\u8D44\u6E90\u548C\u6E20\u9053\u7F51\u7EDC",
            status: "pending",
          },
        ],
      },
    ],
  },
  {
    id: "market",
    label: "\u5E02\u573A\u673A\u4F1A",
    status: "pending",
    children: [
      {
        id: "market-size",
        label: "\u5E02\u573A\u89C4\u6A21",
        status: "pending",
        children: [
          {
            id: "tam",
            label: "TAM",
            fullName: "\u5168\u7403\u5927\u6A21\u578B\u5E02\u573A\u89C4\u6A21\u5C06\u57282027\u5E74\u8FBE\u52301500\u4EBF\u7F8E\u5143",
            status: "pending",
          },
          {
            id: "sam",
            label: "SAM",
            fullName: "\u4E2D\u56FD\u5E02\u573A\u5360\u5168\u7403\u5927\u6A21\u578B\u5E02\u573A\u4EFD\u989D\u768425%\u4EE5\u4E0A",
            status: "pending",
          },
        ],
      },
    ],
  },
  {
    id: "business",
    label: "\u5546\u4E1A\u6A21\u5F0F",
    status: "pending",
    children: [
      {
        id: "revenue-model",
        label: "\u6536\u5165\u6A21\u5F0F",
        status: "pending",
        children: [
          {
            id: "api-pricing",
            label: "API\u8BA1\u8D39",
            fullName: "API\u8C03\u7528\u6309\u91CF\u8BA1\u8D39\u6A21\u5F0F\u80FD\u591F\u5B9E\u73B0\u53EF\u6301\u7EED\u7684\u6536\u5165\u589E\u957F",
            status: "pending",
          },
          {
            id: "enterprise-license",
            label: "\u4F01\u4E1A\u8BB8\u53EF",
            fullName: "\u4F01\u4E1A\u7EA7\u8BB8\u53EF\u8BA2\u9605\u6A21\u5F0F\u5177\u6709\u9AD8\u5BA2\u5355\u4EF7\u548C\u5F3A\u7C98\u6027\u7279\u5F81",
            status: "pending",
          },
        ],
      },
      {
        id: "competitive-moat",
        label: "\u7ADE\u4E89\u58C1\u5792",
        status: "risky",
        children: [
          {
            id: "data-moat",
            label: "\u6570\u636E\u58C1\u5792",
            fullName: "\u81EA\u6709\u8BAD\u7EC3\u6570\u636E\u548C\u7528\u6237\u53CD\u9988\u6570\u636E\u6784\u6210\u6709\u6548\u7684\u6570\u636E\u58C1\u5792",
            status: "risky",
          },
          {
            id: "tech-moat",
            label: "\u6280\u672F\u58C1\u5792",
            fullName: "\u6A21\u578B\u8BAD\u7EC3\u548C\u63A8\u7406\u4F18\u5316\u6280\u672F\u5F62\u6210\u663E\u8457\u7684\u6280\u672F\u58C1\u5792",
            status: "pending",
          },
        ],
      },
      {
        id: "unit-economics",
        label: "\u5355\u4F4D\u7ECF\u6D4E\u6A21\u578B",
        status: "pending",
        children: [
          {
            id: "ltv-cac",
            label: "LTV/CAC",
            fullName: "\u5BA2\u6237\u751F\u547D\u5468\u671F\u4EF7\u503C\u4E0E\u83B7\u5BA2\u6210\u672C\u6BD4\u7387\u8FBE\u52303:1\u4EE5\u4E0A",
            status: "pending",
          },
        ],
      },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Mock data - details                                                */
/* ------------------------------------------------------------------ */
const detailsMap: Record<string, HypothesisDetail> = {
  "tech-bg": {
    id: "tech-bg",
    title: "\u521B\u59CB\u4EBA\u95EB\u4FCA\u6770\u5177\u6709\u624E\u5B9E\u7684\u4EBA\u5DE5\u667A\u80FD\u5B66\u672F\u80CC\u666F",
    qaId: "QA-2024-001",
    createdAt: "2024-01-15",
    updatedAt: "2024-01-20",
    status: "verified",
    creator: PEOPLE.zhangwei,
    valuePoints: [
      {
        id: "vp1",
        title: "\u4EF7\u503C\u70B91",
        evidence: {
          description: "\u521B\u59CB\u4EBA\u62E5\u6709\u535A\u58EB\u5B66\u4F4D\uFF0C\u5728AI\u9886\u57DF\u53D1\u8868\u8FC715\u7BC7\u9AD8\u8D28\u91CF\u5B66\u672F\u8BBA\u6587",
          files: [
            { name: "\u95EB\u4FCA\u6770_CV.pdf", size: "2.4 MB", date: "2024-01-18" },
            { name: "Google Scholar \u5F15\u7528\u6570\u636E.xlsx", size: "1.8 MB", date: "2024-01-19" },
          ],
        },
        analysis: {
          content: "\u521B\u59CB\u4EBA\u62E5\u6709\u535A\u58EB\u5B66\u4F4D\uFF0C\u4E3A\u8BE5\u9886\u57DF\u9AD8\u5B66\u5386\u4EBA\u624D\u3002\u5728\u4EBA\u5DE5\u667A\u80FD\u9886\u57DF\u53D1\u8868\u8FC715\u7BC7\u9AD8\u8D28\u91CF\u5B66\u672F\u8BBA\u6587\uFF0C\u5176\u4E2D5\u7BC7\u53D1\u8868\u5728\u9876\u7EA7\u671F\u520A\u4E0A\u3002\u66FE\u83B7\u5F97\u56FD\u5BB6\u81EA\u7136\u79D1\u5B66\u57FA\u91D1\u9752\u5E74\u9879\u76EE\u8D44\u52A9\uFF0C\u5177\u5907\u624E\u5B9E\u7684\u7406\u8BBA\u57FA\u7840\u548C\u7814\u7A76\u80FD\u529B\u3002",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi, PEOPLE.wangwu, PEOPLE.chenzong],
          createdAt: "2024-01-18",
        },
        comments: [
          { author: "\u738B\u4E94", content: "\u5EFA\u8BAE\u8865\u5145\u521B\u59CB\u4EBA\u5728\u5DE5\u4E1A\u754C\u7684\u5B9E\u9645\u9879\u76EE\u7ECF\u9A8C\u8D44\u6599", time: "2024-01-19 14:30" },
        ],
      },
      {
        id: "vp2",
        title: "\u4EF7\u503C\u70B92",
        evidence: {
          description: "\u5728Google Scholar\u4E0A\u7684H\u6307\u6570\u4E3A8\uFF0C\u603B\u5F15\u7528\u6B21\u6570\u8D85\u8FC7500\u6B21\uFF0C\u8BC1\u660E\u5176\u7814\u7A76\u6210\u679C\u5177\u6709\u8F83\u9AD8\u7684\u5B66\u672F\u5F71\u54CD\u529B",
          files: [
            { name: "\u5B66\u672F\u5F71\u54CD\u529B\u62A5\u544A.pdf", size: "3.1 MB", date: "2024-01-19" },
          ],
        },
        analysis: {
          content: "H\u6307\u6570\u8FBE\u52308\uFF0C\u5728\u540C\u9F84\u5B66\u8005\u4E2D\u5904\u4E8E\u8F83\u9AD8\u6C34\u5E73\u3002\u5176\u7814\u7A76\u6210\u679C\u88AB\u591A\u5BB6\u77E5\u540D\u4F01\u4E1A\u5F15\u7528\u5E76\u5E94\u7528\u4E8E\u5B9E\u9645\u4EA7\u54C1\u4E2D\uFF0C\u8BC1\u660E\u5176\u5B66\u672F\u7814\u7A76\u5177\u6709\u5F88\u9AD8\u7684\u5B9E\u7528\u4EF7\u503C\u3002",
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
        title: "\u98CE\u9669\u70B91",
        evidence: {
          description: "\u5B66\u672F\u80CC\u666F\u8F83\u5F3A\u4F46\u5546\u4E1A\u8F6C\u5316\u7ECF\u9A8C\u76F8\u5BF9\u6709\u9650\uFF0C\u9700\u5173\u6CE8\u4ECE\u5B66\u672F\u5230\u4EA7\u4E1A\u7684\u8FC7\u6E21\u80FD\u529B",
          files: [
            { name: "\u884C\u4E1A\u5BF9\u6807\u5206\u6790.pdf", size: "1.5 MB", date: "2024-01-20" },
          ],
        },
        analysis: {
          content: "\u521B\u59CB\u4EBA\u5728\u5546\u4E1A\u5316\u65B9\u9762\u7684\u7ECF\u9A8C\u4E3B\u8981\u96C6\u4E2D\u5728\u6280\u672F\u8F6C\u8BA9\u548C\u4E13\u5229\u6388\u6743\u9886\u57DF\uFF0C\u5C1A\u672A\u6709\u8FC7\u5B8C\u6574\u7684\u4EA7\u54C1\u5546\u4E1A\u5316\u7ECF\u5386\u3002\u5EFA\u8BAE\u5173\u6CE8\u5176\u56E2\u961F\u4E2D\u662F\u5426\u6709\u5F3A\u6709\u529B\u7684\u5546\u4E1A\u8FD0\u8425\u642D\u6863\u8865\u8DB3\u8FD9\u4E00\u77ED\u677F\u3002",
          creator: PEOPLE.lisi,
          reviewers: [PEOPLE.zhangwei, PEOPLE.wangwu],
          createdAt: "2024-01-20",
        },
        comments: [
          { author: "\u5F20\u4F1F", content: "\u540C\u610F\u8FD9\u4E00\u98CE\u9669\u8BC4\u4F30\uFF0CCOO\u5F20\u9E23\u7684\u52A0\u5165\u5728\u4E00\u5B9A\u7A0B\u5EA6\u4E0A\u5F25\u8865\u4E86\u8FD9\u4E00\u7F3A\u9677", time: "2024-01-20 16:00" },
        ],
      },
    ],
    committeeDecision: {
      conclusion: "\u5047\u8BBE\u6210\u7ACB",
      status: "approved",
      content: "\u7ECF\u6295\u59D4\u4F1A\u5BA1\u8BAE\uFF0C\u521B\u59CB\u4EBA\u7684\u5B66\u672F\u80CC\u666F\u5F97\u5230\u5145\u5206\u9A8C\u8BC1\uFF0C\u5176\u5728AI\u9886\u57DF\u7684\u7814\u7A76\u6DF1\u5EA6\u548C\u5F71\u54CD\u529B\u5747\u8FBE\u5230\u884C\u4E1A\u9886\u5148\u6C34\u5E73\u3002\u867D\u7136\u5546\u4E1A\u5316\u7ECF\u9A8C\u5B58\u5728\u4E00\u5B9A\u98CE\u9669\uFF0C\u4F46\u56E2\u961F\u6574\u4F53\u914D\u7F6E\u53EF\u4EE5\u5F25\u8865\u3002\u5EFA\u8BAE\u6301\u7EED\u8DDF\u8E2A\u5176\u5546\u4E1A\u5316\u8FDB\u5C55\u3002",
      creator: PEOPLE.wangzong,
      reviewers: [PEOPLE.chenzong, PEOPLE.zhangwei, PEOPLE.lisi],
      createdAt: "2024-01-22",
      comments: [
        { author: "\u5F20\u4F1F", content: "\u540C\u610F\u6295\u59D4\u7ED3\u8BBA\uFF0C\u5EFA\u8BAE\u5728\u6761\u6B3E\u4E2D\u52A0\u5165\u521B\u59CB\u4EBA\u7AB6\u4E1A\u7981\u6B62\u6761\u6B3E", time: "2024-01-22 15:00" },
      ],
    },
    verification: {
      conclusion: "\u5047\u8BBE\u5DF2\u9A8C\u8BC1",
      status: "confirmed",
      content: "\u6295\u8D44\u540E6\u4E2A\u6708\u8DDF\u8E2A\u663E\u793A\uFF0C\u521B\u59CB\u4EBA\u7684\u5B66\u672F\u80CC\u666F\u4E3A\u516C\u53F8\u62DB\u52DF\u9876\u7EA7\u4EBA\u624D\u63D0\u4F9B\u4E86\u91CD\u8981\u80CC\u4E66\uFF0C\u5DF2\u6210\u529F\u5438\u5F15\u591A\u540D\u9876\u7EA7\u5B66\u8005\u52A0\u5165\u3002\u6280\u672F\u56E2\u961F\u5728\u5927\u6A21\u578B\u8BAD\u7EC3\u4F18\u5316\u65B9\u9762\u53D6\u5F97\u7A81\u7834\u6027\u8FDB\u5C55\uFF0C\u4E0E\u521B\u59CB\u4EBA\u7684\u5B66\u672F\u79EF\u7D2F\u5BC6\u5207\u76F8\u5173\u3002",
      creator: PEOPLE.zhangwei,
      reviewers: [PEOPLE.lisi, PEOPLE.wangwu],
      createdAt: "2024-07-15",
      comments: [],
    },
    linkedTerms: [
      { id: "board-seat", title: "\u6295\u8D44\u65B9\u6709\u6743\u59D4\u6D3E\u4E00\u540D\u8463\u4E8B\u8FDB\u5165\u516C\u53F8\u8463\u4E8B\u4F1A", termId: "TM-2024-001", status: "approved" },
      { id: "observer-right", title: "\u6295\u8D44\u65B9\u6709\u6743\u59D4\u6D3E\u4E00\u540D\u89C2\u5BDF\u5458\u5217\u5E2D\u8463\u4E8B\u4F1A\u4F1A\u8BAE", termId: "TM-2024-002", status: "approved" },
    ],
  },
  "biz-exp": {
    id: "biz-exp",
    title: "\u521B\u59CB\u4EBA\u5177\u5907\u4E30\u5BCC\u7684AI\u4EA7\u54C1\u5546\u4E1A\u5316\u7ECF\u9A8C",
    qaId: "QA-2024-002",
    createdAt: "2024-01-16",
    updatedAt: "2024-01-21",
    status: "pending",
    creator: PEOPLE.lisi,
    valuePoints: [
      {
        id: "vp1",
        title: "\u4EF7\u503C\u70B91",
        evidence: {
          description: "\u66FE\u5728\u77E5\u540D\u79D1\u6280\u516C\u53F8\u62C5\u4EFB\u6280\u672F\u4E13\u5BB6\uFF0C\u53C2\u4E0E\u8FC7\u591A\u4E2AAI\u4EA7\u54C1\u7684\u7814\u53D1\u548C\u843D\u5730",
          files: [],
        },
        analysis: {
          content: "\u521B\u59CB\u4EBA\u5728\u5546\u4E1A\u5316\u65B9\u9762\u7684\u7ECF\u9A8C\u4E3B\u8981\u6765\u81EA\u4E8E\u5728\u5927\u578B\u79D1\u6280\u516C\u53F8\u7684\u5DE5\u4F5C\u7ECF\u5386\uFF0C\u4F46\u72EC\u7ACB\u521B\u4E1A\u7ECF\u9A8C\u6709\u9650\u3002",
          creator: PEOPLE.zhangwei,
          reviewers: [PEOPLE.lisi],
          createdAt: "2024-01-17",
        },
        comments: [],
      },
    ],
    riskPoints: [],
    committeeDecision: {
      conclusion: "\u5F85\u5BA1\u8BAE",
      status: "pending",
      content: "\u5C1A\u672A\u5F00\u59CB\u6295\u59D4\u5BA1\u8BAE",
      creator: { name: "", role: "" },
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "\u5F85\u9A8C\u8BC1",
      status: "pending",
      content: "\u5C1A\u672A\u8FDB\u5165\u9A8C\u8BC1\u9636\u6BB5",
      creator: { name: "", role: "" },
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [],
  },
  "data-moat": {
    id: "data-moat",
    title: "\u81EA\u6709\u8BAD\u7EC3\u6570\u636E\u548C\u7528\u6237\u53CD\u9988\u6570\u636E\u6784\u6210\u6709\u6548\u7684\u6570\u636E\u58C1\u5792",
    qaId: "QA-2024-008",
    createdAt: "2024-02-01",
    updatedAt: "2024-02-10",
    status: "risky",
    creator: PEOPLE.lisi,
    valuePoints: [
      {
        id: "vp1",
        title: "\u4EF7\u503C\u70B91",
        evidence: {
          description: "\u5DF2\u79EF\u7D2F\u8D85\u8FC710TB\u7684\u4E13\u6709\u8BAD\u7EC3\u6570\u636E\uFF0C\u5305\u542B\u591A\u4E2A\u5782\u76F4\u9886\u57DF\u7684\u9AD8\u8D28\u91CF\u6807\u6CE8\u6570\u636E",
          files: [
            { name: "\u6570\u636E\u8D44\u4EA7\u6E05\u5355.xlsx", size: "0.5 MB", date: "2024-02-05" },
          ],
        },
        analysis: {
          content: "\u516C\u53F8\u901A\u8FC7\u4E0E\u591A\u5BB6\u4F01\u4E1A\u5BA2\u6237\u7684\u5408\u4F5C\u79EF\u7D2F\u4E86\u5927\u91CF\u884C\u4E1A\u7279\u6709\u6570\u636E\uFF0C\u8FD9\u4E9B\u6570\u636E\u5177\u6709\u8F83\u9AD8\u7684\u58C1\u5792\u4EF7\u503C\u3002",
          creator: PEOPLE.lisi,
          reviewers: [PEOPLE.zhangwei, PEOPLE.chenzong],
          createdAt: "2024-02-06",
        },
        comments: [],
      },
    ],
    riskPoints: [
      {
        id: "rp1",
        title: "\u98CE\u9669\u70B91",
        evidence: {
          description: "\u6570\u636E\u5408\u89C4\u98CE\u9669\u8F83\u9AD8\uFF0C\u90E8\u5206\u6570\u636E\u7684\u91C7\u96C6\u548C\u4F7F\u7528\u53EF\u80FD\u5B58\u5728\u6CD5\u5F8B\u4E89\u8BAE",
          files: [],
        },
        analysis: {
          content: "\u9700\u8981\u5BF9\u6570\u636E\u6765\u6E90\u548C\u4F7F\u7528\u6743\u9650\u8FDB\u884C\u5168\u9762\u5BA1\u67E5\uFF0C\u786E\u4FDD\u5408\u89C4\u6027\u3002",
          creator: PEOPLE.zhaoliu,
          reviewers: [PEOPLE.chenzong, PEOPLE.wangwu],
          createdAt: "2024-02-08",
        },
        comments: [
          { author: "\u9648\u603B", content: "\u5EFA\u8BAE\u5F15\u5165\u7B2C\u4E09\u65B9\u6CD5\u5F8B\u56E2\u961F\u8FDB\u884C\u6570\u636E\u5408\u89C4\u5BA1\u67E5", time: "2024-02-09 10:00" },
        ],
      },
    ],
    committeeDecision: {
      conclusion: "\u5F85\u5BA1\u8BAE",
      status: "pending",
      content: "\u6570\u636E\u58C1\u5792\u5047\u8BBE\u9700\u5F85\u6570\u636E\u5408\u89C4\u5BA1\u67E5\u5B8C\u6210\u540E\u518D\u884C\u5BA1\u8BAE",
      creator: { name: "", role: "" },
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    verification: {
      conclusion: "\u5F85\u9A8C\u8BC1",
      status: "pending",
      content: "\u5C1A\u672A\u8FDB\u5165\u9A8C\u8BC1\u9636\u6BB5",
      creator: { name: "", role: "" },
      reviewers: [],
      createdAt: "",
      comments: [],
    },
    linkedTerms: [
      { id: "weighted-avg", title: "\u540E\u7EED\u4F4E\u4EF7\u878D\u8D44\u65F6\u6295\u8D44\u65B9\u4EAB\u6709\u52A0\u6743\u5E73\u5747\u53CD\u7A00\u91CA\u8C03\u6574\u6743", termId: "TM-2024-005", status: "pending" },
    ],
  },
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
function statusDot(status: "verified" | "pending" | "risky") {
  const colors = { verified: "bg-emerald-500", pending: "bg-gray-300", risky: "bg-red-500" }
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", colors[status])} />
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

function AvatarChipGroup({
  people,
  label,
}: {
  people: PersonInfo[]
  label?: string
}) {
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
/*  Tree Node (uniform expandable for all levels)                      */
/* ------------------------------------------------------------------ */
function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: HypothesisNode
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
          isSelected
            ? "bg-[#EFF6FF] text-[#2563EB] font-medium"
            : "text-[#374151] hover:bg-[#F3F4F6]",
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
        <Input
          placeholder={"\u6DFB\u52A0\u8BC4\u8BBA..."}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="text-sm h-8 border-[#E5E7EB]"
        />
        <Button size="sm" variant="outline" className="h-8 px-2.5 shrink-0">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Author Row with Avatar Chips                                       */
/* ------------------------------------------------------------------ */
function AuthorRow({
  creator,
  reviewers,
  createdAt,
}: {
  creator: PersonInfo
  reviewers: PersonInfo[]
  createdAt: string
}) {
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
/*  Value / Risk Point Card                                            */
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
  evidence: ValuePoint["evidence"]
  analysis: ValuePoint["analysis"]
  comments: ValuePoint["comments"]
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
            <div className="space-y-2">
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
/*  Decision / Verification Card                                       */
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
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    invalidated: "bg-red-50 text-red-700 border-red-200",
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
/*  Detail Panel (right)                                               */
/* ------------------------------------------------------------------ */
function DetailPanel({ detail }: { detail: HypothesisDetail }) {
  return (
    <ScrollArea className="h-full">
      <div className="px-8 py-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-[#6B7280]">
          <span className="hover:text-[#374151] cursor-pointer">{"\u9879\u76EE\u5E93"}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="hover:text-[#374151] cursor-pointer">MiniMax</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#374151] font-medium">{"\u5047\u8BBE\u6E05\u5355"}</span>
        </div>

        {/* Header Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 mr-4">
              <h2 className="text-lg font-semibold text-[#111827]">{detail.title}</h2>
              <p className="mt-1.5 text-sm text-[#6B7280]">
                {"ID: "}{detail.qaId}{" | "}{"\u521B\u5EFA\u65F6\u95F4: "}{detail.createdAt}{" | "}{"\u66F4\u65B0\u65F6\u95F4: "}{detail.updatedAt}
              </p>
              {detail.creator && detail.creator.name && (
                <div className="mt-2">
                  <AvatarChip person={detail.creator} label={"\u521B\u5EFA\u8005:"} />
                </div>
              )}
            </div>
            <Badge
              className={cn(
                "shrink-0",
                detail.status === "verified"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  :                 detail.status === "risky"
                    ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-50"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              <span
                className={cn(
                  "mr-1 inline-block h-1.5 w-1.5 rounded-full",
                  detail.status === "verified" ? "bg-emerald-500" : detail.status === "risky" ? "bg-red-500" : "bg-gray-400"
                )}
              />
              {detail.status === "verified" ? "\u6210\u7ACB" : detail.status === "risky" ? "\u4E0D\u6210\u7ACB" : "\u5F85\u51B3\u8BAE"}
            </Badge>
          </div>
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

        {/* Verification */}
        <div>
          <h3 className="text-base font-semibold text-[#111827] mb-4 flex items-center gap-2">
            <span className="inline-block h-5 w-1 rounded-full bg-violet-500" />
            {"\u9A8C\u8BC1\u60C5\u51B5"}
          </h3>
          <DecisionCard
            title={"\u6295\u540E\u9A8C\u8BC1\u8BC4\u4F30"}
            conclusion={detail.verification.conclusion}
            status={detail.verification.status}
            content={detail.verification.content}
            creator={detail.verification.creator}
            reviewers={detail.verification.reviewers}
            createdAt={detail.verification.createdAt}
            comments={detail.verification.comments}
          />
        </div>

        {/* Cross-referenced Terms */}
        {detail.linkedTerms && detail.linkedTerms.length > 0 && (
          <div>
            <h3 className="text-base font-semibold text-[#111827] mb-4 flex items-center gap-2">
              <span className="inline-block h-5 w-1 rounded-full bg-[#6366F1]" />
              {"\u8BE5\u5047\u8BBE\u6240\u652F\u6301\u7684\u6761\u6B3E"}
            </h3>
            <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
              <div className="divide-y divide-[#E5E7EB]">
                {detail.linkedTerms.map((term) => {
                  const termStatusColors: Record<string, string> = {
                    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    pending: "bg-gray-50 text-gray-600 border-gray-200",
                    rejected: "bg-red-50 text-red-700 border-red-200",
                  }
                  const termStatusLabels: Record<string, string> = {
                    approved: "\u901A\u8FC7",
                    pending: "\u5F85\u5BA1\u8BAE",
                    rejected: "\u5426\u51B3",
                  }
                  return (
                    <div key={term.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#F9FAFB] transition-colors cursor-pointer">
                      <FileCheck className="h-4 w-4 text-[#6366F1] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">{term.title}</p>
                        <p className="text-xs text-[#9CA3AF] mt-0.5">{"ID: "}{term.termId}</p>
                      </div>
                      <Badge className={cn("text-xs shrink-0", termStatusColors[term.status])}>
                        {termStatusLabels[term.status]}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function EmptyPlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center h-full">
      <div className="text-center text-[#9CA3AF]">
        <ListChecks className="mx-auto h-12 w-12 mb-3 text-[#D1D5DB]" />
        <p className="text-sm">{"\u70B9\u51FB\u5DE6\u4FA7\u5047\u8BBE\u4EE5\u67E5\u770B\u8BE6\u60C5"}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface HypothesisChecklistProps {
  isNewProject?: boolean
  project?: { strategyId?: string; strategyName?: string }
}

export function HypothesisChecklist({ isNewProject = false, project }: HypothesisChecklistProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [middleCollapsed, setMiddleCollapsed] = useState(false)
  /* expanded = detail hidden, list takes full width */
  const [middleExpanded, setMiddleExpanded] = useState(false)

  const detail = selectedId ? detailsMap[selectedId] ?? null : null
  const hasSelection = selectedId !== null

  function handleSelect(id: string) {
    setSelectedId(id)
    setMiddleCollapsed(false)
    setMiddleExpanded(false)
  }

  function handleExpandRight() {
    setMiddleExpanded(!middleExpanded)
  }

  // For new projects without AI基础设施 strategy, show empty state
  if (isNewProject && project?.strategyId !== "1") {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <ListChecks className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">暂无假设清单</h3>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            {project?.strategyName 
              ? `该项目基于「${project.strategyName}」策略模板创建，假设清单将从策略模板中继承。`
              : "这是一个新创建的项目，还没有添加任何假设。点击下方按钮开始创建您的第一个投资假设。"
            }
          </p>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" />
            创建第一个假设
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Middle Panel: Hypothesis Tree */}
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
                <h2 className="text-base font-semibold text-[#111827]">{"\u5047\u8BBE\u6E05\u5355"}</h2>
                <button className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8]">
                  <Plus className="h-3.5 w-3.5" />
                  {"\u521B\u5EFA\u5047\u8BBE"}
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  placeholder={"\u641C\u7D22\u5047\u8BBE..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-sm h-9 border-[#E5E7EB]"
                />
              </div>
            </div>
          )}
          {hasSelection && (
            <div className="flex items-center gap-1 shrink-0">
              {/* Collapse left button */}
              <button
                onClick={() => {
                  setMiddleCollapsed(!middleCollapsed)
                  if (!middleCollapsed) setMiddleExpanded(false)
                }}
                className="flex items-center justify-center rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
                title={middleCollapsed ? "\u5C55\u5F00\u5047\u8BBE\u5217\u8868" : "\u6536\u8D77\u5047\u8BBE\u5217\u8868"}
              >
                {middleCollapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
              {/* Expand right button (only when not collapsed) */}
              {!middleCollapsed && (
                <button
                  onClick={handleExpandRight}
                  className="flex items-center justify-center rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
                  title={middleExpanded ? "\u663E\u793A\u5047\u8BBE\u8BE6\u60C5" : "\u5C55\u5F00\u5047\u8BBE\u5217\u8868"}
                >
                  {middleExpanded ? (
                    <PanelRightOpen className="h-4 w-4" />
                  ) : (
                    <PanelRightClose className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tree content */}
        {(!hasSelection || !middleCollapsed) && (
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {hypothesisTree.map((node) => (
                <TreeNode key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={handleSelect} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Right Panel: Detail (hidden when middle is expanded) */}
      {hasSelection && !middleExpanded && (
        <div className="flex-1 bg-[#F3F4F6] overflow-hidden">
          {detail ? <DetailPanel detail={detail} /> : <EmptyPlaceholder />}
        </div>
      )}
    </div>
  )
}
