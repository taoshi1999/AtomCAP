"use client"

import { useState } from "react"
import { Eye, EyeOff, RefreshCw, Lock, User, ShieldCheck } from "lucide-react"
import { Input } from "@/src/components/ui/input"
import { cn } from "@/src/lib/utils"
import Image from "next/image"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [captchaInput, setCaptchaInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email: username,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else {
        router.push("/")
        router.refresh()
      }
    } catch (err) {
      setError("登录失败，请稍后重试")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex font-sans">
      {/* Left: Form Panel */}
      <div className="flex w-full flex-col justify-between bg-white px-12 py-10 lg:w-[45%]">
        {/* Logo */}


        {/* Form area */}
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#111827] mb-1 text-balance">欢迎回来</h1>
            <p className="text-sm text-[#6B7280]">请登录您的 AtomCAP 账户</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#374151]">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
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

            {/* Captcha */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#374151]">验证码</label>
              <div className="flex gap-2.5">
                <div className="relative flex-1">
                  <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <Input
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="请输入验证码"
                    maxLength={4}
                    className="pl-9 h-10 border-[#E5E7EB] bg-white text-[#111827] placeholder:text-[#9CA3AF] focus-visible:ring-[#2563EB] focus-visible:border-[#2563EB] uppercase tracking-widest"
                  />
                </div>
                <div className="relative h-10 w-24 shrink-0 overflow-hidden rounded-md border border-[#E5E7EB] bg-white cursor-pointer hover:opacity-80 transition-opacity">
                  <Image
                    src="/captcha.jpg"
                    alt="验证码"
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "mt-2 w-full h-10 rounded-md bg-[#2563EB] text-sm font-medium text-white transition-all",
                "hover:bg-[#1D4ED8]",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  登录中...
                </span>
              ) : (
                "登 录"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#9CA3AF]">
            首次使用请{" "}
            <button 
              type="button" 
              className="text-[#2563EB] hover:underline transition-colors"
              onClick={() => router.push("/register")}
            >
              联系管理员获取账号
            </button>
          </p>
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
            专业投资决策，尽在掌握
          </h2>
          <p className="text-sm text-[#4B6A8A] leading-relaxed max-w-xs">
            AtomCAP 为 PE/VC 机构提供全流程投资决策管理，AI 驱动更智慧的投资判断
          </p>

          {/* Feature tags */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {["策略管理", "假设验证", "条款构建", "AI 赋能"].map((tag) => (
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
