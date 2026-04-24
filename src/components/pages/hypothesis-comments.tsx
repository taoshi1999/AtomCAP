"use client"

import { useRef, useState } from "react"
import { api } from "@/src/trpc/react"
import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Send,
  Sheet,
  User,
  X,
} from "lucide-react"
import { Button } from "@/src/components/ui/button"

interface HypothesisCommentsProps {
  hypothesisId: string
}

export function HypothesisComments({ hypothesisId }: HypothesisCommentsProps) {
  const [content, setContent] = useState("")
  const [attachments, setAttachments] = useState<
    Array<{ name: string; url: string; format?: string; size?: string }>
  >([])
  const [isUploading, setIsUploading] = useState(false)
  const inputFileRef = useRef<HTMLInputElement>(null)

  const utils = api.useUtils()
  const { data: comments, isLoading } = api.hypothesis.getComments.useQuery({ hypothesisId })
  const addCommentMutation = api.hypothesis.addComment.useMutation({
    onSuccess: () => {
      void utils.hypothesis.getComments.invalidate({ hypothesisId })
      setContent("")
      setAttachments([])
    },
    onError: (error) => {
      console.error("发表评论失败:", error)
      alert("发表评论失败: " + error.message)
    },
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setIsUploading(true)
    const file = e.target.files[0]

    try {
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        body: file,
      })
      const newBlob = await response.json()

      if (!response.ok) {
        throw new Error(newBlob?.error || "附件上传失败")
      }

      if (!newBlob?.url) {
        throw new Error("上传成功但未返回文件地址")
      }

      const format = file.name.split(".").pop()?.toUpperCase() || "UNKNOWN"
      const sizeStr = (file.size / 1024 / 1024).toFixed(2) + " MB"

      setAttachments((prev) => [
        ...prev,
        { name: file.name, url: newBlob.url, format, size: sizeStr },
      ])
    } catch (error) {
      console.error("上传出错:", error)
      alert(error instanceof Error ? error.message : "附件上传失败")
    } finally {
      setIsUploading(false)
      if (inputFileRef.current) inputFileRef.current.value = ""
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!content.trim() && attachments.length === 0) return
    addCommentMutation.mutate({
      hypothesisId,
      content,
      attachments,
    })
  }

  const formatIcon = (fmt: string) => {
    if (fmt === "XLSX" || fmt === "XLS") return <Sheet className="h-4 w-4 text-emerald-600" />
    if (fmt === "DOCX" || fmt === "DOC") return <FileText className="h-4 w-4 text-blue-600" />
    if (fmt === "PDF") return <FileIcon className="h-4 w-4 text-rose-500" />
    if (["PNG", "JPG", "JPEG", "GIF"].includes(fmt)) {
      return <ImageIcon className="h-4 w-4 text-purple-500" />
    }
    return <FileIcon className="h-4 w-4 text-gray-500" />
  }

  return (
    <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-[#111827]">评论与附件区</h2>

      <div className="mb-6 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="添加评论..."
          className="min-h-[60px] w-full resize-none bg-transparent text-sm text-[#374151] focus:outline-none"
        />

        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((att, i) => (
              <div
                key={`${att.name}-${i}`}
                className="flex items-center gap-2 rounded border border-[#E5E7EB] bg-white px-2 py-1 text-xs"
              >
                {formatIcon(att.format || "")}
                <span className="max-w-[150px] truncate">{att.name}</span>
                <span className="text-[#9CA3AF]">{att.size}</span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="text-[#9CA3AF] hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-[#E5E7EB] pt-2">
          <div className="flex items-center">
            <input
              type="file"
              ref={inputFileRef}
              onChange={handleUpload}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            />
            <button
              onClick={() => inputFileRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1 text-sm text-[#6B7280] transition-colors hover:text-[#2563EB] disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
              {isUploading ? "上传中..." : "上传附件"}
            </button>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={addCommentMutation.isPending || (!content.trim() && attachments.length === 0)}
            className="h-8 bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            发表评论
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="py-4 text-center text-sm text-[#9CA3AF]">加载评论中...</div>
        ) : comments?.length === 0 ? (
          <div className="py-4 text-center text-sm text-[#9CA3AF]">暂无评论</div>
        ) : (
          comments?.map((comment: any) => (
            <div key={comment.id} className="flex gap-3 border-b border-[#F3F4F6] pb-4 last:border-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E5E7EB]">
                {comment.creatorAvatar ? (
                  <img src={comment.creatorAvatar} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <User className="h-4 w-4 text-[#6B7280]" />
                )}
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-[#111827]">{comment.creatorName}</span>
                  <span className="text-xs text-[#9CA3AF]">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                {comment.content && (
                  <p className="mb-2 whitespace-pre-wrap text-sm text-[#374151]">{comment.content}</p>
                )}
                {comment.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {comment.attachments.map((att: any) => (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1.5 text-xs transition-colors hover:bg-[#F3F4F6]"
                      >
                        {formatIcon(att.format || "")}
                        <span className="max-w-[200px] truncate text-[#374151]">{att.name}</span>
                        <span className="text-[#9CA3AF]">
                          {att.format}
                          {att.format && att.size ? " • " : ""}
                          {att.size}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
