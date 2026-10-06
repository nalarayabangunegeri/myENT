import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const h = req.headers?.authorization ?? '';
    const [type, token] = h.split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Unauthorized');
    try {
      const payload = await this.jwt.verifyAsync(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Unauthorized');
      req.user = user;
      // PRD §6.1: paksa ganti password sementara, kecuali endpoint allowlist.
      const allow = ['/auth/change-password', '/auth/logout', '/auth/refresh'];
      if (user.mustChangePassword && !allow.some((p) => req.url.startsWith(p)))
        throw new UnauthorizedException('MUST_CHANGE_PASSWORD');
      return true;
    } catch (e: any) {
      if (e?.message === 'MUST_CHANGE_PASSWORD') throw e;
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
