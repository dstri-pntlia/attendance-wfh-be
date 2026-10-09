import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttendances1791200000005 implements MigrationInterface {
  name = 'CreateAttendances1791200000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attendances" (
        "id" uuid NOT NULL,
        "employee_id" uuid NOT NULL,
        "work_date" date NOT NULL,
        "check_in_at" timestamptz NOT NULL,
        "check_in_photo_id" uuid NOT NULL,
        "check_out_at" timestamptz,
        "check_out_photo_id" uuid,
        "status" varchar(10) NOT NULL,
        "notes" varchar(500),
        "client_reported_at" timestamptz,
        "ip_address" varchar(45),
        "user_agent" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_attendances" PRIMARY KEY ("id"),
        CONSTRAINT "uq_attendances_employee_work_date" UNIQUE ("employee_id", "work_date"),
        CONSTRAINT "uq_attendances_check_in_photo_id" UNIQUE ("check_in_photo_id"),
        CONSTRAINT "uq_attendances_check_out_photo_id" UNIQUE ("check_out_photo_id"),
        CONSTRAINT "ck_attendances_status" CHECK ("status" IN ('ON_TIME','LATE')),
        CONSTRAINT "ck_attendances_checkout_after_checkin"
          CHECK ("check_out_at" IS NULL OR "check_out_at" > "check_in_at"),
        CONSTRAINT "ck_attendances_checkout_photo_pair"
          CHECK ("check_out_photo_id" IS NULL OR "check_out_at" IS NOT NULL),
        CONSTRAINT "fk_attendances_employee_id" FOREIGN KEY ("employee_id")
          REFERENCES "employees" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_attendances_check_in_photo_id" FOREIGN KEY ("check_in_photo_id")
          REFERENCES "stored_files" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_attendances_check_out_photo_id" FOREIGN KEY ("check_out_photo_id")
          REFERENCES "stored_files" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_attendances_work_date" ON "attendances" ("work_date")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_attendances_work_date"`);
    await queryRunner.query(`DROP TABLE "attendances"`);
  }
}
