import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
<<<<<<< HEAD
import AuthProvider from '@/components/AuthProvider'
=======
>>>>>>> upstream/main

import './globals.css'

const _inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'AtomCAP - PE/VC投资决策管理系统',
  description: '专业的PE/VC投资决策与管理平台',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
<<<<<<< HEAD
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
=======
      <body className="font-sans antialiased">{children}</body>
>>>>>>> upstream/main
    </html>
  )
}
