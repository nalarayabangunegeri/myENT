import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { detectImage } from '../attendance/attendance.rules';

// Sanitasi upload terpusat (P1-05). Selfie sudah begini sejak awal;
// lampiran lain (absence, correction, loan, submission) disamakan.
// Image: decode → re-encode JPEG (EXIF/metadata + polyglot ikut terbuang).
// PDF: %PDF- di kepala + %%EOF di ekor (tolak polyglot gambar-PDF).
export async function sanitizeImage(buf: Buffer): Promise<Buffer> {
  if (!detectImage(buf)) throw new BadRequestException('File harus foto JPG/PNG/WebP');
  try {
    return await sharp(buf, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch {
    throw new BadRequestException('Foto rusak/tidak terbaca');
  }
}

export function assertPdf(buf: Buffer) {
  if (buf.length < 8 || buf.toString('ascii', 0, 5) !== '%PDF-')
    throw new BadRequestException('File harus PDF valid');
  const tail = buf.subarray(Math.max(0, buf.length - 1024)).toString('ascii');
  if (!tail.includes('%%EOF')) throw new BadRequestException('PDF rusak/tidak lengkap');
}
