"use client"

import { useState } from "react"
import {
  Search,
  ChevronRight,
  ChevronDown,
  FileText,
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
  tag?: "required" | "recommended" | "optional"
  children?: TermNode[]
}

interface PersonInfo {
  name: string
  role: string
}

interface StrategyTermDetail {
  id: string
  title: string
  tag: "required" | "recommended" | "optional"
  content: string
  rationale: string
  commonRange: string
  relatedHypotheses: { id: string; title: string }[]
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
/*  Tag config: only 3 tags                                            */
/* ------------------------------------------------------------------ */
const tagConfig: Record<string, { label: string; dotCls: string; badgeCls: string }> = {
  required: {
    label: "\u5FC5\u8981",
    dotCls: "bg-red-500",
    badgeCls: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
  },
  recommended: {
    label: "\u63A8\u8350",
    dotCls: "bg-blue-500",
    badgeCls: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50",
  },
  optional: {
    label: "\u53EF\u9009",
    dotCls: "bg-gray-400",
    badgeCls: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50",
  },
}

/* ------------------------------------------------------------------ */
/*  Mock data - tree                                                   */
/* ------------------------------------------------------------------ */
const termTree: TermNode[] = [
  {
    id: "control-rights",
    label: "\u63A7\u5236\u6743\u6761\u6B3E",
    children: [
      {
        id: "board-terms",
        label: "\u8463\u4E8B\u4F1A\u6761\u6B3E",
        children: [
          {
            id: "st1",
            label: "\u8463\u4E8B\u4F1A\u5E2D\u4F4D",
            fullName: "\u6295\u8D44\u65B9\u6709\u6743\u59D4\u6D3E\u4E00\u540D\u8463\u4E8B\u8FDB\u5165\u516C\u53F8\u8463\u4E8B\u4F1A",
            tag: "recommended",
          },
          {
            id: "st2",
            label: "\u91CD\u5927\u4E8B\u9879\u5426\u51B3\u6743",
            fullName: "\u5BF9\u516C\u53F8\u7AE0\u7A0B\u4FEE\u6539\u7B49\u91CD\u5927\u4E8B\u9879\u6295\u8D44\u65B9\u4EAB\u6709\u4E00\u7968\u5426\u51B3\u6743",
            tag: "required",
          },
        ],
      },
      {
        id: "info-rights",
        label: "\u4FE1\u606F\u6743",
        children: [
          {
            id: "st3",
            label: "\u4FE1\u606F\u6743\u4E0E\u68C0\u67E5\u6743",
            fullName: "\u6295\u8D44\u65B9\u6709\u6743\u83B7\u53D6\u516C\u53F8\u8D22\u52A1\u62A5\u544A\u548C\u8FD0\u8425\u6570\u636E",
            tag: "recommended",
          },
        ],
      },
    ],
  },
  {
    id: "economic-terms",
    label: "\u7ECF\u6D4E\u6761\u6B3E",
    children: [
      {
        id: "liquidation-terms",
        label: "\u6E05\u7B97\u4F18\u5148\u6743",
        children: [
          {
            id: "st4",
            label: "\u4F18\u5148\u6E05\u7B97\u6743",
            fullName: "\u4F18\u5148\u6E05\u7B97\u6743 1x Non-Participating",
            tag: "required",
          },
        ],
      },
      {
        id: "anti-dilution-terms",
        label: "\u53CD\u7A00\u91CA\u4FDD\u62A4",
        children: [
          {
            id: "st5",
            label: "\u52A0\u6743\u5E73\u5747\u53CD\u7A00\u91CA",
            fullName: "\u540E\u7EED\u4F4E\u4EF7\u878D\u8D44\u65F6\u6295\u8D44\u65B9\u4EAB\u6709\u52A0\u6743\u5E73\u5747\u53CD\u7A00\u91CA\u8C03\u6574\u6743",
            tag: "required",
          },
        ],
      },
    ],
  },
  {
    id: "founder-terms",
    label: "\u521B\u59CB\u4EBA\u7EA6\u675F\u6761\u6B3E",
    children: [
      {
        id: "key-person-terms",
        label: "\u5173\u952E\u4EBA\u6761\u6B3E",
        children: [
          {
            id: "st6",
            label: "\u5173\u952E\u4EBA\u9501\u5B9A",
            fullName: "\u521B\u59CB\u4EBA\u53CA\u6838\u5FC3\u6280\u672F\u8D1F\u8D23\u4EBA36\u4E2A\u6708\u5168\u804C\u6295\u5165\u627F\u8BFA",
            tag: "optional",
          },
        ],
      },
      {
        id: "ip-terms",
        label: "\u77E5\u8BC6\u4EA7\u6743",
        children: [
          {
            id: "st7",
            label: "\u77E5\u8BC6\u4EA7\u6743\u4FDD\u62A4",
            fullName: "\u786E\u4FDD\u6240\u6709\u6838\u5FC3\u77E5\u8BC6\u4EA7\u6743\u5F52\u516C\u53F8\u6240\u6709",
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
const detailsMap: Record<string, StrategyTermDetail> = {
  st1: {
    id: "st1",
    title: "\u6295\u8D44\u65B9\u6709\u6743\u59D4\u6D3E\u4E00\u540D\u8463\u4E8B\u8FDB\u5165\u516C\u53F8\u8463\u4E8B\u4F1A",
    tag: "recommended",
    content: "\u6295\u8D44\u65B9\u6709\u6743\u59D4\u6D3E\u4E00\u540D\u8463\u4E8B\u8FDB\u5165\u516C\u53F8\u8463\u4E8B\u4F1A\uFF0C\u4EAB\u6709\u4E0E\u5176\u4ED6\u8463\u4E8B\u540C\u7B49\u7684\u8868\u51B3\u6743\u548C\u77E5\u60C5\u6743\u3002\u8463\u4E8B\u4F1A\u7ED3\u6784\u5EFA\u8BAE\u4E3A\uFF1A2\u540D\u521B\u59CB\u4EBA\u5E2D\u4F4D + 1\u540D\u6295\u8D44\u4EBA\u5E2D\u4F4D + 1\u540D\u72EC\u7ACB\u8463\u4E8B\u5E2D\u4F4D + 1\u540D\u89C2\u5BDF\u5458\u5E2D\u4F4D\u3002",
    rationale: "\u5BF9\u4E8EAI\u57FA\u7840\u8BBE\u65BD\u7C7B\u516C\u53F8\uFF0C\u6280\u672F\u51B3\u7B56\u7684\u4E13\u4E1A\u6027\u6781\u9AD8\uFF0C\u6295\u8D44\u65B9\u9700\u8981\u901A\u8FC7\u8463\u4E8B\u4F1A\u5E2D\u4F4D\u786E\u4FDD\u5BF9\u91CD\u5927\u6280\u672F\u8DEF\u7EBF\u51B3\u7B56\u7684\u77E5\u60C5\u6743\u548C\u53C2\u4E0E\u6743\u3002",
    commonRange: "1-2\u4E2A\u6295\u8D44\u4EBA\u5E2D\u4F4D",
    relatedHypotheses: [
      { id: "sh1", title: "\u6838\u5FC3\u6280\u672F\u56E2\u961F\u5177\u5907GPU\u67B6\u6784\u8BBE\u8BA1\u80FD\u529B" },
    ],
    creator: PEOPLE.zhangwei,
    comments: [
      { author: "\u674E\u56DB", content: "\u5EFA\u8BAE\u8003\u8651\u589E\u52A0\u89C2\u5BDF\u5458\u5E2D\u4F4D\u7684\u5177\u4F53\u6743\u9650\u8303\u56F4", time: "2024-01-22 14:30" },
    ],
  },
  st2: {
    id: "st2",
    title: "\u5BF9\u516C\u53F8\u7AE0\u7A0B\u4FEE\u6539\u7B49\u91CD\u5927\u4E8B\u9879\u6295\u8D44\u65B9\u4EAB\u6709\u4E00\u7968\u5426\u51B3\u6743",
    tag: "required",
    content: "\u5BF9\u4E8E\u516C\u53F8\u7AE0\u7A0B\u4FEE\u6539\u3001\u589E\u51CF\u6CE8\u518C\u8D44\u672C\u3001\u5408\u5E76\u5206\u7ACB\u7B49\u91CD\u5927\u4E8B\u9879\uFF0C\u6295\u8D44\u65B9\u4EAB\u6709\u4E00\u7968\u5426\u51B3\u6743\u3002\u5305\u62EC\u4F46\u4E0D\u9650\u4E8E\uFF1A\u5173\u8054\u4EA4\u6613\u8D85\u8FC7100\u4E07\u5143\u3001\u53D1\u884C\u65B0\u80A1\u3001\u50B5\u52A1\u878D\u8D44\u8D85\u8FC7500\u4E07\u5143\u3002",
    rationale: "\u5426\u51B3\u6743\u662F\u4FDD\u62A4\u5C11\u6570\u80A1\u4E1C\u6743\u76CA\u7684\u6838\u5FC3\u6761\u6B3E\uFF0C\u5C24\u5176\u5728AI\u57FA\u7840\u8BBE\u65BD\u9886\u57DF\uFF0C\u516C\u53F8\u53EF\u80FD\u9762\u4E34\u5927\u989D\u8D44\u672C\u5F00\u652F\u51B3\u7B56\u3002",
    commonRange: "\u6807\u51C6\u5426\u51B3\u6743\u6761\u6B3E",
    relatedHypotheses: [
      { id: "sh1", title: "\u6838\u5FC3\u6280\u672F\u56E2\u961F\u5177\u5907GPU\u67B6\u6784\u8BBE\u8BA1\u80FD\u529B" },
    ],
    creator: PEOPLE.wangwu,
    comments: [],
  },
  st3: {
    id: "st3",
    title: "\u6295\u8D44\u65B9\u6709\u6743\u83B7\u53D6\u516C\u53F8\u8D22\u52A1\u62A5\u544A\u548C\u8FD0\u8425\u6570\u636E",
    tag: "recommended",
    content: "\u516C\u53F8\u5E94\u5411\u6295\u8D44\u65B9\u5B9A\u671F\u63D0\u4F9B\uFF1A\u6708\u5EA6\u8D22\u52A1\u62A5\u544A\uFF0815\u4E2A\u5DE5\u4F5C\u65E5\u5185\uFF09\u3001\u5B63\u5EA6\u7ECF\u8425\u5206\u6790\u62A5\u544A\u3001\u5E74\u5EA6\u5BA1\u8BA1\u62A5\u544A\u3001\u5E74\u5EA6\u7ECF\u8425\u8BA1\u5212\u548C\u9884\u7B97\u3002\u6295\u8D44\u65B9\u6709\u6743\u5728\u5408\u7406\u901A\u77E5\u540E\u5BF9\u516C\u53F8\u8FDB\u884C\u8D22\u52A1\u548C\u8FD0\u8425\u5BA1\u67E5\u3002",
    rationale: "AI\u57FA\u7840\u8BBE\u65BD\u516C\u53F8\u901A\u5E38\u6D89\u53CA\u5927\u989D\u8D44\u672C\u5F00\u652F\u548C\u590D\u6742\u7684\u6280\u672F\u6307\u6807\uFF0C\u5B9A\u671F\u7684\u4FE1\u606F\u62AB\u9732\u6709\u52A9\u4E8E\u6295\u8D44\u65B9\u53CA\u65F6\u4E86\u89E3\u516C\u53F8\u8FD0\u8425\u72B6\u51B5\u3002",
    commonRange: "\u6708\u62A5/\u5B63\u62A5/\u5E74\u62A5",
    relatedHypotheses: [],
    creator: PEOPLE.lisi,
    comments: [
      { author: "\u5F20\u4F1F", content: "\u5EFA\u8BAE\u589E\u52A0\u6280\u672F\u7814\u53D1\u8FDB\u5C55\u62A5\u544A\u7684\u62AB\u9732\u8981\u6C42", time: "2024-01-25 10:00" },
    ],
  },
  st4: {
    id: "st4",
    title: "\u4F18\u5148\u6E05\u7B97\u6743 1x Non-Participating",
    tag: "required",
    content: "\u5728\u516C\u53F8\u53D1\u751F\u6E05\u7B97\u4E8B\u4EF6\uFF08\u5305\u62EC\u5408\u5E76\u3001\u6536\u8D2D\u3001\u8D44\u4EA7\u51FA\u552E\u7B49\u89C6\u540C\u6E05\u7B97\u4E8B\u4EF6\uFF09\u65F6\uFF0C\u6295\u8D44\u65B9\u6709\u6743\u4F18\u5148\u4E8E\u666E\u901A\u80A1\u80A1\u4E1C\u83B7\u5F97\u5176\u6295\u8D44\u91D1\u989D1\u500D\u7684\u56DE\u62A5\u3002\u91C7\u7528Non-Participating\u7ED3\u6784\uFF0C\u5373\u6295\u8D44\u65B9\u5728\u83B7\u5F97\u4F18\u5148\u6E05\u7B97\u56DE\u62A5\u540E\u4E0D\u518D\u53C2\u4E0E\u5269\u4F59\u8D44\u4EA7\u5206\u914D\uFF0C\u6216\u53EF\u9009\u62E9\u8F6C\u6362\u4E3A\u666E\u901A\u80A1\u6309\u6BD4\u4F8B\u53C2\u4E0E\u5206\u914D\u3002",
    rationale: "1x Non-Participating\u662FAI\u57FA\u7840\u8BBE\u65BD\u8D5B\u9053B\u8F6E\u9636\u6BB5\u6700\u5E38\u89C1\u7684\u6E05\u7B97\u4F18\u5148\u6743\u7ED3\u6784\uFF0C\u65E2\u4FDD\u62A4\u4E86\u6295\u8D44\u4EBA\u7684\u4E0B\u884C\u98CE\u9669\uFF0C\u53C8\u4E0D\u4F1A\u8FC7\u5EA6\u7A00\u91CA\u521B\u59CB\u56E2\u961F\u7684\u5229\u76CA\u3002",
    commonRange: "1x-2x Non-Participating",
    relatedHypotheses: [
      { id: "sh5", title: "\u5355\u4F4D\u7ECF\u6D4E\u6A21\u578B\u53EF\u572824\u4E2A\u6708\u5185\u76C8\u4E8F\u5E73\u8861" },
    ],
    creator: PEOPLE.wangwu,
    comments: [
      { author: "\u738B\u4E94", content: "Non-Participating\u7ED3\u6784\u5BF9\u521B\u59CB\u56E2\u961F\u66F4\u53CB\u597D\uFF0C\u6709\u5229\u4E8E\u7EF4\u62A4\u5173\u7CFB", time: "2024-01-28 15:00" },
    ],
  },
  st5: {
    id: "st5",
    title: "\u540E\u7EED\u4F4E\u4EF7\u878D\u8D44\u65F6\u6295\u8D44\u65B9\u4EAB\u6709\u52A0\u6743\u5E73\u5747\u53CD\u7A00\u91CA\u8C03\u6574\u6743",
    tag: "required",
    content: "\u82E5\u516C\u53F8\u5728\u540E\u7EED\u878D\u8D44\u4E2D\u4EE5\u4F4E\u4E8E\u672C\u8F6E\u4F30\u503C\u7684\u4EF7\u683C\u53D1\u884C\u65B0\u80A1\uFF08Down Round\uFF09\uFF0C\u6295\u8D44\u65B9\u4EAB\u6709\u5E7F\u4E49\u52A0\u6743\u5E73\u5747\uFF08Broad-Based Weighted Average\uFF09\u53CD\u7A00\u91CA\u8C03\u6574\u6743\uFF0C\u6309\u516C\u5F0F\u8C03\u6574\u8F6C\u6362\u4EF7\u683C\u4EE5\u8865\u507F\u7A00\u91CA\u5F71\u54CD\u3002",
    rationale: "AI\u57FA\u7840\u8BBE\u65BD\u884C\u4E1A\u6CE2\u52A8\u6027\u8F83\u5927\uFF0C\u52A0\u6743\u5E73\u5747\u53CD\u7A00\u91CA\u662F\u5E73\u8861\u6295\u8D44\u4EBA\u4FDD\u62A4\u548C\u521B\u59CB\u56E2\u961F\u5229\u76CA\u7684\u6700\u4F73\u5B9E\u8DF5\u3002",
    commonRange: "\u5E7F\u4E49\u52A0\u6743\u5E73\u5747",
    relatedHypotheses: [
      { id: "sh2", title: "\u76EE\u6807\u5E02\u573ATAM\u8D85\u8FC7100\u4EBF\u7F8E\u5143" },
    ],
    creator: PEOPLE.lisi,
    comments: [],
  },
  st6: {
    id: "st6",
    title: "\u521B\u59CB\u4EBA\u53CA\u6838\u5FC3\u6280\u672F\u8D1F\u8D23\u4EBA36\u4E2A\u6708\u5168\u804C\u6295\u5165\u627F\u8BFA",
    tag: "optional",
    content: "\u521B\u59CB\u4EBA\u53CA\u6838\u5FC3\u6280\u672F\u8D1F\u8D23\u4EBA\u5E94\u627F\u8BFA\u5728\u6295\u8D44\u5B8C\u6210\u540E\u81F3\u5C1136\u4E2A\u6708\u5185\u5168\u804C\u6295\u5165\u516C\u53F8\u8FD0\u8425\u3002\u5982\u5173\u952E\u4EBA\u79BB\u804C\uFF0C\u6295\u8D44\u65B9\u6709\u6743\u8981\u6C42\u516C\u53F8\u56DE\u8D2D\u6295\u8D44\u65B9\u6240\u6301\u80A1\u6743\u6216\u89E6\u53D1\u7279\u5B9A\u7684\u8865\u507F\u673A\u5236\u3002",
    rationale: "AI\u57FA\u7840\u8BBE\u65BD\u516C\u53F8\u9AD8\u5EA6\u4F9D\u8D56\u6838\u5FC3\u6280\u672F\u4EBA\u624D\uFF0C\u5173\u952E\u4EBA\u79BB\u804C\u53EF\u80FD\u5BF9\u516C\u53F8\u6280\u672F\u8DEF\u7EBF\u548C\u56E2\u961F\u7A33\u5B9A\u6027\u9020\u6210\u91CD\u5927\u5F71\u54CD\u3002",
    commonRange: "24-48\u4E2A\u6708\u9501\u5B9A\u671F",
    relatedHypotheses: [
      { id: "sh1", title: "\u6838\u5FC3\u6280\u672F\u56E2\u961F\u5177\u5907GPU\u67B6\u6784\u8BBE\u8BA1\u80FD\u529B" },
    ],
    creator: PEOPLE.zhangwei,
    comments: [
      { author: "\u674E\u56DB", content: "\u9501\u5B9A\u671F\u5EFA\u8BAE\u6309\u884C\u4E1A\u60EF\u4F8B\u8BBE\u4E3A36\u4E2A\u6708", time: "2024-02-01 11:30" },
    ],
  },
  st7: {
    id: "st7",
    title: "\u786E\u4FDD\u6240\u6709\u6838\u5FC3\u77E5\u8BC6\u4EA7\u6743\u5F52\u516C\u53F8\u6240\u6709",
    tag: "optional",
    content: "\u516C\u53F8\u5E94\u786E\u4FDD\u6240\u6709\u6838\u5FC3\u77E5\u8BC6\u4EA7\u6743\uFF08\u5305\u62EC\u4F46\u4E0D\u9650\u4E8E\u82AF\u7247\u67B6\u6784\u8BBE\u8BA1\u3001\u7F16\u8BD1\u5668\u4EE3\u7801\u3001\u7B97\u6CD5\u4E13\u5229\u7B49\uFF09\u5F52\u516C\u53F8\u6240\u6709\uFF0C\u6838\u5FC3\u5458\u5DE5\u5E94\u7B7E\u7F72\u77E5\u8BC6\u4EA7\u6743\u5F52\u5C5E\u534F\u8BAE\u548C\u7ADE\u4E1A\u9650\u5236\u534F\u8BAE\u3002",
    rationale: "AI\u57FA\u7840\u8BBE\u65BD\u516C\u53F8\u7684\u6838\u5FC3\u4EF7\u503C\u5728\u4E8E\u6280\u672FIP\uFF0C\u786E\u4FDD\u77E5\u8BC6\u4EA7\u6743\u7684\u5F52\u5C5E\u6E05\u6670\u548C\u4FDD\u62A4\u5B8C\u5584\u662F\u6295\u8D44\u7684\u57FA\u672C\u524D\u63D0\u3002",
    commonRange: "\u6807\u51C6IP\u4FDD\u62A4\u6761\u6B3E",
    relatedHypotheses: [
      { id: "sh4", title: "\u5177\u5907\u53EF\u6301\u7EED\u7684\u6280\u672F\u8FED\u4EE3\u80FD\u529B" },
    ],
    creator: PEOPLE.wangwu,
    comments: [],
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
/*  Tree Node (no status dots for strategy)                            */
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
/*  Detail Panel                                                       */
/* ------------------------------------------------------------------ */
function DetailPanel({ detail }: { detail: StrategyTermDetail }) {
  return (
    <ScrollArea className="h-full">
      <div className="px-8 py-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-[#6B7280]">
          <span className="hover:text-[#374151] cursor-pointer">{"AI\u57FA\u7840\u8BBE\u65BD"}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="hover:text-[#374151] cursor-pointer">{"\u63A8\u8350\u6761\u6B3E"}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#374151] font-medium">{detail.title}</span>
        </div>

        {/* Header */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#111827]">{detail.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={cn("text-xs", tagConfig[detail.tag].badgeCls)}>
              {tagConfig[detail.tag].label}
            </Badge>
          </div>
          {detail.creator && detail.creator.name && (
            <div className="mt-3">
              <AvatarChip person={detail.creator} label={"\u521B\u5EFA\u8005:"} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-3">{"\u6761\u6B3E\u5185\u5BB9"}</h3>
          <p className="text-sm leading-relaxed text-[#374151]">{detail.content}</p>
        </div>

        {/* Rationale */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-3">{"\u63A8\u8350\u7406\u7531"}</h3>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <p className="text-sm leading-relaxed text-[#374151]">{detail.rationale}</p>
          </div>
        </div>

        {/* Common Range */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111827] mb-3">{"\u884C\u4E1A\u5E38\u89C1\u8303\u56F4"}</h3>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
            <p className="text-sm text-[#374151]">{detail.commonRange}</p>
          </div>
        </div>

        {/* Related Hypotheses */}
        {detail.relatedHypotheses.length > 0 && (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h3 className="text-base font-semibold text-[#111827] mb-3">{"\u5173\u8054\u5047\u8BBE"}</h3>
            <div className="space-y-2">
              {detail.relatedHypotheses.map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-sm text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer">
                  <Link2 className="h-4 w-4 shrink-0" />
                  <span>{h.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
interface StrategyTermsProps {
  isNewStrategy?: boolean
}

export function StrategyTerms({ isNewStrategy = false }: StrategyTermsProps) {
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

  // Show empty state for new strategies
  if (isNewStrategy) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
            <FileText className="h-8 w-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111827] mb-2">{"\u6682\u65E0\u6761\u6B3E\u6E05\u5355"}</h3>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" />
            {"\u521B\u5EFA\u7B2C\u4E00\u4E2A\u6761\u6B3E"}
          </button>
        </div>
      </div>
    )
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
                <h2 className="text-base font-semibold text-[#111827]">{"\u63A8\u8350\u6761\u6B3E\u6E05\u5355"}</h2>
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
                  title={middleExpanded ? "\u663E\u793A\u6761\u6B3E\u8BE6\u60C5" : "\u5C55\u5F00\u6761\u6B3E\u5217\u8868"}
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
          {detail ? <DetailPanel detail={detail} /> : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-[#9CA3AF]">
                <FileText className="mx-auto h-12 w-12 mb-3 text-[#D1D5DB]" />
                <p className="text-sm">{"\u9009\u62E9\u5DE6\u4FA7\u6761\u6B3E\u4EE5\u67E5\u770B\u8BE6\u60C5"}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
