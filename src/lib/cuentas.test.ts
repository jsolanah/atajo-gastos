import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarCuenta } from "./cuentas";
import type { Cuenta } from "./types";

// Bancos y saldos inventados a propósito: estos tests se publican y los datos
// de la app son personales. La estructura es lo que importa (una entidad con
// varias cuentas, un nombre que empieza como la entidad, etc.), no los valores.
const CUENTAS: Cuenta[] = [
  { id: "u1", nombre: "Banco Aurora", entidad: "Banco Aurora", tipo: "corriente", saldo_inicial: 1000, fecha_saldo: "2026-01-31", color: "#2563eb", orden: 1, activa: true },
  { id: "u2", nombre: "Banco Aurora · Hucha ahorro", entidad: "Banco Aurora", tipo: "ahorro", saldo_inicial: 500, fecha_saldo: "2026-01-31", color: "#1d4ed8", orden: 2, activa: true },
  { id: "r1", nombre: "Caja Áfora", entidad: "Caja Áfora", tipo: "corriente", saldo_inicial: 250, fecha_saldo: "2026-01-31", color: "#16a34a", orden: 3, activa: true },
  { id: "t1", nombre: "Faro · Cuenta remunerada", entidad: "Faro Valores", tipo: "ahorro", saldo_inicial: 750, fecha_saldo: "2026-01-31", color: "#7c3aed", orden: 4, activa: true },
  { id: "t2", nombre: "Faro · Cartera inversión", entidad: "Faro Valores", tipo: "inversion", saldo_inicial: 1200, fecha_saldo: "2026-01-31", color: "#a855f7", orden: 5, activa: true },
];

test('"Banco Aurora" elige la cuenta corriente, no se ambigua con la hucha', () => {
  // Regresión: antes nombre y entidad se filtraban juntos, "Banco Aurora" coincidía
  // con las dos cuentas de ese banco y el atajo de iOS no podía elegirla.
  const r = buscarCuenta(CUENTAS, "Banco Aurora");

  assert.equal(r.ok, true);
  assert.equal(r.ok && r.cuenta.id, "u1");
  assert.equal(r.ok && r.cuenta.nombre, "Banco Aurora");
});

test("el nombre gana siempre sobre la entidad, aunque haya varias", () => {
  // "Faro · Cartera inversión" empieza por "Faro" como la entidad, pero el
  // nombre completo debe resolverse sin ambigüedad.
  const r = buscarCuenta(CUENTAS, "Faro · Cartera inversión");

  assert.equal(r.ok, true);
  assert.equal(r.ok && r.cuenta.id, "t2");
});

test("busca por entidad cuando el nombre no coincide", () => {
  const r = buscarCuenta(CUENTAS, "Caja Áfora");

  assert.equal(r.ok, true);
  assert.equal(r.ok && r.cuenta.id, "r1");
});

test("ignora mayúsculas, tildes y espacios sobrantes", () => {
  for (const valor of ["caja afora", "CAJA ÁFORA", "  Caja Áfora  "]) {
    const r = buscarCuenta(CUENTAS, valor);
    assert.equal(r.ok, true, `falló con "${valor}"`);
    assert.equal(r.ok && r.cuenta.id, "r1", `falló con "${valor}"`);
  }
});

test("la entidad ambigua pide concretar y lista solo esas cuentas", () => {
  const r = buscarCuenta(CUENTAS, "Faro Valores");

  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.candidatas.length, 2);
  assert.equal(r.ok === false && r.candidatas.includes("Faro · Cuenta remunerada"), true);
  assert.match(r.ok === false ? r.error : "", /varias cuentas/i);
});

test("una cuenta desconocida lista todas las candidatas", () => {
  const r = buscarCuenta(CUENTAS, "Banco Neptuno");

  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.candidatas.length, 5);
  assert.match(r.ok === false ? r.error : "", /desconocida/i);
});

test("sin cuenta indica que falta, con la lista de disponibles", () => {
  const r = buscarCuenta(CUENTAS, "   ");

  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : "", /falta indicar/i);
  assert.equal(r.ok === false && r.candidatas.length, 5);
});

test("un UUID resuelve siempre, aunque no se parezca al nombre", () => {
  const r = buscarCuenta(CUENTAS, "r1");

  assert.equal(r.ok, true);
  assert.equal(r.ok && r.cuenta.nombre, "Caja Áfora");
});

test("el separador · del nombre no se ignora: falla con la lista de ayuda", () => {
  const r = buscarCuenta(CUENTAS, "Banco Aurora Hucha Ahorro");

  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : "", /desconocida/i);
});
