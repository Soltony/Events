'use server';

import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        phoneNumber: { label: 'Phone Number', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.phoneNumber || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { phoneNumber: credentials.phoneNumber },
          include: { role: true },
        });

        if (!user || !user.password) {
          throw new Error('Invalid credentials.');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Invalid credentials.');
        }

        if (user.status === 'INACTIVE') {
            if (user.passwordChangeRequired) {
                throw new Error('Your account is pending approval. Please contact an administrator.');
            }
            throw new Error('Your account is inactive. Please contact an administrator.');
        }

        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === 'update') {
        return { ...token, ...session.user };
      }
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.phoneNumber = (user as any).phoneNumber;
        token.passwordChangeRequired = (user as any).passwordChangeRequired;
        token.isGuest = (user as any).isGuest;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.phoneNumber = token.phoneNumber as string;
        session.user.passwordChangeRequired = token.passwordChangeRequired as boolean;
        session.user.isGuest = token.isGuest as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.JWT_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
