import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { connectToDatabase } from "@/lib/db/connect";
import { ALL_PERMISSIONS, toPlainPermissions } from "@/lib/permissions";
import Role from "@/models/Role";
import User from "@/models/User";

const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        await connectToDatabase();
        const user = await User.findOne({ email: parsed.data.email })
          .select("+password")
          .populate<{ role: InstanceType<typeof Role> | null }>("role");
        if (!user || !user.isActive || !user.role) return null;

        const passwordMatches = await compare(parsed.data.password, user.password);
        if (!passwordMatches) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roleId: user.role.id,
          isSuperAdmin: user.isSuperAdmin,
          permissions: user.isSuperAdmin
            ? toPlainPermissions(ALL_PERMISSIONS)
            : toPlainPermissions(user.role.permissions),
        };
      },
    }),
  ],
});
