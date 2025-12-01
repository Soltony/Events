import NextAuth, { DefaultSession } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import { Role, UserStatus } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      phoneNumber: string;
      passwordChangeRequired: boolean;
      isGuest?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
      id: string;
      role: Role;
      phoneNumber: string;
      passwordChangeRequired: boolean;
      status: UserStatus;
      isGuest?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    phoneNumber: string;
    passwordChangeRequired: boolean;
    isGuest?: boolean;
  }
}
