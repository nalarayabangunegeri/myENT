import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { LoginThrottle } from './login-throttle';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: cfg.get('JWT_EXPIRES_IN') ?? '15m' } as any,
      }),
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard, LoginThrottle],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, LoginThrottle],
})
export class CommonModule {}
