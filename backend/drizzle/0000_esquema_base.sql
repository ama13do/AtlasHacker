-- PostGIS en el esquema "extensions" (convención de Supabase; evita exponer spatial_ref_sys en public)
CREATE SCHEMA IF NOT EXISTS extensions;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;--> statement-breakpoint
CREATE TYPE "public"."actor_tipo" AS ENUM('usuario', 'participante', 'anonimo', 'sistema');--> statement-breakpoint
CREATE TYPE "public"."aparecer_como" AS ENUM('nombre', 'anonimo');--> statement-breakpoint
CREATE TYPE "public"."autorizacion_publicacion" AS ENUM('publico_con_nombre', 'publico_anonimo', 'solo_documentacion_interna', 'no_autoriza');--> statement-breakpoint
CREATE TYPE "public"."estado_moderacion" AS ENUM('pendiente', 'aprobado', 'rechazado');--> statement-breakpoint
CREATE TYPE "public"."estado_subida" AS ENUM('pendiente', 'subida');--> statement-breakpoint
CREATE TYPE "public"."autoriza_multimedia" AS ENUM('si', 'no', 'na');--> statement-breakpoint
CREATE TYPE "public"."origen_testimonio" AS ENUM('web', 'facilitador', 'importacion');--> statement-breakpoint
CREATE TYPE "public"."origen_ubicacion" AS ENUM('gps', 'mapa', 'manual', 'importada');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('admin', 'moderador', 'facilitador', 'lector');--> statement-breakpoint
CREATE TYPE "public"."sensible_accion" AS ENUM('anonimizar', 'uso_interno', 'revision_antes_publicar');--> statement-breakpoint
CREATE TYPE "public"."tiene_evidencia" AS ENUM('si', 'no', 'pendiente');--> statement-breakpoint
CREATE TYPE "public"."tipo_evidencia" AS ENUM('recibo_factura', 'documento_oficial', 'foto', 'video', 'audio', 'mapa', 'estudio', 'datos', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_reaccion" AS ENUM('like', 'apoyo', 'alerta', 'fuego');--> statement-breakpoint
CREATE TABLE "bitacora" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_tipo" "actor_tipo" NOT NULL,
	"usuario_id" uuid,
	"usuario_email" text,
	"participante_id" uuid,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text,
	"antes" jsonb,
	"despues" jsonb,
	"detalle" jsonb,
	"ip_enc" text,
	"user_agent" text,
	"request_id" text
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"color" text,
	"icono" text,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorias_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "comentarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"testimonio_id" uuid NOT NULL,
	"participante_id" uuid,
	"autor_nombre" text,
	"contenido" text NOT NULL,
	"estado" "estado_moderacion" DEFAULT 'aprobado' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"likes_conteo" integer DEFAULT 0 NOT NULL,
	"huella_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_comentario_len" CHECK (char_length("comentarios"."contenido") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE TABLE "comentarios_likes" (
	"comentario_id" uuid NOT NULL,
	"huella_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comentarios_likes_comentario_id_huella_hash_pk" PRIMARY KEY("comentario_id","huella_hash")
);
--> statement-breakpoint
CREATE TABLE "configuracion" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"descripcion" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folio" text NOT NULL,
	"testimonio_id" uuid NOT NULL,
	"tipo" "tipo_evidencia" NOT NULL,
	"estado_subida" "estado_subida" DEFAULT 'pendiente' NOT NULL,
	"storage_key" text NOT NULL,
	"nombre_original" text,
	"mime" text NOT NULL,
	"bytes_declarados" bigint NOT NULL,
	"bytes" bigint,
	"descripcion" text,
	"publica" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"subida_por_usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmada_at" timestamp with time zone,
	CONSTRAINT "evidencias_folio_unique" UNIQUE("folio"),
	CONSTRAINT "evidencias_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "chk_evidencia_bytes" CHECK ("evidencias"."bytes_declarados" > 0)
);
--> statement-breakpoint
CREATE TABLE "expedientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"titulo" text NOT NULL,
	"materia" text NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expedientes_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "participantes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folio_hash" text NOT NULL,
	"folio_pista" text NOT NULL,
	"nombre_enc" text,
	"correo_enc" text,
	"correo_hash" text,
	"telefono_enc" text,
	"telefono_hash" text,
	"perfil_publico" boolean DEFAULT false NOT NULL,
	"nombre_publico" text,
	"aviso_privacidad_version" text,
	"aviso_privacidad_at" timestamp with time zone,
	"creado_por_usuario_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"datos_cancelados_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participantes_folio_hash_unique" UNIQUE("folio_hash")
);
--> statement-breakpoint
CREATE TABLE "reacciones" (
	"testimonio_id" uuid NOT NULL,
	"huella_hash" text NOT NULL,
	"tipo" "tipo_reaccion" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reacciones_testimonio_id_huella_hash_tipo_pk" PRIMARY KEY("testimonio_id","huella_hash","tipo")
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"familia_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"revocada_at" timestamp with time zone,
	"reemplazada_por" uuid,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sesiones_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "testimonios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folio" text NOT NULL,
	"expediente_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"participante_id" uuid NOT NULL,
	"origen" "origen_testimonio" DEFAULT 'web' NOT NULL,
	"fecha" date DEFAULT current_date NOT NULL,
	"titulo" text,
	"lugar_territorio" text,
	"entidad" text,
	"municipio" text,
	"facilitador_id" uuid,
	"facilitador_nombre" text,
	"aparecer_como" "aparecer_como" DEFAULT 'anonimo' NOT NULL,
	"nombre_publico" text,
	"ubicacion" geometry(Geometry,4326) NOT NULL,
	"tipo_geometria" text,
	"centroide" geometry(Point,4326),
	"ubicacion_aproximada" boolean DEFAULT false NOT NULL,
	"ubicacion_publica" geometry(Geometry,4326),
	"centroide_publico" geometry(Point,4326),
	"origen_ubicacion" "origen_ubicacion" DEFAULT 'mapa' NOT NULL,
	"relato" text NOT NULL,
	"territorio_dice" text,
	"comunidad_dice" text,
	"tiene_evidencia" "tiene_evidencia" DEFAULT 'no' NOT NULL,
	"evidencia_descripcion" text,
	"evidencia_tipos" "tipo_evidencia"[] DEFAULT '{}'::tipo_evidencia[] NOT NULL,
	"evidencia_otro" text,
	"dato_fuente_anio" text,
	"fuente_pendiente_verificacion" boolean DEFAULT false NOT NULL,
	"pregunta_tribunal" text,
	"consentimiento_aceptado" boolean NOT NULL,
	"autorizacion" "autorizacion_publicacion" NOT NULL,
	"autoriza_multimedia" "autoriza_multimedia" DEFAULT 'na' NOT NULL,
	"consentimiento_version" text NOT NULL,
	"consentimiento_at" timestamp with time zone DEFAULT now() NOT NULL,
	"info_sensible" boolean DEFAULT false NOT NULL,
	"sensible_accion" "sensible_accion",
	"estado" "estado_moderacion" DEFAULT 'pendiente' NOT NULL,
	"moderado_por" uuid,
	"moderado_at" timestamp with time zone,
	"motivo_rechazo" text,
	"notas_internas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"es_publico" boolean DEFAULT false NOT NULL,
	"publicado_at" timestamp with time zone,
	"reacciones_conteo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reacciones_total" integer DEFAULT 0 NOT NULL,
	"comentarios_conteo" integer DEFAULT 0 NOT NULL,
	"busqueda" "tsvector" GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(titulo,'') || ' ' || coalesce(lugar_territorio,'') || ' ' || coalesce(relato,'') || ' ' || coalesce(territorio_dice,'') || ' ' || coalesce(comunidad_dice,'') || ' ' || coalesce(pregunta_tribunal,''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "testimonios_folio_unique" UNIQUE("folio"),
	CONSTRAINT "chk_consentimiento" CHECK ("testimonios"."consentimiento_aceptado" = true),
	CONSTRAINT "chk_sensible_accion" CHECK (NOT "testimonios"."info_sensible" OR "testimonios"."sensible_accion" IS NOT NULL),
	CONSTRAINT "chk_nombre_publico" CHECK ("testimonios"."aparecer_como" = 'nombre' OR "testimonios"."nombre_publico" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "testimonios_auditoria" (
	"testimonio_id" uuid PRIMARY KEY NOT NULL,
	"ip_enc" text,
	"ip_hash" text,
	"user_agent" text,
	"huella_dispositivo_hash" text,
	"captcha_ok" boolean,
	"origen_ubicacion" "origen_ubicacion",
	"precision_gps_m" real,
	"zona_horaria" text,
	"idioma" text,
	"pantalla" text,
	"referer" text,
	"consentimiento_version" text,
	"extra" jsonb,
	"retener_hasta" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol_usuario" DEFAULT 'lector' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"intentos_fallidos" integer DEFAULT 0 NOT NULL,
	"bloqueado_hasta" timestamp with time zone,
	"ultimo_login_at" timestamp with time zone,
	"debe_cambiar_password" boolean DEFAULT false NOT NULL,
	"password_cambiada_at" timestamp with time zone,
	"tokens_validos_desde" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_testimonio_id_testimonios_id_fk" FOREIGN KEY ("testimonio_id") REFERENCES "public"."testimonios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios_likes" ADD CONSTRAINT "comentarios_likes_comentario_id_comentarios_id_fk" FOREIGN KEY ("comentario_id") REFERENCES "public"."comentarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_testimonio_id_testimonios_id_fk" FOREIGN KEY ("testimonio_id") REFERENCES "public"."testimonios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_subida_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("subida_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_creado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reacciones" ADD CONSTRAINT "reacciones_testimonio_id_testimonios_id_fk" FOREIGN KEY ("testimonio_id") REFERENCES "public"."testimonios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonios" ADD CONSTRAINT "testimonios_expediente_id_expedientes_id_fk" FOREIGN KEY ("expediente_id") REFERENCES "public"."expedientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonios" ADD CONSTRAINT "testimonios_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonios" ADD CONSTRAINT "testimonios_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonios" ADD CONSTRAINT "testimonios_facilitador_id_usuarios_id_fk" FOREIGN KEY ("facilitador_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonios" ADD CONSTRAINT "testimonios_moderado_por_usuarios_id_fk" FOREIGN KEY ("moderado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonios_auditoria" ADD CONSTRAINT "testimonios_auditoria_testimonio_id_testimonios_id_fk" FOREIGN KEY ("testimonio_id") REFERENCES "public"."testimonios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bitacora_fecha" ON "bitacora" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_bitacora_usuario" ON "bitacora" USING btree ("usuario_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_bitacora_entidad" ON "bitacora" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "idx_bitacora_accion" ON "bitacora" USING btree ("accion");--> statement-breakpoint
CREATE INDEX "idx_comentarios_testimonio" ON "comentarios" USING btree ("testimonio_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_evidencias_testimonio" ON "evidencias" USING btree ("testimonio_id");--> statement-breakpoint
CREATE INDEX "idx_participantes_correo_hash" ON "participantes" USING btree ("correo_hash");--> statement-breakpoint
CREATE INDEX "idx_participantes_telefono_hash" ON "participantes" USING btree ("telefono_hash");--> statement-breakpoint
CREATE INDEX "idx_sesiones_usuario" ON "sesiones" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "idx_sesiones_familia" ON "sesiones" USING btree ("familia_id");--> statement-breakpoint
CREATE INDEX "idx_sesiones_expira" ON "sesiones" USING btree ("expira_en");--> statement-breakpoint
CREATE INDEX "idx_testimonios_estado_fecha" ON "testimonios" USING btree ("estado","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_testimonios_categoria" ON "testimonios" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX "idx_testimonios_expediente" ON "testimonios" USING btree ("expediente_id");--> statement-breakpoint
CREATE INDEX "idx_testimonios_participante" ON "testimonios" USING btree ("participante_id");--> statement-breakpoint
CREATE INDEX "idx_testimonios_facilitador" ON "testimonios" USING btree ("facilitador_id");--> statement-breakpoint
CREATE INDEX "idx_testimonios_created" ON "testimonios" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_testimonios_entidad" ON "testimonios" USING btree ("entidad");--> statement-breakpoint
CREATE INDEX "idx_auditoria_ip_hash" ON "testimonios_auditoria" USING btree ("ip_hash");--> statement-breakpoint
CREATE INDEX "idx_auditoria_retener" ON "testimonios_auditoria" USING btree ("retener_hasta");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_usuarios_email" ON "usuarios" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "idx_usuarios_rol" ON "usuarios" USING btree ("rol");