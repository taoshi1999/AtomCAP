import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc'
import { prisma } from '../../db'

export const authRouter = createTRPCRouter({
  /**
   * 用户注册
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email('请输入有效的邮箱地址'),
        password: z.string().min(6, '密码至少需要 6 位字符'),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 检查用户是否已存在
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
      })

      if (existingUser) {
        throw new Error('该邮箱已被注册')
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(input.password, 10)

      // 创建用户
      const user = await prisma.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          name: input.name,
        },
      })

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    }),

  /**
   * 用户登录
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 查找用户
      const user = await prisma.user.findUnique({
        where: { email: input.email },
      })

      if (!user || !user.password) {
        throw new Error('邮箱或密码错误')
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(input.password, user.password)

      if (!isPasswordValid) {
        throw new Error('邮箱或密码错误')
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    }),

  /**
   * 获取当前用户信息
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
      },
    })

    if (!user) {
      throw new Error('用户不存在')
    }

    return user
  }),
})
