'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { setNonce } from 'get-nonce';

/**
 * Makes the per-request CSP nonce (generated in middleware) available to client code
 * that has to inject <style> elements at runtime:
 *  - Radix's scroll lock (react-remove-scroll → react-style-singleton) reads it via `get-nonce`;
 *  - our own components read it with `useCspNonce()`.
 */
const CspNonceContext = createContext<string | undefined>(undefined);

export function CspNonceProvider({ nonce, children }: { nonce: string; children: ReactNode }) {
  if (nonce && typeof window !== 'undefined') {
    setNonce(nonce);
  }
  return <CspNonceContext.Provider value={nonce || undefined}>{children}</CspNonceContext.Provider>;
}

export function useCspNonce(): string | undefined {
  return useContext(CspNonceContext);
}
