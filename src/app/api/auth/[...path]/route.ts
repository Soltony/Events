
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const AUTH_API_BASE_URL = process.env.AUTH_API_BASE_URL || 'http://localhost:5160';

async function proxyRequest(req: NextRequest, context: { params: { path: string[] } }) {
  const path = context.params.path || [];
  if (!AUTH_API_BASE_URL) {
    console.error('AUTH_API_BASE_URL is not set.');
    return new NextResponse(
      JSON.stringify({ isSuccess: false, errors: ['Proxy configuration error.'] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const apiPath = path.join('/');
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
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        const textBody = await req.text();
        if (textBody) {
          body = JSON.parse(textBody);
        }
      } catch (e) {
        console.warn("Could not parse request body:", e);
      }
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: body,
      headers,
      validateStatus: () => true,
    });
    
    let responseBody = response.data;
    // Ensure the response is always valid JSON, even if the upstream service returns an empty body.
    if (response.status >= 200 && response.status < 300 && (response.data === '' || response.data === null || response.data === undefined)) {
      responseBody = {};
    }


    return new NextResponse(JSON.stringify(responseBody), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`API Proxy Error for ${targetUrl}:`, error.message);
    const status = error.response?.status || 502;
    const errorMessage = error.response?.data?.errors?.join(', ') || 'Proxy request failed.';
    
    return new NextResponse(
      JSON.stringify({ isSuccess: false, errors: [errorMessage] }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(req: NextRequest, context: { params: { path: string[] } }) {
  return proxyRequest(req, context);
}

export async function POST(req: NextRequest, context: { params: { path: string[] } }) {
  return proxyRequest(req, context);
}

export async function PUT(req: NextRequest, context: { params: { path: string[] } }) {
  return proxyRequest(req, context);
}

export async function DELETE(req: NextRequest, context: { params: { path: string[] } }) {
  return proxyRequest(req, context);
}
