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
} from 'typeorm';
import { Employee } from './employee.entity.js';
import { StoredFile } from './stored-file.entity.js';

export enum AttendanceStatus {
  ON_TIME = 'ON_TIME',
  LATE = 'LATE',
}

@Entity({ name: 'attendances' })
@Unique('uq_attendances_employee_work_date', ['employeeId', 'workDate'])
@Unique('uq_attendances_check_in_photo_id', ['checkInPhotoId'])
@Unique('uq_attendances_check_out_photo_id', ['checkOutPhotoId'])
@Check('ck_attendances_status', `"status" IN ('ON_TIME','LATE')`)
@Check(
  'ck_attendances_checkout_after_checkin',
  `"check_out_at" IS NULL OR "check_out_at" > "check_in_at"`,
)
@Check(
  'ck_attendances_checkout_photo_pair',
  `"check_out_photo_id" IS NULL OR "check_out_at" IS NOT NULL`,
)
@Index('ix_attendances_work_date', ['workDate'])
export class Attendance {
  @PrimaryColumn({
    type: 'uuid',
    name: 'id',
    primaryKeyConstraintName: 'pk_attendances',
  })
  id: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @Column({ type: 'date', name: 'work_date' })
  workDate: string;

  @Column({ type: 'timestamptz', name: 'check_in_at' })
  checkInAt: Date;

  @Column({ type: 'uuid', name: 'check_in_photo_id' })
  checkInPhotoId: string;

  @Column({ type: 'timestamptz', name: 'check_out_at', nullable: true })
  checkOutAt: Date | null;

  @Column({ type: 'uuid', name: 'check_out_photo_id', nullable: true })
  checkOutPhotoId: string | null;

  @Column({ type: 'varchar', length: 10, name: 'status' })
  status: AttendanceStatus;

  @Column({ type: 'varchar', length: 500, name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', name: 'client_reported_at', nullable: true })
  clientReportedAt: Date | null;

  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 500, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'employee_id',
    foreignKeyConstraintName: 'fk_attendances_employee_id',
  })
  employee: Employee;

  @ManyToOne(() => StoredFile, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'check_in_photo_id',
    foreignKeyConstraintName: 'fk_attendances_check_in_photo_id',
  })
  checkInPhoto: StoredFile;

  @ManyToOne(() => StoredFile, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'check_out_photo_id',
    foreignKeyConstraintName: 'fk_attendances_check_out_photo_id',
  })
  checkOutPhoto: StoredFile | null;

  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }
}
