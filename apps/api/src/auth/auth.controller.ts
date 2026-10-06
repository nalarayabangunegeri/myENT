import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ForgotDto, LoginDto, RefreshDto, ResetPasswordDto, ResetViaEmailDto } from './dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { LoginThrottle } from '../common/login-throttle';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private throttle: LoginThrottle,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const key = `${req.ip}:${dto.nim}`;
    if (this.throttle.isBlocked(key)) {
      const { UnauthorizedException } = await import('@nestjs/common');
      throw new UnauthorizedException('Terlalu banyak percobaan, coba lagi sebentar');
    }
    return this.auth.login(dto.nim, dto.password);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgot(@Body() dto: ForgotDto) {
    return this.auth.forgotPassword(dto.nim);
  }

  @Post('reset-via-email')
  @HttpCode(200)
  resetViaEmail(@Body() dto: ResetViaEmailDto) {
    return this.auth.resetViaEmail(dto.token, dto.newPassword);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    const { passwordHash, ...safe } = req.user;
    return safe;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  change(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.id, dto.oldPassword, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OFFICER', 'ADMIN')
  @Post('reset-password')
  reset(@Req() req: any, @Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(req.user.id, dto.userId);
  }
}
