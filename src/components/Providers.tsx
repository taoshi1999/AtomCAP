"use client"

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import { TRPCReactProvider } from "@/src/trpc/react"
import { Toaster } from "sonner"

interface ProvidersProps {
  children: ReactNode
}

/**
 * 全局 Provider 组合：NextAuth Session + tRPC React Query
 * 在 root layout 中使用。
 */
export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <TRPCReactProvider>
        {children}
        <Toaster position="top-center" richColors />
      </TRPCReactProvider>
    </SessionProvider>
  )
}
