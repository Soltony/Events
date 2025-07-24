
import {NextRequest, NextResponse} from 'next/server';
import axios from 'axios';

const AUTH_API_BASE_URL = process.env.AUTH_API_BASE_URL;

async function proxyHandler(req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!AUTH_API_BASE_URL) {
    console.error('AUTH_API_BASE_URL is not set.');
    return new NextResponse(
      JSON.stringify({ isSuccess: false, errors: ['Proxy configuration error.'] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const apiPath = params.path.join('/');
  const { search } = new URL(req.url);
  const targetUrl = `${AUTH_API_BASE_URL}/api/Auth/${apiPath}${search}`;
  
  try {
    let body;
    const contentType = req.headers.get('content-type');
    if (req.method !== 'GET' && contentType && contentType.includes('application/json')) {
      try {
        body = await req.json();
      } catch (e) {
        body = null;
      }
    }
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    const authorization = req.headers.get('authorization');
    if (authorization) {
        headers['Authorization'] = authorization;
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: body,
      headers: headers,
      validateStatus: () => true, 
    });

    return new NextResponse(JSON.stringify(response.data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`API Proxy Error for ${targetUrl}:`, error.message);
    return new NextResponse(
      JSON.stringify({ isSuccess: false, errors: ['Proxy request failed.'] }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export { proxyHandler as GET, proxyHandler as POST, proxyHandler as PUT, proxyHandler as DELETE };
