import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { readBoundedMedia } from "../src/inbound-media.js";

test("collects an incoming media stream and closes it", async () => {
  const stream = Readable.from([Buffer.from("abc"), Buffer.from("def")]);
  assert.equal((await readBoundedMedia(stream, 6)).toString(), "abcdef");
  assert.equal(stream.destroyed, true);
});

test("stops downloading at the size limit", async () => {
  const stream = Readable.from([Buffer.alloc(4), Buffer.alloc(4), Buffer.alloc(4)]);
  await assert.rejects(readBoundedMedia(stream, 5), /inbound_media_too_large/);
  assert.equal(stream.destroyed, true);
});

test("download errors propagate without retaining partial content", async () => {
  const stream = Readable.from((async function* () {
    yield Buffer.from("partial");
    throw new Error("download_failed");
  })());
  await assert.rejects(readBoundedMedia(stream), /download_failed/);
  assert.equal(stream.destroyed, true);
});
