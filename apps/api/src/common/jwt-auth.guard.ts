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
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, nim: true, name: true, role: true, status: true, division: true, cohortYear: true, mustChangePassword: true },
      });
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Unauthorized');
      req.user = user;
      // PRD §6.1: paksa ganti password sementara, kecuali endpoint allowlist.
      // Samakan path persis (tanpa query) — prefix rapuh terhadap /auth/change-passwordXYZ.
      // /auth/me ikut allowlist: baca profil sendiri (tanpa secret) agar client/BFF bisa deteksi status.
      const allow = ['/auth/change-password', '/auth/logout', '/auth/refresh', '/auth/me'];
      const path = (req.url as string).split('?')[0];
      if (user.mustChangePassword && !allow.includes(path))
        throw new UnauthorizedException('MUST_CHANGE_PASSWORD');
      return true;
    } catch (e: any) {
      if (e?.message === 'MUST_CHANGE_PASSWORD') throw e;
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
