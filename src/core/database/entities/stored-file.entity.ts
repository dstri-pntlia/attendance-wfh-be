import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity.js';

@Entity({ name: 'stored_files' })
@Unique('uq_stored_files_storage_key', ['storageKey'])
@Check('ck_stored_files_size', `"size_bytes" > 0 AND "size_bytes" <= 5242880`)
@Check(
  'ck_stored_files_mime',
  `"mime_type" IN ('image/jpeg','image/png','image/webp')`,
)
export class StoredFile {
  @PrimaryColumn({
    type: 'uuid',
    name: 'id',
    primaryKeyConstraintName: 'pk_stored_files',
  })
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'storage_key' })
  storageKey: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'original_name',
    nullable: true,
  })
  originalName: string | null;

  @Column({ type: 'varchar', length: 50, name: 'mime_type' })
  mimeType: string;

  @Column({ type: 'integer', name: 'size_bytes' })
  sizeBytes: number;

  @Column({ type: 'char', length: 64, name: 'sha256' })
  sha256: string;

  @Column({ type: 'uuid', name: 'uploaded_by' })
  uploadedBy: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'uploaded_by',
    foreignKeyConstraintName: 'fk_stored_files_uploaded_by',
  })
  uploader: User;

  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }
}
