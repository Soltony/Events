'use server';

import { cookies } from 'next/headers';
import { encryptSessionPayload, decryptSessionPayload } from './sessionCrypto';

/**
 * Sets an HTTP-only cookie with encrypted data
 * @param name Cookie name
 * @param value Cookie value (will be encrypted)
 * @param options Cookie options
 */
export async function setSecureCookie(
  name: string,
  value: any,
  options: {
    maxAge?: number;
    path?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  } = {}
) {
  const cookieStore = cookies();
  const encrypted = await encryptSessionPayload(
    typeof value === 'string' ? value : JSON.stringify(value)
  );
  
  cookieStore.set(name, encrypted, {
    httpOnly: true,
    secure: options.secure ?? true,
    sameSite: options.sameSite ?? 'strict',
    path: options.path ?? '/',
    maxAge: options.maxAge ?? 60 * 60 * 24, // 1 day default
  });
}

/**
 * Gets and decrypts an HTTP-only cookie
 * @param name Cookie name
 * @returns Decrypted cookie value or null if not found
 */
export async function getSecureCookie<T = any>(name: string): Promise<T | null> {
  try {
    const cookieStore = cookies();
    const cookie = cookieStore.get(name);
    
    if (!cookie?.value) {
      return null;
    }
    
    const decrypted = await decryptSessionPayload(cookie.value);
    
    try {
      return JSON.parse(decrypted) as T;
    } catch {
      return decrypted as unknown as T;
    }
  } catch (error) {
    console.error(`Error getting secure cookie ${name}:`, error);
    return null;
  }
}

/**
 * Deletes an HTTP-only cookie
 * @param name Cookie name
 */
export async function deleteSecureCookie(name: string) {
  const cookieStore = cookies();
  cookieStore.delete(name);
}