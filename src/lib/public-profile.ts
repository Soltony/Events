/**
 * Shapes the account objects returned to the browser by login / "me" endpoints.
 *
 * Security internals — password hash, token version (session-revocation counter),
 * lockout state and password timestamps — must never leave the server: they are not
 * needed by the UI and would help an attacker reason about session revocation and
 * brute-force lockouts.
 */

const SENSITIVE_ACCOUNT_FIELDS = [
  'password',
  'tokenVersion',
  'failedLoginAttempts',
  'lockoutUntil',
  'passwordUpdatedAt',
] as const;

type Sensitive = (typeof SENSITIVE_ACCOUNT_FIELDS)[number];

/** Regular user: everything the UI already relies on, minus security internals. */
export function toPublicUser<T extends Record<string, any>>(user: T): Omit<T, Sensitive> {
  const out: Record<string, any> = { ...user };
  for (const field of SENSITIVE_ACCOUNT_FIELDS) delete out[field];
  return out as Omit<T, Sensitive>;
}

/** Super Admin: an explicit allow-list matching what the Super Admin portal uses. */
export function toPublicSuperAdmin(superAdmin: {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  status: string;
  lastLoginAt: Date | string | null;
  passwordChangeRequired: boolean;
  role: { id: string; name: string; description: string | null };
  permissions: string[];
}) {
  return {
    id: superAdmin.id,
    fullName: superAdmin.fullName,
    phoneNumber: superAdmin.phoneNumber,
    email: superAdmin.email,
    status: superAdmin.status,
    lastLoginAt: superAdmin.lastLoginAt,
    passwordChangeRequired: superAdmin.passwordChangeRequired,
    role: {
      id: superAdmin.role.id,
      name: superAdmin.role.name,
      description: superAdmin.role.description,
      permissions: superAdmin.permissions,
    },
  };
}
