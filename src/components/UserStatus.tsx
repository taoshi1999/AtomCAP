"use client"

import { useSession, signOut } from "next-auth/react"

export default function UserStatus() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div className="text-gray-500">加载中...</div>
  }

  if (!session) {
    return null
  }

  return (
    <div className="flex items-center gap-4">
      <div className="text-sm">
        <span className="font-medium">{session.user?.name}</span>
        <span className="text-gray-500 ml-2">({session.user?.email})</span>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-sm text-red-600 hover:text-red-500"
      >
        退出登录
      </button>
    </div>
  )
}
