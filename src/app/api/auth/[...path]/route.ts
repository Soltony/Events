
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const AUTH_API_BASE_URL = process.env.AUTH_API_BASE_URL;

async function handler(req: NextRequest, context: { params: { path: string[] } }) {
  if (!AUTH_API_BASE_URL) {
    console.error('AUTH_API_BASE_URL is not set.');
    return new NextResponse(
      JSON.stringify({ isSuccess: false, errors: ['Proxy configuration error.'] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { params } = context;
  const apiPath = params.path.join('/');
  const { search } = new URL(req.url);
  const targetUrl = `${AUTH_API_BASE_URL}/api/Auth/${apiPath}${search}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const authorization = req.headers.get('authorization');
  if (authorization) {
    headers['Authorization'] = authorization;
  }

  try {
    let body;
    // Check if the request method can have a body
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        // req.json() will throw an error if body is empty, so we handle it
        body = await req.json();
      } catch (e) {
        body = null;
      }
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: body,
      headers: headers,
      validateStatus: () => true, // Let us handle all status codes
    });

    return new NextResponse(JSON.stringify(response.data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`API Proxy Error for ${targetUrl}:`, error.message);
    const status = error.response?.status || 502; // Bad Gateway
    const errorMessage = error.response?.data?.errors?.join(', ') || 'Proxy request failed.';
    
    return new NextResponse(
      JSON.stringify({ isSuccess: false, errors: [errorMessage] }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
