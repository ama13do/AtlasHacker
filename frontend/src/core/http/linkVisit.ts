import http from '@/core/http/client'

// Enlace /ir (el QR impreso en lonas y flyers): cuenta la visita sin hacer esperar a nadie. Sale del navegador
// directo a la API (IP real, con el X-Device-Id del cliente); las previsualizaciones de WhatsApp y los robots
// no ejecutan JavaScript, así que no cuentan
export function countLinkVisit() {
  http.post('/api/ir').catch(() => {})
}
