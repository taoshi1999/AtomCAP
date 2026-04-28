import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename') || 'unnamed_file';

  if (!request.body) {
    return NextResponse.json({ error: 'No file body found' }, { status: 400 });
  }

  try {
    const fileBody = await request.arrayBuffer();
    const blob = await put(filename, fileBody, {
      access: 'public',
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      ...blob,
      url: blob.url,
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
