import { Facebook, Twitter, Instagram } from 'lucide-react';

export function Footer() {
  return (
    <footer style={{ backgroundColor: "#fdf3d7" }} className="text-black">
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-center text-black/80">
            &copy; {new Date().getFullYear()} NibTera Tickets. All rights reserved.
          </p>
          <div className="flex justify-center space-x-4">
            <a
              href="#"
              aria-label="Facebook"
              className="hover:text-sidebar-accent transition-colors"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a
              href="#"
              aria-label="Twitter"
              className="hover:text-sidebar-accent transition-colors"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="#"
              aria-label="Instagram"
              className="hover:text-sidebar-accent transition-colors"
            >
              <Instagram className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
