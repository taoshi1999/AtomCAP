import { PrismaClient } from '@prisma/client' // 从生成的 prisma 客户端模块中导入 PrismaClient 类

const globalForPrisma = globalThis as unknown as { // 将全局对象 globalThis 转换为包含 prisma 属性的类型
  prisma: PrismaClient | undefined // 声明 prisma 变量可能是 PrismaClient 实例，也可能是 undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient() // 导出 prisma 实例：如果全局已存在就复用，否则实例化一个新的 PrismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma // 如果当前不是生产环境（如开发热更新时），则将实例挂载到全局对象，防止重复创建过多数据库连接
