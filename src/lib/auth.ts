import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
    updateAge: 0,
  },
  jwt: {
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawEmail = credentials.email as string | undefined;
        const password = credentials.password as string | undefined;

        if (!rawEmail || !password) return null;

        const email = rawEmail.trim().toLowerCase();
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const isValid = await compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          departmentId: user.departmentId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user || trigger === "signIn") {
        token.loginAt = Math.floor(Date.now() / 1000);
        token.userId = user!.id!;
        token.name = user!.name!;
        token.role = user!.role;
        token.departmentId = user!.departmentId;
      }
      if (token.loginAt && Math.floor(Date.now() / 1000) - token.loginAt > 24 * 60 * 60) {
        return null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.userId = token.userId;
      session.user.name = token.name;
      session.user.role = token.role;
      session.user.departmentId = token.departmentId;
      return session;
    },
  },
});
