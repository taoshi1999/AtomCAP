"use client"

import { useState } from "react"
import { Send, Paperclip, X, FileText, Loader2 } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { ScrollArea } from "@/src/components/ui/scroll-area"
import { cn } from "@/src/lib/utils"
import { api } from "@/src/trpc/react"
import { useSession } from "next-auth/react"

export function HypothesisCommentSection({ hypothesisId }: { hypothesisId: string }) {
  const [commentText, setCommentText] = useState("")
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const { data: session } = useSession()

  const createCommentMutation = api.comment.create.useMutation()
  const getCommentsQuery = api.comment.getByHypothesis.useQuery(
    { hypothesisId },
    { refetchOnWindowFocus: false }
  )
  const addAttachmentMutation = api.comment.addAttachment.useMutation()

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    setUploadingFiles(Array.from(e.target.files))
  }

  function removeFile(index: number) {
    setUploadingFiles(uploadingFiles.filter((_, i) => i !== index))
  }

  function getFileFormat(fileName: string) {
    return fileName.split(".").pop()?.toUpperCase() || "FILE"
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function handleUploadFile(file: File): Promise<string> {
    const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      body: file,
    })
    
    const data = await response.json()
    return data.url
  }

  async function handleSubmitComment() {
    if (!commentText.trim() && uploadingFiles.length === 0) return

    setIsUploading(true)

    try {
      let commentId: string | undefined

      if (commentText.trim()) {
        const newComment = await createCommentMutation.mutateAsync({
          hypothesisId,
          content: commentText.trim(),
        })
        commentId = newComment.id
      }

      for (const file of uploadingFiles) {
        const fileUrl = await handleUploadFile(file)
        await addAttachmentMutation.mutateAsync({
          hypothesisId,
          commentId,
          fileName: file.name,
          fileUrl,
          fileFormat: getFileFormat(file.name),
          fileSize: formatFileSize(file.size),
        })
      }

      setCommentText("")
      setUploadingFiles([])
      getCommentsQuery.refetch()
    } catch (error) {
      console.error("Failed to submit comment:", error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {getCommentsQuery.data?.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center">
                <span className="text-xs font-medium text-[#6B7280]">
                  {comment.authorName.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-[#111827]">{comment.authorName}</span>
                  <span className="text-xs text-[#9CA3AF]">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-[#374151] mb-2">{comment.content}</p>
                {comment.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {comment.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs px-3 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5 text-[#6B7280]" />
                        <span className="truncate max-w-[150px]">{attachment.fileName}</span>
                        <span className="text-[#9CA3AF]">{attachment.fileFormat}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-[#E5E7EB] p-4">
        {uploadingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {uploadingFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 text-xs px-3 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg">
                <FileText className="h-3.5 w-3.5 text-[#6B7280]" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                <span className="text-[#9CA3AF]">{formatFileSize(file.size)}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-[#EF4444] hover:text-[#DC2626]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="添加评论..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={isUploading}
              className="pr-10"
            />
            <label htmlFor="file-upload" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#374151] cursor-pointer">
              <Paperclip className="h-4 w-4" />
              <input
                id="file-upload"
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          </div>
          <Button
            onClick={handleSubmitComment}
            disabled={isUploading || (!commentText.trim() && uploadingFiles.length === 0)}
            size="sm"
            className="gap-1"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
