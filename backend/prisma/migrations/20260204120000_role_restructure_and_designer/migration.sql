-- Update existing PROJECT_MANAGER users to ADMIN before altering enum
UPDATE "users" SET "role" = 'SPECIALIST' WHERE "role" = 'PROJECT_MANAGER';

-- AlterEnum: Recreate Role enum with new values
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'SPECIALIST', 'SALES_MANAGER', 'DESIGNER');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL;
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- AlterTable: Add designer fields to clients
ALTER TABLE "clients" ADD COLUMN "designer_id" TEXT;
ALTER TABLE "clients" ADD COLUMN "designer_assigned_at" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN "designer_assignment_seen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add type and designer fields to assignment_history, make specialist_id optional
ALTER TABLE "assignment_history" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'SPECIALIST';
ALTER TABLE "assignment_history" ADD COLUMN "designer_id" TEXT;
ALTER TABLE "assignment_history" ALTER COLUMN "specialist_id" DROP NOT NULL;

-- AddForeignKey: clients.designer_id -> users.id
ALTER TABLE "clients" ADD CONSTRAINT "clients_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: assignment_history.designer_id -> users.id
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update the previously converted PROJECT_MANAGER users to ADMIN
UPDATE "users" SET "role" = 'ADMIN' WHERE "email" = 'pm@crm.local';
