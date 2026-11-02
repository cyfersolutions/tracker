import { NextResponse, type NextRequest } from "next/server";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import { leadExportQuerySchema } from "@/lib/validations/query";
import Lead from "@/models/Lead";
import { canManageLeadPrice, getLeadTotalPrice } from "@/lib/lead-pricing";

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
    const { search, status } = parsed.data;
    const filter: Record<string, unknown> = {};
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
      "Name", "Email", "Phone", "Video", "Street", "City", "Country",
      "Postal code", "Roof size (sq ft)", "Status",
      ...(canExportPrices ? ["Base price (USD)", "Final price (USD)"] : []),
      "Assigned to", "Created at",
    ];
    const rows = [
      headers,
      ...leads.map((lead) => [
        lead.name,
        lead.email,
        lead.phone,
        lead.videoUrl,
        lead.address.street,
        lead.address.city,
        lead.address.country,
        lead.address.postalCode,
        lead.roofSize,
        lead.status,
        ...(canExportPrices
          ? [
              lead.basePrice ?? 10,
              lead.finalPrice ??
                getLeadTotalPrice({ basePrice: lead.basePrice ?? 10, topUps: lead.topUps ?? [] }),
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
