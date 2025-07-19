
import Link from 'next/link';
import Image from 'next/image';

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
              <Image src="https://storage.googleapis.com/project-pincher-testing/downloads/f0a4f5f5-f81d-4001-ba76-0b81d770c3c8.png" alt="NibTera Tickets Logo" width={150} height={40} className="object-contain" />
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
