import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from './department.entity.js';
import { User } from './user.entity.js';

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity({ name: 'employees' })
@Unique('uq_employees_user_id', ['userId'])
@Unique('uq_employees_employee_number', ['employeeNumber'])
@Check('ck_employees_status', `"status" IN ('ACTIVE','INACTIVE')`)
@Index('ix_employees_department_id', ['departmentId'])
@Index('ix_employees_status', ['status'])
@Index('ix_employees_full_name', ['fullName'])
export class Employee {
  @PrimaryColumn({
    type: 'uuid',
    name: 'id',
    primaryKeyConstraintName: 'pk_employees',
  })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 20, name: 'employee_number' })
  employeeNumber: string;

  @Column({ type: 'varchar', length: 150, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 20, name: 'phone', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, name: 'position' })
  position: string;

  @Column({ type: 'uuid', name: 'department_id' })
  departmentId: string;

  @Column({ type: 'date', name: 'hire_date' })
  hireDate: string;

  @Column({ type: 'varchar', length: 10, name: 'status', default: 'ACTIVE' })
  status: EmployeeStatus;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_employees_user_id',
  })
  user: User;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'department_id',
    foreignKeyConstraintName: 'fk_employees_department_id',
  })
  department: Department;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'fk_employees_created_by',
  })
  createdByUser: User | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'updated_by',
    foreignKeyConstraintName: 'fk_employees_updated_by',
  })
  updatedByUser: User | null;

  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }
}
