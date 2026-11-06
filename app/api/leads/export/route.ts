import { NextResponse, type NextRequest } from "next/server";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import { leadExportQuerySchema } from "@/lib/validations/query";
import Lead from "@/models/Lead";
import { canManageLeadPrice, getLeadTotalPrice } from "@/lib/lead-pricing";
import { Types } from "mongoose";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function csvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  const text = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export const GET = withAuth("leads:export", async (request: NextRequest, _context, user) => {
  try {
    const parsed = leadExportQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid export filters." }, { status: 400 });
    }

    await connectToDatabase();
    const { search, status, campaign } = parsed.data;
    const filter: Record<string, unknown> =
      user.role.type === "client" ? { campaign: { $in: user.campaignIds ?? [] } } : {};
    if (user.role.type === "client" && campaign && (user.campaignIds ?? []).some((id: unknown) => String(id) === campaign) && Types.ObjectId.isValid(campaign)) {
      filter.campaign = campaign;
    }
    if (status) filter.status = status;
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: expression }, { email: expression }, { phone: expression }];
    }
    const leads = await Lead.find(filter)
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const canExportPrices = canManageLeadPrice(user);
    const headers = [
      "Type", "Name", "Email", "Phone", "MC Number", "State", "OTR", "Truck Type", "Trucks", "Revenue (USD)",
      "Roof size (sq ft)", "Street", "City", "Country", "Postal code", "Video", "Status",
      ...(canExportPrices ? ["Base price (USD)", "price (USD)"] : []),
      "Assigned to", "Created at",
    ];
    const rows = [
      headers,
      ...leads.map((lead) => [
        lead.leadType || "Roofing",
        lead.name,
        lead.email,
        lead.phone,
        lead.mcNumber || "",
        lead.address?.state || "",
        lead.otr || "",
        lead.truckType || "",
        lead.trucks ?? "",
        lead.revenue ?? "",
        lead.roofSize ?? "",
        lead.address?.street || "",
        lead.address?.city || "",
        lead.address?.country || "",
        lead.address?.postalCode || "",
        lead.videoUrl || "",
        lead.status,
        ...(canExportPrices
          ? [
              lead.basePrice ?? 50,
              lead.finalPrice ??
                getLeadTotalPrice({ basePrice: lead.basePrice ?? 50, topUps: lead.topUps ?? [] }),
            ]
          : []),
        typeof lead.assignedTo === "object" && lead.assignedTo ? lead.assignedTo.name : "",
        lead.createdAt.toISOString(),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="leads.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
});
