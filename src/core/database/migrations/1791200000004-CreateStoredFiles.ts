import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStoredFiles1791200000004 implements MigrationInterface {
  name = 'CreateStoredFiles1791200000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "stored_files" (
        "id" uuid NOT NULL,
        "storage_key" varchar(255) NOT NULL,
        "original_name" varchar(255),
        "mime_type" varchar(50) NOT NULL,
        "size_bytes" integer NOT NULL,
        "sha256" char(64) NOT NULL,
        "uploaded_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_stored_files" PRIMARY KEY ("id"),
        CONSTRAINT "uq_stored_files_storage_key" UNIQUE ("storage_key"),
        CONSTRAINT "ck_stored_files_size"
          CHECK ("size_bytes" > 0 AND "size_bytes" <= 5242880),
        CONSTRAINT "ck_stored_files_mime"
          CHECK ("mime_type" IN ('image/jpeg','image/png','image/webp')),
        CONSTRAINT "fk_stored_files_uploaded_by" FOREIGN KEY ("uploaded_by")
          REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "stored_files"`);
  }
}
