-- Los links de evidencia pasan de texto a { url, publica } (como las fotos: cada uno se publica o no)
UPDATE "testimonios" SET "enlaces_evidencia" = (
  SELECT coalesce(jsonb_agg(CASE WHEN jsonb_typeof(e) = 'string' THEN jsonb_build_object('url', e #>> '{}', 'publica', false) ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements("enlaces_evidencia") AS e
) WHERE "enlaces_evidencia" <> '[]'::jsonb;
