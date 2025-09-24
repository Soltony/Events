
import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Twitter, Instagram, Mail, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-sidebar text-sidebar-foreground">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Side: Logo and Description */}
          <div className="space-y-4">
             <Link href="/" className="flex items-center">
                <Image
                    src="/image/nibtickets.jpg"
                    alt="Nibkera Tickets Logo"
                    width={150}
                    height={40}
                    className="object-contain"
                    data-ai-hint="logo nibtera"
                />
            </Link>
            <p className="text-sm text-sidebar-foreground/80">
              The ultimate solution for event ticketing, making it easy to discover, buy, and manage tickets for your favorite events.
            </p>
          </div>

          {/* Center: Navigation Links */}
          <div className="flex justify-center">
            <div className="space-y-4 text-center md:text-left">
                <h3 className="text-lg font-semibold">Quick Links</h3>
                <ul className="space-y-2">
                    <li><Link href="/" className="hover:text-sidebar-accent transition-colors">Home</Link></li>
                    <li><Link href="/#events" className="hover:text-sidebar-accent transition-colors">Events</Link></li>
                    <li><Link href="/tickets" className="hover:text-sidebar-accent transition-colors">My Tickets</Link></li>
                    <li><Link href="/login" className="hover:text-sidebar-accent transition-colors">Organizer Login</Link></li>
                </ul>
            </div>
          </div>

          {/* Right Side: Contact Info and Social Media */}
          <div className="flex flex-col items-center md:items-end">
            <div className="space-y-4 text-center md:text-right">
                <h3 className="text-lg font-semibold">Contact Us</h3>
                <div className="space-y-2 text-sm">
                    <a href="mailto:contact@nibtickets.com" className="flex items-center justify-center md:justify-end gap-2 hover:text-sidebar-accent transition-colors">
                        <Mail className="h-4 w-4" />
                        contact@nibtickets.com
                    </a>
                    <p className="flex items-center justify-center md:justify-end gap-2">
                        <Phone className="h-4 w-4" />
                        +251-912-345-678
                    </p>
                </div>
                <div className="flex justify-center md:justify-end space-x-4 pt-2">
                    <a href="#" aria-label="Facebook" className="hover:text-sidebar-accent transition-colors"><Facebook className="h-5 w-5" /></a>
                    <a href="#" aria-label="Twitter" className="hover:text-sidebar-accent transition-colors"><Twitter className="h-5 w-5" /></a>
                    <a href="#" aria-label="Instagram" className="hover:text-sidebar-accent transition-colors"><Instagram className="h-5 w-5" /></a>
                </div>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-sidebar-border pt-4 text-center text-sm text-sidebar-foreground/60">
            <p>&copy; {new Date().getFullYear()} NibTera Tickets. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
