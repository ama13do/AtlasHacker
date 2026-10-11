/** Error de negocio: se devuelve tal cual al cliente. Cualquier otro error se responde como 500 genérico. */
export class AppError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 423 | 429 | 500 | 503,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
  }
}

export const E = {
  invalido: (mensaje: string, detalles?: unknown) => new AppError(400, 'DATOS_INVALIDOS', mensaje, detalles),
  noAutenticado: (mensaje = 'Autenticación requerida') => new AppError(401, 'NO_AUTENTICADO', mensaje),
  credenciales: () => new AppError(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos'),
  prohibido: (mensaje = 'No tienes permiso para realizar esta acción') => new AppError(403, 'PROHIBIDO', mensaje),
  noEncontrado: (que = 'Recurso') => new AppError(404, 'NO_ENCONTRADO', `${que} no encontrado`),
  conflicto: (mensaje: string, codigo = 'CONFLICTO') => new AppError(409, codigo, mensaje),
  bloqueado: (mensaje: string) => new AppError(423, 'CUENTA_BLOQUEADA', mensaje),
  limite: (mensaje = 'Demasiadas solicitudes, intenta más tarde') => new AppError(429, 'DEMASIADAS_SOLICITUDES', mensaje),
  noDisponible: (mensaje: string) => new AppError(503, 'NO_DISPONIBLE', mensaje),
};

/** Código SQLSTATE de violación de unicidad */
export function esViolacionUnica(err: unknown, constraint?: string): boolean {
  const e = err as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const base = e?.cause ?? e;
  return base?.code === '23505' && (!constraint || base.constraint_name === constraint);
}
