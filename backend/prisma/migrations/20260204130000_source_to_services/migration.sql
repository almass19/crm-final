-- Add new services column as text array
ALTER TABLE "clients" ADD COLUMN "services" TEXT[] NOT NULL DEFAULT '{}';

-- Migrate existing source data into services array
UPDATE "clients" SET "services" = ARRAY["source"] WHERE "source" IS NOT NULL AND "source" != '';

-- Drop old source column
ALTER TABLE "clients" DROP COLUMN "source";
