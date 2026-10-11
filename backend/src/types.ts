import type { Rol } from './db/schema.js';

export type UsuarioAuth = { id: string; email: string; nombre: string; rol: Rol };
export type ParticipanteAuth = { id: string };

/** Variables que los middlewares dejan disponibles en c.var */
export type AppEnv = {
  Variables: {
    requestId: string;
    ip: string;
    usuario?: UsuarioAuth;
    participante?: ParticipanteAuth;
    captchaOk?: boolean;
  };
};
