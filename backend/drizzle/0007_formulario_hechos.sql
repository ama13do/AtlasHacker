CREATE TYPE "public"."amenazas" AS ENUM('no', 'si', 'prefiero_no_decir');--> statement-breakpoint
CREATE TYPE "public"."desde_cuando" AS ENUM('este_anio', 'uno_a_tres_anios', 'mas_de_tres_anios');--> statement-breakpoint
CREATE TYPE "public"."reclamo_previo" AS ENUM('no', 'si_sin_respuesta', 'si_con_respuesta');--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "hechos" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "subcategoria" text;--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "desde_cuando" "desde_cuando";--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "sigue_pasando" boolean;--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "reclamo_previo" "reclamo_previo";--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "amenazas" "amenazas";