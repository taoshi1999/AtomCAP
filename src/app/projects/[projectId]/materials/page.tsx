"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react"
import { api } from "@/src/trpc/react"
import { Badge } from "@/src/components/ui/badge"
import { Button } from "@/src/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Textarea } from "@/src/components/ui/textarea"

type PendingFile = {
  id: string
  file: File
  description: string
}

type MaterialItem = {
  id: string
  name: string
  format: string
  size: string
  category: string
  description: string
  url: string
  createdAt: string
}

type UploadedMaterialPayload = Omit<MaterialItem, "id" | "createdAt">

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`
  }

  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)}KB`
  }

  return `${size}B`
}

function getFileFormat(fileName: string) {
  const parts = fileName.split(".")
  return (parts[parts.length - 1] || "unknown").toUpperCase()
}

function getFormatIcon(format: string) {
  switch (format.toUpperCase()) {
    case "PDF":
    case "DOC":
    case "DOCX":
    case "TXT":
    case "MD":
      return FileText
    case "XLS":
    case "XLSX":
    case "CSV":
      return FileSpreadsheet
    case "PNG":
    case "JPG":
    case "JPEG":
    case "WEBP":
      return FileImage
    default:
      return File
  }
}

function getFormatBadgeClass(format: string) {
  switch (format.toUpperCase()) {
    case "PDF":
      return "border-red-200 bg-red-50 text-red-700"
    case "DOC":
    case "DOCX":
      return "border-blue-200 bg-blue-50 text-blue-700"
    case "XLS":
    case "XLSX":
    case "CSV":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "PNG":
    case "JPG":
    case "JPEG":
    case "WEBP":
      return "border-violet-200 bg-violet-50 text-violet-700"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

function buildUploadFileName(projectId: string, fileName: string) {
  const safeName = fileName.replace(/\s+/g, "-")
  return `${projectId}-${Date.now()}-${safeName}`
}

function getLocalMaterialsKey(projectId: string) {
  return `project-materials:${projectId}`
}

export default function ProjectMaterialsPage() {
  const params = useParams()
  const router = useRouter()
  const { status } = useSession()
  const projectId = params.projectId as string
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploadError, setUploadError] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [localMaterials, setLocalMaterials] = useState<MaterialItem[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  const utils = api.useUtils()

  const { data: project, isLoading: isProjectLoading } = api.project.getById.useQuery(
    { id: projectId },
    { enabled: status === "authenticated" }
  )

  const {
    data: materials,
    isLoading: isMaterialsLoading,
    isError,
    error,
  } = api.project.getMaterials.useQuery(
    { projectId },
    { enabled: status === "authenticated" }
  )

  const createMaterials = api.project.createMaterials.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.project.getMaterials.invalidate({ projectId }),
        utils.project.getById.invalidate({ id: projectId }),
      ])
    },
  })

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(getLocalMaterialsKey(projectId))
      if (!cached) {
        setLocalMaterials([])
        return
      }

      const parsed = JSON.parse(cached) as MaterialItem[]
      setLocalMaterials(Array.isArray(parsed) ? parsed : [])
    } catch {
      setLocalMaterials([])
    }
  }, [projectId])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        getLocalMaterialsKey(projectId),
        JSON.stringify(localMaterials)
      )
    } catch {
      // Ignore storage write errors and keep the in-memory list.
    }
  }, [localMaterials, projectId])

  const selectedCountText = useMemo(() => {
    if (pendingFiles.length === 0) {
      return "暂未添加文件"
    }

    return `已添加 ${pendingFiles.length} 个文件`
  }, [pendingFiles.length])

  const mergedMaterials = useMemo(() => {
    const merged = new Map<string, MaterialItem>()

    for (const material of materials ?? []) {
      merged.set(material.url || `${material.name}-${material.createdAt}`, material)
    }

    for (const material of localMaterials) {
      merged.set(material.url || `${material.name}-${material.createdAt}`, material)
    }

    return Array.from(merged.values()).sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
  }, [localMaterials, materials])

  function handleDialogOpenChange(open: boolean) {
    if (isUploading) {
      return
    }

    setIsUploadOpen(open)
    if (!open) {
      setPendingFiles([])
      setUploadError("")
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) {
      return
    }

    setPendingFiles((prev) => {
      const next = [...prev]

      for (const file of files) {
        const duplicate = next.some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified
        )

        if (!duplicate) {
          next.push({
            id: `${file.name}-${file.size}-${file.lastModified}`,
            file,
            description: "",
          })
        }
      }

      return next
    })

    event.target.value = ""
    setUploadError("")
  }

  function handleDescriptionChange(id: string, description: string) {
    setPendingFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, description } : item))
    )
  }

  function handleRemoveFile(id: string) {
    setPendingFiles((prev) => prev.filter((item) => item.id !== id))
  }

  async function handleUpload() {
    if (pendingFiles.length === 0 || isUploading) {
      return
    }

    if (pendingFiles.some((item) => item.description.trim().length === 0)) {
      setUploadError("每上传一个文件都需要填写简介。")
      return
    }

    setIsUploading(true)
    setUploadError("")

    try {
      const uploadedMaterials: UploadedMaterialPayload[] = []

      for (const item of pendingFiles) {
        const uploadFileName = buildUploadFileName(projectId, item.file.name)
        const response = await fetch(
          `/api/upload?filename=${encodeURIComponent(uploadFileName)}`,
          {
            method: "POST",
            headers: {
              "content-type": item.file.type || "application/octet-stream",
            },
            body: item.file,
          }
        )

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "文件上传失败")
        }

        uploadedMaterials.push({
          name: item.file.name,
          format: getFileFormat(item.file.name),
          size: formatFileSize(item.file.size),
          description: item.description.trim(),
          url: result.url as string,
          category: "项目材料",
        })
      }

      await createMaterials.mutateAsync({
        projectId,
        materials: uploadedMaterials,
      })

      const createdAt = new Date().toISOString()
      setLocalMaterials((prev) => [
        ...uploadedMaterials.map((material, index) => ({
          id: `local-${Date.now()}-${index}`,
          ...material,
          createdAt,
        })),
        ...prev,
      ])
      setPendingFiles([])
      setUploadError("")
      setIsUploadOpen(false)
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "上传材料失败"
      setUploadError(message)
    } finally {
      setIsUploading(false)
    }
  }

  if (status === "loading" || isProjectLoading || isMaterialsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载项目材料...
        </div>
      </div>
    )
  }

  if (isError || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-red-500">
          加载失败：{error?.message || "项目不存在"}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-6xl space-y-6 px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">项目材料</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              {project.name} 的项目材料清单，支持多文件上传、逐文件简介填写和下载查看。
            </p>
          </div>
          <Button
            className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8]"
            onClick={() => handleDialogOpenChange(true)}
          >
            <Upload className="h-4 w-4" />
            上传材料
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(240px,2fr)_90px_90px_minmax(220px,3fr)_140px] items-center gap-4 bg-[#1E3A5F] px-6 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-white">
              文件名称
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-white">
              格式
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-white">
              大小
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-white">
              简介
            </span>
            <span className="text-right text-xs font-semibold uppercase tracking-wider text-white">
              操作
            </span>
          </div>

          {mergedMaterials.length > 0 ? (
            <div className="divide-y divide-[#F3F4F6]">
              {mergedMaterials.map((material) => {
                const Icon = getFormatIcon(material.format)
                const downloadHref = material.url.startsWith("http")
                  ? `/api/upload?url=${encodeURIComponent(material.url)}&filename=${encodeURIComponent(material.name)}`
                  : material.url

                return (
                  <div
                    key={material.id}
                    className="grid grid-cols-[minmax(240px,2fr)_90px_90px_minmax(220px,3fr)_140px] items-center gap-4 px-6 py-4 hover:bg-[#F9FAFB]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6]">
                        <Icon className="h-4 w-4 text-[#6B7280]" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#111827]">
                          {material.name}
                        </p>
                        <p className="mt-1 text-xs text-[#9CA3AF]">
                          上传于 {new Date(material.createdAt).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className={getFormatBadgeClass(material.format)}
                      >
                        {material.format}
                      </Badge>
                    </div>
                    <span className="text-sm text-[#6B7280]">{material.size}</span>
                    <p className="text-sm leading-6 text-[#6B7280]">
                      {material.description}
                    </p>
                    <div className="flex justify-end">
                      {material.url ? (
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <a
                            href={downloadHref}
                            download={material.name}
                          >
                            <Download className="h-3.5 w-3.5" />
                            下载
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="gap-1.5" disabled>
                          <Download className="h-3.5 w-3.5" />
                          下载
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-full bg-[#EFF6FF] p-4">
                <Upload className="h-6 w-6 text-[#2563EB]" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-[#111827]">
                暂无项目材料
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#6B7280]">
                先上传项目相关文件，系统会在这里按表格展示文件名、格式、大小和简介，并支持直接下载。
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isUploadOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>上传项目材料</DialogTitle>
            <DialogDescription>
              支持一次上传多个文件；每个文件都必须填写单独的简介。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="materials-input">选择文件</Label>
              <Input
                ref={fileInputRef}
                id="materials-input"
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="h-4 w-4" />
                    选择文件
                  </Button>
                  <span className="text-sm text-[#6B7280]">{selectedCountText}</span>
                </div>
                <p className="mt-2 text-xs text-[#9CA3AF]">
                  支持重复点击继续添加文件；文件加入后会在下方列表显示。
                </p>
              </div>
            </div>

            <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
              {pendingFiles.length > 0 ? (
                pendingFiles.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#111827]">
                          {index + 1}. {item.file.name}
                        </p>
                        <p className="mt-1 text-xs text-[#6B7280]">
                          {getFileFormat(item.file.name)} | {formatFileSize(item.file.size)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleRemoveFile(item.id)}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`description-${item.id}`}>文件简介</Label>
                      <Textarea
                        id={`description-${item.id}`}
                        value={item.description}
                        onChange={(event) =>
                          handleDescriptionChange(item.id, event.target.value)
                        }
                        placeholder="请填写这个文件的用途、内容摘要或关键说明"
                        rows={3}
                        disabled={isUploading}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[#D1D5DB] px-6 py-10 text-center text-sm text-[#6B7280]">
                  还没有添加待上传文件，请点击上方“选择文件”。
                </div>
              )}
            </div>

            {uploadError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {uploadError}
              </div>
            ) : null}

            <div className="flex justify-end gap-3 border-t border-[#E5E7EB] pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isUploading}
              >
                取消
              </Button>
              <Button
                type="button"
                className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8]"
                onClick={handleUpload}
                disabled={pendingFiles.length === 0 || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在上传...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    上传材料
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
