-- DropForeignKey
ALTER TABLE "assignment_history" DROP CONSTRAINT "assignment_history_specialist_id_fkey";

-- AddForeignKey
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
