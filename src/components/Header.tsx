"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"

export default function Header() {
  const { data: session, status } = useSession()

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600">
          AtomCAP
        </Link>

        <nav className="flex items-center gap-4">
          {status === "loading" ? (
            <span className="text-gray-500">加载中...</span>
          ) : session ? (
            <>
              <span className="text-gray-600">
                欢迎，{session.user?.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-500"
              >
                退出登录
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500"
              >
                注册
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
