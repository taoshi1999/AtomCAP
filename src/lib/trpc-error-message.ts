import { isTRPCClientError } from '@trpc/client'

/** 供 mutation/query 的 onError、toast 等使用，兼容 tRPC 与普通 Error */
export function getTrpcToastMessage(err: unknown, fallback = '操作失败'): string {
  if (isTRPCClientError(err)) {
    const m = err.message?.trim()
    return m || fallback
  }
  if (err instanceof Error && err.message.trim()) return err.message
  return fallback
}
