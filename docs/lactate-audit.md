# Auditoría del módulo de lactato y hoja de ruta metabólica

## Hallazgos corregidos en esta iteración

- La gráfica mostraba líneas fijas en 2 y 4 mmol/L aunque LT1 y LT2 se calculaban con métodos individuales. Ahora usa los puntos medidos, una curva continua y marcadores en la carga calculada para cada umbral.
- Los ritmos con formato `5:00/km` se interpretaban como 5 km/h. El parser ahora convierte el ritmo a velocidad real (`12 km/h`).
- LT1 y OBLA/LT2 devolvían el estadio anterior al cruce. Ahora interpolan linealmente entre los dos estadios adyacentes y conservan la carga, FC y VO₂ interpolados.
- Dmax usaba FC como eje X. La FC es una respuesta fisiológica y puede derivar; Dmax ahora prioriza potencia, después velocidad/ritmo y finalmente el número de estadio.

## Riesgos que deben resolverse antes de presentar resultados como clínicos

1. **Protocolo y calidad de muestra**: el motor acepta cualquier secuencia de lactato. Hay que validar unidades (mmol/L), orden de estadios, incrementos de carga, duración mínima, tiempo desde el final del estadio hasta la punción y valores imposibles.
2. **Método de umbral configurable**: Dmax, OBLA 4 mmol/L, baseline + 0.5 e IAT no son equivalentes. El informe debe mostrar el método usado y permitir elegirlo por protocolo.
3. **Curva monotónica**: lactato puede tener ruido. Hay que mostrar mediciones crudas y, opcionalmente, una curva suavizada/monótona separada. Nunca ocultar las muestras originales.
4. **Estimación vs medición**: si no hay lactato directo, LT1/LT2 no deben describirse como medidos. La interfaz ya tiene confianza, pero debe aparecer junto a cada valor y en el PDF.
5. **Combustible**: el perfil de grasa/CHO actual es estimado desde VO₂/intensidad cuando no existe RER. Para acercarse a INSCYD se necesitan VO₂, VCO₂/RER, peso y protocolo válidos, con un aviso claro cuando falten.
6. **Repetibilidad**: faltan controles de calidad entre tests (mismo protocolo, temperatura, ayuno, hora, analizador y operador) y comparación de error mínimo detectable.

## Próxima fase recomendada

1. Crear un panel de calidad del test: número de muestras, rango de carga, monotonicidad, duplicados, valores fuera de rango y confianza de LT1/LT2.
2. Añadir selector de método de umbral y guardar método/parámetros en `test_results` y en el JSON/PDF.
3. Rediseñar el informe principal como un perfil de 4 bloques: capacidad aeróbica, umbrales, utilización de combustible y prescripción de zonas.
4. Añadir comparación longitudinal por carga normalizada (W/kg o velocidad) con cambio de LT1, LT2, VO₂max, FatMax y economía.
5. Validar el motor con datasets sintéticos y casos reales anonimizados antes de usarlo para decisiones clínicas o de entrenamiento de alto impacto.

La aplicación puede inspirarse en el flujo de INSCYD, pero sus resultados deben presentarse como análisis fisiológico dependiente del protocolo y de la calidad de los datos, no como equivalencia automática con ese software.
