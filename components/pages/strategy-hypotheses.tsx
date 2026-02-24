"use client"

import { useState } from "react"
import {
  Search,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Plus,
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
  tag?: "required" | "recommended" | "optional"
  children?: HypothesisNode[]
}

interface PersonInfo {
  name: string
  role: string
}

interface StrategyHypothesisDetail {
  id: string
  title: string
  category: string
  tag: "required" | "recommended" | "optional"
  description: string
  rationale: string
  verificationMethod: string
  relatedMetrics: string[]
  creator: PersonInfo
  comments: { author: string; content: string; time: string }[]
}

/* ------------------------------------------------------------------ */
/*  Mock people                                                        */
/* ------------------------------------------------------------------ */
const PEOPLE: Record<string, PersonInfo> = {
  zhangwei: { name: "\u5F20\u4F1F", role: "\u6295\u8D44\u7ECF\u7406" },
  lisi: { name: "\u674E\u56DB", role: "\u9AD8\u7EA7\u5206\u6790\u5E08" },
  wangwu: { name: "\u738B\u4E94", role: "\u5408\u4F19\u4EBA" },
}

/* ------------------------------------------------------------------ */
/*  Mock data - tree (no status)                                       */
/* ------------------------------------------------------------------ */
const hypothesisTree: HypothesisNode[] = [
  {
    id: "team-capability",
    label: "\u56E2\u961F\u80FD\u529B",
    children: [
      {
        id: "core-tech-team",
        label: "\u6838\u5FC3\u6280\u672F\u56E2\u961F",
        children: [
          {
            id: "sh1",
            label: "GPU\u67B6\u6784",
            fullName: "\u6838\u5FC3\u6280\u672F\u56E2\u961F\u5177\u5907GPU\u67B6\u6784\u8BBE\u8BA1\u80FD\u529B",
            tag: "required",
          },
          {
            id: "sh4",
            label: "\u6280\u672F\u8FED\u4EE3",
            fullName: "\u5177\u5907\u53EF\u6301\u7EED\u7684\u6280\u672F\u8FED\u4EE3\u80FD\u529B",
            tag: "recommended",
          },
        ],
      },
    ],
  },
  {
    id: "market-opportunity",
    label: "\u5E02\u573A\u673A\u4F1A",
    children: [
      {
        id: "market-size",
        label: "\u5E02\u573A\u89C4\u6A21",
        children: [
          {
            id: "sh2",
            label: "TAM\u8D85100\u4EBF",
            fullName: "\u76EE\u6807\u5E02\u573ATAM\u8D85\u8FC7100\u4EBF\u7F8E\u5143",
            tag: "required",
          },
        ],
      },
    ],
  },
  {
    id: "commercial-validation",
    label: "\u5546\u4E1A\u9A8C\u8BC1",
    children: [
      {
        id: "customer-validation",
        label: "\u5BA2\u6237\u9A8C\u8BC1",
        children: [
          {
            id: "sh3",
            label: "\u6807\u6746\u5BA2\u6237",
            fullName: "\u4EA7\u54C1\u5DF2\u83B7\u5F97\u6807\u6746\u5BA2\u6237\u9A8C\u8BC1",
            tag: "recommended",
          },
        ],
      },
    ],
  },
  {
    id: "financial-model",
    label: "\u8D22\u52A1\u6A21\u578B",
    children: [
      {
        id: "unit-economics",
        label: "\u5355\u4F4D\u7ECF\u6D4E",
        children: [
          {
            id: "sh5",
            label: "\u76C8\u4E8F\u5E73\u8861",
            fullName: "\u5355\u4F4D\u7ECF\u6D4E\u6A21\u578B\u53EF\u572824\u4E2A\u6708\u5185\u76C8\u4E8F\u5E73\u8861",
            tag: "optional",
          },
        ],
      },
    ],
  },
  {
    id: "risk-management",
    label: "\u8FD0\u8425\u98CE\u9669",
    children: [
      {
        id: "supply-chain",
        label: "\u4F9B\u5E94\u94FE",
        children: [
          {
            id: "sh6",
            label: "\u591A\u5143\u5316\u5E03\u5C40",
            fullName: "\u4F9B\u5E94\u94FE\u5177\u6709\u591A\u5143\u5316\u5E03\u5C40",
            tag: "optional",
          },
        ],
      },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Mock data - details                                                */
/* ------------------------------------------------------------------ */
const detailsMap: Record<string, StrategyHypothesisDetail> = {
  sh1: {
    id: "sh1",
    title: "\u6838\u5FC3\u6280\u672F\u56E2\u961F\u5177\u5907GPU\u67B6\u6784\u8BBE\u8BA1\u80FD\u529B",
    category: "\u56E2\u961F\u80FD\u529B",
    tag: "required",
    description:
      "\u6295\u8D44\u6807\u7684\u7684\u6838\u5FC3\u6280\u672F\u56E2\u961F\u5E94\u5177\u5907\u81EA\u7814GPU/AI\u82AF\u7247\u67B6\u6784\u7684\u80FD\u529B\uFF0C\u5305\u62EC\u5FAE\u67B6\u6784\u8BBE\u8BA1\u3001\u7F16\u8BD1\u5668\u4F18\u5316\u3001\u9A71\u52A8\u5F00\u53D1\u7B49\u5173\u952E\u6280\u672F\u73AF\u8282\u3002",
    rationale:
      "AI\u7B97\u529B\u82AF\u7247\u662F\u57FA\u7840\u8BBE\u65BD\u7684\u6838\u5FC3\uFF0C\u81EA\u7814\u80FD\u529B\u51B3\u5B9A\u4E86\u4F01\u4E1A\u7684\u957F\u671F\u7ADE\u4E89\u529B\u548C\u6280\u672F\u58C1\u5792\u3002\u53C2\u8003NVIDIA\u3001AMD\u7684\u53D1\u5C55\u8DEF\u5F84\uFF0C\u6838\u5FC3\u67B6\u6784\u56E2\u961F\u662F\u51B3\u5B9A\u6027\u56E0\u7D20\u3002",
    verificationMethod:
      "\u5BA1\u67E5\u56E2\u961F\u6210\u5458\u7684\u6280\u672F\u80CC\u666F\u548C\u4E13\u5229\u60C5\u51B5\uFF0C\u8BC4\u4F30\u6838\u5FC3\u67B6\u6784\u5E08\u7684\u884C\u4E1A\u7ECF\u9A8C\uFF0C\u9A8C\u8BC1\u5DF2\u6709\u4EA7\u54C1\u7684\u6027\u80FD\u6307\u6807\u3002",
    relatedMetrics: ["\u56E2\u961F\u89C4\u6A21", "\u4E13\u5229\u6570\u91CF", "\u6838\u5FC3\u4EBA\u5458\u7A33\u5B9A\u6027"],
    creator: PEOPLE.zhangwei,
    comments: [
      { author: "\u674E\u56DB", content: "\u5EFA\u8BAE\u540C\u65F6\u5173\u6CE8\u56E2\u961F\u5728\u8F6F\u4EF6\u751F\u6001\u65B9\u9762\u7684\u80FD\u529B", time: "2024-01-20 10:30" },
      { author: "\u738B\u4E94", content: "\u540C\u610F\uFF0CGPU\u67B6\u6784\u8BBE\u8BA1\u80FD\u529B\u662F\u5173\u952E\u7684\u62A4\u57CE\u6CB3", time: "2024-01-20 14:00" },
    ],
  },
  sh2: {
    id: "sh2",
    title: "\u76EE\u6807\u5E02\u573ATAM\u8D85\u8FC7100\u4EBF\u7F8E\u5143",
    category: "\u5E02\u573A\u673A\u4F1A",
    tag: "required",
    description:
      "\u76EE\u6807\u5E02\u573A\u7684\u603B\u53EF\u53CA\u5E02\u573A\u89C4\u6A21\uFF08TAM\uFF09\u5E94\u5728100\u4EBF\u7F8E\u5143\u4EE5\u4E0A\uFF0C\u5E76\u4FDD\u6301\u5E74\u574720%\u4EE5\u4E0A\u7684\u589E\u957F\u7387\uFF0C\u786E\u4FDD\u8DB3\u591F\u7684\u6210\u957F\u7A7A\u95F4\u3002",
    rationale:
      "AI\u57FA\u7840\u8BBE\u65BD\u8D5B\u9053\u5904\u4E8E\u9AD8\u901F\u589E\u957F\u671F\uFF0C\u5168\u7403AI\u82AF\u7247\u5E02\u573A\u9884\u8BA12025\u5E74\u5C06\u8FBE\u5230800\u4EBF\u7F8E\u5143\u3002\u786E\u4FDD\u6295\u8D44\u6807\u7684\u6240\u5904\u7EC6\u5206\u5E02\u573A\u5177\u6709\u8DB3\u591F\u89C4\u6A21\u3002",
    verificationMethod:
      "\u6536\u96C6\u7B2C\u4E09\u65B9\u5E02\u573A\u7814\u7A76\u62A5\u544A\uFF08Gartner\u3001IDC\u7B49\uFF09\uFF0C\u5206\u6790\u5386\u53F2\u6570\u636E\u548C\u589E\u957F\u8D8B\u52BF\uFF0C\u8FDB\u884C\u81EA\u4E0B\u800C\u4E0A\u7684\u5E02\u573A\u89C4\u6A21\u6D4B\u7B97\u3002",
    relatedMetrics: ["TAM\u89C4\u6A21", "CAGR", "\u5E02\u573A\u6E17\u900F\u7387"],
    creator: PEOPLE.lisi,
    comments: [
      { author: "\u5F20\u4F1F", content: "\u5E02\u573A\u89C4\u6A21\u9700\u8981\u533A\u5206\u8BAD\u7EC3\u548C\u63A8\u7406\u4E24\u4E2A\u7EC6\u5206\u5E02\u573A", time: "2024-01-22 09:00" },
    ],
  },
  sh3: {
    id: "sh3",
    title: "\u4EA7\u54C1\u5DF2\u83B7\u5F97\u6807\u6746\u5BA2\u6237\u9A8C\u8BC1",
    category: "\u5546\u4E1A\u9A8C\u8BC1",
    tag: "recommended",
    description:
      "\u6295\u8D44\u6807\u7684\u7684\u4EA7\u54C1\u6216\u670D\u52A1\u5E94\u5DF2\u83B7\u5F97\u81F3\u5C112-3\u4E2A\u884C\u4E1A\u6807\u6746\u5BA2\u6237\u7684\u5B9E\u9645\u4F7F\u7528\u9A8C\u8BC1\uFF0C\u8BC1\u660E\u4EA7\u54C1\u7684\u5E02\u573A\u53EF\u884C\u6027\u3002",
    rationale:
      "\u6807\u6746\u5BA2\u6237\u7684\u91C7\u7EB3\u662F\u4EA7\u54C1\u5E02\u573A\u5339\u914D\uFF08PMF\uFF09\u7684\u91CD\u8981\u6807\u5FD7\uFF0C\u80FD\u591F\u6709\u6548\u964D\u4F4E\u6280\u672F\u98CE\u9669\u548C\u5E02\u573A\u98CE\u9669\uFF0C\u540C\u65F6\u4E3A\u540E\u7EED\u5BA2\u6237\u62D3\u5C55\u63D0\u4F9B\u80CC\u4E66\u3002",
    verificationMethod:
      "\u83B7\u53D6\u5BA2\u6237\u5408\u540C\u6216\u610F\u5411\u4E66\uFF0C\u8FDB\u884C\u5BA2\u6237\u8BBF\u8C08\u4EE5\u4E86\u89E3\u4F7F\u7528\u60C5\u51B5\u548C\u6EE1\u610F\u5EA6\uFF0C\u9A8C\u8BC1\u6536\u5165\u6570\u636E\u548C\u7EED\u7EA6\u7387\u3002",
    relatedMetrics: ["\u5BA2\u6237\u6570\u91CF", "NPS\u8BC4\u5206", "\u7EED\u7EA6\u7387"],
    creator: PEOPLE.wangwu,
    comments: [],
  },
  sh4: {
    id: "sh4",
    title: "\u5177\u5907\u53EF\u6301\u7EED\u7684\u6280\u672F\u8FED\u4EE3\u80FD\u529B",
    category: "\u56E2\u961F\u80FD\u529B",
    tag: "recommended",
    description:
      "\u4F01\u4E1A\u5E94\u5C55\u793A\u51FA\u6301\u7EED\u7684\u6280\u672F\u8FED\u4EE3\u548C\u521B\u65B0\u80FD\u529B\uFF0C\u5305\u62EC\u660E\u786E\u7684\u6280\u672F\u8DEF\u7EBF\u56FE\u3001\u5B9A\u671F\u7684\u4EA7\u54C1\u66F4\u65B0\u8282\u594F\u548C\u6280\u672F\u9884\u7814\u6295\u5165\u3002",
    rationale:
      "AI\u57FA\u7840\u8BBE\u65BD\u9886\u57DF\u6280\u672F\u6F14\u8FDB\u901F\u5EA6\u5FEB\uFF0C\u6301\u7EED\u7684\u7814\u53D1\u80FD\u529B\u662F\u4FDD\u6301\u7ADE\u4E89\u4F18\u52BF\u7684\u5173\u952E\u3002\u9700\u8981\u8BC4\u4F30\u4F01\u4E1A\u7684\u7814\u53D1\u4F53\u7CFB\u548C\u521B\u65B0\u673A\u5236\u3002",
    verificationMethod:
      "\u5BA1\u67E5\u6280\u672F\u8DEF\u7EBF\u56FE\u548C\u7814\u53D1\u8BA1\u5212\uFF0C\u8BC4\u4F30\u7814\u53D1\u6295\u5165\u5360\u6BD4\uFF0C\u5206\u6790\u4EA7\u54C1\u8FED\u4EE3\u5386\u53F2\u548C\u901F\u5EA6\u3002",
    relatedMetrics: ["\u7814\u53D1\u6295\u5165\u5360\u6BD4", "\u4EA7\u54C1\u7248\u672C\u8FED\u4EE3\u9891\u7387", "\u6280\u672F\u4E13\u5229\u589E\u901F"],
    creator: PEOPLE.zhangwei,
    comments: [
      { author: "\u674E\u56DB", content: "\u5EFA\u8BAE\u5173\u6CE8\u6280\u672F\u8DEF\u7EBF\u56FE\u4E0E\u5E02\u573A\u9700\u6C42\u7684\u5339\u914D\u5EA6", time: "2024-02-01 11:00" },
    ],
  },
  sh5: {
    id: "sh5",
    title: "\u5355\u4F4D\u7ECF\u6D4E\u6A21\u578B\u53EF\u572824\u4E2A\u6708\u5185\u76C8\u4E8F\u5E73\u8861",
    category: "\u8D22\u52A1\u6A21\u578B",
    tag: "optional",
    description:
      "\u6295\u8D44\u6807\u7684\u7684\u5355\u4F4D\u7ECF\u6D4E\u6A21\u578B\u5E94\u80FD\u572824\u4E2A\u6708\u5185\u5B9E\u73B0\u76C8\u4E8F\u5E73\u8861\uFF0C\u6BDB\u5229\u7387\u76EE\u6807\u5E94\u4E0D\u4F4E\u4E8E60%\u3002",
    rationale:
      "\u867D\u7136AI\u57FA\u7840\u8BBE\u65BD\u524D\u671F\u6295\u5165\u8F83\u5927\uFF0C\u4F46\u5065\u5EB7\u7684\u5355\u4F4D\u7ECF\u6D4E\u6A21\u578B\u662F\u4F01\u4E1A\u53EF\u6301\u7EED\u53D1\u5C55\u7684\u57FA\u7840\u3002",
    verificationMethod:
      "\u5206\u6790\u8D22\u52A1\u62A5\u8868\u548C\u9884\u6D4B\u6A21\u578B\uFF0C\u8FDB\u884C\u5355\u4F4D\u7ECF\u6D4E\u654F\u611F\u6027\u5206\u6790\uFF0C\u5BF9\u6BD4\u540C\u884C\u4E1A\u4F01\u4E1A\u7684\u76C8\u5229\u8282\u594F\u3002",
    relatedMetrics: ["\u6BDB\u5229\u7387", "\u5BA2\u6237\u83B7\u53D6\u6210\u672C", "\u5BA2\u6237\u7EC8\u8EAB\u4EF7\u503C"],
    creator: PEOPLE.lisi,
    comments: [],
  },
  sh6: {
    id: "sh6",
    title: "\u4F9B\u5E94\u94FE\u5177\u6709\u591A\u5143\u5316\u5E03\u5C40",
    category: "\u8FD0\u8425\u98CE\u9669",
    tag: "optional",
    description:
      "\u4F01\u4E1A\u5E94\u5177\u5907\u591A\u5143\u5316\u7684\u4F9B\u5E94\u94FE\u5E03\u5C40\uFF0C\u907F\u514D\u5BF9\u5355\u4E00\u4F9B\u5E94\u5546\u7684\u8FC7\u5EA6\u4F9D\u8D56\u3002",
    rationale:
      "\u5168\u7403\u82AF\u7247\u4F9B\u5E94\u94FE\u9762\u4E34\u5730\u7F18\u653F\u6CBB\u4E0D\u786E\u5B9A\u6027\uFF0C\u591A\u5143\u5316\u5E03\u5C40\u80FD\u6709\u6548\u5BF9\u51B2\u98CE\u9669\u3002",
    verificationMethod:
      "\u5BA1\u67E5\u4F9B\u5E94\u5546\u6E05\u5355\u548C\u96C6\u4E2D\u5EA6\uFF0C\u8BC4\u4F30\u66FF\u4EE3\u4F9B\u5E94\u5546\u7684\u53EF\u884C\u6027\u3002",
    relatedMetrics: ["\u4F9B\u5E94\u5546\u96C6\u4E2D\u5EA6", "\u5E93\u5B58\u5468\u8F6C\u5929\u6570", "\u5907\u9009\u65B9\u6848\u6570\u91CF"],
    creator: PEOPLE.wangwu,
    comments: [
      { author: "\u5F20\u4F1F", content: "\u9700\u8981\u91CD\u70B9\u5173\u6CE8\u5730\u7F18\u653F\u6CBB\u98CE\u9669\u5BF9\u4F9B\u5E94\u94FE\u7684\u5F71\u54CD", time: "2024-02-05 16:30" },
    ],
  },
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

/* ------------------------------------------------------------------ */
/*  Tree Node (no status dots)                                         */
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
        <span className={cn(isLeaf ? "line-clamp-2" : "truncate")}>{displayLabel}</span>
        {isLeaf && node.tag && (
          <Badge className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0 ml-auto", tagConfig[node.tag].badgeCls)}>
            {tagConfig[node.tag].label}
          </Badge>
        )}
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
/*  Status / Priority configs                                          */
/* ------------------------------------------------------------------ */
const tagConfig: Record<string, { label: string; badgeCls: string }> = {
  required: { label: "\u5FC5\u8981", badgeCls: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50" },
  recommended: { label: "\u63A8\u8350", badgeCls: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50" },
  optional: { label: "\u53EF\u9009", badgeCls: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50" },
}

/* ------------------------------------------------------------------ */
/*  Detail Panel                                                       */
/* ------------------------------------------------------------------ */
function DetailPanel({ detail }: { detail: StrategyHypothesisDetail }) {
  return (
    <ScrollArea className="h-full">
      <div className="px-8 py-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-[#6B7280]">
          <span className="hover:text-[#374151] cursor-pointer">{"AI\u57FA\u7840\u8BBE\u65BD"}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="hover:text-[#374151] cursor-pointer">{"\u63A8\u8350\u5047\u8BBE"}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#374151] font-medium">{detail.title}</span>
        </div>

        {/* Header */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#111827]">{detail.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className="bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50 text-xs">
              {detail.category}
            </Badge>
            <Badge className={cn("text-xs", tagConfig[detail.tag]?.badgeCls)}>
              {tagConfig[detail.tag]?.label}
            </Badge>
          </div>
          {detail.creator && detail.creator.name && (
            <div className="mt-3">
              <AvatarChip person={detail.creator} label={"\u521B\u5EFA\u8005:"} />
            </div>
          )}
        </div>

        {/* Description */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-3">{"\u5047\u8BBE\u63CF\u8FF0"}</h3>
          <p className="text-sm leading-relaxed text-[#374151]">{detail.description}</p>
        </div>

        {/* Rationale */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-3">{"\u63A8\u8350\u7406\u7531"}</h3>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <p className="text-sm leading-relaxed text-[#374151]">{detail.rationale}</p>
          </div>
        </div>

        {/* Verification Method */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-3">{"\u5EFA\u8BAE\u9A8C\u8BC1\u65B9\u6CD5"}</h3>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <p className="text-sm leading-relaxed text-[#374151]">{detail.verificationMethod}</p>
          </div>
        </div>

        {/* Related Metrics */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-3">{"\u5173\u8054\u6307\u6807"}</h3>
          <div className="flex flex-wrap gap-2">
            {detail.relatedMetrics.map((m) => (
              <Badge key={m} className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                {m}
              </Badge>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <CommentSection comments={detail.comments} />
        </div>


      </div>
    </ScrollArea>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export function StrategyHypotheses() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [middleCollapsed, setMiddleCollapsed] = useState(false)
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
                <h2 className="text-base font-semibold text-[#111827]">{"\u63A8\u8350\u5047\u8BBE\u6E05\u5355"}</h2>
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

      {/* Right Panel: Detail */}
      {hasSelection && !middleExpanded && (
        <div className="flex-1 bg-[#F3F4F6] overflow-hidden">
          {detail ? <DetailPanel detail={detail} /> : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-[#9CA3AF]">
                <Lightbulb className="mx-auto h-12 w-12 mb-3 text-[#D1D5DB]" />
                <p className="text-sm">{"\u9009\u62E9\u5DE6\u4FA7\u5047\u8BBE\u4EE5\u67E5\u770B\u8BE6\u60C5"}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
