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
  // Video
  ".avi": "video/x-msvideo",
  ".m4v": "video/x-m4v",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".weba": "audio/webm",
  // Documents & Images
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

export type UploadedLeadDocument = {
  originalName: string;
  filename: string;
  path: string;
  url: string;
  size: number;
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
    files: 25,
    fields: 10,
    parts: 35,
  },
});

export async function readLeadSubmission(request: NextRequest): Promise<{
  body: unknown;
  file?: UploadedLeadVideo;
  documentFiles?: UploadedLeadDocument[];
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
      uploader.any()(multerRequest, {} as Response, (error?: unknown) => {
        if (error) reject(error);
        else resolve();
      });
    });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        throw new LeadVideoUploadError("Files must be 250 MB or smaller.", 413);
      }
      throw new LeadVideoUploadError("The file upload request is invalid.");
    }
    throw error;
  }

  const files = (multerRequest as unknown as { files?: Express.Multer.File[] }).files ?? [];
  const singleFile = multerRequest.file;
  const allFiles: Express.Multer.File[] = singleFile ? [singleFile, ...files] : files;

  const videoFile = allFiles.find((f) => f.fieldname === "video" || f.fieldname === "audio");
  const documentFiles = allFiles.filter((f) => f.fieldname === "documents" || f.fieldname === "document");

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
      ...(videoFile
        ? {
            file: {
              filename: videoFile.filename,
              path: videoFile.path,
              videoUrl: `${videoUrlPrefix}${videoFile.filename}`,
            },
          }
        : {}),
      ...(documentFiles.length > 0
        ? {
            documentFiles: documentFiles.map((doc) => ({
              originalName: doc.originalname,
              filename: doc.filename,
              path: doc.path,
              url: `${videoUrlPrefix}${doc.filename}`,
              size: doc.size,
            })),
          }
        : {}),
    };
  } catch (error) {
    for (const file of allFiles) {
      await removeUploadedLeadVideo(file.path);
    }
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
