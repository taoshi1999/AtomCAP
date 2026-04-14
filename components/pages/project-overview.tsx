"use client"

import { useState, useRef, useEffect } from "react"
import {
  DollarSign,
  TrendingUp,
  ShieldAlert,

  Upload,
  CheckCircle2,
  FileText,
  Clock,
  Briefcase,
  User,
  Calendar,
  Tag,
  MessageCircle,
  Search,
  UserPlus,
  Plus,
  Send,
  Smile,
  Paperclip,
  Scissors,
  History,
  FilePlus2,
  Lightbulb,
  Scale,
  FolderOpen,
  ArrowLeft,
  X,
  Users,
  Hash,
  Image,
  ChevronDown,
  Check,
} from "lucide-react"
import type { HypothesisTableItem } from "@/components/pages/hypothesis-checklist"
import type { TermTableItem } from "@/components/pages/term-sheet"
import type { StrategyMaterial } from "@/components/pages/strategies-grid"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/* ------------------------------------------------------------------ */
/*  Chat mock data                                                     */
/* ------------------------------------------------------------------ */
interface ChatMember {
  id: string
  name: string
  initials: string
  role: string
  color: string
  online: boolean
}

interface ChatGroup {
  id: string
  name: string
  icon: string
  memberCount: number
  lastMessage: string
  lastTime: string
}

interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  senderInitials: string
  senderColor: string
  content: string
  time: string
  isMe: boolean
  type: "text" | "file" | "shared-doc" | "hypothesis-ref" | "term-ref" | "material-ref"
  refTitle?: string
}

const MOCK_MEMBERS: ChatMember[] = [
  { id: "m1", name: "张伟", initials: "张", role: "投资经理", color: "bg-blue-500", online: true },
  { id: "m2", name: "李四", initials: "李", role: "高级分析师", color: "bg-emerald-500", online: true },
  { id: "m3", name: "王五", initials: "王", role: "合伙人", color: "bg-amber-500", online: false },
  { id: "m4", name: "王芳", initials: "芳", role: "财务总监", color: "bg-violet-500", online: true },
  { id: "m5", name: "赵强", initials: "赵", role: "法务顾问", color: "bg-rose-500", online: false },
  { id: "m6", name: "陈总", initials: "陈", role: "风控总监", color: "bg-teal-500", online: true },
  { id: "m7", name: "刘燕", initials: "刘", role: "研究员", color: "bg-indigo-500", online: false },
]

const MOCK_GROUPS: ChatGroup[] = [
  { id: "g1", name: "技术组", icon: "🔧", memberCount: 4, lastMessage: "技术尽调报告已更新", lastTime: "10:30" },
  { id: "g2", name: "投决委员会", icon: "📋", memberCount: 5, lastMessage: "本周投决会议安排", lastTime: "昨天" },
  { id: "g3", name: "法务组", icon: "⚖️", memberCount: 3, lastMessage: "条款修改建议已提交", lastTime: "昨天" },
  { id: "g4", name: "财务组", icon: "💰", memberCount: 3, lastMessage: "Q4财报分析完成", lastTime: "周一" },
]

function getMockMessages(targetId: string, targetName: string): ChatMessage[] {
  if (targetId === "g1") return [
    { id: "1", senderId: "m2", senderName: "李四", senderInitials: "李", senderColor: "bg-emerald-500", content: "技术尽调的初步结论出来了，模型架构比较先进", time: "09:15", isMe: false, type: "text" },
    { id: "2", senderId: "me", senderName: "张伟", senderInitials: "张", senderColor: "bg-blue-500", content: "好的，能分享一下详细的评估报告吗？", time: "09:20", isMe: true, type: "text" },
    { id: "3", senderId: "m2", senderName: "李四", senderInitials: "李", senderColor: "bg-emerald-500", content: "", time: "09:25", isMe: false, type: "file", refTitle: "AI模型架构评估报告_v2.pdf" },
    { id: "4", senderId: "m6", senderName: "陈总", senderInitials: "陈", senderColor: "bg-teal-500", content: "风控方面有几个点需要关注，我在文档里标注了", time: "09:30", isMe: false, type: "text" },
    { id: "5", senderId: "me", senderName: "张伟", senderInitials: "张", senderColor: "bg-blue-500", content: "收到，我看一下。大家看看这个假设的验证情况", time: "09:45", isMe: true, type: "text" },
    { id: "6", senderId: "me", senderName: "张伟", senderInitials: "张", senderColor: "bg-blue-500", content: "", time: "09:46", isMe: true, type: "hypothesis-ref", refTitle: "核心AI模型性能达到行业领先水平" },
    { id: "7", senderId: "m2", senderName: "李四", senderInitials: "李", senderColor: "bg-emerald-500", content: "这个假设我认为基本可以成立，测试结果很不错", time: "10:00", isMe: false, type: "text" },
    { id: "8", senderId: "m4", senderName: "王芳", senderInitials: "芳", senderColor: "bg-violet-500", content: "财务数据我也整理好了，整体收入增长很健康", time: "10:15", isMe: false, type: "text" },
    { id: "9", senderId: "m6", senderName: "陈总", senderInitials: "陈", senderColor: "bg-teal-500", content: "技术尽调报告已更新，请大家审阅", time: "10:30", isMe: false, type: "text" },
  ]
  if (targetId === "g2") return [
    { id: "1", senderId: "m3", senderName: "王五", senderInitials: "王", senderColor: "bg-amber-500", content: "本周四下午2点召开投决会议，请各位准备好材料", time: "昨天 14:00", isMe: false, type: "text" },
    { id: "2", senderId: "me", senderName: "张伟", senderInitials: "张", senderColor: "bg-blue-500", content: "收到，我准备好了项目摘要和估值模型", time: "昨天 14:30", isMe: true, type: "text" },
    { id: "3", senderId: "m5", senderName: "赵强", senderInitials: "赵", senderColor: "bg-rose-500", content: "法律尽调报告也已完成，需要讨论几个关键条款", time: "昨天 15:00", isMe: false, type: "text" },
    { id: "4", senderId: "m5", senderName: "赵强", senderInitials: "赵", senderColor: "bg-rose-500", content: "", time: "昨天 15:01", isMe: false, type: "term-ref", refTitle: "采用完全棘轮反稀释条款保护投资方权益" },
    { id: "5", senderId: "m3", senderName: "王五", senderInitials: "王", senderColor: "bg-amber-500", content: "本周投决会议安排已更新，请查看", time: "昨天 16:00", isMe: false, type: "text" },
  ]
  // Default for members
  return [
    { id: "1", senderId: targetId, senderName: targetName, senderInitials: targetName.charAt(0), senderColor: "bg-gray-500", content: `你好，关于项目有些问题想讨论一下`, time: "14:00", isMe: false, type: "text" },
    { id: "2", senderId: "me", senderName: "张伟", senderInitials: "张", senderColor: "bg-blue-500", content: "好的，请说", time: "14:05", isMe: true, type: "text" },
  ]
}

/* ------------------------------------------------------------------ */
/*  Emoji picker data                                                  */
/* ------------------------------------------------------------------ */
const EMOJI_LIST = ["😀","😂","🤣","😊","😍","🤔","😅","😎","👍","👏","🎉","❤️","🔥","💪","✅","📊","📈","💡","⭐","🚀"]

/* ------------------------------------------------------------------ */
/*  Default overview data                                              */
/* ------------------------------------------------------------------ */
const defaultMetrics = [
  {
    label: "估值",
    value: "10亿",
    unit: "USD",
    icon: DollarSign,
    trend: "+15%",
    trendUp: true,
  },
  {
    label: "累计融资金额",
    value: "3.2亿",
    unit: "USD",
    icon: TrendingUp,
    trend: "B轮",
    trendUp: true,
  },
  {
    label: "风险指数",
    value: "低",
    unit: "",
    icon: ShieldAlert,
    trend: "2/10",
    trendUp: false,
  },
]

const defaultTimeline = [
  {
    user: "张伟",
    avatar: "张",
    action: "上传了财务报表",
    target: "MiniMax_财务数据_2023Q4.xlsx",
    time: "2小时前",
    icon: Upload,
    color: "bg-blue-100 text-blue-600",
  },
  {
    user: "李四",
    avatar: "李",
    action: "完成了技术尽调",
    target: "AI 模型架构评估报告",
    time: "5小时前",
    icon: CheckCircle2,
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    user: "王芳",
    avatar: "王",
    action: "更新了条款草案",
    target: "B轮投资条款 v2.1",
    time: "昨天 16:30",
    icon: FileText,
    color: "bg-amber-100 text-amber-600",
  },
  {
    user: "赵强",
    avatar: "赵",
    action: "添加了竞品分析",
    target: "智谱AI vs MiniMax 对比报告",
    time: "昨天 10:15",
    icon: TrendingUp,
    color: "bg-violet-100 text-violet-600",
  },
]

/* ------------------------------------------------------------------ */
/*  Communication Center Component                                     */
/* ------------------------------------------------------------------ */
function CommunicationCenter({ onBack, hypotheses = [], terms = [], materials = [] }: { onBack: () => void; hypotheses?: HypothesisTableItem[]; terms?: TermTableItem[]; materials?: StrategyMaterial[] }) {
  const [sidebarTab, setSidebarTab] = useState<"members" | "groups">("members")
  const [memberSearch, setMemberSearch] = useState("")
  const [groupSearch, setGroupSearch] = useState("")
  const [selectedChat, setSelectedChat] = useState<{ id: string; name: string; type: "member" | "group" } | null>(null)
  const [messageInput, setMessageInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showToolbar, setShowToolbar] = useState(false)
  const [showSharedDocDialog, setShowSharedDocDialog] = useState(false)
  const [sharedDocName, setSharedDocName] = useState("")
  const [sharedDocDesc, setSharedDocDesc] = useState("")
  const [sharedDocType, setSharedDocType] = useState<"word" | "excel" | "powerpoint">("word")
  const [showHypothesisRefDialog, setShowHypothesisRefDialog] = useState(false)
  const [hypothesisRefSearch, setHypothesisRefSearch] = useState("")
  const [selectedHypothesisIds, setSelectedHypothesisIds] = useState<Set<string>>(new Set())
  const [showTermRefDialog, setShowTermRefDialog] = useState(false)
  const [termRefSearch, setTermRefSearch] = useState("")
  const [selectedTermIds, setSelectedTermIds] = useState<Set<string>>(new Set())
  const [showMaterialRefDialog, setShowMaterialRefDialog] = useState(false)
  const [materialRefSearch, setMaterialRefSearch] = useState("")
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const filteredMembers = MOCK_MEMBERS.filter(
    (m) => m.name.includes(memberSearch) || m.role.includes(memberSearch)
  )
  const filteredGroups = MOCK_GROUPS.filter(
    (g) => g.name.includes(groupSearch)
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Close popups on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false)
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) setShowToolbar(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSelectChat(id: string, name: string, type: "member" | "group") {
    setSelectedChat({ id, name, type })
    setMessages(getMockMessages(id, name))
    setShowEmojiPicker(false)
    setShowToolbar(false)
  }

  function handleSendMessage() {
    if (!messageInput.trim() || !selectedChat) return
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: "me",
      senderName: "张伟",
      senderInitials: "张",
      senderColor: "bg-blue-500",
      content: messageInput.trim(),
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      isMe: true,
      type: "text",
    }
    setMessages((prev) => [...prev, newMsg])
    setMessageInput("")
  }

  function handleInsertEmoji(emoji: string) {
    setMessageInput((prev) => prev + emoji)
    setShowEmojiPicker(false)
  }

  function handleToolbarAction(action: string) {
    if (!selectedChat) return
    // Open shared doc dialog instead of directly sending
    if (action === "shared-doc") {
      setSharedDocName("")
      setSharedDocDesc("")
      setSharedDocType("word")
      setShowSharedDocDialog(true)
      setShowToolbar(false)
      return
    }
    if (action === "hypothesis") {
      setHypothesisRefSearch("")
      setSelectedHypothesisIds(new Set())
      setShowHypothesisRefDialog(true)
      setShowToolbar(false)
      return
    }
    if (action === "term") {
      setTermRefSearch("")
      setSelectedTermIds(new Set())
      setShowTermRefDialog(true)
      setShowToolbar(false)
      return
    }
    if (action === "material") {
      setMaterialRefSearch("")
      setSelectedMaterialIds(new Set())
      setShowMaterialRefDialog(true)
      setShowToolbar(false)
      return
    }
    setShowToolbar(false)
  }

  function handleCreateSharedDoc() {
    if (!sharedDocName.trim() || !selectedChat) return
    const typeExtMap = { word: ".docx", excel: ".xlsx", powerpoint: ".pptx" }
    const typeLabelMap = { word: "Word 文档", excel: "Excel 表格", powerpoint: "PowerPoint 演示" }
    const ext = typeExtMap[sharedDocType]
    const displayName = sharedDocName.trim() + ext
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: "me",
      senderName: "张伟",
      senderInitials: "张",
      senderColor: "bg-blue-500",
      content: sharedDocDesc.trim() || "",
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      isMe: true,
      type: "shared-doc",
      refTitle: displayName,
    }
    setMessages((prev) => [...prev, msg])
    setShowSharedDocDialog(false)
  }

  function handleSendHypothesisRef() {
    if (selectedHypothesisIds.size === 0 || !selectedChat) return
    const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    const selected = hypotheses.filter((h) => selectedHypothesisIds.has(h.id))
    const newMessages: ChatMessage[] = selected.map((h, idx) => ({
      id: `msg-${Date.now()}-${idx}`,
      senderId: "me",
      senderName: "张伟",
      senderInitials: "张",
      senderColor: "bg-blue-500",
      content: "",
      time: now,
      isMe: true,
      type: "hypothesis-ref" as const,
      refTitle: h.name,
    }))
    setMessages((prev) => [...prev, ...newMessages])
    setShowHypothesisRefDialog(false)
  }

  function toggleHypothesisSelection(id: string) {
    setSelectedHypothesisIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getHypothesisStatusLabel(status: string) {
    if (status === "verified") return { label: "已验证", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    if (status === "risky") return { label: "有风险", color: "bg-red-50 text-red-700 border-red-200" }
    return { label: "待验证", color: "bg-amber-50 text-amber-700 border-amber-200" }
  }

  function handleSendTermRef() {
    if (selectedTermIds.size === 0 || !selectedChat) return
    const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    const selected = terms.filter((t) => selectedTermIds.has(t.id))
    const newMessages: ChatMessage[] = selected.map((t, idx) => ({
      id: `msg-${Date.now()}-${idx}`,
      senderId: "me",
      senderName: "张伟",
      senderInitials: "张",
      senderColor: "bg-blue-500",
      content: "",
      time: now,
      isMe: true,
      type: "term-ref" as const,
      refTitle: t.name,
    }))
    setMessages((prev) => [...prev, ...newMessages])
    setShowTermRefDialog(false)
  }

  function toggleTermSelection(id: string) {
    setSelectedTermIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getTermStatusLabel(status: string) {
    if (status === "approved") return { label: "通过", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    if (status === "rejected") return { label: "否决", color: "bg-red-50 text-red-700 border-red-200" }
    return { label: "待审", color: "bg-amber-50 text-amber-700 border-amber-200" }
  }

  function handleSendMaterialRef() {
    if (selectedMaterialIds.size === 0 || !selectedChat) return
    const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    const selected = materials.filter((m) => selectedMaterialIds.has(m.id))
    const newMessages: ChatMessage[] = selected.map((m, idx) => ({
      id: `msg-${Date.now()}-${idx}`,
      senderId: "me",
      senderName: "张伟",
      senderInitials: "张",
      senderColor: "bg-blue-500",
      content: "",
      time: now,
      isMe: true,
      type: "material-ref" as const,
      refTitle: m.name,
    }))
    setMessages((prev) => [...prev, ...newMessages])
    setShowMaterialRefDialog(false)
  }

  function toggleMaterialSelection(id: string) {
    setSelectedMaterialIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getFormatColor(format: string) {
    const f = format.toUpperCase()
    if (f === "PDF") return "bg-red-50 text-red-600 border-red-200"
    if (f === "XLSX" || f === "XLS") return "bg-emerald-50 text-emerald-600 border-emerald-200"
    if (f === "DOCX" || f === "DOC") return "bg-blue-50 text-blue-600 border-blue-200"
    if (f === "PPTX" || f === "PPT") return "bg-orange-50 text-orange-600 border-orange-200"
    return "bg-gray-50 text-gray-600 border-gray-200"
  }

  function renderRefCard(msg: ChatMessage) {
    const configs: Record<string, { icon: React.ElementType; bg: string; text: string; label: string }> = {
      "file": { icon: FileText, bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "文件" },
      "shared-doc": { icon: FilePlus2, bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700", label: "共享文档" },
      "hypothesis-ref": { icon: Lightbulb, bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "引用假设" },
      "term-ref": { icon: Scale, bg: "bg-violet-50 border-violet-200", text: "text-violet-700", label: "引用条款" },
      "material-ref": { icon: FolderOpen, bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "引用材料" },
    }
    const cfg = configs[msg.type]
    if (!cfg) return null
    const Icon = cfg.icon
    return (
      <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${cfg.bg}`}>
        <Icon className={`h-4 w-4 shrink-0 ${cfg.text}`} />
        <div className="min-w-0">
          <p className={`text-[10px] font-medium ${cfg.text} opacity-70`}>{cfg.label}</p>
          <p className={`text-xs font-medium ${cfg.text} truncate`}>{msg.refTitle}</p>
          {msg.content && msg.type === "shared-doc" && (
            <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">{msg.content}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#F3F4F6]">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-[#E5E7EB] bg-white px-5 py-3">
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors">
          <ArrowLeft className="h-4 w-4" />
          返回概览
        </button>
        <div className="h-5 w-px bg-[#E5E7EB]" />
        <MessageCircle className="h-5 w-5 text-[#2563EB]" />
        <h2 className="text-base font-semibold text-[#111827]">交流中心</h2>
        {selectedChat && (
          <>
            <div className="h-5 w-px bg-[#E5E7EB]" />
            <span className="text-sm text-[#6B7280]">
              {selectedChat.type === "group" ? "📢" : "💬"} {selectedChat.name}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar ── */}
        <div className="flex w-[280px] shrink-0 flex-col border-r border-[#E5E7EB] bg-white">
          {/* Tabs */}
          <div className="flex border-b border-[#E5E7EB]">
            <button
              onClick={() => setSidebarTab("members")}
              className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors ${sidebarTab === "members" ? "border-b-2 border-[#2563EB] text-[#2563EB]" : "text-[#6B7280] hover:text-[#374151]"}`}
            >
              <Users className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              成员
            </button>
            <button
              onClick={() => setSidebarTab("groups")}
              className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors ${sidebarTab === "groups" ? "border-b-2 border-[#2563EB] text-[#2563EB]" : "text-[#6B7280] hover:text-[#374151]"}`}
            >
              <Hash className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              群组
            </button>
          </div>

          {/* Members tab */}
          {sidebarTab === "members" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="p-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                  <Input
                    placeholder="搜索成员..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-[#F9FAFB] border-[#E5E7EB]"
                  />
                </div>
                <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#D1D5DB] py-1.5 text-xs font-medium text-[#6B7280] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
                  <UserPlus className="h-3.5 w-3.5" />
                  邀请新成员
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectChat(m.id, m.name, "member")}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${selectedChat?.id === m.id ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"}`}
                  >
                    <div className="relative">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${m.color} text-white text-xs font-bold`}>
                        {m.initials}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${m.online ? "bg-emerald-400" : "bg-gray-300"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#111827] truncate">{m.name}</p>
                      <p className="text-[11px] text-[#9CA3AF] truncate">{m.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Groups tab */}
          {sidebarTab === "groups" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="p-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                  <Input
                    placeholder="搜索群组..."
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-[#F9FAFB] border-[#E5E7EB]"
                  />
                </div>
                <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#D1D5DB] py-1.5 text-xs font-medium text-[#6B7280] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  创建新群组
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {filteredGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSelectChat(g.id, g.name, "group")}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors ${selectedChat?.id === g.id ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"}`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F4F6] text-base">
                      {g.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#111827] truncate">{g.name}</p>
                        <span className="text-[10px] text-[#9CA3AF] shrink-0 ml-1">{g.lastTime}</span>
                      </div>
                      <p className="text-[11px] text-[#9CA3AF] truncate">{g.lastMessage}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right chat area ── */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[#F9FAFB]">
          {!selectedChat ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EFF6FF]">
                <MessageCircle className="h-8 w-8 text-[#2563EB]" />
              </div>
              <p className="mt-4 text-sm font-medium text-[#374151]">选择成员或群组开始聊天</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">点击左侧列表中的成员或群组</p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2.5 ${msg.isMe ? "flex-row-reverse" : ""}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.senderColor} text-white text-xs font-bold`}>
                      {msg.senderInitials}
                    </div>
                    <div className={`max-w-[60%] ${msg.isMe ? "items-end" : "items-start"}`}>
                      <div className={`flex items-center gap-2 mb-0.5 ${msg.isMe ? "flex-row-reverse" : ""}`}>
                        <span className="text-xs font-medium text-[#374151]">{msg.senderName}</span>
                        <span className="text-[10px] text-[#9CA3AF]">{msg.time}</span>
                      </div>
                      {msg.type === "text" ? (
                        <div className={`rounded-xl px-3.5 py-2 text-sm leading-relaxed ${msg.isMe ? "bg-[#2563EB] text-white rounded-tr-sm" : "bg-white text-[#374151] border border-[#E5E7EB] rounded-tl-sm"}`}>
                          {msg.content}
                        </div>
                      ) : (
                        renderRefCard(msg)
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-[#E5E7EB] bg-white px-4 py-3">
                {/* Toolbar row */}
                <div className="flex items-center gap-1 mb-2">
                  {/* Emoji */}
                  <div className="relative" ref={emojiRef}>
                    <button
                      onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowToolbar(false) }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors"
                      title="表情"
                    >
                      <Smile className="h-4 w-4" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-full left-0 mb-1 z-50 rounded-xl border border-[#E5E7EB] bg-white p-2.5 shadow-lg w-[240px]">
                        <p className="text-[10px] text-[#9CA3AF] font-medium mb-1.5">常用表情</p>
                        <div className="grid grid-cols-10 gap-0.5">
                          {EMOJI_LIST.map((e) => (
                            <button key={e} onClick={() => handleInsertEmoji(e)} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#F3F4F6] text-sm">
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors" title="上传文件">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors" title="截图">
                    <Image className="h-4 w-4" />
                  </button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors" title="聊天记录">
                    <History className="h-4 w-4" />
                  </button>

                  <div className="h-4 w-px bg-[#E5E7EB] mx-0.5" />

                  {/* Extended toolbar */}
                  <div className="relative" ref={toolbarRef}>
                    <button
                      onClick={() => { setShowToolbar(!showToolbar); setShowEmojiPicker(false) }}
                      className="flex h-7 items-center gap-1 rounded-md px-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors"
                      title="更多功能"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium">更多</span>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {showToolbar && (
                      <div className="absolute bottom-full left-0 mb-1 z-50 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg w-[180px]">
                        {[
                          { key: "shared-doc", icon: FilePlus2, label: "创建共享文档", color: "text-indigo-600" },
                          { key: "hypothesis", icon: Lightbulb, label: "引用假设", color: "text-amber-600" },
                          { key: "term", icon: Scale, label: "引用条款", color: "text-violet-600" },
                          { key: "material", icon: FolderOpen, label: "引用项目材料", color: "text-emerald-600" },
                        ].map((item) => {
                          const Icon = item.icon
                          return (
                            <button
                              key={item.key}
                              onClick={() => handleToolbarAction(item.key)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                            >
                              <Icon className={`h-4 w-4 ${item.color}`} />
                              {item.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Input row */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="输入消息..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                    className="flex-1 bg-[#F9FAFB] border-[#E5E7EB] text-sm"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    className="bg-[#2563EB] hover:bg-[#1D4ED8] h-9 w-9 p-0 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Shared Doc Dialog */}
      {showSharedDocDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[440px] rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
                  <FilePlus2 className="h-4.5 w-4.5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#111827]">创建共享文档</h3>
                  <p className="text-xs text-[#9CA3AF]">共享文档可供团队成员协同编辑</p>
                </div>
              </div>
              <button onClick={() => setShowSharedDocDialog(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* File name */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">文件名 <span className="text-red-500">*</span></label>
                <Input
                  placeholder="输入文件名..."
                  value={sharedDocName}
                  onChange={(e) => setSharedDocName(e.target.value)}
                  className="bg-[#F9FAFB] border-[#E5E7EB]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">文件简介</label>
                <textarea
                  placeholder="简要描述文档内容..."
                  value={sharedDocDesc}
                  onChange={(e) => setSharedDocDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] resize-none"
                />
              </div>

              {/* File type */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">文件类型</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {([
                    { key: "word" as const, label: "Word", ext: ".docx", icon: "W", color: "bg-blue-500" },
                    { key: "excel" as const, label: "Excel", ext: ".xlsx", icon: "X", color: "bg-emerald-500" },
                    { key: "powerpoint" as const, label: "PPT", ext: ".pptx", icon: "P", color: "bg-orange-500" },
                  ]).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setSharedDocType(t.key)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all ${
                        sharedDocType === t.key
                          ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm"
                          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                      }`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.color} text-white text-sm font-bold`}>
                        {t.icon}
                      </div>
                      <span className={`text-xs font-medium ${sharedDocType === t.key ? "text-[#2563EB]" : "text-[#6B7280]"}`}>{t.label}</span>
                      <span className="text-[10px] text-[#9CA3AF]">{t.ext}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 border-t border-[#E5E7EB] px-6 py-4">
              <Button
                variant="outline"
                onClick={() => setShowSharedDocDialog(false)}
                className="text-[#6B7280] border-[#E5E7EB]"
              >
                取消
              </Button>
              <Button
                onClick={handleCreateSharedDoc}
                disabled={!sharedDocName.trim()}
                className="bg-[#2563EB] hover:bg-[#1D4ED8]"
              >
                <FilePlus2 className="h-4 w-4 mr-1.5" />
                创建
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hypothesis Ref Dialog */}
      {showHypothesisRefDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[560px] max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                  <Lightbulb className="h-4.5 w-4.5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#111827]">引用假设</h3>
                  <p className="text-xs text-[#9CA3AF]">引用本项目内的假设</p>
                </div>
              </div>
              <button onClick={() => setShowHypothesisRefDialog(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  placeholder="搜索假设..."
                  value={hypothesisRefSearch}
                  onChange={(e) => setHypothesisRefSearch(e.target.value)}
                  className="pl-9 bg-[#F9FAFB] border-[#E5E7EB]"
                />
              </div>
            </div>

            {/* Hypothesis List */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
              {hypotheses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Lightbulb className="h-10 w-10 text-[#D1D5DB]" />
                  <p className="mt-3 text-sm text-[#6B7280]">暂无假设</p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">请先在假设清单中创建假设</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {hypotheses.map((h) => {
                    const isSelected = selectedHypothesisIds.has(h.id)
                    const statusInfo = getHypothesisStatusLabel(h.status)
                    return (
                      <button
                        key={h.id}
                        onClick={() => toggleHypothesisSelection(h.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                          isSelected
                            ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm"
                            : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          isSelected ? "border-[#2563EB] bg-[#2563EB]" : "border-[#D1D5DB] bg-white"
                        }`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded">{h.direction}</span>
                            <span className="text-xs text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{h.category}</span>
                          </div>
                          <p className="text-sm font-medium text-[#111827] truncate">{h.name}</p>
                        </div>

                        {/* Status */}
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4 shrink-0">
              <span className="text-xs text-[#9CA3AF]">
                已选择 <span className="font-medium text-[#374151]">{selectedHypothesisIds.size}</span> 个假设
              </span>
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => setShowHypothesisRefDialog(false)}
                  className="text-[#6B7280] border-[#E5E7EB]"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSendHypothesisRef}
                  disabled={selectedHypothesisIds.size === 0}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  发送
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Term Ref Dialog */}
      {showTermRefDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[560px] max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
                  <Scale className="h-4.5 w-4.5 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#111827]">引用条款</h3>
                  <p className="text-xs text-[#9CA3AF]">引用本项目内的条款</p>
                </div>
              </div>
              <button onClick={() => setShowTermRefDialog(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  placeholder="搜索条款..."
                  value={termRefSearch}
                  onChange={(e) => setTermRefSearch(e.target.value)}
                  className="pl-9 bg-[#F9FAFB] border-[#E5E7EB]"
                />
              </div>
            </div>

            {/* Term List */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
              {terms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Scale className="h-10 w-10 text-[#D1D5DB]" />
                  <p className="mt-3 text-sm text-[#6B7280]">暂无条款</p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">请先在条款清单中创建条款</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {terms.map((t) => {
                    const isSelected = selectedTermIds.has(t.id)
                    const statusInfo = getTermStatusLabel(t.status)
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleTermSelection(t.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                          isSelected
                            ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm"
                            : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          isSelected ? "border-[#2563EB] bg-[#2563EB]" : "border-[#D1D5DB] bg-white"
                        }`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{t.direction}</span>
                            <span className="text-xs text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{t.category}</span>
                          </div>
                          <p className="text-sm font-medium text-[#111827] truncate">{t.name}</p>
                        </div>

                        {/* Status */}
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4 shrink-0">
              <span className="text-xs text-[#9CA3AF]">
                已选择 <span className="font-medium text-[#374151]">{selectedTermIds.size}</span> 个条款
              </span>
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => setShowTermRefDialog(false)}
                  className="text-[#6B7280] border-[#E5E7EB]"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSendTermRef}
                  disabled={selectedTermIds.size === 0}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  发送
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Material Ref Dialog */}
      {showMaterialRefDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[560px] max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                  <FolderOpen className="h-4.5 w-4.5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#111827]">引用项目材料</h3>
                  <p className="text-xs text-[#9CA3AF]">引用本项目内的项目材料</p>
                </div>
              </div>
              <button onClick={() => setShowMaterialRefDialog(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  placeholder="搜索材料..."
                  value={materialRefSearch}
                  onChange={(e) => setMaterialRefSearch(e.target.value)}
                  className="pl-9 bg-[#F9FAFB] border-[#E5E7EB]"
                />
              </div>
            </div>

            {/* Material List */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
              {materials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="h-10 w-10 text-[#D1D5DB]" />
                  <p className="mt-3 text-sm text-[#6B7280]">暂无项目材料</p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">请先在项目材料中上传材料</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {materials.map((m) => {
                    const isSelected = selectedMaterialIds.has(m.id)
                    const formatColor = getFormatColor(m.format)
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleMaterialSelection(m.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                          isSelected
                            ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm"
                            : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          isSelected ? "border-[#2563EB] bg-[#2563EB]" : "border-[#D1D5DB] bg-white"
                        }`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${formatColor}`}>{m.format}</span>
                            <span className="text-xs text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{m.category}</span>
                            <span className="text-[11px] text-[#9CA3AF]">{m.size}</span>
                          </div>
                          <p className="text-sm font-medium text-[#111827] truncate">{m.name}</p>
                          {m.description && (
                            <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">{m.description}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4 shrink-0">
              <span className="text-xs text-[#9CA3AF]">
                已选择 <span className="font-medium text-[#374151]">{selectedMaterialIds.size}</span> 个材料
              </span>
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => setShowMaterialRefDialog(false)}
                  className="text-[#6B7280] border-[#E5E7EB]"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSendMaterialRef}
                  disabled={selectedMaterialIds.size === 0}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  发送
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
interface ProjectOverviewProps {
  project?: {
    name?: string
    description?: string
    round?: string
    valuation?: string
    status?: string
    owner?: { name: string; initials?: string }
    strategyName?: string
    createdAt?: string
    tags?: string[]
    logo?: string
  }
  isNewProject?: boolean
  projectHypotheses?: HypothesisTableItem[]
  projectTerms?: TermTableItem[]
  projectMaterials?: StrategyMaterial[]
}

export function ProjectOverview({ project, isNewProject = false, projectHypotheses, projectTerms, projectMaterials }: ProjectOverviewProps) {
  const [showChat, setShowChat] = useState(false)

  // For new projects, show their own data
  if (isNewProject && project) {
    if (showChat) {
      return <CommunicationCenter onBack={() => setShowChat(false)} hypotheses={projectHypotheses} terms={projectTerms} materials={projectMaterials} />
    }

    const newMetrics = [
      {
        label: "估值",
        value: project.valuation || "待定",
        unit: project.valuation ? "USD" : "",
        icon: DollarSign,
        trend: "新项目",
        trendUp: true,
      },
      {
        label: "融资轮次",
        value: project.round || "待定",
        unit: "",
        icon: TrendingUp,
        trend: "设立期",
        trendUp: true,
      },
      {
        label: "风险指数",
        value: "待评估",
        unit: "",
        icon: ShieldAlert,
        trend: "-",
        trendUp: false,
      },
    ]

    return (
      <div className="h-full overflow-auto bg-[#F3F4F6]">
        <div className="mx-auto max-w-6xl px-8 py-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">项目概览</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              {project.name} - {project.round || "待定"}投资项目仪表盘
              {project.strategyName && <span className="ml-2 text-[#2563EB]">(策略: {project.strategyName})</span>}
            </p>
          </div>

          {/* Project Info Card */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#111827] text-white text-xl font-bold">
                {project.logo || project.name?.charAt(0) || "P"}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[#111827]">{project.name}</h2>
                <p className="mt-0.5 text-sm text-[#6B7280]">
                  {project.description || "暂无项目简介"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {project.tags?.map((tag, idx) => (
                  <Badge key={idx} className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                    {tag}
                  </Badge>
                ))}
                {project.round && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                    {project.round}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Basic Info for New Projects */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 md:p-6 w-full">
            <h3 className="mb-4 text-base font-semibold text-[#111827]">基本信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6B7280]">负责人</p>
                  <p className="text-sm font-medium text-[#111827]">{project.owner?.name || "待分配"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Briefcase className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6B7280]">关联策略</p>
                  <p className="text-sm font-medium text-[#111827]">{project.strategyName || "无"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6B7280]">创建日期</p>
                  <p className="text-sm font-medium text-[#111827]">{project.createdAt || "今天"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                  <Tag className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6B7280]">项目状态</p>
                  <p className="text-sm font-medium text-[#111827]">{project.status || "设立期"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Cards + Communication Center Button */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {newMetrics.map((m) => {
              const Icon = m.icon
              return (
                <div
                  key={m.label}
                  className="rounded-xl border border-[#E5E7EB] bg-white p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6B7280]">{m.label}</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3F4F6]">
                      <Icon className="h-4 w-4 text-[#6B7280]" />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-[#111827]">
                    {m.value}
                    {m.unit && (
                      <span className="ml-1 text-sm font-normal text-[#9CA3AF]">
                        {m.unit}
                      </span>
                    )}
                  </p>
                  <p className={`mt-1 text-xs ${m.trendUp ? "text-emerald-600" : "text-[#6B7280]"}`}>
                    {m.trend}
                  </p>
                </div>
              )
            })}
            {/* Communication Center Button */}
            <button
              onClick={() => setShowChat(true)}
              className="group flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2563EB]/30 bg-gradient-to-br from-[#EFF6FF] to-white p-5 transition-all hover:border-[#2563EB] hover:shadow-md hover:shadow-blue-100"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2563EB]/10 transition-colors group-hover:bg-[#2563EB]/20">
                <MessageCircle className="h-5 w-5 text-[#2563EB]" />
              </div>
              <p className="mt-2.5 text-sm font-semibold text-[#2563EB]">交流中心</p>
              <p className="mt-0.5 text-[11px] text-[#6B7280]">团队协作沟通</p>
            </button>
          </div>

          {/* Empty Timeline */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-[#111827]">最近动态</h3>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F6]">
                <Clock className="h-6 w-6 text-[#9CA3AF]" />
              </div>
              <p className="mt-3 text-sm text-[#6B7280]">暂无动态记录</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">项目活动将在此处显示</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Default view for existing projects (MiniMax etc)
  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-6xl px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">项目概览</h1>
          <p className="mt-1 text-sm text-[#6B7280]">MiniMax - B轮投资项目仪表盘</p>
        </div>

        {/* Project Info Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#111827] text-white text-xl font-bold">
              M
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#111827]">MiniMax</h2>
              <p className="mt-0.5 text-sm text-[#6B7280]">
                通用人工智能科技公司，专注于大模型研发
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                AI
              </Badge>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                B轮
              </Badge>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                设立期
              </Badge>
            </div>
          </div>
        </div>

        {/* Basic Info Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 md:p-6 w-full">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">基本信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">负责人</p>
                <p className="text-sm font-medium text-[#111827]">张伟</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Briefcase className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">关联策略</p>
                <p className="text-sm font-medium text-[#111827]">大模型应用</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">创建日期</p>
                <p className="text-sm font-medium text-[#111827]">2024-01-15</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#F9FAFB] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <Tag className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">项目状态</p>
                <p className="text-sm font-medium text-[#111827]">设立期</p>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {defaultMetrics.map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.label}
                className="rounded-xl border border-[#E5E7EB] bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">{m.label}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3F4F6]">
                    <Icon className="h-4 w-4 text-[#6B7280]" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold text-[#111827]">
                  {m.value}
                  {m.unit && (
                    <span className="ml-1 text-sm font-normal text-[#9CA3AF]">
                      {m.unit}
                    </span>
                  )}
                </p>
                <p
                  className={`mt-1 text-xs ${m.trendUp ? "text-emerald-600" : "text-[#6B7280]"
                    }`}
                >
                  {m.trend}
                </p>
              </div>
            )
          })}
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">最近动态</h3>
          <div className="space-y-4">
            {defaultTimeline.map((item, idx) => {
              const Icon = item.icon
              return (
                <div key={idx} className="flex items-start gap-4">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${item.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {idx < defaultTimeline.length - 1 && (
                      <div className="mt-1 h-8 w-px bg-[#E5E7EB]" />
                    )}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm text-[#374151]">
                      <span className="font-medium">{item.user}</span>{" "}
                      {item.action}
                    </p>
                    <p className="text-xs text-[#6B7280]">{item.target}</p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-xs text-[#9CA3AF]">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
