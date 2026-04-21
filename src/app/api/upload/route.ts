import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  // 从 URL 参数中获取文件名（例如：MiniMax_BP.pdf）
  const filename = searchParams.get('filename') || 'unnamed_file';

  // 确保有文件流
  if (!request.body) {
    return NextResponse.json({ error: 'No file body found' }, { status: 400 });
  }

  try {
    // 调用 Vercel Blob 的 put 方法直接上传
    // access: 'public' 表示上传后生成一个任何人都可以下载的公开链接
    const blob = await put(filename, request.body, {
      access: 'public',
    });

    // 返回成功信息及文件的永久 URL
    return NextResponse.json(blob);
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
