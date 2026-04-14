"use client"

import { useState } from "react"
import {
  Search,
  TrendingUp,
  BookOpen,
  BarChart2,
  Globe,
  FileText,
  Flame,
  ChevronRight,
  Clock,
  Eye,
  Star,
  ArrowUpRight,
  Newspaper,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// ─── Types ────────────────────────────────────────────────────────────────────

type ArticleCategory =
  | "全部"
  | "市场洞察"
  | "行业研究"
  | "投资策略"
  | "宏观分析"
  | "监管政策"

interface Article {
  id: string
  title: string
  summary: string
  category: ArticleCategory
  tag?: "热门" | "最新" | "精选"
  coverColor: string   // gradient class
  coverIcon: string    // emoji / text used as abstract cover art
  source: string
  date: string
  views: number
  featured?: boolean
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const articles: Article[] = [
  {
    id: "art-001",
    title: "2025年中国股权投资市场年度研究报告",
    summary:
      "全面梳理2025年全年一级市场募、投、管、退数据，深度解析市场结构变化与主要趋势，并对2026年市场走势作出展望。",
    category: "市场洞察",
    tag: "热门",
    coverColor: "from-teal-500 to-cyan-600",
    coverIcon: "MARKET\nRESEARCH",
    source: "AtomCAP",
    date: "2026-02-04",
    views: 18420,
    featured: true,
  },
  {
    id: "art-002",
    title: "中企并购市场现状：交易量与估值双升",
    summary:
      "2025年并购交易总金额同比增长32%，跨境并购案例显著增多。本文详细拆解并购活跃赛道与典型案例。",
    category: "市场洞察",
    tag: "热门",
    coverColor: "from-blue-500 to-indigo-600",
    coverIcon: "M&A\nREPORT",
    source: "AtomCAP",
    date: "2026-02-27",
    views: 9340,
  },
  {
    id: "art-003",
    title: "2025年募资回暖：LP结构悄然生变",
    summary:
      "国资LP占比持续提升，市场化母基金份额收缩。政府引导基金与产业资本成为新晋主力，本文深度拆解募资结构演变。",
    category: "投资策略",
    tag: "热门",
    coverColor: "from-violet-500 to-purple-600",
    coverIcon: "FUND\nRAISE",
    source: "AtomCAP",
    date: "2026-02-10",
    views: 7210,
  },
  {
    id: "art-004",
    title: "中国一级市场全景：百页PPT复盘",
    summary:
      "超百页PPT系统梳理过去一年一级市场在各细分维度上的表现，包含赛道热度图谱、机构排名、典型案例等核心数据。",
    category: "市场洞察",
    coverColor: "from-rose-500 to-pink-600",
    coverIcon: "ANNUAL\nREVIEW",
    source: "AtomCAP",
    date: "2026-02-04",
    views: 14750,
  },
  {
    id: "art-005",
    title: "前三季度一级市场持续回暖信号",
    summary:
      "Q1-Q3累计投融资案例数与金额双双回升，科技赛道领跑，出海主题热度不减。",
    category: "市场洞察",
    coverColor: "from-amber-500 to-orange-600",
    coverIcon: "Q1-Q3\nINSIGHT",
    source: "AtomCAP",
    date: "2025-11-10",
    views: 5680,
  },
  {
    id: "art-006",
    title: "上半年IPO市场成绩单：A股与港股分化加剧",
    summary:
      "A股IPO审核趋严，港股上市通道持续扩容，上半年企业选择赴港挂牌数量创历史新高。",
    category: "监管政策",
    tag: "热门",
    coverColor: "from-emerald-500 to-teal-600",
    coverIcon: "IPO\nREPORT",
    source: "AtomCAP",
    date: "2025-07-24",
    views: 8890,
  },
  {
    id: "art-007",
    title: "2025年收官：IPO盘点与退出展望",
    summary:
      "全年IPO节奏与质量复盘，二级市场估值修复对一级市场退出的传导效应，以及2026年退出路径预判。",
    category: "投资策略",
    coverColor: "from-sky-500 to-blue-600",
    coverIcon: "EXIT\nOUTLOOK",
    source: "AtomCAP",
    date: "2026-01-07",
    views: 6320,
  },
  {
    id: "art-008",
    title: "退出季报：退出渠道持续多元化",
    summary:
      "S基金、并购退出、境外上市三条路径共同构成退出新格局，本期季报全面梳理各渠道规模、案例与机构参与度。",
    category: "投资策略",
    tag: "最新",
    coverColor: "from-lime-500 to-green-600",
    coverIcon: "EXIT\nQUARTER",
    source: "AtomCAP",
    date: "2026-03-10",
    views: 3210,
  },
  {
    id: "art-009",
    title: "2025年第一季度中国股权投资市场研究报告",
    summary:
      "Q1市场开门红，人工智能与硬科技并驾齐驱，新能源赛道分化显著，消费赛道仍处底部震荡。",
    category: "行业研究",
    coverColor: "from-indigo-500 to-violet-600",
    coverIcon: "Q1 2025\nSTUDY",
    source: "AtomCAP",
    date: "2025-05-12",
    views: 4450,
  },
  {
    id: "art-010",
    title: "人工智能投资热潮下的估值泡沫风险",
    summary:
      "AI赛道融资热度持续高企，本文从估值方法论、历史类比与风险指标三个维度，理性评估当前AI投资的潜在风险。",
    category: "行业研究",
    tag: "精选",
    coverColor: "from-fuchsia-500 to-pink-600",
    coverIcon: "AI\nRISK",
    source: "AtomCAP研究",
    date: "2026-03-05",
    views: 11200,
  },
  {
    id: "art-011",
    title: "募投月报：2026年2月融资数据速览",
    summary:
      "2月份共披露投融资事件317起，总金额超420亿元，环比小幅回落，同比增长显著。",
    category: "市场洞察",
    tag: "最新",
    coverColor: "from-cyan-500 to-sky-600",
    coverIcon: "MONTHLY\nREPORT",
    source: "AtomCAP",
    date: "2026-03-01",
    views: 2980,
  },
  {
    id: "art-012",
    title: "宏观政策对私募股权市场的传导路径分析",
    summary:
      "降准、财政扩张与产业政策三重驱动下，资本流向如何调整？本文系统梳理政策到市场的传导机制。",
    category: "宏观分析",
    coverColor: "from-stone-500 to-neutral-600",
    coverIcon: "MACRO\nPOLICY",
    source: "AtomCAP研究",
    date: "2026-02-18",
    views: 5670,
  },
]

// ─── Category Config ───────────────────────────────────────────────────────────

const categories: { key: ArticleCategory; icon: React.ReactNode }[] = [
  { key: "全部", icon: <Globe className="h-3.5 w-3.5" /> },
  { key: "市场洞察", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: "行业研究", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { key: "投资策略", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { key: "宏观分析", icon: <Globe className="h-3.5 w-3.5" /> },
  { key: "监管政策", icon: <FileText className="h-3.5 w-3.5" /> },
]

const tagConfig = {
  热门: { color: "bg-red-500 text-white", icon: <Flame className="h-2.5 w-2.5" /> },
  最新: { color: "bg-blue-500 text-white", icon: <Clock className="h-2.5 w-2.5" /> },
  精选: { color: "bg-amber-500 text-white", icon: <Star className="h-2.5 w-2.5" /> },
}

// ─── Sub-Components ────────────────────────────────────────────────────────────

function CoverPlaceholder({
  colorClass,
  label,
  compact = false,
}: {
  colorClass: string
  label: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-lg bg-gradient-to-br overflow-hidden shrink-0",
        colorClass,
        compact ? "w-full h-full" : "w-full h-full"
      )}
    >
      <div className="absolute inset-0 opacity-10">
        {/* grid decoration */}
        <div className="h-full w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 19px,rgba(255,255,255,.15) 19px,rgba(255,255,255,.15) 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,rgba(255,255,255,.15) 19px,rgba(255,255,255,.15) 20px)",
          }}
        />
      </div>
      <pre className="text-center text-[10px] font-bold tracking-widest text-white/80 leading-relaxed whitespace-pre-wrap px-2">
        {label}
      </pre>
    </div>
  )
}

function ArticleTag({ tag }: { tag: NonNullable<Article["tag"]> }) {
  const cfg = tagConfig[tag]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold",
        cfg.color
      )}
    >
      {cfg.icon}
      {tag}
    </span>
  )
}

// ─── Featured Card (large left) ───────────────────────────────────────────────

function FeaturedCard({ article }: { article: Article }) {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md cursor-pointer">
      {/* Cover image area */}
      <div className="relative h-48 w-full overflow-hidden">
        <CoverPlaceholder colorClass={article.coverColor} label={article.coverIcon} />
        {article.tag && (
          <div className="absolute left-3 top-3">
            <ArticleTag tag={article.tag} />
          </div>
        )}
      </div>
      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
          {article.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {article.summary}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
              <Newspaper className="h-2.5 w-2.5 text-blue-600" />
            </div>
            <span className="text-xs text-muted-foreground">{article.source}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {article.views.toLocaleString()}
            </span>
            <span>{article.date}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Standard Grid Card ────────────────────────────────────────────────────────

function GridCard({ article }: { article: Article }) {
  return (
    <div className="group flex gap-3 overflow-hidden rounded-xl border border-border bg-white p-3 shadow-sm transition-shadow hover:shadow-md cursor-pointer">
      {/* Cover thumbnail */}
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg">
        <CoverPlaceholder colorClass={article.coverColor} label={article.coverIcon} compact />
        {article.tag && (
          <div className="absolute left-1.5 top-1.5">
            <ArticleTag tag={article.tag} />
          </div>
        )}
      </div>
      {/* Text */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
          {article.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {article.summary}
        </p>
        <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>{article.source}</span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {article.views.toLocaleString()}
          </span>
          <span className="ml-auto">{article.date}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Hot List Sidebar Card ─────────────────────────────────────────────────────

function HotListCard({ articles: hotArticles }: { articles: Article[] }) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Flame className="h-4 w-4 text-red-500" />
        <span className="text-sm font-semibold text-foreground">热门推荐</span>
      </div>
      <ul className="divide-y divide-border">
        {hotArticles.slice(0, 5).map((a, idx) => (
          <li
            key={a.id}
            className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors group"
          >
            <span
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0 rounded text-[11px] font-bold flex items-center justify-center",
                idx < 3
                  ? "bg-red-500 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                {a.title}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Eye className="h-3 w-3" />
                {a.views.toLocaleString()} 浏览
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ConsultationCenter() {
  const [activeCategory, setActiveCategory] = useState<ArticleCategory>("全部")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredArticles = articles.filter((a) => {
    const matchesCategory = activeCategory === "全部" || a.category === activeCategory
    const matchesSearch =
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.summary.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const featuredArticles = filteredArticles.filter((a) => a.featured)
  const topFeatured = featuredArticles[0] ?? filteredArticles[0]
  const gridArticles = filteredArticles.filter((a) => a.id !== topFeatured?.id)
  const hotArticles = [...articles]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC]">
      {/* ── Page Header ── */}
      <div className="shrink-0 border-b border-border bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">资讯中心</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              整合市场研究报告、行业洞察与投资策略，助力投资决策
            </p>
          </div>
          {/* Search */}
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索报告、洞察..."
              className="pl-9 bg-muted/40 border-border h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ── Category Tabs ── */}
        <div className="mt-3 flex items-center gap-1">
          {categories.map(({ key, icon }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                activeCategory === key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {icon}
              {key}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <span>共 {filteredArticles.length} 篇</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
            >
              查看全部
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* ── Main Content ── */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6">
          {filteredArticles.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center gap-3 text-muted-foreground">
              <BookOpen className="h-10 w-10 opacity-30" />
              <p className="text-sm">暂无相关报告</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Top Feature Row ── */}
              {topFeatured && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ gridTemplateRows: "auto" }}>
                  {/* Large featured card */}
                  <div className="col-span-1 lg:row-span-2">
                    <FeaturedCard article={topFeatured} />
                  </div>
                  {/* Right 2×2 grid of the next 4 articles */}
                  <div className="col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {gridArticles.slice(0, 4).map((a) => (
                      <FeaturedCard key={a.id} article={a} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Divider with label ── */}
              {gridArticles.length > 4 && (
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground">更多报告</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}

              {/* ── Remaining articles as list cards ── */}
              {gridArticles.length > 4 && (
                <div className="grid grid-cols-1 gap-3">
                  {gridArticles.slice(4).map((a) => (
                    <GridCard key={a.id} article={a} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="w-full lg:w-72 shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l border-border bg-white px-4 py-6 space-y-4">
          {/* Hot list */}
          <HotListCard articles={hotArticles} />

          {/* Category quick links */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold text-foreground">专题分类</span>
            </div>
            <ul className="divide-y divide-border">
              {categories.slice(1).map(({ key, icon }) => {
                const count = articles.filter((a) => a.category === key).length
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors group"
                    onClick={() => setActiveCategory(key)}
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {icon}
                      {key}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{count}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Latest updates */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold text-foreground">最新发布</span>
            </div>
            <ul className="divide-y divide-border">
              {[...articles]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)
                .map((a) => (
                  <li
                    key={a.id}
                    className="px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors group"
                  >
                    <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                      {a.title}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {a.date}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
