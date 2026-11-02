import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.roleId = user.roleId;
        token.isSuperAdmin = user.isSuperAdmin;
        token.permissions = [...user.permissions];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.userId = token.sub ?? "";
        session.user.roleId = token.roleId;
        session.user.isSuperAdmin = token.isSuperAdmin;
        session.user.permissions = [...token.permissions];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
