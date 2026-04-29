import { get, put } from '@vercel/blob';
import { NextResponse } from 'next/server';

function buildDownloadFileName(fileName: string) {
  return encodeURIComponent(fileName)
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const blobUrl = searchParams.get('url');
  const fileName = searchParams.get('filename') || 'download';

  if (!blobUrl) {
    return NextResponse.json({ error: 'Missing blob url' }, { status: 400 });
  }

  try {
    const result = await get(blobUrl, { access: 'public' });

    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        'content-type': result.blob.contentType,
        'content-disposition': `attachment; filename*=UTF-8''${buildDownloadFileName(fileName)}`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Download failed:', error);
    return NextResponse.json({ error: 'Download failed: ' + String(error) }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename') || 'unnamed_file';

  if (!request.body) {
    return NextResponse.json({ error: 'No file body found' }, { status: 400 });
  }

  try {
    const fileBuffer = await request.arrayBuffer();

    const blob = await put(filename, fileBuffer, {
      access: 'private',
      allowOverwrite: true, // 允许覆盖同名文件
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed: ' + String(error) }, { status: 500 });
  }
}
