CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"lugar" text,
	"inicio" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_eventos_horario" CHECK ("eventos"."fin" > "eventos"."inicio")
);
--> statement-breakpoint
CREATE TABLE "ir_visitas" (
	"hora" timestamp with time zone PRIMARY KEY NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"unicos" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_eventos_inicio" ON "eventos" USING btree ("inicio" DESC NULLS LAST);--> statement-breakpoint
-- ─────────────── Extras a mano: huellas de /ir, updated_at, RLS y limpieza diaria ───────────────
-- Personas distintas en /ir: huella HMAC (IP + dispositivo) por día. UNLOGGED (como rate_limits): es efímera y se purga a diario.
CREATE UNLOGGED TABLE public.ir_vistos (
  huella text NOT NULL,
  dia date NOT NULL,
  PRIMARY KEY (huella, dia)
);--> statement-breakpoint
CREATE TRIGGER trg_eventos_updated BEFORE UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();--> statement-breakpoint
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.ir_visitas ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.ir_vistos ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.purgar_sesiones_y_limites() RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n integer; m integer; v integer;
BEGIN
  DELETE FROM public.sesiones WHERE expira_en < now() - interval '1 day';
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.rate_limits WHERE ventana < now() - interval '1 day';
  GET DIAGNOSTICS m = ROW_COUNT;
  DELETE FROM public.ir_vistos WHERE dia < current_date - 1;
  GET DIAGNOSTICS v = ROW_COUNT;
  RETURN n + m + v;
END $$;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.purgar_sesiones_y_limites() FROM PUBLIC;
