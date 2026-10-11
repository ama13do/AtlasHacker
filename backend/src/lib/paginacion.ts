import { z } from '@hono/zod-openapi';
import { E } from './errors.js';

/** Cursor opaco para paginación por keyset (estable y rápida: no usa OFFSET). */
export type Cursor = { t: string; id: string };

export const codificarCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');

export function decodificarCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
    if (typeof c.t !== 'string' || typeof c.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(c.id) || Number.isNaN(Date.parse(c.t))) throw new Error();
    return c;
  } catch {
    throw E.invalido('Cursor de paginación inválido');
  }
}

export const PaginacionOffset = z.object({
  pagina: z.coerce.number().int().min(1).default(1).openapi({ description: 'Página (desde 1)' }),
  por_pagina: z.coerce.number().int().min(1).max(200).default(25).openapi({ description: 'Elementos por página (máx. 200)' }),
});

export const PaginacionCursor = z.object({
  limite: z.coerce.number().int().min(1).max(100).default(30).openapi({ description: 'Elementos por página (máx. 100)' }),
  cursor: z.string().max(300).optional().openapi({ description: 'Cursor devuelto como "siguiente_cursor" en la página anterior' }),
});
