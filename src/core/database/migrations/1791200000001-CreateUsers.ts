import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1791200000001 implements MigrationInterface {
  name = 'CreateUsers1791200000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL,
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "role" varchar(20) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "token_version" integer NOT NULL DEFAULT 0,
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "ck_users_role" CHECK ("role" IN ('EMPLOYEE','HR_ADMIN')),
        CONSTRAINT "ck_users_email_lowercase" CHECK ("email" = lower("email"))
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
