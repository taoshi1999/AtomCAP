import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { query } from "@/lib/db"
import { verifyPassword } from "@/lib/auth"

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "email@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("请输入邮箱和密码")
        }

        try {
          // 查询用户
          const result = await query(
            "SELECT id, email, password_hash, name FROM users WHERE email = $1",
            [credentials.email]
          )

          if (result.rows.length === 0) {
            throw new Error("邮箱或密码错误")
          }

          const user = result.rows[0]
          
          // 验证密码
          const isValid = await verifyPassword(credentials.password, user.password_hash)
          
          if (!isValid) {
            throw new Error("邮箱或密码错误")
          }

          // 返回用户信息
          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name || user.email,
          }
        } catch (error) {
          console.error("Authorization error:", error)
          throw error
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }
      
      // Handle session updates
      if (trigger === "update" && session) {
        return {
          ...token,
          ...session.user,
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
