import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDepartments1791200000002 implements MigrationInterface {
  name = 'CreateDepartments1791200000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" uuid NOT NULL,
        "code" varchar(20) NOT NULL,
        "name" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_departments" PRIMARY KEY ("id"),
        CONSTRAINT "uq_departments_code" UNIQUE ("code"),
        CONSTRAINT "uq_departments_name" UNIQUE ("name")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "departments"`);
  }
}
