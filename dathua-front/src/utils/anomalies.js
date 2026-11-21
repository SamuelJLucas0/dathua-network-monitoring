// El motor de IA genera muchas anomalías de score bajo que son ruido normal
// (fluctuaciones menores, nada que valga la pena revisar) — solo interesan
// las que superan este umbral. Centralizado aquí porque antes cada pantalla
// (Resumen, IA Sentinel, detalle de equipo) definía su propio `MIN_SCORE`
// por separado, y el Resumen en particular no lo mandaba al backend — así
// "Anomalías por revisar" en el Resumen podía decir "245" mientras IA
// Sentinel, con el mismo concepto, decía "44": ambas pantallas tenían razón
// con sus propios criterios, pero un dueño de PyME solo ve dos números que
// no cuadran. Ahora las tres pantallas usan el mismo umbral.
export const ANOMALY_MIN_SCORE = 0.7
