import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import {
  IsDifferentFrom,
  IsPasswordPolicy,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../../common/validation/password.validators.js';
import { UserRole } from '../../../core/database/entities/user.entity.js';

export class LoginDto {
  @ApiProperty({ example: 'budi@example.com', maxLength: 255 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Secret123', minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'Secret123', minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  currentPassword: string;

  @ApiProperty({
    example: 'NewSecret456',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    description:
      'Must contain a letter and a digit, and differ from currentPassword.',
  })
  @IsPasswordPolicy()
  @IsDifferentFrom('currentPassword')
  newPassword: string;
}

export class EmployeeSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'EMP-0001' })
  employeeNumber: string;

  @ApiProperty({ example: 'Budi Santoso' })
  fullName: string;
}

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'budi@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role: UserRole;

  @ApiProperty({
    type: EmployeeSummaryDto,
    nullable: true,
    description: '`null` for HR admins without an employee profile.',
  })
  employee: EmployeeSummaryDto | null;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT access token (claims `sub`, `role`, `ver`).',
  })
  accessToken: string;

  @ApiProperty({
    example: 900,
    description: 'Access token lifetime in seconds.',
  })
  expiresIn: number;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
