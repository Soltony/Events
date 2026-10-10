import jwt, { type JwtPayload, type SignOptions, type VerifyOptions } from 'jsonwebtoken';

/**
 * Single place where the application's JWTs are signed and verified.
 *
 * The algorithm is pinned: tokens are always signed with HS256 and verification accepts
 * HS256 only, so unsigned (`alg: none`), signature-stripped, or algorithm-confused tokens
 * are rejected regardless of what the token header claims. Never use `jwt.decode` to make
 * a trust decision — it does not check the signature.
 */
export const JWT_ALGORITHM = 'HS256' as const;

export function signJwt(
  payload: string | object | Buffer,
  secret: string,
  options: Omit<SignOptions, 'algorithm'> = {},
): string {
  return jwt.sign(payload, secret, { ...options, algorithm: JWT_ALGORITHM });
}

export function verifyJwt<T extends object = JwtPayload>(
  token: string,
  secret: string,
  options: Omit<VerifyOptions, 'algorithms' | 'complete'> = {},
): T {
  return jwt.verify(token, secret, { ...options, algorithms: [JWT_ALGORITHM] }) as T;
}

export { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
