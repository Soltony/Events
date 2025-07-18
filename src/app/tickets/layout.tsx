
import Link from 'next/link';
import { Logo } from '@/components/logo';

export default function TicketsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
          <div className="flex gap-6 md:gap-10">
            <Link href="/" className="flex items-center space-x-2">
              <Logo />
              <span className="inline-block font-bold">EventFlow</span>
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
