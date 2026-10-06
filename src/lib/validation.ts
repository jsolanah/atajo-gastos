import { z } from "zod";
import { parseImporte } from "./money";
import { hoyISO } from "./dates";

const importeSchema = z
  .union([z.string(), z.number()], { error: "Falta el importe" })
  .transform((valor, ctx) => {
    const n = parseImporte(valor as string | number);
    if (n === null || Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "Importe no válido" });
      return z.NEVER;
    }
    if (n <= 0) {
      ctx.addIssue({ code: "custom", message: "El importe debe ser mayor que 0" });
      return z.NEVER;
    }
    if (n > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "El importe es demasiado alto" });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

const texto = (campo: string, min = 1) =>
  z
    .string()
    .trim()
    .min(min, `${campo} es obligatorio`)
    .max(200, `${campo} es demasiado largo`);

const fechaSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida (AAAA-MM-DD)")
  .refine((f) => !Number.isNaN(Date.parse(`${f}T00:00:00`)), "Fecha no válida");

/* -------------------------------------------------------------------------- */
/* Atajo de iOS                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Acepta el JSON del Atajo con nombres en español o inglés, para que sea
 * fácil de montar en la app de Atajos.
 */
export const gastoAtajoSchema = z
  .object({
    importe: importeSchema,
    concepto: texto("El concepto").optional(),
    descripcion: texto("El concepto").optional(),
    cuenta: texto("La cuenta").optional(),
    cuenta_origen: texto("La cuenta").optional(),
    banco: texto("El banco").optional(),
    categoria: texto("La categoría").optional(),
    categoria_id: texto("La categoría").optional(),
    fecha: fechaSchema.optional(),
    notas: texto("Las notas", 0).optional(),
  })
  .transform((v) => ({
    importe: v.importe,
    concepto: (v.concepto ?? v.descripcion ?? "").trim(),
    cuenta: (v.cuenta ?? v.cuenta_origen ?? v.banco ?? "").trim(),
    categoria: (v.categoria ?? v.categoria_id ?? "").trim(),
    fecha: v.fecha ?? hoyISO(),
    notas: v.notas?.trim() || null,
  }));

export type GastoAtajo = z.infer<typeof gastoAtajoSchema>;

/* -------------------------------------------------------------------------- */
/* Formularios de la web                                                      */
/* -------------------------------------------------------------------------- */

export const movimientoSchema = z
  .object({
    id: z.string().uuid("Movimiento no válido").optional(),
    tipo: z.enum(["gasto", "ingreso", "traspaso"], "Tipo no válido"),
    importe: importeSchema,
    descripcion: texto("El concepto"),
    cuenta_origen: z.string().uuid("Selecciona la cuenta de origen").nullable().optional(),
    cuenta_destino: z.string().uuid("Selecciona la cuenta de destino").nullable().optional(),
    categoria_id: z.string().uuid("Categoría no válida").nullable().optional(),
    fecha: fechaSchema,
    notas: texto("Las notas", 0).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    const origen = v.cuenta_origen || null;
    const destino = v.cuenta_destino || null;

    if (v.tipo === "gasto" && !origen) {
      ctx.addIssue({ code: "custom", path: ["cuenta_origen"], message: "Falta la cuenta de origen" });
    }
    if (v.tipo === "ingreso" && !destino) {
      ctx.addIssue({ code: "custom", path: ["cuenta_destino"], message: "Falta la cuenta de destino" });
    }
    if (v.tipo === "traspaso") {
      if (!origen) {
        ctx.addIssue({ code: "custom", path: ["cuenta_origen"], message: "Falta la cuenta de origen" });
      }
      if (!destino) {
        ctx.addIssue({ code: "custom", path: ["cuenta_destino"], message: "Falta la cuenta de destino" });
      }
      if (origen && destino && origen === destino) {
        ctx.addIssue({
          code: "custom",
          path: ["cuenta_destino"],
          message: "El origen y el destino no pueden ser la misma cuenta",
        });
      }
    }
  });

export type MovimientoInput = z.infer<typeof movimientoSchema>;

export const cuentaSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: texto("El nombre", 2),
  entidad: z.string().trim().max(60).optional().nullable(),
  tipo: z.enum(["corriente", "ahorro", "inversion", "efectivo"]),
  saldo_inicial: z.union([z.string(), z.number()]).transform((v) => Math.abs(Number(v) || 0)),
  fecha_saldo: fechaSchema.optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color no válido")
    .optional()
    .nullable(),
  activa: z.boolean().optional(),
});

export const categoriaSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: texto("El nombre", 2),
  tipo: z.enum(["gasto", "ingreso"]),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color no válido")
    .optional()
    .nullable(),
  activa: z.boolean().optional(),
});

const mesSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes no válido")
  .transform((valor) => `${valor}-01`);

export const recurrenteSchema = z
  .object({
    id: z.string().uuid().optional(),
    concepto: texto("El concepto"),
    tipo: z.enum(["gasto", "ingreso", "traspaso"]),
    importe: importeSchema,
    dia: z.coerce
      .number({ message: "Día no válido" })
      .int("Día no válido")
      .min(1, "El día debe estar entre 1 y 31")
      .max(31, "El día debe estar entre 1 y 31"),
    mes_inicio: mesSchema,
    cuenta_origen: z.string().uuid("Selecciona la cuenta de origen").nullable().optional(),
    cuenta_destino: z.string().uuid("Selecciona la cuenta de destino").nullable().optional(),
    categoria_id: z.string().uuid("Categoría no válida").nullable().optional(),
    activo: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const origen = v.cuenta_origen || null;
    const destino = v.cuenta_destino || null;

    if (v.tipo === "gasto" && !origen) {
      ctx.addIssue({
        code: "custom",
        path: ["cuenta_origen"],
        message: "Un gasto necesita la cuenta de origen",
      });
    }
    if (v.tipo === "ingreso") {
      if (!destino) {
        ctx.addIssue({
          code: "custom",
          path: ["cuenta_destino"],
          message: "Un ingreso necesita la cuenta donde entra el dinero",
        });
      }
    }
    if (v.tipo === "traspaso") {
      if (!origen) {
        ctx.addIssue({
          code: "custom",
          path: ["cuenta_origen"],
          message: "Falta la cuenta de origen",
        });
      }
      if (!destino) {
        ctx.addIssue({
          code: "custom",
          path: ["cuenta_destino"],
          message: "Falta la cuenta de destino",
        });
      }
      if (origen && destino && origen === destino) {
        ctx.addIssue({
          code: "custom",
          path: ["cuenta_destino"],
          message: "El origen y el destino no pueden ser la misma cuenta",
        });
      }
    }
  });

/** Porcentaje opcional: cadena vacía -> null (préstamo sin intereses). */
const porcentajeSchema = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((valor, ctx) => {
    if (valor === null || valor === undefined || valor === "") return null;
    const n = parseImporte(valor as string | number);
    if (n === null || Number.isNaN(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "Tipo de interés no válido" });
      return z.NEVER;
    }
    return n;
  });

export const prestamoSchema = z
  .object({
    id: z.string().uuid().optional(),
    nombre: texto("El nombre"),
    capital_inicial: z.coerce.number().min(0, "Capital inválido"),
    cuota: z.coerce.number().positive("La cuota debe ser mayor que 0"),
    fecha_inicio: fechaSchema,
    interes_anual: porcentajeSchema,
    interes_modo: z.enum(["tan", "tae"]).nullable().optional(),
    numero_cuotas: z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      .transform((valor, ctx) => {
        if (valor === null || valor === undefined || valor === "") return null;
        const n = Math.floor(Number(valor));
        if (!Number.isFinite(n) || n <= 0 || n > 600) {
          ctx.addIssue({ code: "custom", message: "Número de cuotas no válido" });
          return z.NEVER;
        }
        return n;
      }),
    saldo_referencia: z.coerce.number().min(0, "Capital inválido").nullable().optional(),
    fecha_referencia: fechaSchema.nullable().optional(),
    cuenta_origen: z.string().uuid().nullable().optional(),
    categoria_id: z.string().uuid().nullable().optional(),
    notas: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    // El ancla con el banco son dos datos o ninguno: sin fecha, el saldo no
    // sirve de nada.
    if (v.saldo_referencia !== null && v.saldo_referencia !== undefined && !v.fecha_referencia) {
      ctx.addIssue({
        code: "custom",
        path: ["fecha_referencia"],
        message: "Dime a qué fecha corresponde ese capital pendiente.",
      });
    }
    if (v.fecha_referencia && v.saldo_referencia === null) {
      ctx.addIssue({
        code: "custom",
        path: ["saldo_referencia"],
        message: "Falta el capital pendiente del banco en esa fecha.",
      });
    }
  });

export type RecurrenteInput = z.infer<typeof recurrenteSchema>;

export const abonoSchema = z
  .object({
    prestamo_id: z.string().uuid("Préstamo no válido"),
    importe: importeSchema,
    fecha: fechaSchema,
    modo: z.enum(["reducir_plazo", "reducir_cuota"]),
    cuenta_id: z.string().uuid("Selecciona la cuenta de la que sale el dinero").nullable().optional(),
    notas: z.string().trim().max(500).nullable().optional(),
    actualizar_fijo: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.modo === "reducir_cuota" && !v.actualizar_fijo) {
      ctx.addIssue({
        code: "custom",
        path: ["actualizar_fijo"],
        message:
          "Si bajas la cuota, hay que actualizar también el pago fijo mensual: si no, la app seguiría descontando la cuota antigua.",
      });
    }
  });

export type AbonoInput = z.infer<typeof abonoSchema>;

/** Convierte los issues de zod en un mapa campo -> mensaje. */
export function erroresDeFormulario(
  error: z.ZodError,
): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = issue.path.join(".") || "formulario";
    if (!mapa[campo]) mapa[campo] = issue.message;
  }
  return mapa;
}

/** Normaliza texto para comparar ignorando tildes, mayúsculas y espacios. */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}