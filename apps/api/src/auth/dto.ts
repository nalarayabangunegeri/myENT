import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  nim!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  newPassword!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class ForgotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  nim!: string;
}

export class ResetViaEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  newPassword!: string;
}

export class TwoFaCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  code!: string;
}

export class Verify2faDto extends TwoFaCodeDto {
  @IsString()
  @IsNotEmpty()
  pendingToken!: string;
}

export class Disable2faDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}
