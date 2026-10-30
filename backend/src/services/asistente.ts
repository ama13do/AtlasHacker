import { env } from '../config/env.js';
import { E } from '../lib/errors.js';

/**
 * Sugiere la pregunta al Tribunal a partir del testimonio (prototipo: components/AsistentePregunta.tsx). No es un chat:
 * la persona pide una sugerencia y, si no le gusta, otra.
 * Pregunta primero a Groq y, si falla o tarda, a OpenRouter. Apagado salvo ASISTENTE_IA_ACTIVO=true y al menos
 * una clave. No guarda nada: ni las sugerencias ni el contexto pasan por la base de datos.
 */
type Proveedor = { nombre: string; url: string; clave: string; modelo: string; extra?: Record<string, unknown>; ms: number };

// Los modelos que razonan antes de responder: el razonamiento no va en la respuesta
function razonamientoGroq(modelo: string): Record<string, unknown> | undefined {
  if (modelo.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low', include_reasoning: false };
  if (modelo.startsWith('qwen/')) return { reasoning_format: 'hidden' };
  return undefined;
}

// La Lambda corta a los 15 s: Groq responde en 1–3 s, así que el respaldo todavía tiene tiempo
function proveedores(): Proveedor[] {
  const e = env();
  const lista: Proveedor[] = [];
  if (e.GROQ_API_KEY) {
    lista.push({
      nombre: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      clave: e.GROQ_API_KEY,
      modelo: e.GROQ_MODEL,
      extra: razonamientoGroq(e.GROQ_MODEL),
      ms: 6_000,
    });
  }
  if (e.OPENROUTER_API_KEY) {
    lista.push({
      nombre: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      clave: e.OPENROUTER_API_KEY,
      modelo: e.OPENROUTER_MODEL,
      // Sin razonamiento: si no, el modelo gasta los tokens pensando y la respuesta llega vacía
      extra: { reasoning: { enabled: false } },
      ms: 7_000,
    });
  }
  return lista;
}

export function asistenteDisponible(): boolean {
  return env().ASISTENTE_IA_ACTIVO && proveedores().length > 0;
}

export type ContextoPregunta = {
  hechos?: string[];
  lugar?: string;
  desde_cuando?: string;
  sigue_pasando?: string;
  titulo?: string;
  relato?: string;
  pregunta?: string;
};
export type MensajeAsistente = { role: 'user' | 'assistant'; content: string };

function instrucciones(t: ContextoPregunta) {
  return `Eres el asistente del Atlas Hacker de Hackers x Nuestro Futuro. Sugieres UNA pregunta clara para el Tribunal Popular de Juicios x Nuestro Futuro a partir del testimonio de una persona. Esa pregunta se convertirá en una solicitud de información pública a la autoridad responsable, así que debe pedir información que exista en documentos: acciones, fechas, presupuesto, responsables, resultados.

Reglas:
- Responde SOLO con la pregunta entre <pregunta> y </pregunta>, sin saludo ni explicación.
- Una sola pregunta de máximo 60 palabras, en español de México, con palabras sencillas y sin jerga legal. Menciona el lugar.
- Si hay un borrador de pregunta, respeta su intención y su voz: mejóralo sin cambiar lo que quiere saber.
- Si te piden otra, propón una distinta a las anteriores (otro ángulo: presupuesto, fechas, responsables o resultados).
- No inventes cifras, leyes, artículos, programas, dependencias ni nombres de funcionarios. No des asesoría legal ni prometas resultados.
- No incluyas nombres de personas ni datos que identifiquen a alguien.

Contexto del testimonio:
- Qué pasa: ${t.hechos?.join(', ') || '(sin elegir)'}
- Lugar: ${t.lugar || '(sin lugar)'}
- Desde cuándo: ${t.desde_cuando || '(sin dato)'} · ¿Sigue pasando?: ${t.sigue_pasando || '(sin dato)'}
- Título: ${t.titulo || '(vacío)'}
- Relato: ${t.relato?.slice(0, 1500) || '(vacío)'}
- Borrador de pregunta: ${t.pregunta || '(vacío)'}`;
}

async function preguntar(p: Proveedor, mensajes: { role: string; content: string }[]): Promise<string> {
  const r = await fetch(p.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.clave}`, 'Content-Type': 'application/json', 'X-Title': 'Atlas Hacker' },
    body: JSON.stringify({ model: p.modelo, messages: mensajes, max_tokens: 400, temperature: 0.7, ...p.extra }),
    signal: AbortSignal.timeout(p.ms),
  });
  if (!r.ok) throw new Error(`respondió ${r.status}`);
  const datos = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  const texto = datos.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new Error('respuesta vacía');
  return texto;
}

export async function responderAsistente(contexto: ContextoPregunta, mensajes: MensajeAsistente[]): Promise<string> {
  if (!asistenteDisponible()) throw E.noDisponible('El asistente no está disponible');
  const conversacion = [{ role: 'system', content: instrucciones(contexto) }, ...mensajes];
  for (const p of proveedores()) {
    try {
      return await preguntar(p, conversacion);
    } catch (err) {
      console.error(`asistente: ${p.nombre} falló`, (err as Error).message);
    }
  }
  throw E.noDisponible('El asistente no está disponible ahora. Intenta en un momento.');
}
