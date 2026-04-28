'use client';

import { useState, useRef } from 'react';

interface FileUploadProps {
  onUploadSuccess?: (url: string, name: string) => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputFileRef.current?.files?.length) {
      alert('请先选择一个文件！');
      return;
    }

    setIsUploading(true);
    const file = inputFileRef.current.files[0];

    try {
      // 向我们刚才写的后端 API 发送请求
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      });

      const newBlob = await response.json();
      
      if (!response.ok) {
        throw new Error(newBlob.error || '上传失败');
      }

      // 保存上传成功后的 URL
      setBlobUrl(newBlob.url);
      
      // TODO: 在这里你可以把 newBlob.url 和 projectId 一起保存到你的关系型数据库中
      if (onUploadSuccess) {
        onUploadSuccess(newBlob.url, file.name);
      }
      
    } catch (error: any) {
      console.error('上传出错:', error);
      alert('上传出错: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 border border-gray-200 rounded-lg bg-white w-full max-w-md">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">上传尽调论据</h3>
      
      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        {/* 文件选择框 */}
        <input 
          name="file" 
          ref={inputFileRef} 
          type="file" 
          accept=".pdf,.xlsx,.docx"
          className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        
        {/* 提交按钮 */}
        <button 
          type="submit" 
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:bg-gray-400 transition-colors"
        >
          {isUploading ? '正在上传到 Vercel 云端...' : '确认上传'}
        </button>
      </form>

      {/* 成功后的反馈 */}
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
