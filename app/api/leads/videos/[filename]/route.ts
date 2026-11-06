import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { apiError, withAuth } from "@/lib/api-guards";
import {
  getLeadVideoContentType,
  getLeadVideoPath,
  isInlineLeadVideo,
} from "@/lib/server/lead-video";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withAuth("leads:view", async (_request, context) => {
  try {
    const { filename } = await context.params;
    const filePath = getLeadVideoPath(filename);
    if (!filePath) {
      return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }

    let fileSize: number;
    try {
      fileSize = (await stat(filePath)).size;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return NextResponse.json({ error: "Video not found." }, { status: 404 });
      }
      throw error;
    }

    const body = Readable.toWeb(createReadStream(filePath)) as unknown as BodyInit;
    const isInline = isInlineLeadVideo(filename);
    return new NextResponse(body, {
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(fileSize),
        "Content-Type": getLeadVideoContentType(filename),
        "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
});
