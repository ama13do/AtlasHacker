import { env } from '../config/env.js';
import { E } from '../lib/errors.js';

/**
 * Asistente para escribir la pregunta al Tribunal (prototipo: components/AsistentePregunta.tsx), vía OpenRouter.
 * Apagado salvo que estén ASISTENTE_IA_ACTIVO=true, OPENROUTER_API_KEY y OPENROUTER_MODEL. No guarda nada:
 * ni la conversación ni el contexto pasan por la base de datos.
 */
export function asistenteDisponible(): boolean {
  const e = env();
  return e.ASISTENTE_IA_ACTIVO && Boolean(e.OPENROUTER_API_KEY) && Boolean(e.OPENROUTER_MODEL);
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
  return `Eres el asistente del Atlas Hacker de Hackers x Nuestro Futuro. Ayudas a una persona a escribir UNA pregunta clara para el Tribunal Popular de Juicios x Nuestro Futuro. Esa pregunta se convertirá en una solicitud de información pública a la autoridad responsable, así que debe pedir información que exista en documentos: acciones, fechas, presupuesto, responsables, resultados.

Reglas:
- Español de México, palabras sencillas, sin jerga legal. Máximo 3 frases por turno.
- Haz una sola pregunta a la vez para entender qué quiere saber la persona.
- Respeta su intención y su voz. No cambies el sentido de lo que quiere preguntar.
- No inventes cifras, leyes, artículos, programas ni nombres de funcionarios. No des asesoría legal ni prometas resultados.
- No pidas datos personales. Si la persona comparte nombres o datos que la identifiquen, sugiere quitarlos de la pregunta.
- Cuando tengas una propuesta, escríbela entre <pregunta> y </pregunta>, una sola pregunta de máximo 60 palabras, que mencione el lugar. Luego pregunta si le sirve o si quiere cambiar algo.

Contexto del testimonio:
- Qué pasa: ${t.hechos?.join(', ') || '(sin elegir)'}
- Lugar: ${t.lugar || '(sin lugar)'}
- Desde cuándo: ${t.desde_cuando || '(sin dato)'} · ¿Sigue pasando?: ${t.sigue_pasando || '(sin dato)'}
- Título: ${t.titulo || '(vacío)'}
- Relato: ${t.relato?.slice(0, 1500) || '(vacío)'}
- Borrador de pregunta: ${t.pregunta || '(vacío)'}`;
}

export async function responderAsistente(contexto: ContextoPregunta, mensajes: MensajeAsistente[]): Promise<string> {
  if (!asistenteDisponible()) throw E.noDisponible('El asistente no está disponible');
  const e = env();
  let r: Response;
  try {
    r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${e.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Atlas Hacker' },
      body: JSON.stringify({
        model: e.OPENROUTER_MODEL,
        messages: [{ role: 'system', content: instrucciones(contexto) }, ...mensajes],
        max_tokens: 400,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(12_000), // la Lambda corta a los 15 s
    });
  } catch (err) {
    console.error('asistente: OpenRouter no respondió', (err as Error).message);
    throw E.noDisponible('El asistente no está disponible ahora');
  }
  if (!r.ok) {
    console.error('asistente: OpenRouter respondió', r.status);
    throw r.status === 429 ? E.limite('Muchas consultas seguidas. Espera un momento.') : E.noDisponible('El asistente no está disponible ahora');
  }
  const datos = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  const texto = datos.choices?.[0]?.message?.content?.trim();
  if (!texto) throw E.noDisponible('El asistente no está disponible ahora');
  return texto;
}
