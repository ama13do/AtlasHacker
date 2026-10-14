import { beforeAll, describe, expect, it } from 'vitest';
import { initEnv } from '../src/config/env.js';
import { cifrar, descifrar, hashCorreo } from '../src/lib/crypto.js';
import { folioEvidencia, folioTestimonio, nuevoFolioParticipante, normalizarFolioParticipante } from '../src/lib/ids.js';
import { GeometriaSchema } from '../src/schemas/comunes.js';
import { decidirPublicacion, evidenciaPublicaPorDefecto } from '../src/services/reglas.js';

beforeAll(async () => {
  await initEnv();
});

describe('reglas de publicación', () => {
  const base = { autorizacion: 'publico_con_nombre', info_sensible: false } as const;

  it('revisar_todo: todo queda pendiente', () => {
    expect(decidirPublicacion('revisar_todo', base).estado).toBe('pendiente');
  });

  it('auto_si_no_sensible: publica solo si no hay información sensible', () => {
    expect(decidirPublicacion('auto_si_no_sensible', base).estado).toBe('aprobado');
    expect(decidirPublicacion('auto_si_no_sensible', { ...base, info_sensible: true, sensible_accion: 'anonimizar' }).estado).toBe('pendiente');
  });

  it('auto_todo: publica incluso con información sensible a anonimizar, que además generaliza la ubicación', () => {
    const d = decidirPublicacion('auto_todo', { ...base, info_sensible: true, sensible_accion: 'anonimizar' });
    expect(d.estado).toBe('aprobado');
    expect(d.ubicacion_aproximada).toBe(true);
  });

  it('REGLAS FIJAS: ningún modo publica sin autorización, ni con "revisión antes de publicar" / "uso interno"', () => {
    for (const modo of ['revisar_todo', 'auto_si_no_sensible', 'auto_todo'] as const) {
      expect(decidirPublicacion(modo, { ...base, autorizacion: 'no_autoriza' }).estado).toBe('pendiente');
      expect(decidirPublicacion(modo, { ...base, autorizacion: 'solo_documentacion_interna' }).estado).toBe('pendiente');
      expect(decidirPublicacion(modo, { ...base, info_sensible: true, sensible_accion: 'revision_antes_publicar' }).estado).toBe('pendiente');
      expect(decidirPublicacion(modo, { ...base, info_sensible: true, sensible_accion: 'uso_interno' }).estado).toBe('pendiente');
    }
  });

  it('REGLA FIJA (Manual C.10): con información de niñas, niños o adolescentes nunca se publica solo', () => {
    for (const modo of ['revisar_todo', 'auto_si_no_sensible', 'auto_todo'] as const) {
      expect(decidirPublicacion(modo, { ...base, info_menores: true }).estado).toBe('pendiente');
    }
  });

  it('evidencias: recibos y documentos oficiales nunca se publican solos; multimedia solo en modos automáticos y con autorización', () => {
    expect(evidenciaPublicaPorDefecto('auto_todo', 'aprobado', 'si', 'foto')).toBe(true);
    expect(evidenciaPublicaPorDefecto('auto_todo', 'aprobado', 'si', 'recibo_factura')).toBe(false);
    expect(evidenciaPublicaPorDefecto('auto_todo', 'aprobado', 'si', 'documento_oficial')).toBe(false);
    expect(evidenciaPublicaPorDefecto('auto_todo', 'aprobado', 'no', 'foto')).toBe(false);
    expect(evidenciaPublicaPorDefecto('auto_todo', 'pendiente', 'si', 'foto')).toBe(false);
    expect(evidenciaPublicaPorDefecto('revisar_todo', 'aprobado', 'si', 'foto')).toBe(false);
  });
});

describe('folios aleatorios', () => {
  it('formatos', () => {
    expect(folioTestimonio('FUTURO/001')).toMatch(/^FUTURO\/001-T[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(folioEvidencia('FUTURO/001')).toMatch(/^FUTURO\/001-E[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(nuevoFolioParticipante()).toMatch(/^P(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
  });

  it('no se repiten ni son secuenciales', () => {
    const s = new Set(Array.from({ length: 5000 }, () => folioTestimonio('FUTURO/001')));
    expect(s.size).toBe(5000);
  });

  it('el folio de la persona tolera minúsculas, espacios, sin guiones y O/I/L confundidas', () => {
    const f = nuevoFolioParticipante();
    expect(normalizarFolioParticipante(f.toLowerCase())).toBe(f);
    expect(normalizarFolioParticipante(f.replaceAll('-', ' '))).toBe(f);
    expect(normalizarFolioParticipante('P-OOOO-IIII-LLLL-0000')).toBe('P-0000-1111-1111-0000');
    expect(normalizarFolioParticipante('basura')).toBeNull();
    expect(normalizarFolioParticipante(undefined)).toBeNull();
  });
});

describe('cifrado de datos personales (AES-256-GCM)', () => {
  it('ida y vuelta, con IV distinto cada vez', () => {
    const a = cifrar('maria@example.org', 'participantes.correo');
    const b = cifrar('maria@example.org', 'participantes.correo');
    expect(a).not.toBe(b);
    expect(a).not.toContain('maria');
    expect(descifrar(a, 'participantes.correo')).toBe('maria@example.org');
  });

  it('no se puede mover un valor cifrado a otra columna (AAD) ni manipularlo', () => {
    const a = cifrar('55 1234 5678', 'participantes.telefono');
    expect(() => descifrar(a, 'participantes.correo')).toThrow();
    const partes = a.split('.');
    partes[3] = Buffer.from('otra cosa').toString('base64url');
    expect(() => descifrar(partes.join('.'), 'participantes.telefono')).toThrow();
  });

  it('el índice ciego del correo ignora mayúsculas y espacios', () => {
    expect(hashCorreo('  Maria@Example.ORG ')).toBe(hashCorreo('maria@example.org'));
    expect(hashCorreo('a@b.co')).not.toBe(hashCorreo('c@d.co'));
  });
});

describe('geometrías GeoJSON', () => {
  it('acepta puntos, líneas y polígonos', () => {
    expect(GeometriaSchema.safeParse({ type: 'Point', coordinates: [-99.13, 19.43] }).success).toBe(true);
    expect(GeometriaSchema.safeParse({ type: 'LineString', coordinates: [[-99.1, 19.4], [-99.2, 19.5]] }).success).toBe(true);
    expect(GeometriaSchema.safeParse({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }).success).toBe(true);
  });

  it('rechaza coordenadas fuera de rango, polígonos sin cerrar y tipos desconocidos', () => {
    expect(GeometriaSchema.safeParse({ type: 'Point', coordinates: [19.43, -99.13 * 2] }).success).toBe(false);
    expect(GeometriaSchema.safeParse({ type: 'Point', coordinates: [200, 10] }).success).toBe(false);
    expect(GeometriaSchema.safeParse({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }).success).toBe(false);
    expect(GeometriaSchema.safeParse({ type: 'GeometryCollection', geometries: [] }).success).toBe(false);
  });
});

describe('regla de la base de datos con el pooler de Supabase', () => {
  it('no se usa Promise.all con consultas (cuelga el pooler en modo transacción): usar enSerie()', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const archivos: string[] = [];
    const recorrer = (d: string) => {
      for (const f of readdirSync(d)) {
        const r = join(d, f);
        if (statSync(r).isDirectory()) recorrer(r);
        else if (r.endsWith('.ts')) archivos.push(r);
      }
    };
    recorrer(join(import.meta.dirname, '../src'));
    // Excepción explícita: la línea anterior lleva el marcador "sin-bd" (p. ej. solo firmar URLs de R2)
    const infractores = archivos.flatMap((f) => {
      const lineas = readFileSync(f, 'utf8').split(/\r?\n/);
      return lineas
        .map((l, i) => ({ l, i }))
        .filter(({ l, i }) => /Promise\.all\(/.test(l) && !l.trim().startsWith('*') && !(lineas[i - 1] ?? '').includes('sin-bd'))
        .map(({ i }) => `${f}:${i + 1}`);
    });
    expect(infractores).toEqual([]);
  });
});
