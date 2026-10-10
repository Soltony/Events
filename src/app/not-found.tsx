import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Replaces Next.js's built-in 404 page, whose inline <style> is blocked by the nonce-based CSP.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">The page you are looking for could not be found.</p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
