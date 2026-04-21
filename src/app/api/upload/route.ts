import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename') || 'unnamed_file';

  if (!request.body) {
    return NextResponse.json({ error: 'No file body found' }, { status: 400 });
  }

  try {
    const blob = await put(filename, request.body, {
      access: 'private',
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
