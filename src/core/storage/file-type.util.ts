export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const ascii = (buf: Buffer, start: number, end: number) =>
  buf.subarray(start, end).toString('ascii');

export function detectMimeType(buf: Buffer): string | null {
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    ascii(buf, 0, 4) === 'RIFF' &&
    ascii(buf, 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
