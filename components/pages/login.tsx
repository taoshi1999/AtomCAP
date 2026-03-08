"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, RefreshCw, Lock, User, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface LoginProps {
  onLogin: () => void
}

function generateCaptcha(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let result = ""
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [captchaInput, setCaptchaInput] = useState("")
  const [captchaCode, setCaptchaCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setCaptchaCode(generateCaptcha())
  }, [])

  function refreshCaptcha() {
    setCaptchaCode(generateCaptcha())
    setCaptchaInput("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!username.trim()) {
      setError("请输入用户名")
      return
    }
    if (!password.trim()) {
      setError("请输入密码")
      return
    }
    if (!captchaInput.trim()) {
      setError("请输入验证码")
      return
    }
    // DEBUG: skip captcha validation
    // if (captchaInput.toUpperCase() !== captchaCode) {
    //   setError("验证码错误")
    //   refreshCaptcha()
    //   return
    // }

    setIsLoading(true)
    // Simulate login delay
    await new Promise((resolve) => setTimeout(resolve, 800))
    setIsLoading(false)
    onLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#2563EB]/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#2563EB]/10 blur-3xl" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] shadow-lg shadow-[#2563EB]/25 mb-4">
            <span className="text-2xl font-bold text-white italic">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AtomCAP</h1>
          <p className="text-sm text-[#94A3B8] mt-1">PE/VC投资决策管理系统</p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-[#334155] bg-[#1E293B]/80 backdrop-blur-xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#E2E8F0]">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="pl-10 h-11 bg-[#0F172A] border-[#334155] text-white placeholder:text-[#64748B] focus:border-[#2563EB] focus:ring-[#2563EB]/20"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#E2E8F0]">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="pl-10 pr-10 h-11 bg-[#0F172A] border-[#334155] text-white placeholder:text-[#64748B] focus:border-[#2563EB] focus:ring-[#2563EB]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#94A3B8] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Captcha */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#E2E8F0]">验证码</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <Input
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="请输入验证码"
                    maxLength={4}
                    className="pl-10 h-11 bg-[#0F172A] border-[#334155] text-white placeholder:text-[#64748B] focus:border-[#2563EB] focus:ring-[#2563EB]/20 uppercase"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-11 w-24 items-center justify-center rounded-lg bg-gradient-to-r from-[#334155] to-[#475569] select-none">
                    <span className="text-lg font-bold tracking-widest text-white" style={{ fontFamily: "monospace", letterSpacing: "0.2em" }}>
                      {captchaCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#334155] bg-[#0F172A] text-[#64748B] hover:text-[#94A3B8] hover:border-[#475569] transition-colors"
                    title="刷新验证码"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full h-11 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-sm font-semibold text-white shadow-lg shadow-[#2563EB]/25 transition-all",
                "hover:from-[#1D4ED8] hover:to-[#1E40AF] hover:shadow-[#2563EB]/30",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  登录中...
                </span>
              ) : (
                "登录"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-[#334155]">
            <p className="text-center text-xs text-[#64748B]">
              首次使用？ <button type="button" className="text-[#2563EB] hover:text-[#60A5FA] transition-colors">联系管理员获取账号</button>
            </p>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-center text-xs text-[#64748B] mt-6">
          © 2024 AtomCAP. All rights reserved.
        </p>
      </div>
    </div>
  )
}
