import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
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
