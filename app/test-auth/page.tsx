"use client"

import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"

export default function TestAuthPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">加载中...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-500">未登录</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-4">
      <h1 className="text-3xl font-bold">NextAuth 测试成功！✅</h1>
      
      <div className="rounded-lg border bg-gray-50 p-6">
        <h2 className="mb-4 text-xl font-semibold">用户信息：</h2>
        <div className="space-y-2">
          <p><strong>ID:</strong> {session.user?.id}</p>
          <p><strong>邮箱:</strong> {session.user?.email}</p>
          <p><strong>姓名:</strong> {session.user?.name}</p>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/test-auth" })}
        className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-500"
      >
        退出登录
      </button>

      <a href="/" className="text-blue-600 hover:underline">
        返回首页
      </a>
    </div>
  )
}
