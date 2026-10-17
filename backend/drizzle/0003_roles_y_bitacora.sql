ALTER TYPE "public"."rol_usuario" ADD VALUE 'superadmin' BEFORE 'admin';--> statement-breakpoint
ALTER TABLE "bitacora" ADD COLUMN "usuario_nombre" text;--> statement-breakpoint
ALTER TABLE "bitacora" ADD COLUMN "usuario_rol" text;--> statement-breakpoint
ALTER TABLE "bitacora" ADD COLUMN "folio" text;--> statement-breakpoint
CREATE INDEX "idx_bitacora_folio" ON "bitacora" USING btree ("folio");