'use client';

import { useState, useRef } from 'react';

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface FileUploadProps {
  onUploadSuccess?: (url: string, name: string, size: string) => void;
  buttonLabel?: string;
}

export default function FileUpload({ onUploadSuccess, buttonLabel }: FileUploadProps) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const doUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const response = await fetch(`/api/upload?filename=${file.name}`, {
        method: 'POST',
        body: file,
      });

      const newBlob = await response.json();

      if (!response.ok) {
        throw new Error(newBlob.error || '上传失败');
      }

      setBlobUrl(newBlob.url);

      if (onUploadSuccess) {
        onUploadSuccess(newBlob.url, file.name, formatFileSize(file.size));
      }

    } catch (error: any) {
      console.error('上传出错:', error);
      alert('上传出错: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputFileRef.current?.files?.length) {
      alert('请先选择一个文件！');
      return;
    }
    await doUpload(inputFileRef.current.files[0]);
  };

  const handleFileChange = async () => {
    if (!inputFileRef.current?.files?.length) return;
    await doUpload(inputFileRef.current.files[0]);
  };

  // Compact variant: hidden input + upload button, auto-submits on file select
  if (buttonLabel) {
    return (
      <form onSubmit={handleUpload} className="flex-1">
        <input
          name="file"
          ref={inputFileRef}
          type="file"
          accept=".pdf,.xlsx,.docx"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => inputFileRef.current?.click()}
          disabled={isUploading}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#2563EB] border border-[#2563EB] rounded-lg hover:bg-[#EFF6FF] transition-colors disabled:opacity-50"
        >
          {isUploading ? '上传中...' : buttonLabel}
        </button>
      </form>
    );
  }

  return (
    <div className="p-6 border border-gray-200 rounded-lg bg-white w-full max-w-md">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">上传材料</h3>

      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <input
          name="file"
          ref={inputFileRef}
          type="file"
          accept=".pdf,.xlsx,.docx"
          className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        <button
          type="submit"
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:bg-gray-400 transition-colors"
        >
          {isUploading ? '正在上传到 Vercel 云端...' : '确认上传'}
        </button>
      </form>

      {blobUrl && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md text-sm break-all">
          ✅ 上传成功！<br/>
          <a href={blobUrl} target="_blank" rel="noreferrer" className="underline font-bold">
            点击这里查看文件
          </a>
        </div>
      )}
    </div>
  );
}
