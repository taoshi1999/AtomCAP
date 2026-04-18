"use client"

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import { TRPCProvider } from "./TRPCProvider"

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <TRPCProvider>
        {children}
      </TRPCProvider>
    </SessionProvider>
  )
}
