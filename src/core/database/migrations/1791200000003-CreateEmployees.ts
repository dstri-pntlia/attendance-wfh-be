import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployees1791200000003 implements MigrationInterface {
  name = 'CreateEmployees1791200000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "employee_number" varchar(20) NOT NULL,
        "full_name" varchar(150) NOT NULL,
        "phone" varchar(20),
        "position" varchar(100) NOT NULL,
        "department_id" uuid NOT NULL,
        "hire_date" date NOT NULL,
        "status" varchar(10) NOT NULL DEFAULT 'ACTIVE',
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_employees" PRIMARY KEY ("id"),
        CONSTRAINT "uq_employees_user_id" UNIQUE ("user_id"),
        CONSTRAINT "uq_employees_employee_number" UNIQUE ("employee_number"),
        CONSTRAINT "ck_employees_status" CHECK ("status" IN ('ACTIVE','INACTIVE')),
        CONSTRAINT "fk_employees_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_employees_department_id" FOREIGN KEY ("department_id")
          REFERENCES "departments" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_employees_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_employees_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_employees_department_id" ON "employees" ("department_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_employees_status" ON "employees" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_employees_full_name" ON "employees" ("full_name")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_employees_full_name"`);
    await queryRunner.query(`DROP INDEX "ix_employees_status"`);
    await queryRunner.query(`DROP INDEX "ix_employees_department_id"`);
    await queryRunner.query(`DROP TABLE "employees"`);
  }
}
