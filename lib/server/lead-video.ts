import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import multer from "multer";
import type { Request, Response } from "express";
import type { NextRequest } from "next/server";

const videoDirectory = () =>
  path.resolve(/*turbopackIgnore: true*/
    process.env.LEAD_VIDEO_STORAGE_DIR ??
      path.join(process.cwd(), "uploads", "lead-videos"),
  );
const videoUrlPrefix = "/api/leads/videos/";
const contentTypes: Record<string, string> = {
  ".avi": "video/x-msvideo",
  ".m4v": "video/x-m4v",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export class LeadVideoUploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "LeadVideoUploadError";
  }
}

export type UploadedLeadVideo = {
  filename: string;
  path: string;
  videoUrl: string;
};

const uploader = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      const directory = videoDirectory();
      void mkdir(directory, { recursive: true }).then(
        () => callback(null, directory),
        (error: Error) => callback(error, directory),
      );
    },
    filename: (_request, file, callback) => {
      const originalExtension = path.extname(file.originalname).toLowerCase();
      const extension = /^\.[a-z0-9]{1,10}$/.test(originalExtension)
        ? originalExtension
        : "";
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: 250 * 1024 * 1024,
    files: 1,
    fields: 1,
    parts: 2,
  },
});

export async function readLeadSubmission(request: NextRequest): Promise<{
  body: unknown;
  file?: UploadedLeadVideo;
}> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return { body: await request.json() };
  }
  if (!request.body) {
    throw new LeadVideoUploadError("The upload request has no content.");
  }

  const stream = Readable.fromWeb(
    request.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
  );
  const headers = Object.fromEntries(request.headers.entries());
  if (!headers["content-length"] && !headers["transfer-encoding"]) {
    headers["transfer-encoding"] = "chunked";
  }
  const multerRequest = Object.assign(stream, {
    headers,
    method: request.method,
  }) as unknown as Request;

  try {
    await new Promise<void>((resolve, reject) => {
      uploader.single("video")(multerRequest, {} as Response, (error?: unknown) => {
        if (error) reject(error);
        else resolve();
      });
    });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        throw new LeadVideoUploadError("Videos must be 250 MB or smaller.", 413);
      }
      throw new LeadVideoUploadError("The video upload request is invalid.");
    }
    throw error;
  }

  const file = multerRequest.file;
  try {
    if (!multerRequest.body) {
      throw new LeadVideoUploadError("The upload request could not be processed.");
    }
    const submittedLead = multerRequest.body.lead;
    if (typeof submittedLead !== "string") {
      throw new LeadVideoUploadError("Lead details are missing from the upload.");
    }
    let body: unknown;
    try {
      body = JSON.parse(submittedLead);
    } catch {
      throw new LeadVideoUploadError("Lead details must contain valid JSON.");
    }
    return {
      body,
      ...(file
        ? {
            file: {
              filename: file.filename,
              path: file.path,
              videoUrl: `${videoUrlPrefix}${file.filename}`,
            },
          }
        : {}),
    };
  } catch (error) {
    if (file) await removeUploadedLeadVideo(file.path);
    throw error;
  }
}

export async function removeUploadedLeadVideo(filePath: string) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}

export function getLeadVideoPath(filename: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.[a-z0-9]{1,10})?$/i.test(
      filename,
    )
  ) {
    return null;
  }
  return path.join(/*turbopackIgnore: true*/ videoDirectory(), filename);
}

export function getManagedLeadVideoPath(videoUrl: string) {
  if (!videoUrl.startsWith(videoUrlPrefix)) return null;
  return getLeadVideoPath(videoUrl.slice(videoUrlPrefix.length));
}

export function getLeadVideoContentType(filename: string) {
  return contentTypes[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

export function isInlineLeadVideo(filename: string) {
  return Object.hasOwn(contentTypes, path.extname(filename).toLowerCase());
}
