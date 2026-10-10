import { Controller, Get, NotFoundException, Param, Query, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';

// Melayani file driver lokal via token HMAC (dev saja). R2 langsung presigned — tak tersentuh.
@Controller('files')
export class FilesController {
  constructor(private storage: StorageService) {}

  @Get('*key')
  async get(@Param('key') key: string | string[], @Query('exp') exp: string, @Query('sig') sig: string, @Res() res: Response) {
    const k = Array.isArray(key) ? key.join('/') : key;
    if (!exp || !sig || !StorageService.verifyLocalToken(k, exp, sig)) throw new UnauthorizedException();
    try {
      const buf = await this.storage.readLocal(k);
      res.setHeader('Content-Type', StorageService.contentTypeFor(k));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(buf);
    } catch {
      throw new NotFoundException('File sudah dihapus');
    }
  }
}
