import type { Metadata } from 'next'
import Providers from '@/src/components/Providers'

import './globals.css'

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
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
