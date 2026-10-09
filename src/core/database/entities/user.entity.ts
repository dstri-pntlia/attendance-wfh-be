import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  HR_ADMIN = 'HR_ADMIN',
}

@Entity({ name: 'users' })
@Unique('uq_users_email', ['email'])
@Check('ck_users_role', `"role" IN ('EMPLOYEE','HR_ADMIN')`)
@Check('ck_users_email_lowercase', `"email" = lower("email")`)
export class User {
  @PrimaryColumn({
    type: 'uuid',
    name: 'id',
    primaryKeyConstraintName: 'pk_users',
  })
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'email' })
  email: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'password_hash',
    select: false,
  })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, name: 'role' })
  role: UserRole;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'integer', name: 'token_version', default: 0 })
  tokenVersion: number;

  @Column({ type: 'timestamptz', name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }
}
