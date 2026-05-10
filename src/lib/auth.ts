import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const ALLOWED_DOMAIN = process.env.AUTH_ALLOWED_DOMAIN;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      ...(ALLOWED_DOMAIN && {
        authorization: { params: { hd: ALLOWED_DOMAIN } },
      }),
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (!ALLOWED_DOMAIN) return true;
      const email = (profile as any)?.email as string | undefined;
      return !!email && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN.toLowerCase()}`);
    },
  },
  session: { strategy: 'jwt' },
};
