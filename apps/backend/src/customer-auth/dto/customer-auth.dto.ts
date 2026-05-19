import { IsString, Length, Matches, MinLength } from 'class-validator';

export class CustomerMobileDto {
  @IsString()
  @Matches(/^[0-9+\-\s]{8,15}$/, { message: 'Enter a valid mobile number' })
  mobile!: string;
}

export class CustomerSetPasswordDto extends CustomerMobileDto {
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;
}

export class CustomerLoginDto extends CustomerSetPasswordDto {}

export class CustomerResetPasswordDto extends CustomerMobileDto {
  @IsString()
  @Length(6, 6, { message: 'Enter the 6-digit verification code' })
  @Matches(/^[0-9]{6}$/, { message: 'Enter the 6-digit verification code' })
  otp!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;
}
