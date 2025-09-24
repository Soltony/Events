import { Facebook, Twitter, Instagram } from 'lucide-react';

export function Footer() {
  return (
    <footer style={{ backgroundColor: "#fdf3d7" }} className="text-black">
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
<<<<<<< HEAD
        <div className="flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-center text-muted-foreground">
=======
        <div className="flex flex-col items-center text-center space-y-4">
          <p className="text-sm text-black/80">
>>>>>>> 0d7b3485aab2c1f97523ec9b021509f47f9f2440
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
