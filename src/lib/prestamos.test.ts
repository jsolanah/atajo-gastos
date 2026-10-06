import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amortizar,
  calcularAbono,
  cuotaDe,
  mesesRestantes,
  planAmortizacion,
  repartirCuota,
  simularPrestamo,
  tasaMensual,
} from "./prestamos";
import { redondear } from "./money";

// Préstamo de EJEMPLO, con cifras inventadas y redondas: 15.000 € a 60 meses
// al TAN 6 %, que dan una cuota exacta de 290 €. Los datos reales de quien
// mantiene la app no se publican en los tests.
const EJEMPLO = {
  capital_inicial: 15000,
  cuota: 290,
  fecha_inicio: "2025-01-31",
  interes_anual: 6,
  interes_modo: "tan" as const,
  saldo_referencia: null as number | null,
  fecha_referencia: null as string | null,
};

// Modelo sin intereses, para los abonos que no dependen del tipo.
const PRESTAMO = { capitalPendiente: 12000, cuota: 210 };

/* -------------------------------------------------------------------------- */
/* Sistema francés con el préstamo de ejemplo                                   */
/* -------------------------------------------------------------------------- */

test("tasaMensual: el TAN se divide entre 12 y la TAE se compone", () => {
  assert.ok(Math.abs(tasaMensual(6, "tan") - 0.06 / 12) < 1e-12);

  // Los dos rótulos del contrato describen el mismo préstamo: uno es el tipo
  // nominal y el otro el efectivo, y por eso la app guarda cuál de los dos es.
  assert.ok(
    Math.abs(tasaMensual(6, "tan") - tasaMensual(6.1678, "tae")) < 1e-6,
    "TAN 6 % y TAE 6,1678 % deben dar el mismo tipo mensual",
  );

  assert.equal(tasaMensual(0, "tan"), 0);
  assert.equal(tasaMensual(-3, "tae"), 0);
});

test("cuotaDe: con intereses da la cuota del sistema francés, redondeada arriba", () => {
  // 15.000 € a 60 meses al TAN 6 % -> 289,9920229 € exactos, que redondeados
  // arriba dan 290 €. Abajo se comprueba que esa cuota cierra en 60 meses.
  assert.equal(cuotaDe(15000, 60, 6, "tan"), 290);
  assert.ok(Math.abs(cuotaDe(15000, 60, 6, "tan") - 289.9920229) < 0.01, "cuota del contrato");
  assert.equal(cuotaDe(12000, 24), 500, "sin tipo sigue siendo capital / meses");
  assert.equal(cuotaDe(0, 24), 0);
  assert.equal(cuotaDe(1000, 0), 0);
});

test("repartirCuota: la cuota se parte en interés y capital", () => {
  const r = repartirCuota(15000, 290, 6, "tan");

  assert.equal(r.interes, 75, "15.000 * 0,5 %");
  assert.equal(r.amortizacion, 215);
  assert.equal(r.capitalRestante, 14785);
  assert.equal(
    Number((r.interes + r.amortizacion).toFixed(2)),
    290,
    "interés + amortización es exactamente la cuota",
  );
});

test("repartirCuota: sin capital no hay nada que repartir", () => {
  assert.deepEqual(repartirCuota(0, 290, 6, "tan"), {
    interes: 0,
    amortizacion: 0,
    capitalRestante: 0,
  });
});

test("tabla de amortización: los tres primeros meses", () => {
  const plan = planAmortizacion(15000, 290, 6, "tan");

  assert.equal(plan.length, 60, "60 cuotas y el préstamo queda a cero");
  assert.equal(plan[0].capitalRestante, 14785);
  assert.equal(plan[1].capitalRestante, 14568.93);
  assert.equal(plan[2].capitalRestante, 14351.77);
  assert.equal(plan.at(-1)!.capitalRestante, 0);
  assert.ok(plan[0].interes > plan.at(-1)!.interes, "el interés decrece mes a mes");
});

test("mesesRestantes: el plazo real, no capital / cuota", () => {
  const meses = mesesRestantes(14568.93, 290, 6, "tan");

  assert.ok(Math.abs(meses - 58) < 0.05, `58 meses, dio ${meses}`);
  assert.equal(Math.ceil(meses), 58);
  // Sin intereses salen 50,24 meses: sin tipo el plazo es bastante más corto.
  assert.ok(Math.abs(mesesRestantes(14568.93, 290) - 50.24) < 0.05);
});

test("amortizar: cuenta los pagos de verdad, no redondea el plazo", () => {
  // La annuity exacta de 17.000 € a 60 meses al TAN 6 % vale 328,6576260 €.
  // Redondeada arriba son 328,66 € y cierra en 60 cuotas; redondeada abajo,
  // 328,65 €, quedarían céntimos sueltos y haría falta una cuota 61.
  assert.equal(amortizar(17000, 328.66, 6, "tan").cuotas, 60, "hacia arriba: 60");
  assert.equal(amortizar(17000, 328.65, 6, "tan").cuotas, 61, "hacia abajo: 61");

  const r = amortizar(17000, cuotaDe(17000, 60, 6, "tan"), 6, "tan");

  assert.equal(r.cuotas, 60, "la annuity de 60 meses no puede durar 61");
  assert.ok(r.totalPagado >= 17000, "hay que haber pagado al menos el capital");
  assert.equal(r.totalPagado - r.interesesTotales, 17000, "capital = pagado - intereses");
  assert.ok(r.ultimaCuota <= 328.67, "la última cuota no puede ser mayor que la cuota");
});

test("amortizar: una cuota que no amortiza no inventa un plazo", () => {
  const r = amortizar(15000, 50, 6, "tan");

  assert.equal(r.completa, false);
  assert.equal(r.cuotas, 0, "mejor cero que los 1.200 meses del tope");
  assert.equal(r.ultimaCuota, 0);
});

test("amortizar: los intereses pendientes son la diferencia hasta el final", () => {
  const r = amortizar(14568.93, 290, 6, "tan");

  assert.equal(r.cuotas, 58, "de 60 cuotas quedan 58: ya se pagaron dos");
  assert.equal(r.interesesTotales, redondear(r.totalPagado - 14568.93));
});

test("mesesRestantes: una cuota que no cubre el interés no termina nunca", () => {
  // Capital * 0,5 % = 75 € de interés al mes, y la cuota es menor.
  assert.equal(mesesRestantes(15000, 50, 6, "tan"), Number.POSITIVE_INFINITY);
  assert.equal(mesesRestantes(15000, 0, 6, "tan"), Number.POSITIVE_INFINITY);
  assert.equal(mesesRestantes(0, 290, 6, "tan"), 0);
});

/* -------------------------------------------------------------------------- */
/* Capital pendiente derivado                                                  */
/* -------------------------------------------------------------------------- */

test("simularPrestamo: el capital baja solo con la parte de cuota que amortiza", () => {
  const estado = simularPrestamo(EJEMPLO, [
    { fecha: "2025-02-28", tipo: "cuota", importe: 290 },
  ]);

  assert.equal(estado.capitalPendiente, 14785, "no baja los 290 enteros");
  assert.equal(estado.cuotasRegistradas, 1);
  assert.equal(estado.interesesPagados, 75);
});

test("simularPrestamo: dos cuotas dan los 14.568,93 € del modelo", () => {
  const estado = simularPrestamo(EJEMPLO, [
    { fecha: "2025-02-28", tipo: "cuota", importe: 290 },
    { fecha: "2025-03-31", tipo: "cuota", importe: 290 },
  ]);

  assert.equal(estado.capitalPendiente, 14568.93);
  assert.equal(estado.interesesPagados, 148.93, "75 + 73,93");
  assert.equal(estado.cuotasRestantes, 58);
  assert.ok(
    estado.interesesPendientes > 2200 && estado.interesesPendientes < 2300,
    `unos 2.250 € de intereses por pagar, dio ${estado.interesesPendientes}`,
  );
});

test("simularPrestamo: el ancla parte de la cifra del banco e ignora lo anterior", () => {
  const anclado = { ...EJEMPLO, saldo_referencia: 14568.93, fecha_referencia: "2025-03-31" };

  // Estas dos cuotas ya están dentro de la cifra del banco: si se descontaran,
  // el capital quedaría por debajo de lo que dice el banco.
  const estado = simularPrestamo(anclado, [
    { fecha: "2025-02-28", tipo: "cuota", importe: 290 },
    { fecha: "2025-03-31", tipo: "cuota", importe: 290 },
  ]);

  assert.equal(estado.capitalPendiente, 14568.93, "el ancla manda sobre el historial");
  assert.equal(estado.cuotasRegistradas, 0);
  assert.equal(estado.interesesPagados, 0);
  assert.equal(estado.anclado, true);
  assert.equal(estado.fechaAncla, "2025-03-31");
});

test("simularPrestamo: con el ancla, la cuota siguiente descuenta su interés", () => {
  const anclado = { ...EJEMPLO, saldo_referencia: 14568.93, fecha_referencia: "2025-03-31" };

  const estado = simularPrestamo(anclado, [
    { fecha: "2025-04-30", tipo: "cuota", importe: 290 },
  ]);

  assert.equal(estado.capitalPendiente, 14351.77, "14.568,93 - (290 - 72,84)");
  assert.equal(estado.interesesPagados, 72.84);
  assert.equal(estado.cuotasRegistradas, 1);
});

test("simularPrestamo: un abono intercalado baja el interés de la cuota siguiente", () => {
  const conAbono = simularPrestamo(EJEMPLO, [
    { fecha: "2025-02-28", tipo: "cuota", importe: 290 },
    { fecha: "2025-03-15", tipo: "abono", importe: 1000 },
    { fecha: "2025-03-31", tipo: "cuota", importe: 290 },
  ]);

  // 15.000 -> 14.785 (cuota) -> 13.785 (abono) -> 13.563,93 (cuota).
  assert.equal(conAbono.capitalPendiente, 13563.93);
  assert.equal(conAbono.interesesPagados, 143.93, "75 + 68,93");
  assert.ok(
    conAbono.interesesPagados < 148.93,
    "con 1.000 € menos de capital, la segunda cuota paga menos de interés",
  );
});

test("simularPrestamo: los abonos y las cuotas se cuentan una sola vez", () => {
  // El abono genera también un movimiento de gasto con prestamo_id. Si `queries`
  // lo pasara también como cuota, el capital caería 1.000 € de más.
  const estado = simularPrestamo(EJEMPLO, [
    { fecha: "2025-02-28", tipo: "cuota", importe: 290 },
    { fecha: "2025-03-15", tipo: "abono", importe: 1000 },
  ]);

  assert.equal(estado.capitalPendiente, 13785);
  assert.equal(estado.cuotasRegistradas, 1, "solo la cuota cuenta como cuota");
});

test("simularPrestamo: el capital nunca baja de cero", () => {
  const estado = simularPrestamo(EJEMPLO, [
    { fecha: "2025-02-28", tipo: "abono", importe: 99999 },
  ]);

  assert.equal(estado.capitalPendiente, 0);
  assert.equal(estado.cuotasRestantes, 0);
  assert.equal(estado.interesesPendientes, 0);
});

test("simularPrestamo: un préstamo sin pagos sigue íntegro", () => {
  const estado = simularPrestamo(EJEMPLO, []);

  assert.equal(estado.capitalPendiente, 15000);
  assert.equal(estado.capitalAmortizado, 0);
  assert.equal(estado.anclado, false);
  assert.equal(estado.cuotaNoAmortiza, false);
});

test("simularPrestamo: avisa si la cuota no cubre el interés", () => {
  const estado = simularPrestamo({ ...EJEMPLO, cuota: 50 }, []);

  assert.equal(estado.cuotaNoAmortiza, true);
  assert.equal(estado.cuotasRestantes, 0, "sin plazo que mostrar");
  assert.equal(estado.interesesPendientes, 0, "no se puede estimar lo que no termina");
});

/* -------------------------------------------------------------------------- */
/* Abono con intereses                                                         */
/* -------------------------------------------------------------------------- */

test("abono con intereses: quitar cuotas cuenta el interés real que se ahorra", () => {
  const r = calcularAbono(
    { capitalPendiente: 15000, cuota: 290, tasa: 6, modoTasa: "tan" },
    3000,
    "reducir_plazo",
  );

  assert.equal(r.capitalDespues, 12000);
  assert.equal(r.cuotasRestantesAntes, 60);
  assert.equal(r.cuotasRestantesDespues, 47);
  assert.equal(r.cuotasAhorradas, 13);
  assert.ok(r.interesAhorradoEstimado > 0, "con intereses el ahorro no es 0");
  // Lo que se ahorra son los intereses de las cuotas del final, que son los
  // más baratos, así que no puede acercarse a cuota x cuotas.
  assert.ok(r.interesAhorradoEstimado < r.cuotasAhorradas * r.cuotaAntes);
});

test("abono con intereses: bajar la cuota mantiene el plazo", () => {
  const r = calcularAbono(
    { capitalPendiente: 15000, cuota: 290, tasa: 6, modoTasa: "tan" },
    3000,
    "reducir_cuota",
  );

  assert.equal(r.capitalDespues, 12000);
  assert.equal(r.cuotaDespues, 232, "12.000 € en 60 cuotas");
  assert.ok(r.cuotaDespues < r.cuotaAntes);
  assert.ok(
    Math.abs(r.cuotasRestantesDespues - r.cuotasRestantesAntes) <= 1,
    `el plazo debe mantenerse (±1 mes): ${r.cuotasRestantesAntes} -> ${r.cuotasRestantesDespues}`,
  );
});

test("abono con intereses: la cuota recalculada termina el préstamo en el plazo que dice", () => {
  const r = calcularAbono(
    { capitalPendiente: 15000, cuota: 290, tasa: 6, modoTasa: "tan" },
    5000,
    "reducir_cuota",
  );

  assert.equal(r.capitalDespues, 10000);
  assert.equal(r.cuotaDespues, 193.33, "10.000 € en 60 cuotas");

  // Lo que se promete en la ficha tiene que ser cierto de verdad: con esa cuota
  // y esos meses, el capital se amortiza por completo.
  const plan = amortizar(r.capitalDespues, r.cuotaDespues, 6, "tan");

  assert.equal(plan.completa, true);
  assert.equal(plan.cuotas, r.cuotasRestantesDespues);
  assert.ok(plan.totalPagado >= r.capitalDespues);
});

/* -------------------------------------------------------------------------- */
/* Abono sin intereses (comportamiento anterior)                               */
/* -------------------------------------------------------------------------- */

test("quitar cuotas: baja el capital y mantiene la cuota", () => {
  const r = calcularAbono(PRESTAMO, 3000, "reducir_plazo");

  assert.equal(r.capitalAntes, 12000);
  assert.equal(r.capitalDespues, 9000);
  assert.equal(r.cuotaDespues, 210, "la cuota no debe cambiar");
  assert.ok(r.cuotasAhorradas > 0, "debe quitarse al menos una cuota");
  assert.ok(r.cuotasRestantesDespues < r.cuotasRestantesAntes);
  assert.equal(r.cuotasRestantesAntes, 58, "ceil(12.000 / 210)");
});

test("quitar cuotas: el resto de cuotas cuadra con el capital que queda", () => {
  const r = calcularAbono(PRESTAMO, 3000, "reducir_plazo");
  assert.equal(r.cuotasRestantesDespues, Math.ceil(r.capitalDespues / r.cuotaDespues));
});

test("bajar cuota: reduce la cuota manteniendo el plazo", () => {
  const r = calcularAbono(PRESTAMO, 3000, "reducir_cuota");

  assert.equal(r.capitalDespues, 9000);
  assert.ok(r.cuotaDespues < r.cuotaAntes, "la cuota debe bajar");
  assert.ok(
    Math.abs(r.cuotasRestantesDespues - r.cuotasRestantesAntes) <= 1,
    "el plazo debe mantenerse (±1 mes por redondeo)",
  );
  assert.ok(
    r.cuotaDespues * r.cuotasRestantesDespues >= r.capitalDespues,
    "cuota x meses debe cubrir el capital pendiente",
  );
});

test("bajar cuota: la cuota sale a céntimos, sin ruido de coma flotante", () => {
  const r = calcularAbono(PRESTAMO, 3000, "reducir_cuota");
  assert.equal(r.cuotaDespues, Math.round(r.cuotaDespues * 100) / 100);
  assert.equal(r.capitalDespues, 9000);
});

test("un abono mayor que el capital pendiente se topa, no rompe", () => {
  const r = calcularAbono(PRESTAMO, 99999, "reducir_plazo");

  assert.equal(r.capitalDespues, 0);
  assert.equal(r.cuotasRestantesDespues, 0);
  assert.equal(r.importe, PRESTAMO.capitalPendiente, "se topa al capital pendiente");
});

test("importe cero o negativo no cambia nada", () => {
  for (const importe of [0, -500]) {
    const r = calcularAbono(PRESTAMO, importe, "reducir_plazo");
    assert.equal(r.capitalDespues, PRESTAMO.capitalPendiente);
  }
});

test("un préstamo ya amortizado no rompe la simulación", () => {
  const r = calcularAbono({ capitalPendiente: 0, cuota: 290 }, 1000, "reducir_plazo");

  assert.equal(r.capitalDespues, 0);
  assert.equal(r.cuotasRestantesDespues, 0);
  assert.equal(r.cuotaDespues, 290);
});

test("un abono pequeño quita la cuota que sobra", () => {
  // 58 x 210 = 12.180 > 12.000: sobra una cuota de golpe.
  const r = calcularAbono(PRESTAMO, 30, "reducir_plazo");

  assert.equal(r.capitalDespues, 11970);
  assert.equal(r.cuotasRestantesAntes, 58);
  assert.equal(r.cuotasRestantesDespues, 57);
  assert.equal(r.cuotasAhorradas, 1);
});

test("cuotaDe devuelve la cuota constante de un préstamo a plazos", () => {
  assert.equal(cuotaDe(12000, 24), 500);
  assert.equal(cuotaDe(0, 24), 0);
  assert.equal(cuotaDe(1000, 0), 0);
});
