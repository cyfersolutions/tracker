import Role from "@/models/Role";

export async function getClientRole() {
  return Role.findOneAndUpdate(
    { name: "Client" },
    {
      $set: {
        type: "client",
        permissions: ["leads:view", "leads:topup"],
        isSystem: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
}
