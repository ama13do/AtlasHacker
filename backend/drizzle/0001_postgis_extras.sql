-- ====================================================================================
-- AtlasHacker · Extras que Drizzle no modela: triggers, vistas, índices espaciales/parciales,
-- RLS, rol de solo lectura para QGIS, semillas y política de Realtime.
-- (Las sentencias van separadas por el marcador de corte de drizzle-kit.)
-- ====================================================================================

-- ─────────────────────────────── 1. updated_at genérico ───────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;--> statement-breakpoint

CREATE TRIGGER trg_expedientes_updated BEFORE UPDATE ON public.expedientes FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_categorias_updated BEFORE UPDATE ON public.categorias FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_participantes_updated BEFORE UPDATE ON public.participantes FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_configuracion_updated BEFORE UPDATE ON public.configuracion FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();--> statement-breakpoint
-- Un "like" no debe modificar updated_at del comentario
CREATE TRIGGER trg_comentarios_updated BEFORE UPDATE ON public.comentarios FOR EACH ROW
  WHEN (OLD.likes_conteo = NEW.likes_conteo) EXECUTE FUNCTION public.trg_set_updated_at();--> statement-breakpoint

-- ─────────────────── 2. Testimonios: geometría, visibilidad pública y updated_at ───────────────────
-- Normaliza/repara la geometría, calcula el pin (centroide), la geometría que ve el público
-- (exacta, o aproximada ~1 km si ubicacion_aproximada) y es_publico.
CREATE OR REPLACE FUNCTION public.trg_testimonios_before() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE
  g geometry;
  dim integer;
BEGIN
  g := ST_Force2D(ST_SetSRID(NEW.ubicacion, 4326));
  dim := ST_Dimension(g);
  IF NOT ST_IsValid(g) THEN
    g := ST_MakeValid(g);
    IF GeometryType(g) = 'GEOMETRYCOLLECTION' THEN
      g := ST_CollectionExtract(g, dim + 1);
    END IF;
    -- Una línea con puntos repetidos se "repararía" como punto: eso es una geometría degenerada, no una reparación
    IF NOT ST_IsEmpty(g) AND ST_Dimension(g) IS DISTINCT FROM dim THEN
      RAISE EXCEPTION 'Geometría degenerada (cambia de tipo al repararla)' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF g IS NULL OR ST_IsEmpty(g) OR NOT ST_IsValid(g) THEN
    RAISE EXCEPTION 'Geometría inválida' USING ERRCODE = '22023';
  END IF;

  NEW.ubicacion := g;
  NEW.tipo_geometria := GeometryType(g);
  NEW.centroide := ST_PointOnSurface(g);

  IF NEW.ubicacion_aproximada THEN
    NEW.ubicacion_publica := ST_ReducePrecision(ST_PointOnSurface(g), 0.01);
  ELSE
    NEW.ubicacion_publica := g;
  END IF;
  NEW.centroide_publico := ST_PointOnSurface(NEW.ubicacion_publica);

  -- Regla de visibilidad (única): aprobado + activo + autorizó publicar + no es "solo uso interno"
  NEW.es_publico := (
    NEW.estado = 'aprobado'
    AND NEW.activo
    AND NEW.autorizacion IN ('publico_con_nombre', 'publico_anonimo')
    AND NOT (NEW.info_sensible AND NEW.sensible_accion = 'uso_interno')
  );
  IF NEW.es_publico AND NEW.publicado_at IS NULL THEN
    NEW.publicado_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;--> statement-breakpoint

CREATE TRIGGER trg_testimonios_insert BEFORE INSERT ON public.testimonios
  FOR EACH ROW EXECUTE FUNCTION public.trg_testimonios_before();--> statement-breakpoint
-- En UPDATE no se dispara cuando solo cambian los contadores (likes/comentarios): evita recalcular geometría por cada reacción.
CREATE TRIGGER trg_testimonios_update BEFORE UPDATE ON public.testimonios
  FOR EACH ROW
  WHEN (ROW(NEW.reacciones_conteo, NEW.reacciones_total, NEW.comentarios_conteo) IS NOT DISTINCT FROM ROW(OLD.reacciones_conteo, OLD.reacciones_total, OLD.comentarios_conteo))
  EXECUTE FUNCTION public.trg_testimonios_before();--> statement-breakpoint

-- ─────────────────────────── 3. Contadores atómicos (sin condiciones de carrera) ───────────────────────────
CREATE OR REPLACE FUNCTION public.trg_reacciones_conteo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.testimonios SET
      reacciones_conteo = jsonb_set(reacciones_conteo, ARRAY[NEW.tipo::text], to_jsonb(COALESCE((reacciones_conteo ->> NEW.tipo::text)::int, 0) + 1), true),
      reacciones_total = reacciones_total + 1
    WHERE id = NEW.testimonio_id;
    RETURN NEW;
  ELSE
    UPDATE public.testimonios SET
      reacciones_conteo = jsonb_set(reacciones_conteo, ARRAY[OLD.tipo::text], to_jsonb(GREATEST(COALESCE((reacciones_conteo ->> OLD.tipo::text)::int, 0) - 1, 0)), true),
      reacciones_total = GREATEST(reacciones_total - 1, 0)
    WHERE id = OLD.testimonio_id;
    RETURN OLD;
  END IF;
END $$;--> statement-breakpoint
CREATE TRIGGER trg_reacciones_conteo AFTER INSERT OR DELETE ON public.reacciones
  FOR EACH ROW EXECUTE FUNCTION public.trg_reacciones_conteo();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.trg_comentarios_likes_conteo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.comentarios SET likes_conteo = likes_conteo + 1 WHERE id = NEW.comentario_id;
    RETURN NEW;
  ELSE
    UPDATE public.comentarios SET likes_conteo = GREATEST(likes_conteo - 1, 0) WHERE id = OLD.comentario_id;
    RETURN OLD;
  END IF;
END $$;--> statement-breakpoint
CREATE TRIGGER trg_comentarios_likes_conteo AFTER INSERT OR DELETE ON public.comentarios_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_comentarios_likes_conteo();--> statement-breakpoint

-- comentarios_conteo del testimonio = comentarios visibles (activos y aprobados)
CREATE OR REPLACE FUNCTION public.trg_comentarios_conteo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE tid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN tid := OLD.testimonio_id; ELSE tid := NEW.testimonio_id; END IF;
  UPDATE public.testimonios
     SET comentarios_conteo = (SELECT count(*) FROM public.comentarios WHERE testimonio_id = tid AND activo AND estado = 'aprobado')
   WHERE id = tid;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER trg_comentarios_conteo AFTER INSERT OR DELETE OR UPDATE OF activo, estado ON public.comentarios
  FOR EACH ROW EXECUTE FUNCTION public.trg_comentarios_conteo();--> statement-breakpoint

-- ──────────────────────────── 4. Bitácora: solo se agrega ────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_bitacora_inmutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Única excepción: la FK "ON DELETE SET NULL" de usuario_id (la instantánea usuario_email se conserva)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.usuario_id IS NOT NULL AND NEW.usuario_id IS NULL
       AND (to_jsonb(NEW) - 'usuario_id') = (to_jsonb(OLD) - 'usuario_id') THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'La bitácora es de solo lectura (append-only)' USING ERRCODE = '42501';
END $$;--> statement-breakpoint
CREATE TRIGGER trg_bitacora_inmutable BEFORE UPDATE OR DELETE ON public.bitacora
  FOR EACH ROW EXECUTE FUNCTION public.trg_bitacora_inmutable();--> statement-breakpoint

-- ─────────────────────────── 5. Rate limiting (tabla sin WAL, rápida) ───────────────────────────
CREATE UNLOGGED TABLE public.rate_limits (
  clave text NOT NULL,
  ventana timestamptz NOT NULL,
  conteo integer NOT NULL DEFAULT 1,
  PRIMARY KEY (clave, ventana)
);--> statement-breakpoint

-- ─────────────────────────────── 6. Índices espaciales y parciales ───────────────────────────────
-- Geometría exacta (privada): consultas del dashboard / exportación
CREATE INDEX idx_testimonios_geom_exacta ON public.testimonios USING gist (ubicacion);--> statement-breakpoint
-- Mapa público: solo filas públicas (índice pequeño). bbox = operador &&
CREATE INDEX idx_testimonios_geom_publica ON public.testimonios USING gist (ubicacion_publica) WHERE es_publico;--> statement-breakpoint
-- Búsqueda por radio en metros (ST_DWithin sobre geography)
CREATE INDEX idx_testimonios_geog_publica ON public.testimonios USING gist ((ubicacion_publica::geography)) WHERE es_publico;--> statement-breakpoint
-- Listado público paginado por cursor (created_at, id)
CREATE INDEX idx_testimonios_publicos_recientes ON public.testimonios (created_at DESC, id DESC) WHERE es_publico;--> statement-breakpoint
CREATE INDEX idx_testimonios_publicos_categoria ON public.testimonios (categoria_id, created_at DESC, id DESC) WHERE es_publico;--> statement-breakpoint
-- Cola de moderación
CREATE INDEX idx_testimonios_pendientes ON public.testimonios (created_at) WHERE estado = 'pendiente' AND activo;--> statement-breakpoint
-- Texto completo
CREATE INDEX idx_testimonios_busqueda ON public.testimonios USING gin (busqueda);--> statement-breakpoint

-- ──────────────────────────── 7. Vista pública (única fuente de lo visible) ────────────────────────────
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
  -- El nombre solo se muestra si la persona lo pidió, autorizó publicarlo con nombre y no se marcó "anonimizar"
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
  t.busqueda
FROM public.testimonios t
JOIN public.expedientes e ON e.id = t.expediente_id
JOIN public.categorias c ON c.id = t.categoria_id
WHERE t.es_publico;--> statement-breakpoint

-- ──────────────────────────────── 8. Mantenimiento ────────────────────────────────
CREATE OR REPLACE FUNCTION public.purgar_auditoria_vencida() RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.testimonios_auditoria WHERE retener_hasta IS NOT NULL AND retener_hasta < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.purgar_sesiones_y_limites() RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n integer; m integer;
BEGIN
  DELETE FROM public.sesiones WHERE expira_en < now() - interval '1 day';
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.rate_limits WHERE ventana < now() - interval '1 day';
  GET DIAGNOSTICS m = ROW_COUNT;
  RETURN n + m;
END $$;--> statement-breakpoint

-- ──────────────────────────── 9. Seguridad: RLS y permisos ────────────────────────────
-- La API se conecta como dueño de las tablas (omite RLS). Cualquier otro acceso (clave anon/authenticated
-- de Supabase por PostgREST, Realtime postgres_changes, etc.) queda DENEGADO: RLS activo y sin políticas.
ALTER TABLE public.expedientes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.sesiones ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.participantes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.testimonios ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.testimonios_auditoria ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.evidencias ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.comentarios_likes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.reacciones ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.bitacora ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;
  END IF;
END $$;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.purgar_auditoria_vencida() FROM PUBLIC;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.purgar_sesiones_y_limites() FROM PUBLIC;--> statement-breakpoint

-- ───────────────── 10. Rol de solo lectura para QGIS (únicamente la vista pública) ─────────────────
-- Se crea sin login. Para habilitarlo:  ALTER ROLE lector_qgis LOGIN PASSWORD '<contraseña fuerte>';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lector_qgis') THEN
    CREATE ROLE lector_qgis NOLOGIN;
  END IF;
  GRANT USAGE ON SCHEMA public TO lector_qgis;
  GRANT SELECT ON public.v_testimonios_publicos TO lector_qgis;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    GRANT USAGE ON SCHEMA extensions TO lector_qgis;
    GRANT SELECT ON extensions.spatial_ref_sys TO lector_qgis;
    GRANT SELECT ON extensions.geometry_columns TO lector_qgis;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Sin privilegios para crear/otorgar al rol lector_qgis; hazlo manualmente.';
END $$;--> statement-breakpoint

-- ───────────── 11. Realtime: canal privado "mapa" solo-lectura para el público ─────────────
-- El servidor emite con service_role (omite RLS). Los clientes (anon) pueden ESCUCHAR el canal "mapa" pero
-- no hay política de INSERT, así que nadie puede inyectar eventos falsos.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS mapa_lectura_publica ON realtime.messages';
    EXECUTE $p$CREATE POLICY mapa_lectura_publica ON realtime.messages FOR SELECT TO anon, authenticated
               USING (realtime.topic() = 'mapa' AND realtime.messages.extension = 'broadcast')$p$;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Sin privilegios sobre realtime.messages; crea la política manualmente (ver README).';
END $$;--> statement-breakpoint

-- ──────────────────────────────────── 12. Semillas ────────────────────────────────────
INSERT INTO public.expedientes (codigo, titulo, materia, descripcion) VALUES
  ('FUTURO/001', 'Tribunal Popular por Nuestro Futuro', 'Sistema Energético Nacional',
   'Expediente FUTURO/001 · Juicios por Nuestro Futuro. Escucha · Registra · Verifica · Protege.')
ON CONFLICT (codigo) DO NOTHING;--> statement-breakpoint

INSERT INTO public.categorias (slug, nombre, descripcion, color, icono, orden) VALUES
  ('inseguridad-energetica', 'Inseguridad energética', 'Apagones, tarifas, falta de acceso o de abasto de energía.', '#E4572E', 'zap-off', 1),
  ('afectaciones-cambio-climatico', 'Afectaciones por cambio climático', 'Sequías, inundaciones, calor extremo y otros efectos observados en el territorio.', '#2E86AB', 'cloud-lightning', 2),
  ('megaproyectos', 'Megaproyectos', 'Proyectos de gran escala de energía e infraestructura y sus efectos en comunidades y territorios.', '#8E5572', 'factory', 3)
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint

INSERT INTO public.configuracion (clave, valor, descripcion) VALUES
  ('modo_publicacion', '"revisar_todo"', 'revisar_todo | auto_si_no_sensible | auto_todo. Reglas fijas: sin autorización no se publica; "revisión antes de publicar" siempre pasa a revisión; "anonimizar" oculta el nombre.'),
  ('max_archivos_por_testimonio', '5', 'Máximo de archivos de evidencia por testimonio.'),
  ('max_bytes_totales_por_testimonio', '20971520', 'Suma máxima (bytes) de las evidencias de un testimonio. 20971520 = 20 MB.'),
  ('tipos_mime_permitidos', '["image/jpeg","image/png","image/webp","application/pdf","audio/mpeg","audio/mp4","audio/ogg","audio/wav","audio/webm","video/mp4","video/webm","video/quicktime"]', 'Tipos MIME permitidos para evidencias.'),
  ('captcha_requerido', 'true', 'Exigir Cloudflare Turnstile al crear testimonios y comentarios.'),
  ('auditoria_envio_activa', 'true', 'Guardar datos de auditoría del envío (IP cifrada, user-agent, huella, captcha, GPS...).'),
  ('auditoria_retencion_dias', '365', 'Días que se conserva la auditoría del envío antes de purgarse.'),
  ('comentarios_habilitados', 'true', 'Permitir comentarios públicos.'),
  ('comentarios_requieren_moderacion', 'false', 'Si es true, los comentarios nuevos quedan pendientes hasta aprobarse.'),
  ('reacciones_habilitadas', 'true', 'Permitir reacciones/likes públicos.'),
  ('participantes_pueden_editar', 'true', 'La persona puede editar sus testimonios con su folio.'),
  ('participantes_pueden_eliminar', 'true', 'La persona puede dar de baja (baja lógica) sus testimonios con su folio.'),
  ('edicion_requiere_revision', 'true', 'Si la persona edita un testimonio, vuelve a revisión.'),
  ('mapa_tiempo_real', 'true', 'Emitir eventos en tiempo real al mapa (Supabase Realtime Broadcast).'),
  ('consentimiento_version_actual', '"v1"', 'Versión vigente del aviso de privacidad / consentimiento.')
ON CONFLICT (clave) DO NOTHING;
