"use client"

import { useState } from "react"
import {
  ChevronRight,
  Flame,
  Clock,
  Globe,
  TrendingUp,
  BarChart2,
  Building2,
  FileText,
  Newspaper,
  Star,
  ArrowRight,
  Eye,
  Search,
  BookMarked,
} from "lucide-react"
import { cn } from "@/src/lib/utils"
import { Input } from "@/src/components/ui/input"

// ─── Types ────────────────────────────────────────────────────────────────────

type MainCategory = "宏观经济" | "投资策略" | "行业分析" | "公司调研"
type HotPeriod = "今日热门" | "本周热门" | "本月热门"

interface ReportItem {
  id: string
  title: string
  category: MainCategory
  subCategory: string
  date: string
  isHot?: boolean
  isNew?: boolean
  views: number
}

interface LeftCategory {
  key: MainCategory
  icon: React.ReactNode
  subs: string[]
}

interface Industry {
  name: string
  color: string
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const leftCategories: LeftCategory[] = [
  {
    key: "宏观经济",
    icon: <Globe className="h-4 w-4" />,
    subs: ["海外经济", "美国经济", "欧洲经济", "中国经济", "货币政策"],
  },
  {
    key: "投资策略",
    icon: <TrendingUp className="h-4 w-4" />,
    subs: ["策略数据", "定期策略", "全球策略", "行业策略", "综合策略"],
  },
  {
    key: "行业分析",
    icon: <BarChart2 className="h-4 w-4" />,
    subs: ["定期报告", "行业策略", "行业评论", "行业数据", "行业信息"],
  },
  {
    key: "公司调研",
    icon: <Building2 className="h-4 w-4" />,
    subs: ["财报点评", "公司评论", "公司研究", "业绩报告"],
  },
]

const industries: Industry[] = [
  { name: "金融服务", color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
  { name: "房地产", color: "bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { name: "有色金属", color: "bg-zinc-50 text-zinc-700 hover:bg-zinc-100" },
  { name: "医药生物", color: "bg-green-50 text-green-700 hover:bg-green-100" },
  { name: "化工行业", color: "bg-orange-50 text-orange-700 hover:bg-orange-100" },
  { name: "机械设备", color: "bg-slate-50 text-slate-700 hover:bg-slate-100" },
  { name: "交通运输", color: "bg-sky-50 text-sky-700 hover:bg-sky-100" },
  { name: "农林牧渔", color: "bg-lime-50 text-lime-700 hover:bg-lime-100" },
  { name: "电子行业", color: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
  { name: "新能源", color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { name: "建筑材料", color: "bg-stone-50 text-stone-700 hover:bg-stone-100" },
  { name: "信息服务", color: "bg-violet-50 text-violet-700 hover:bg-violet-100" },
  { name: "汽车行业", color: "bg-red-50 text-red-700 hover:bg-red-100" },
  { name: "黑色金属", color: "bg-gray-50 text-gray-700 hover:bg-gray-100" },
  { name: "采掘行业", color: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100" },
  { name: "家用电器", color: "bg-pink-50 text-pink-700 hover:bg-pink-100" },
  { name: "餐饮旅游", color: "bg-rose-50 text-rose-700 hover:bg-rose-100" },
  { name: "公用事业", color: "bg-teal-50 text-teal-700 hover:bg-teal-100" },
  { name: "商业贸易", color: "bg-cyan-50 text-cyan-700 hover:bg-cyan-100" },
  { name: "信息设备", color: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
  { name: "食品饮料", color: "bg-orange-50 text-orange-700 hover:bg-orange-100" },
  { name: "轻工制造", color: "bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100" },
  { name: "纺织服装", color: "bg-rose-50 text-rose-700 hover:bg-rose-100" },
  { name: "新能源汽车", color: "bg-green-50 text-green-700 hover:bg-green-100" },
  { name: "高端装备", color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
  { name: "其他行业", color: "bg-gray-50 text-gray-600 hover:bg-gray-100" },
]

const reports: ReportItem[] = [
  // 宏观经济
  { id: "r001", title: "2026年Q1宏观经济形势展望：政策暖风与结构压力并存", category: "宏观经济", subCategory: "中国经济", date: "2026-03-19", isHot: true, views: 8420 },
  { id: "r002", title: "美联储3月FOMC会议解读：降息路径再度收窄", category: "宏观经济", subCategory: "美国经济", date: "2026-03-19", isNew: true, views: 6730 },
  { id: "r003", title: "华福证券-2026年3月美联储议息会议解读：降息预期前移一步后移", category: "宏观经济", subCategory: "美国经济", date: "2026-03-19", views: 4210 },
  { id: "r004", title: "开源证券-3月FOMC前瞻：美联储仍处于政策观察期", category: "宏观经济", subCategory: "货币政策", date: "2026-03-19", views: 3980 },
  { id: "r005", title: "中国1-2月经济数据点评：开年平稳，投资亮点突出", category: "宏观经济", subCategory: "中国经济", date: "2026-03-17", isHot: true, views: 7150 },
  { id: "r006", title: "全球流动性周报：资金向亚洲市场持续回流信号增强", category: "宏观经济", subCategory: "海外经济", date: "2026-03-18", views: 2890 },
  { id: "r007", title: "欧洲央行货币政策前瞻：欧元区通胀粘性仍存", category: "宏观经济", subCategory: "欧洲经济", date: "2026-03-18", views: 2340 },
  { id: "r008", title: "资产配置月报：破水尝试后的再平衡方向", category: "宏观经济", subCategory: "货币政策", date: "2026-03-18", views: 3120 },

  // 投资策略
  { id: "r009", title: "2026年一级市场资产配置策略：结构性机会优先于总量beta", category: "投资策略", subCategory: "综合策略", date: "2026-03-19", isHot: true, views: 9810 },
  { id: "r010", title: "科技赛道重点布局建议：AI应用端进入兑现窗口期", category: "投资策略", subCategory: "行业策略", date: "2026-03-18", views: 7430 },
  { id: "r011", title: "LP组合构建与风险管理优化：2026年配置框架更新", category: "投资策略", subCategory: "综合策略", date: "2026-03-17", views: 5280 },
  { id: "r012", title: "定期策略月报：权益资产性价比阶段性修复", category: "投资策略", subCategory: "定期策略", date: "2026-03-15", views: 4690 },
  { id: "r013", title: "全球策略：亚太市场估值洼地与资金轮动路径", category: "投资策略", subCategory: "全球策略", date: "2026-03-14", views: 3870 },
  { id: "r014", title: "硬科技专题策略：卡脖子赛道估值体系重构", category: "投资策略", subCategory: "行业策略", date: "2026-03-12", isNew: true, views: 6120 },
  { id: "r015", title: "策略数据周报：北向资金与机构持仓变化追踪", category: "投资策略", subCategory: "策略数据", date: "2026-03-19", views: 2980 },
  { id: "r016", title: "出海主题投资策略：跨境资产并购机遇梳理", category: "投资策略", subCategory: "行业策略", date: "2026-03-11", views: 4150 },

  // 行业分析
  { id: "r017", title: "人工智能赛道深度：大模型应用进入爆发前夜", category: "行业分析", subCategory: "行业评论", date: "2026-03-19", isHot: true, views: 12300 },
  { id: "r018", title: "新能源汽车产业链投资价值分析：智驾与储能双轮驱动", category: "行业分析", subCategory: "行业策略", date: "2026-03-18", views: 8760 },
  { id: "r019", title: "医疗健康行业深度：创新药与医疗器械赛道分化研究", category: "行业分析", subCategory: "定期报告", date: "2026-03-17", views: 6430 },
  { id: "r020", title: "消费行业季报：线下复苏分化，品牌集中度持续提升", category: "行业分析", subCategory: "行业数据", date: "2026-03-16", views: 4280 },
  { id: "r021", title: "半导体行业周报：国产替代进度与景气度追踪", category: "行业分析", subCategory: "行业信息", date: "2026-03-19", isNew: true, views: 5920 },
  { id: "r022", title: "企业服务SaaS深度研究：AI Native产品重塑竞争格局", category: "行业分析", subCategory: "行业评论", date: "2026-03-15", views: 7110 },
  { id: "r023", title: "绿色能源行业报告：储能降本路径与市场规模测算", category: "行业分析", subCategory: "定期报告", date: "2026-03-14", views: 3890 },
  { id: "r024", title: "跨境电商行业分析：东南亚市场渗透率提升空间研判", category: "行业分析", subCategory: "行业策略", date: "2026-03-13", views: 3450 },

  // 公司调研
  { id: "r025", title: "某AI大模型公司深度调研：商业化进展与估值锚定", category: "公司调研", subCategory: "公司研究", date: "2026-03-19", isHot: true, views: 10240 },
  { id: "r026", title: "被投企业年度经营数据点评：营收增速与盈利质量分析", category: "公司调研", subCategory: "财报点评", date: "2026-03-18", views: 5670 },
  { id: "r027", title: "重点关注标的业绩预期修正报告：Q4超预期后的展望", category: "公司调研", subCategory: "业绩报告", date: "2026-03-17", isNew: true, views: 4380 },
  { id: "r028", title: "新能源整车标的企业调研：交付节奏与产能爬坡评估", category: "公司调研", subCategory: "公司研究", date: "2026-03-16", views: 6210 },
  { id: "r029", title: "生物科技被投企业公司评论：管线进展与里程碑节点预判", category: "公司调研", subCategory: "公司评论", date: "2026-03-15", views: 3920 },
  { id: "r030", title: "硬科技企业财报点评：研发投入强度与专利转化效率", category: "公司调研", subCategory: "财报点评", date: "2026-03-14", views: 2980 },
  { id: "r031", title: "企业服务标的Q1业绩前瞻：ARR增速与NRR指标监测", category: "公司调研", subCategory: "业绩报告", date: "2026-03-12", views: 3450 },
  { id: "r032", title: "消费品牌标的调研：渠道扩张与品类延伸战略评估", category: "公司调研", subCategory: "公司研究", date: "2026-03-10", views: 2870 },
]

// Featured reports for the banner area
const featuredReports = [
  { id: "f1", title: "电子行业：AI存储架构升级，头部厂商有望加速应用", category: "行业分析", coverColor: "from-blue-600 to-indigo-700", coverText: "AI\nSTORAGE" },
  { id: "f2", title: "新能源行业年度投资策略：锂电与新能源车产业链机会", category: "投资策略", coverColor: "from-emerald-600 to-teal-700", coverText: "NEV\nSTRATEGY" },
  { id: "f3", title: "食品饮料行业大消费战略研究（二）：扩大内需政策落地路径", category: "行业分析", coverColor: "from-amber-600 to-orange-700", coverText: "CONSUMER\nINSIGHT" },
]

// ─── Sub-Components ────────────────────────────────────────────────────────────

function ReportListItem({
  item,
  rank,
}: {
  item: ReportItem
  rank?: number
}) {
  return (
    <div className="group flex items-start gap-3 py-2 cursor-pointer hover:bg-blue-50/50 px-2 rounded transition-colors">
      {rank !== undefined && (
        <span
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 rounded text-[11px] font-bold flex items-center justify-center",
            rank < 3 ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          {rank + 1}
        </span>
      )}
      {rank === undefined && (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5 flex-wrap">
          {item.isHot && (
            <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold bg-red-500 text-white shrink-0">
              <Flame className="h-2.5 w-2.5" />热
            </span>
          )}
          {item.isNew && (
            <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold bg-blue-500 text-white shrink-0">
              <Star className="h-2.5 w-2.5" />新
            </span>
          )}
          <p className="text-sm text-foreground line-clamp-1 group-hover:text-blue-600 transition-colors leading-snug">
            {item.title}
          </p>
        </div>
        {rank !== undefined && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Eye className="h-3 w-3" />
            {item.views.toLocaleString()} 浏览
          </div>
        )}
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground mt-0.5">{item.date.slice(5)}</span>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ResearchCenter() {
  const [activeCategory, setActiveCategory] = useState<MainCategory>("宏观经济")
  const [hotPeriod, setHotPeriod] = useState<HotPeriod>("今日热门")
  const [expandedLeft, setExpandedLeft] = useState<MainCategory | null>("宏观经济")
  const [featuredIdx, setFeaturedIdx] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")

  const categoryReports = reports.filter(
    (r) => r.category === activeCategory &&
      (!searchQuery || r.title.includes(searchQuery))
  )

  const hotReports = [...reports]
    .sort((a, b) => {
      if (hotPeriod === "今日热门") return b.views - a.views
      if (hotPeriod === "本周热门") return b.views * 0.7 - a.views * 0.7
      return b.views * 1.2 - a.views * 1.2
    })
    .slice(0, 9)

  const currentFeatured = featuredReports[featuredIdx]

  return (
    <div className="flex h-full overflow-hidden bg-[#F8FAFC]">

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <div className="w-44 shrink-0 overflow-y-auto border-r border-border bg-white py-3">
        {/* Search bar */}
        <div className="px-3 mb-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索研报..."
              className="pl-7 h-7 text-xs bg-muted/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {leftCategories.map(({ key, icon, subs }) => {
          const isExpanded = expandedLeft === key
          const isActive = activeCategory === key
          return (
            <div key={key}>
              {/* Category header */}
              <button
                onClick={() => {
                  setExpandedLeft(isExpanded ? null : key)
                  setActiveCategory(key)
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "text-blue-600 bg-blue-50"
                    : "text-foreground hover:bg-muted/60"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={isActive ? "text-blue-600" : "text-muted-foreground"}>{icon}</span>
                  {key}
                </div>
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    isExpanded && "rotate-90"
                  )}
                />
              </button>
              {/* Sub-items */}
              {isExpanded && (
                <ul className="bg-muted/20">
                  {subs.map((sub) => (
                    <li key={sub}>
                      <button
                        onClick={() => setActiveCategory(key)}
                        className="w-full py-1.5 pl-9 pr-3 text-left text-xs text-muted-foreground hover:text-blue-600 hover:bg-blue-50/60 transition-colors"
                      >
                        {sub}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Featured banner */}
        <div className="flex gap-3 p-4 border-b border-border bg-white">
          {/* Banner image */}
          <div className="relative h-44 flex-1 overflow-hidden rounded-xl shrink-0">
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br flex items-center justify-center",
              currentFeatured.coverColor
            )}>
              {/* grid overlay */}
              <div className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg,transparent,transparent 29px,rgba(255,255,255,.2) 29px,rgba(255,255,255,.2) 30px),repeating-linear-gradient(90deg,transparent,transparent 29px,rgba(255,255,255,.2) 29px,rgba(255,255,255,.2) 30px)",
                }}
              />
              <pre className="text-center text-[11px] font-bold tracking-widest text-white/70 whitespace-pre-wrap">{currentFeatured.coverText}</pre>
            </div>
            {/* Caption */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
              <p className="text-sm font-semibold text-white line-clamp-1">{currentFeatured.title}</p>
            </div>
            {/* Carousel dots */}
            <div className="absolute right-3 top-3 flex gap-1">
              {featuredReports.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setFeaturedIdx(i)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === featuredIdx ? "w-5 bg-white" : "w-2 bg-white/50"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Recommended articles sidebar */}
          <div className="w-56 shrink-0 flex flex-col">
            <div className="flex items-center gap-1.5 mb-2">
              <BookMarked className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-foreground">网站推荐</span>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {reports.filter(r => r.isHot).slice(0, 2).map((r) => (
                <div key={r.id}
                  className="group flex gap-2 rounded-lg border border-border bg-muted/30 p-2 cursor-pointer hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
                >
                  <div className={cn(
                    "h-12 w-14 shrink-0 rounded flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br",
                    r.category === "宏观经济" ? "from-blue-500 to-indigo-600"
                      : r.category === "投资策略" ? "from-violet-500 to-purple-600"
                      : r.category === "行业分析" ? "from-teal-500 to-cyan-600"
                      : "from-rose-500 to-pink-600"
                  )}>
                    PDF
                  </div>
                  <p className="text-xs text-foreground line-clamp-3 leading-snug group-hover:text-blue-600 transition-colors">{r.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category tabs + article list */}
        <div className="bg-white mt-2 mx-0 border-y border-border">
          {/* Tabs */}
          <div className="flex items-center border-b border-border px-4">
            {(["宏观经济", "投资策略", "行业分析", "公司调研"] as MainCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  activeCategory === cat
                    ? "text-blue-600"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cat}
                {activeCategory === cat && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
            <button className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors py-2.5">
              更多
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Article list */}
          <div className="divide-y divide-border/60">
            {categoryReports.slice(0, 8).map((r) => (
              <div key={r.id} className="px-4 py-0.5">
                <ReportListItem item={r} />
              </div>
            ))}
            {categoryReports.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无相关研报</div>
            )}
          </div>
        </div>

        {/* Bottom two-column section */}
        <div className="grid grid-cols-2 gap-2 p-2 pt-2">
          {/* 晨会早刊 / 机构资讯 */}
          <MorningSection reports={reports} />
          {/* 新股研究 / 并购重组 / 融资融券 */}
          <SpecialSection reports={reports} />
        </div>
      </div>

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 overflow-y-auto border-l border-border bg-white py-4 px-3 space-y-4">

        {/* 主要行业 */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart2 className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-foreground">主要行业</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {industries.map((ind) => (
              <button
                key={ind.name}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                  ind.color
                )}
              >
                {ind.name}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground leading-snug">
            点击行业标签进入对应行业分类
          </p>
        </div>

        <div className="h-px bg-border" />

        {/* 热门排行 */}
        <div>
          {/* Period tabs */}
          <div className="flex items-center gap-0 mb-2 border-b border-border">
            {(["今日热门", "本周热门", "本月热门"] as HotPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setHotPeriod(p)}
                className={cn(
                  "text-[11px] font-medium px-2 py-1.5 transition-colors relative",
                  hotPeriod === p
                    ? "text-blue-600"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.replace("热门", "")}热门
                {hotPeriod === p && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          <ul className="space-y-0">
            {hotReports.map((r, idx) => (
              <li
                key={r.id}
                className="group flex items-start gap-2 py-1.5 cursor-pointer hover:bg-muted/40 rounded px-1 transition-colors"
              >
                <span
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded text-[10px] font-bold flex items-center justify-center",
                    idx < 3 ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {idx + 1}
                </span>
                <p className="text-[11px] text-foreground line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                  {r.title}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── Bottom Section Components ─────────────────────────────────────────────────

function MorningSection({ reports }: { reports: ReportItem[] }) {
  const [tab, setTab] = useState<"晨会早刊" | "机构资讯">("晨会早刊")
  const items = reports.slice(0, 10)
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="flex items-center border-b border-border">
        {(["晨会早刊", "机构资讯"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              tab === t ? "text-blue-600" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          </button>
        ))}
        <button className="ml-auto flex items-center gap-1 text-xs text-blue-600 pr-3 py-2.5">
          更多 <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="divide-y divide-border/60">
        {items.slice(0, 8).map((r) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-2 group cursor-pointer hover:bg-muted/30 transition-colors">
            <p className="text-xs text-foreground line-clamp-1 group-hover:text-blue-600 transition-colors flex-1 min-w-0 mr-3">
              {tab === "晨会早刊" ? `AtomCAP研究-${r.title.slice(0, 20)}...` : r.title.slice(0, 25) + "..."}
            </p>
            <span className="text-[11px] text-muted-foreground shrink-0">{r.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SpecialSection({ reports }: { reports: ReportItem[] }) {
  const [tab, setTab] = useState<"新股研究" | "并购重组" | "融资融券">("新股研究")
  const items = reports.filter(r => r.category === "公司调研").slice(0, 8)
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="flex items-center border-b border-border">
        {(["新股研究", "并购重组", "融资融券"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2.5 text-sm font-medium transition-colors relative",
              tab === t ? "text-blue-600" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          </button>
        ))}
        <button className="ml-auto flex items-center gap-1 text-xs text-blue-600 pr-3 py-2.5">
          更多 <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="divide-y divide-border/60">
        {items.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-2 group cursor-pointer hover:bg-muted/30 transition-colors">
            <p className="text-xs text-foreground line-clamp-1 group-hover:text-blue-600 transition-colors flex-1 min-w-0 mr-3">
              {tab === "新股研究"
                ? `新股专题-${r.title.slice(0, 18)}...`
                : tab === "并购重组"
                ? `并购重组-${r.title.slice(0, 18)}...`
                : `融资融券-${r.title.slice(0, 18)}...`}
            </p>
            <span className="text-[11px] text-muted-foreground shrink-0">{r.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
