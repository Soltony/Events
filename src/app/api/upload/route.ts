
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Ensure the uploads directory exists
const uploadsDir = path.join(process.cwd(), 'public/uploads');

const ensureUploadsDirExists = async () => {
    try {
        await fs.access(uploadsDir);
    } catch (error) {
        await fs.mkdir(uploadsDir, { recursive: true });
    }
};

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ success: false, error: 'Method Not Allowed' }, { status: 405 });
  }

  await ensureUploadsDirExists();

  try {
    const { file } = await req.json();

    if (!file || typeof file !== 'string' || !file.startsWith('data:image/')) {
      return NextResponse.json({ success: false, error: 'Invalid file data provided. Expected a data URI.' }, { status: 400 });
    }

    const base64Data = file.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Extract file extension
    const mimeType = file.match(/data:(image\/\w+);/)?.[1];
    const extension = mimeType ? mimeType.split('/')[1] : 'png';
    
    const filename = `${uuidv4()}.${extension}`;
    const filePath = path.join(uploadsDir, filename);

    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
