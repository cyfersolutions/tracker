import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      roleId: string;
      isSuperAdmin: boolean;
      permissions: string[];
    } & NonNullable<DefaultSession["user"]>;
  }

  interface User {
    roleId: string;
    isSuperAdmin: boolean;
    permissions: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roleId: string;
    isSuperAdmin: boolean;
    permissions: string[];
  }
}
