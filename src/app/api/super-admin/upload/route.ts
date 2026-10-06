
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireSuperAdminPermission } from '@/lib/super-admin-auth';
import { assertSameOriginCsrf } from '@/lib/csrf';

// Accepted raster image types for carousel artwork. SVG is deliberately excluded
// (it can carry script), as is any non-image data URI.
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_FORMATS = new Set(['png', 'jpeg', 'webp']);
const MAX_DECODED_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;

const DATA_URI_RE = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/\r\n]+={0,2})$/i;

export async function POST(req: NextRequest) {
  try {
    if (!assertSameOriginCsrf(req)) {
      return NextResponse.json({ success: false, error: 'Invalid CSRF token.' }, { status: 403 });
    }

    try {
      // Shared by both the add-slide and edit-slide flows in the same dialog.
      await requireSuperAdminPermission('Homepage Carousel:Create').catch(() =>
        requireSuperAdminPermission('Homepage Carousel:Update')
      );
    } catch {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ success: false, error: 'Payload too large.' }, { status: 413 });
    }

    const { file } = await req.json();

    if (!file || typeof file !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid file data provided. Expected a data URI.' }, { status: 400 });
    }

    const match = DATA_URI_RE.exec(file);
    if (!match) {
      return NextResponse.json({ success: false, error: 'Invalid file data. Expected a base64 image data URI.' }, { status: 400 });
    }

    const declaredMime = match[1].toLowerCase();
    if (!ALLOWED_MIME.has(declaredMime)) {
      return NextResponse.json({ success: false, error: 'Unsupported image type. Allowed: PNG, JPEG, WebP.' }, { status: 400 });
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > MAX_DECODED_BYTES) {
      return NextResponse.json(
        { success: false, error: `Image must be between 1 byte and ${MAX_DECODED_BYTES / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    // Content inspection: the decoded bytes must actually be an allowed raster
    // format, regardless of what the data-URI prefix claimed.
    let detectedFormat: string | undefined;
    try {
      detectedFormat = (await sharp(buffer).metadata()).format;
    } catch {
      return NextResponse.json({ success: false, error: 'File is not a valid image.' }, { status: 400 });
    }
    if (!detectedFormat || !ALLOWED_FORMATS.has(detectedFormat)) {
      return NextResponse.json({ success: false, error: 'File content does not match an allowed image type.' }, { status: 400 });
    }

    const normalizedMime = detectedFormat === 'jpeg' ? 'image/jpeg' : `image/${detectedFormat}`;
    const imageUrl = `data:${normalizedMime};base64,${buffer.toString('base64')}`;

    return NextResponse.json({ success: true, url: imageUrl });
  } catch (error) {
    console.error('Super admin upload API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
