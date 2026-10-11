export type MediaTipo = 'imagen' | 'audio' | 'video' | 'documento' | 'ninguno';

export interface Testimonio {
  id: string;
  titulo: string;
  descripcion: string;
  autor_nombre: string;
  ubicacion?: string;
  latitud: number;
  longitud: number;
  media_url?: string | null;
  media_tipo: MediaTipo;
  categoria: string;
  reacciones_conteo?: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface CrearTestimonioDTO {
  titulo: string;
  descripcion: string;
  autor_nombre?: string;
  latitud: number;
  longitud: number;
  media_url?: string | null;
  media_tipo?: MediaTipo;
  categoria?: string;
}

export interface Comentario {
  id: string;
  testimonio_id: string;
  autor_nombre: string;
  contenido: string;
  created_at: string;
}

export interface Reaccion {
  id: string;
  testimonio_id: string;
  tipo: string;
  usuario_fingerprint?: string;
  created_at: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}
