import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) throw new ForbiddenException('Forbidden'); // deny by default — AGENTS §6
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Forbidden');
    return true;
  }
}
