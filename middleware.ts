import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // 如果用户已认证，允许访问
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
)

export const config = {
  matcher: [
    "/projects/:path*",
    "/dashboard/:path*",
    "/strategies/:path*",
    "/change-requests/:path*",
    "/settings/:path*",
  ],
}
