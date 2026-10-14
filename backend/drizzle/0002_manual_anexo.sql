CREATE TYPE "public"."autoriza_voz_imagen" AS ENUM('voz_imagen', 'solo_voz', 'ninguna');--> statement-breakpoint
ALTER TYPE "public"."tipo_evidencia" ADD VALUE 'recibo';--> statement-breakpoint
ALTER TYPE "public"."tipo_evidencia" ADD VALUE 'factura';--> statement-breakpoint
ALTER TYPE "public"."tipo_evidencia" ADD VALUE 'oficio';--> statement-breakpoint
ALTER TYPE "public"."tipo_evidencia" ADD VALUE 'contrato';--> statement-breakpoint
ALTER TYPE "public"."tipo_evidencia" ADD VALUE 'registro_oficial';--> statement-breakpoint
ALTER TYPE "public"."tipo_evidencia" ADD VALUE 'testimonio_escrito';--> statement-breakpoint
ALTER TYPE "public"."tipo_evidencia" ADD VALUE 'testimonio_oral';--> statement-breakpoint
ALTER TYPE "public"."tipo_evidencia" ADD VALUE 'nota_prensa';--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "fuentes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "algo_mas" text;--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "registro_voz" text;--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "autoriza_voz_imagen" "autoriza_voz_imagen";--> statement-breakpoint
ALTER TABLE "testimonios" ADD COLUMN "info_menores" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Vista pública: se agregan «fuentes» y «algo_mas» al final (CREATE OR REPLACE VIEW solo admite columnas nuevas al final)
CREATE OR REPLACE VIEW public.v_testimonios_publicos AS
SELECT
  t.id,
  t.folio,
  t.expediente_id,
  e.codigo AS expediente_codigo,
  t.categoria_id,
  c.slug AS categoria_slug,
  c.nombre AS categoria_nombre,
  c.color AS categoria_color,
  t.titulo,
  t.fecha,
  t.lugar_territorio,
  t.entidad,
  t.municipio,
  CASE WHEN t.aparecer_como = 'nombre'
        AND t.autorizacion = 'publico_con_nombre'
        AND NOT (t.info_sensible AND t.sensible_accion = 'anonimizar')
       THEN t.nombre_publico END AS nombre_publico,
  t.relato,
  t.territorio_dice,
  t.comunidad_dice,
  t.tiene_evidencia,
  t.evidencia_tipos,
  t.dato_fuente_anio,
  t.fuente_pendiente_verificacion,
  t.pregunta_tribunal,
  t.tipo_geometria,
  t.ubicacion_aproximada,
  t.ubicacion_publica,
  t.centroide_publico,
  t.reacciones_conteo,
  t.reacciones_total,
  t.comentarios_conteo,
  t.publicado_at,
  t.created_at,
  t.busqueda,
  t.fuentes,
  t.algo_mas
FROM public.testimonios t
JOIN public.expedientes e ON e.id = t.expediente_id
JOIN public.categorias c ON c.id = t.categoria_id
WHERE t.es_publico;
