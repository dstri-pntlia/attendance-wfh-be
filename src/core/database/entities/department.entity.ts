import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'departments' })
@Unique('uq_departments_code', ['code'])
@Unique('uq_departments_name', ['name'])
export class Department {
  @PrimaryColumn({
    type: 'uuid',
    name: 'id',
    primaryKeyConstraintName: 'pk_departments',
  })
  id: string;

  @Column({ type: 'varchar', length: 20, name: 'code' })
  code: string;

  @Column({ type: 'varchar', length: 100, name: 'name' })
  name: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }
}
