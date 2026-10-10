'use client';

// App-wide error boundary: catches errors from any page or layout. It replaces the whole
// document, so it renders its own <html>/<body> and uses no app components or styles.
// Never shows the error message or stack — only the opaque digest.
// There is deliberately no root src/app/error.tsx: with Next.js 15.5 a root segment error
// boundary intermittently broke hydration of client pages (React error #418) when the
// server responded slowly, forcing a full client re-render.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem 1.5rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>An unexpected error occurred. Please try again.</p>
          {error.digest && <p style={{ fontSize: '0.75rem', color: '#666' }}>Reference: {error.digest}</p>}
          <button type="button" onClick={() => reset()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
