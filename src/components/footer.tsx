import { Facebook, Instagram, Linkedin, Youtube, Send } from 'lucide-react';

export function Footer() {
  return (
    <footer className="text-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#fff4d6] via-[#ffe2a3] to-[#ffcf6b]" />
      <div className="relative">
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-center text-black/80">
            &copy; {new Date().getFullYear()} NibTera Tickets. All rights reserved.
          </p>
          <div className="flex justify-center space-x-4">
            <a
              href="https://web.facebook.com/nib.intbank"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="hover:text-sidebar-accent transition-colors"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a
              href="https://www.linkedin.com/company/nib-internationalbank"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Linkedin"
              className="hover:text-sidebar-accent transition-colors"
            >
              <Linkedin className="h-5 w-5" />
            </a>
            <a
              href="https://www.instagram.com/nib_internationalbank/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="hover:text-sidebar-accent transition-colors"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="https://www.youtube.com/channel/UCn_-tUsAPEKdzm_b2BOCOdA"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Youtube"
              className="hover:text-sidebar-accent transition-colors"
            >
              <Youtube className="h-5 w-5" />
            </a>
            <a
              href="https://t.me/nibinternationalbanksc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="hover:text-sidebar-accent transition-colors"
            >
              <Send className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
      </div>
    </footer>
  );
}
