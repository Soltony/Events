

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
              <Image src="https://sdmntprwestus2.oaiusercontent.com/files/00000000-3fe4-61f8-ad48-fc57e9f36849/raw?se=2025-07-19T09%3A14%3A18Z&sp=r&sv=2024-08-04&sr=b&scid=50db1888-8a8c-5f2e-8d5d-d41402fb4415&skoid=add8ee7d-5fc7-451e-b06e-a82b2276cf62&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-07-19T02%3A21%3A06Z&ske=2025-07-20T02%3A21%3A06Z&sks=b&skv=2024-08-04&sig=MyAXfeV%2BQY0NDXL4I2f/IKkhwhOo2UiOacqRxRhoYIU%3D" alt="NibTera Tickets Logo" width={150} height={40} className="object-contain" data-ai-hint="logo nibtera" />
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
