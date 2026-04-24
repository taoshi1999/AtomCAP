import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename') || 'unnamed_file';

  if (!request.body) {
    return NextResponse.json({ error: 'No file body found' }, { status: 400 });
  }

  try {
    const fileBuffer = await request.arrayBuffer();

    const blob = await put(filename, fileBuffer, {
      access: 'public',
      allowOverwrite: true, // 允许覆盖同名文件
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed: ' + String(error) }, { status: 500 });
  }
}
