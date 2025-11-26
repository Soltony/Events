import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let normalized = phone.trim();
  
  if (normalized.startsWith('+251')) {
    normalized = '0' + normalized.substring(4);
  } else if (normalized.startsWith('251')) {
    normalized = '0' + normalized.substring(3);
  }

  // Ensure it's in the format 09... or 07... etc.
  if (!normalized.startsWith('0')) {
      // If it's a 9-digit number like 912345678, prepend 0
      if (normalized.length === 9) {
          normalized = '0' + normalized;
      }
  }
  
  return normalized.replace(/[^0-9]/g, ''); // Final cleanup to remove non-numeric characters
}
