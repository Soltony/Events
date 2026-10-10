
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { verifyAuth } from '@/lib/auth-middleware';
import { hasPermission } from '@/lib/permissions';
import { verifyCsrf } from '@/lib/csrf';
import { malformedJsonResponse, readJsonBody, withApiErrorHandling } from '@/lib/api-handler';

// Accepted raster image types for event artwork. SVG is deliberately excluded
// (it can carry script), as is any non-image data URI.
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_FORMATS = new Set(['png', 'jpeg', 'webp']);
const MAX_DECODED_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_REQUEST_BYTES = 8 * 1024 * 1024; // base64 + JSON overhead headroom

const DATA_URI_RE = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/\r\n]+={0,2})$/i;

export const POST = withApiErrorHandling(async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) {
      return NextResponse.json({ success: false, error: 'Invalid CSRF token.' }, { status: 403 });
    }

    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }
    if (!hasPermission(user.role as any, 'Events:Update') && !hasPermission(user.role as any, 'Events:Create')) {
      return NextResponse.json({ success: false, error: 'Permission denied.' }, { status: 403 });
    }

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ success: false, error: 'Payload too large.' }, { status: 413 });
    }

    const body = await readJsonBody(req);
    if (!body) return malformedJsonResponse();
    const { file } = body;

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

    // Content inspection: the decoded bytes must actually be one of the allowed
    // raster formats, regardless of what the data-URI prefix claimed.
    let detectedFormat: string | undefined;
    try {
      detectedFormat = (await sharp(buffer).metadata()).format;
    } catch {
      return NextResponse.json({ success: false, error: 'File is not a valid image.' }, { status: 400 });
    }
    if (!detectedFormat || !ALLOWED_FORMATS.has(detectedFormat)) {
      return NextResponse.json({ success: false, error: 'File content does not match an allowed image type.' }, { status: 400 });
    }

    // Prototype behaviour retained: echo back a normalized data URI. A real
    // deployment should persist `buffer` to object storage and return its URL.
    const normalizedMime = detectedFormat === 'jpeg' ? 'image/jpeg' : `image/${detectedFormat}`;
    const imageUrl = `data:${normalizedMime};base64,${buffer.toString('base64')}`;

    return NextResponse.json({ success: true, url: imageUrl });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
});
