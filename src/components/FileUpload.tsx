'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';

interface FileUploadProps {
  onUploadSuccess: (url: string, name: string) => void;
  accept?: string;
}

export default function FileUpload({ onUploadSuccess, accept = ".pdf,.xlsx,.docx" }: FileUploadProps) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    setIsUploading(true);
    const file = e.target.files[0];

    try {
      // 向我们刚才写的后端 API 发送请求
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      });

      if (!response.ok) throw new Error('Upload failed');

      const newBlob = await response.json();
      
      // 保存上传成功后的 URL
      onUploadSuccess(newBlob.url, file.name);
      
      // Reset input
      if (inputFileRef.current) inputFileRef.current.value = '';
      
    } catch (error) {
      console.error('上传出错:', error);
      alert('上传失败，请稍后重试');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input 
        name="file" 
        ref={inputFileRef} 
        type="file" 
        accept={accept}
        onChange={handleUpload}
        className="hidden"
        id="file-upload-input"
        disabled={isUploading}
      />
      <label htmlFor="file-upload-input">
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="cursor-pointer" 
          asChild
          disabled={isUploading}
        >
          <span>
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? '正在上传...' : '上传附件'}
          </span>
        </Button>
      </label>
    </div>
  );
}
