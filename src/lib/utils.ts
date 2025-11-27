import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhoneNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const digitsOnly = phone.replace(/\D+/g, "");
  if (!digitsOnly) return null;

  // Ethiopian numbers come back either as 09... or +2519...
  if (digitsOnly.length === 12 && digitsOnly.startsWith("2519")) {
    return `0${digitsOnly.slice(-9)}`;
  }

  if (digitsOnly.length === 10 && digitsOnly.startsWith("09")) {
    return digitsOnly;
  }

  return digitsOnly;
}

export function buildPhoneVariants(phone?: string | null): string[] {
  if (!phone) return [];
  const normalized = normalizePhoneNumber(phone);
  const variants = new Set<string>();
  variants.add(phone);
  if (normalized) variants.add(normalized);
  if (normalized && normalized.startsWith("0") && normalized.length === 10) {
    variants.add(`251${normalized.slice(1)}`);
    variants.add(`+251${normalized.slice(1)}`);
  }
  return Array.from(variants);
}
