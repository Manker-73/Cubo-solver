// @ts-check
/**
 * Calidad de los scrambles prácticos (sesión «longitud del scramble práctico», 26/11/2026), medida
 * fuera de la app: 200 scrambles por longitud (semilla 77), distancia de la forma al resuelto de cada
 * uno frente a la distribución EXACTA de las geometrías (BFS completo en C; ver DECISIONES.md).
 *   mezcla = 1 − TV (en %; con 200 muestras el ruido de la TV es ~0,1: el mezclado no llega al 100 %)
 *   distanciaMedia / distanciaExacta, hasta10 / hasta10Exacta = % de formas a distancia ≤ 10
 * Medidas: 5x5 de 16 barras (80.452.680 geometrías, diámetro 31) y 2x4x4 sobre el 4x4 (807.003, diámetro 11).
 * Clave: `${N}:${claveBloqueos(bloques)}`. Las configuraciones que no están aquí no muestran la calidad.
 * @type {Record<string, Record<string, { mezcla: number, distanciaMedia: number, distanciaExacta: number, hasta10: number, hasta10Exacta: number, muestras: number }>>}
 */
export const CALIDAD_PRACTICO = {
  "5:B.B12.B32.DB-B11.B21.B31.DB3-B13.B23.B33.DB1-BL.BL1.BL3.DBL-BR.BR1.BR3.DBR-DF.F.F12.F32-DF1.F11.F21.F31-DF3.F13.F23.F33-DFL.FL.FL1.FL3-DFR.FR.FR1.FR3-DL.L.L12.L32-DL1.L11.L21.L31-DL3.L13.L23.L33-DR.R.R12.R32-DR1.R13.R23.R33-DR3.R11.R21.R31": {
    "30": {
      mezcla: 24,
      distanciaMedia: 8.03,
      distanciaExacta: 14.49,
      hasta10: 86,
      hasta10Exacta: 10.5,
      muestras: 200
    },
    "60": {
      mezcla: 36,
      distanciaMedia: 9.38,
      distanciaExacta: 14.49,
      hasta10: 69.5,
      hasta10Exacta: 10.5,
      muestras: 200
    },
    "100": {
      mezcla: 46,
      distanciaMedia: 10.21,
      distanciaExacta: 14.49,
      hasta10: 58,
      hasta10Exacta: 10.5,
      muestras: 200
    },
    mezclado: {
      mezcla: 90,
      distanciaMedia: 14.46,
      distanciaExacta: 14.49,
      hasta10: 12.5,
      hasta10Exacta: 10.5,
      muestras: 200
    }
  },
  "4:B11.UB2-B12.UB1-B21.DB2-B22.DB1-BL1.DBL-BL2.UBL-BR1.DBR-BR2.UBR-DF1.F21-DF2.F22-DFL.FL1-DFR.FR1-DL1.L21-DL2.L22-DR1.R22-DR2.R21-F11.UF1-F12.UF2-FL2.UFL-FR2.UFR-L11.UL1-L12.UL2-R11.UR2-R12.UR1": {
    "30": {
      mezcla: 86,
      distanciaMedia: 7.81,
      distanciaExacta: 8.08,
      hasta10: 100,
      hasta10Exacta: 100,
      muestras: 200
    },
    "40": {
      mezcla: 90,
      distanciaMedia: 7.9,
      distanciaExacta: 8.08,
      hasta10: 100,
      hasta10Exacta: 100,
      muestras: 200
    },
    "100": {
      mezcla: 93,
      distanciaMedia: 7.97,
      distanciaExacta: 8.08,
      hasta10: 100,
      hasta10Exacta: 100,
      muestras: 200
    },
    mezclado: {
      mezcla: 96,
      distanciaMedia: 8.04,
      distanciaExacta: 8.08,
      hasta10: 100,
      hasta10Exacta: 100,
      muestras: 200
    }
  }
};
