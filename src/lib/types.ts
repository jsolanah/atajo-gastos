export type TipoCuenta = "corriente" | "ahorro" | "inversion" | "efectivo";
export type TipoMovimiento = "gasto" | "ingreso" | "traspaso";
export type TipoCategoria = "gasto" | "ingreso";
export type OrigenMovimiento = "web" | "atajo";

export interface Cuenta {
  id: string;
  nombre: string;
  entidad: string;
  tipo: TipoCuenta;
  saldo_inicial: number;
  fecha_saldo: string;
  color: string;
  orden: number;
  activa: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  color: string;
  orden: number;
  activa: boolean;
}

/**
 * Cómo viene dado el interés en el contrato:
 * - `tan`: nominal anual, el tipo mensual es `interes / 1200`.
 * - `tae`: efectiva anual, el tipo mensual es `(1 + interes)^(1/12) - 1`.
 */
export type ModoTasa = "tan" | "tae";

export interface Prestamo {
  id: string;
  nombre: string;
  capital_inicial: number;
  /** @deprecated Ya no se usa: el capital pendiente se deriva de los pagos. */
  capital_pendiente: number;
  cuota: number;
  fecha_inicio: string;
  /** Tipo de interés anual en %, tal cual aparece en el contrato. */
  interes_anual: number | null;
  interes_modo: ModoTasa | null;
  /** Número total de cuotas del préstamo, si se conoce. */
  numero_cuotas: number | null;
  /** Capital pendiente según el banco en `fecha_referencia`. */
  saldo_referencia: number | null;
  /** Lo anterior a esta fecha se ignora al calcular el capital pendiente. */
  fecha_referencia: string | null;
  cuenta_origen: string | null;
  categoria_id: string | null;
  notas: string | null;
}

/**
 * Abono: pago por delante del préstamo hecho con dinero ahorrado.
 * - `reducir_plazo`: quitas cuotas, la cuota mensual se mantiene.
 * - `reducir_cuota`: mantienes los meses, la cuota mensual baja.
 */
export type ModoAbono = "reducir_plazo" | "reducir_cuota";

export interface PagoPrestamo {
  id: string;
  prestamo_id: string;
  fecha: string;
  importe: number;
  modo: ModoAbono;
  cuenta_id: string | null;
  movimiento_id: string | null;
  /** Cuota mensual después del abono (solo si bajó la cuota). */
  cuota_resultante: number | null;
  /** Cuota mensual antes del abono, para poder restituirla al deshacerlo. */
  cuota_previa: number | null;
  notas: string | null;
  created_at: string;
}

export interface Recurrente {
  id: string;
  concepto: string;
  tipo: TipoMovimiento;
  importe: number;
  dia: number;
  mes_inicio: string;
  cuenta_origen: string | null;
  cuenta_destino: string | null;
  categoria_id: string | null;
  prestamo_id: string | null;
  activo: boolean;
}

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  importe: number;
  descripcion: string;
  categoria_id: string | null;
  cuenta_origen: string | null;
  cuenta_destino: string | null;
  fecha: string;
  recurrente_id: string | null;
  prestamo_id: string | null;
  /** Si el movimiento es el gasto de un abono de `pagos_prestamo`. */
  pago_prestamo_id: string | null;
  notas: string | null;
  origen: OrigenMovimiento;
  created_at: string;
}

export type MovimientoConDetalle = Movimiento & {
  categoria: Categoria | null;
  cuenta_origen_detalle: Pick<Cuenta, "id" | "nombre" | "color"> | null;
  cuenta_destino_detalle: Pick<Cuenta, "id" | "nombre" | "color"> | null;
};

export interface SaldoCuenta {
  cuenta: Cuenta;
  saldo: number;
  ingresos: number;
  gastos: number;
}

export interface ResumenFijos {
  gastosTotal: number;
  gastosPagados: number;
  gastosPendientes: number;
  traspasosTotal: number;
  traspasosPagados: number;
  traspasosPendientes: number;
  ingresosTotal: number;
  ingresosPagados: number;
  ingresosPendientes: number;
  /** Flujo neto del mes: entra − sale. */
  neto: number;
}

export interface ResumenMes {
  mes: string;
  gastos: number;
  ingresos: number;
  neto: number;
  fijos: ResumenFijos;
}

export interface ApunteCategoria {
  categoria: Categoria | null;
  total: number;
  porcentaje: number;
  numMovimientos: number;
}