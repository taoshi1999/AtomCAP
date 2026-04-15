"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, User, Mail, ShieldCheck, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import Image from "next/image"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // 验证密码
    if (formData.password !== formData.confirmPassword) {
      setError("两次输入的密码不一致")
      return
    }

    if (formData.password.length < 6) {
      setError("密码长度至少为 6 位")
      return
    }

    setLoading(true)

    try {
      // 调用注册 API
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "注册失败")
      }

      // 注册成功，跳转到登录页
      router.push("/login")
    } catch (err: any) {
      setError(err.message || "注册失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex font-sans">
      {/* Left: Form Panel */}
      <div className="flex w-full flex-col justify-between bg-white px-12 py-10 lg:w-[45%]">
        {/* Form area */}
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#111827] mb-1 text-balance">注册账号</h1>
            <p className="text-sm text-[#6B7280]">
              已有账号？{" "}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-[#2563EB] hover:underline transition-colors"
              >
                立即登录
              </button>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#374151]">姓名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="请输入姓名"
                  className="pl-9 h-10 border-[#E5E7EB] bg-white text-[#111827] placeholder:text-[#9CA3AF] focus-visible:ring-[#2563EB] focus-visible:border-[#2563EB]"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#374151]">邮箱地址</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="请输入邮箱"
                  className="pl-9 h-10 border-[#E5E7EB] bg-white text-[#111827] placeholder:text-[#9CA3AF] focus-visible:ring-[#2563EB] focus-visible:border-[#2563EB]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#374151]">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="请设置密码（至少 6 位）"
                  className="pl-9 pr-10 h-10 border-[#E5E7EB] bg-white text-[#111827] placeholder:text-[#9CA3AF] focus-visible:ring-[#2563EB] focus-visible:border-[#2563EB]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#374151]">确认密码</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="请再次输入密码"
                  className="pl-9 pr-10 h-10 border-[#E5E7EB] bg-white text-[#111827] placeholder:text-[#9CA3AF] focus-visible:ring-[#2563EB] focus-visible:border-[#2563EB]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "mt-2 w-full h-10 rounded-md bg-[#2563EB] text-sm font-medium text-white transition-all",
                "hover:bg-[#1D4ED8]",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  注册中...
                </span>
              ) : (
                "注 册"
              )}
            </button>
          </form>
        </div>

        {/* Bottom copyright */}
        <p className="text-xs text-[#9CA3AF]">
          © 2025 AtomCAP. All rights reserved.
        </p>
      </div>

      {/* Right: Brand Panel */}
      <div className="hidden lg:flex lg:w-[55%] flex-col items-center justify-center relative overflow-hidden bg-[#EEF2F9]">
        {/* Subtle dot grid pattern */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(circle, #B8C5D6 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Decorative geometric accents */}
        <div className="absolute top-16 right-20 h-20 w-20 rounded-full bg-[#DBEAFE]/60" />
        <div className="absolute bottom-24 left-16 h-14 w-14 rounded-full bg-[#BFDBFE]/50" />
        <div className="absolute top-1/3 right-12 h-8 w-8 rotate-45 rounded-sm bg-[#93C5FD]/40" />
        <div className="absolute bottom-1/3 left-20 h-6 w-6 rotate-12 rounded-sm bg-[#93C5FD]/40" />

        {/* Illustration */}
        <div className="relative z-10 flex flex-col items-center px-16 text-center">
          <div className="mb-10 w-72 h-64 relative">
            <Image
              src="/login-illustration.jpg"
              alt="AtomCAP 投资管理平台插图"
              fill
              sizes="288px"
              className="object-contain rounded-2xl"
              priority
            />
          </div>
          <h2 className="text-2xl font-bold text-[#1E3A5F] mb-3 text-balance">
            开启专业投资之旅
          </h2>
          <p className="text-sm text-[#4B6A8A] leading-relaxed max-w-xs">
            加入 AtomCAP，体验 AI 驱动的投资决策管理新方式
          </p>

          {/* Feature tags */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {["免费注册", "即刻使用", "专业支持", "安全可靠"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#BFDBFE] bg-white/60 px-3.5 py-1 text-xs font-medium text-[#2563EB]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
