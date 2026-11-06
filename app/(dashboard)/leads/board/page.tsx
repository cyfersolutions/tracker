import { redirect } from "next/navigation";

export default async function LeadBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  params.set("view", "board");
  if (query.campaign) params.set("campaign", query.campaign);
  redirect(`/leads?${params.toString()}`);
}
