/**
 * Preferencia de "mostrar el dinero".
 *
 * Vive en una cookie (no en localStorage) para que el servidor la lea al pintar
 * la página: así las cifras nunca aparecen un instante antes de taparse.
 *
 * Ojo: este módulo lo importan cliente y servidor, así que no puede llevar
 * `import "server-only"`. Lo que sí necesita cookies vive en actions.ts.
 */
export const COOKIE_OCULTO = "ocultar_dinero";

/** Valor de la cookie cuando el dinero está oculto. */
export const OCULTO_SI = "1";

/** Valor de la cookie cuando el dinero se ve. */
export const OCULTO_NO = "0";