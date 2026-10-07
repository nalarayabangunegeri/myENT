import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, timingSafeEqual } from 'crypto';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { dirname, join } from 'path';
import { requireJwtSecret } from '../common/jwt-secret';

// ponytail: driver local untuk dev/smoke tanpa R2; R2 S3-compatible untuk prod (PRD §10).
// STORAGE_DRIVER=local| r2. Upgrade path: hapus driver local saat semua env punya R2.
function fileSecret(): string {
  return requireJwtSecret();
}

@Injectable()
export class StorageService {
  private driver = process.env.STORAGE_DRIVER ?? 'local';
  private dir = process.env.UPLOAD_DIR ?? './uploads';
  private s3?: S3Client;
  private bucket = process.env.R2_BUCKET ?? '';

  private client() {
    if (!this.s3) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
        },
      });
    }
    return this.s3;
  }

  async save(key: string, buf: Buffer, contentType: string) {
    if (key.includes('..')) throw new Error('Invalid key');
    if (this.driver === 'r2')
      await this.client().send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buf, ContentType: contentType }));
    else {
      const p = join(this.dir, key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, buf);
    }
    return key;
  }

  async remove(key: string) {
    if (this.driver === 'r2') await this.client().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    else {
      try {
        await unlink(join(this.dir, key));
      } catch (e: any) {
        if (e?.code !== 'ENOENT') throw e; // hilang = anggap terhapus; gagal lain = retry tick berikut
      }
    }
  }

  // URL berumur pendek untuk file privat. Lokal: token HMAC via /files (dev saja).
  async signedUrl(key: string, baseUrl: string, secs = 300) {
    if (this.driver === 'r2')
      return getSignedUrl(this.client(), new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: secs });
    const exp = Math.floor(Date.now() / 1000) + secs;
    const sig = createHmac('sha256', fileSecret()).update(`${key}:${exp}`).digest('hex');
    return `${baseUrl}/files/${key}?exp=${exp}&sig=${sig}`;
  }

  static verifyLocalToken(key: string, exp: string, sig: string) {
    if (key.includes('..') || Date.now() / 1000 > Number(exp)) return false;
    const want = createHmac('sha256', fileSecret()).update(`${key}:${exp}`).digest('hex');
    return sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want));
  }

  async readLocal(key: string) {
    return readFile(join(this.dir, key));
  }
}
