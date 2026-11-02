import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import {
  readLeadSubmission,
  removeUploadedLeadVideo,
} from "@/lib/server/lead-video";

test("Multer stores an uploaded file without checking its MIME type or extension", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lead-video-test-"));
  const previousDirectory = process.env.LEAD_VIDEO_STORAGE_DIR;
  process.env.LEAD_VIDEO_STORAGE_DIR = directory;

  try {
    const form = new FormData();
    form.append("lead", JSON.stringify({ name: "Jordan Lee" }));
    form.append(
      "video",
      new Blob([new Uint8Array([1, 2, 3])], { type: "application/octet-stream" }),
      "inspection.bin",
    );
    const request = new NextRequest("http://localhost/api/leads", {
      method: "POST",
      body: form,
    });

    assert.match(request.headers.get("content-type") ?? "", /^multipart\/form-data;/);
    const submission = await readLeadSubmission(request);
    assert.deepEqual(submission.body, { name: "Jordan Lee" });
    assert.ok(submission.file);
    assert.match(submission.file.videoUrl, /^\/api\/leads\/videos\/[0-9a-f-]+\.bin$/i);
    assert.deepEqual(await readFile(submission.file.path), Buffer.from([1, 2, 3]));
    await removeUploadedLeadVideo(submission.file.path);
  } finally {
    if (previousDirectory === undefined) delete process.env.LEAD_VIDEO_STORAGE_DIR;
    else process.env.LEAD_VIDEO_STORAGE_DIR = previousDirectory;
    await rm(directory, { recursive: true, force: true });
  }
});

test("Multer accepts submissions with no file", async () => {
  const form = new FormData();
  form.append("lead", JSON.stringify({ name: "Jordan Lee" }));
  const request = new NextRequest("http://localhost/api/leads", {
    method: "POST",
    body: form,
  });

  const submission = await readLeadSubmission(request);
  assert.deepEqual(submission.body, { name: "Jordan Lee" });
  assert.equal(submission.file, undefined);
});
