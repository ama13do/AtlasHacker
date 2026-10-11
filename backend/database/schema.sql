-- ====================================================================
-- ATLAS HACKER - ESQUEMA DE BASE DE DATOS (SUPABASE + POSTGIS)
-- ====================================================================
-- Copia y pega este script completo en el SQL Editor de tu consola de Supabase.

-- 1. Habilitar extensión PostGIS para geolocalización
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabla: TESTIMONIOS
CREATE TABLE IF NOT EXISTS public.testimonios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NOT NULL,
    autor_nombre VARCHAR(100) DEFAULT 'Anónimo',
    
    -- Columna PostGIS espacial (SRID 4326: WGS 84 - Coordenadas estándar GPS / Leaflet / Mapbox)
    ubicacion GEOGRAPHY(Point, 4326) NOT NULL,
    
    -- Columnas generadas automáticamente para conveniencia del Frontend (latitud y longitud en formato numérico)
    latitud DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(ubicacion::geometry)) STORED,
    longitud DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(ubicacion::geometry)) STORED,
    
    -- Archivos en Cloudflare R2
    media_url TEXT,
    media_tipo VARCHAR(50) DEFAULT 'ninguno', -- 'imagen', 'audio', 'video', 'documento', 'ninguno'
    categoria VARCHAR(100) DEFAULT 'general',
    
    -- Conteo de reacciones cacheado para alto desempeño
    reacciones_conteo JSONB DEFAULT '{"like": 0, "apoyo": 0, "alerta": 0}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice espacial GiST para consultas ultrarrápidas de geolocalización
CREATE INDEX IF NOT EXISTS idx_testimonios_ubicacion ON public.testimonios USING GIST (ubicacion);
CREATE INDEX IF NOT EXISTS idx_testimonios_created_at ON public.testimonios (created_at DESC);

-- 3. Tabla: COMENTARIOS
CREATE TABLE IF NOT EXISTS public.comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    testimonio_id UUID NOT NULL REFERENCES public.testimonios(id) ON DELETE CASCADE,
    autor_nombre VARCHAR(100) DEFAULT 'Anónimo',
    contenido TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comentarios_testimonio_id ON public.comentarios (testimonio_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_created_at ON public.comentarios (created_at ASC);

-- 4. Tabla: REACCIONES
CREATE TABLE IF NOT EXISTS public.reacciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    testimonio_id UUID NOT NULL REFERENCES public.testimonios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'like', 'apoyo', 'alerta', etc.
    usuario_fingerprint VARCHAR(100), -- identificador anónimo de sesión/dispositivo
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reacciones_testimonio_id ON public.reacciones (testimonio_id);

-- ====================================================================
-- FUNCIONES RPC ESPACIALES DE POSTGIS
-- ====================================================================

-- Función 1: Buscar testimonios dentro de un radio en metros (ej: 5000 = 5km)
CREATE OR REPLACE FUNCTION public.buscar_testimonios_en_radio(
    lng DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    radio_metros DOUBLE PRECISION DEFAULT 10000
)
RETURNS TABLE (
    id UUID,
    titulo VARCHAR,
    descripcion TEXT,
    autor_nombre VARCHAR,
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    media_url TEXT,
    media_tipo VARCHAR,
    categoria VARCHAR,
    reacciones_conteo JSONB,
    distancia_metros DOUBLE PRECISION,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        t.id,
        t.titulo,
        t.descripcion,
        t.autor_nombre,
        t.latitud,
        t.longitud,
        t.media_url,
        t.media_tipo,
        t.categoria,
        t.reacciones_conteo,
        ST_Distance(t.ubicacion, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) AS distancia_metros,
        t.created_at
    FROM public.testimonios t
    WHERE ST_DWithin(t.ubicacion, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radio_metros)
    ORDER BY distancia_metros ASC;
$$;

-- Función 2: Buscar testimonios en la caja visible del mapa (Bounding Box / BBox)
CREATE OR REPLACE FUNCTION public.buscar_testimonios_en_bbox(
    min_lng DOUBLE PRECISION,
    min_lat DOUBLE PRECISION,
    max_lng DOUBLE PRECISION,
    max_lat DOUBLE PRECISION
)
RETURNS TABLE (
    id UUID,
    titulo VARCHAR,
    descripcion TEXT,
    autor_nombre VARCHAR,
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    media_url TEXT,
    media_tipo VARCHAR,
    categoria VARCHAR,
    reacciones_conteo JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        t.id,
        t.titulo,
        t.descripcion,
        t.autor_nombre,
        t.latitud,
        t.longitud,
        t.media_url,
        t.media_tipo,
        t.categoria,
        t.reacciones_conteo,
        t.created_at
    FROM public.testimonios t
    WHERE t.ubicacion::geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    ORDER BY t.created_at DESC;
$$;

-- ====================================================================
-- ACTIVAR TIEMPO REAL (SUPABASE REALTIME)
-- ====================================================================
-- Esto permite que el frontend escuche cambios automáticos por WebSockets
ALTER PUBLICATION supabase_realtime ADD TABLE public.testimonios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comentarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reacciones;

-- ====================================================================
-- SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ====================================================================
ALTER TABLE public.testimonios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reacciones ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública: cualquier persona puede leer testimonios y comentarios en el mapa
CREATE POLICY "Lectura pública de testimonios" ON public.testimonios FOR SELECT USING (true);
CREATE POLICY "Lectura pública de comentarios" ON public.comentarios FOR SELECT USING (true);
CREATE POLICY "Lectura pública de reacciones" ON public.reacciones FOR SELECT USING (true);

-- Las inserciones las realizará el backend de AWS Lambda usando la clave segura 'service_role' (que bypasses RLS),
-- o se pueden permitir inserciones públicas si se desea escritura directa:
CREATE POLICY "Inserción controlada de testimonios" ON public.testimonios FOR INSERT WITH CHECK (true);
CREATE POLICY "Inserción controlada de comentarios" ON public.comentarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Inserción controlada de reacciones" ON public.reacciones FOR INSERT WITH CHECK (true);
