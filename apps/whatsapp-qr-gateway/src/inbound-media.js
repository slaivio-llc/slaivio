export const MAX_INBOUND_MEDIA_BYTES = 12 * 1024 * 1024;

export async function readBoundedMedia(stream, maxBytes = MAX_INBOUND_MEDIA_BYTES) {
  const chunks = [];
  let size = 0;
  const timer = setTimeout(() => stream.destroy(new Error("inbound_media_timeout")), 60_000);
  try {
    for await (const chunk of stream) {
      size += chunk.length;
      if (size > maxBytes) throw new Error("inbound_media_too_large");
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks, size);
  } finally {
    clearTimeout(timer);
    stream.destroy();
  }
}
