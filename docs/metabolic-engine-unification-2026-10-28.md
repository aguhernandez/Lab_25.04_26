# Unificación del cálculo de combustible

Resultados por etapa, perfil de combustible del análisis de lactato, gráficos y PDF usan ahora una única función de oxidación no proteica basada en VO₂ y VCO₂. El simulador de carrera utiliza la misma función, con RER estimado a partir de la intensidad porque no dispone de gases medidos durante la carrera.

**Prioridad de datos:** VO₂/VCO₂ medidos y RER entre 0,70 y 1,00; si falta VCO₂, RER estimado desde %VO₂máx; si el VCO₂ medido da un RER fuera de rango, combustible no disponible. Nunca se sustituye un gas medido inválido por una estimación silenciosa. Las zonas siguen derivándose de LT1/LT2 del análisis del test y conservan sus métodos alternativos.

**Alcance:** esta consolidación elimina fórmulas divergentes de combustible entre vistas. El simulador de carrera mantiene su propio modelo empírico de acumulación de lactato y pulso; no debe interpretarse como una predicción calibrada de lactato del test. Las simulaciones de dinámica de lactato usan el modelo de un compartimento documentado por separado. Unificar estas predicciones con datos individuales requiere calibración y validación externa, no solo compartir código.

Pruebas: cinco casos cruzan análisis, resultados y datos de gráficos/PDF; cinco regresiones de fórmulas previas; compilación de producción.
