
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

async function connectUser() {
  const headerList = await headers();
  const authHeader = headerList.get('Authorization');

  if (!authHeader) {
    return {
      status: 'error',
      message:
        'Authorization header is missing from the request. This page should be opened from the NIB Super App.',
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      status: 'error',
      message: 'Authorization header is malformed. It must start with "Bearer".',
    };
  }

  const token = authHeader.substring(7);
  const validationUrl = process.env.AUTH_VALIDATION_URL;

  if (!validationUrl) {
    console.error('AUTH_VALIDATION_URL is not set in environment variables.');
    return { status: 'error', message: 'Authentication service is not configured.' };
  }

  let phoneNumber;
  try {
    const externalResponse = await fetch(validationUrl, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text();
      console.error(
        `External token validation failed with status ${externalResponse.status}: ${errorText}`
      );
      throw new Error('Token validation failed with the authentication service.');
    }

    const responseText = await externalResponse.text();
    if (!responseText) {
      throw new Error('External authentication service returned an empty response.');
    }

    const responseData = JSON.parse(responseText);
    phoneNumber = responseData.phone;

    if (!phoneNumber) {
      throw new Error('External service did not return a phone number.');
    }
  } catch (error: any) {
    console.error('Connect Page - Token Validation Error:', error);
    return {
      status: 'error',
      message: error.message || 'An unexpected error occurred during token validation.',
    };
  }

  // --- Session Creation via API Route ---
  try {
    const sessionPayload = {
      accessToken: token,
      phoneNumber,
      source: 'superapp',
    };

    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;

    const sessionResponse = await fetch(`${appUrl}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionPayload)
    });

    if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to create session.');
    }

    return { status: 'success' };
  } catch (error: any) {
    console.error('Connect Page - Session Creation Error:', error);
    return {
      status: 'error',
      message: error.message || 'An unexpected error occurred during session creation.',
    };
  }
}

export default async function PortalConnectPage() {
  const result = await connectUser();

  if (result.status === 'success') {
    redirect('/');
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted">
      <Card className="w-full max-w-md m-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-6 w-6" />
            Authentication Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Could not connect to your account.
          </p>
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{result.message}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
