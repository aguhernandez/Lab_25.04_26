# Zonas de entrenamiento — auditoría y métodos, 28/10/2026

## Errores corregidos

- Z6 podía comenzar por encima de FCmáx. Z6/Z7 fisiológicas ya no reciben una FC numérica: no discrimina esfuerzos cortos.
- Las zonas de ritmo Z6/Z7 se solapaban; ahora comparten una única frontera de velocidad, con límites continuos `(inferior, superior]`.
- La conversión fisiológica 7→5 perdía extremos de ritmo. Agrupación correcta: [1], [2,3], [4], [5], [6,7]. Se conserva la unión de cada grupo.
- Los límites de potencia se tomaban del siguiente estadio por FC. Ahora se priorizan cargas LT1/LT2 calculadas; cuando faltan, solo se interpola dentro de los datos observados.
- Se evitó reparar límites invertidos intercambiándolos: referencias inconsistentes se rechazan. Límites bpm/W se expresan como enteros contiguos; el rango superior de potencia queda abierto.
- El parser compartido interpreta ritmo natación sin absorber los dígitos del sufijo `/100m`. La conversión a ritmo redondea segundos totales, evitando valores `4:60`.
- La interfaz y el PDF ya no expanden zonas manuales de 5 a 7 copiando filas. Las fórmulas de autores mantienen su número nativo de zonas.
- El guardado mantiene independientes FC, potencia y ritmo. Crea el primer registro si no existía, respeta bloqueo a laboratorio y comprueba que la escritura devuelva la fila esperada.

## Métodos disponibles

| Método | Métrica | Zonas | Referencia |
|---|---|---|---|
| Asciende fisiológico | FC / potencia / ritmo | 5 o 7 | LT1, LT2, PAM/VAM |
| Joe Friel carrera | FC | 7 (1–4, 5a, 5b, 5c) | LTHR de carrera |
| Joe Friel ciclismo | FC | 7 (1–4, 5a, 5b, 5c) | LTHR de ciclismo |
| Andy Coggan FC | FC | 5 | LTHR |
| Andy Coggan potencia | Potencia ciclismo | 7 niveles | FTP; sprint descriptivo sin porcentaje |
| %FCmáx | FC | 5 | FCmáx |
| Karvonen, bandas Asciende | FC | 5 | FCmáx y FCreposo |
| Asciende %velocidad de umbral | Ritmo carrera/natación | 5 | Velocidad de umbral en km/h |
| MyProCoach potencia carrera | Potencia carrera | 5 | Potencia de umbral |

Las opciones se filtran por deporte. Triatlón ofrece los métodos FC/potencia de ciclismo y FC de carrera para seleccionar la disciplina adecuada; los ritmos se ofrecen en evaluaciones de carrera o natación, evitando inferir la disciplina de un test combinado.

## Convenciones y límites científicos

- LT2, FTP, LTHR de campo y MLSS son referencias distintas. La propuesta principal LT1/LT2 se genera automáticamente. Las alternativas pueden precargarse desde LT2 como aproximaciones explícitas de FTP/LTHR, con esa procedencia visible y guardada; el usuario puede sustituir la referencia por una medición de campo. No se afirma equivalencia entre ambas referencias.
- Los porcentajes publicados redondeados se implementan con límites bpm/W enteros contiguos; no se dejan huecos por redondeo de porcentajes. Se muestran las fórmulas exactas utilizadas.
- En Coggan se usa la tabla original de niveles con techos 55/75/90/105/120% FTP. El calculador automático de TrainingPeaks usa seis zonas numéricas: el séptimo nivel neuromuscular no tiene frontera fija de %FTP. Aquí Z7 aparece descriptiva; no se inventa 150% FTP ni se pretende clasificar sprints por potencia solamente.
- Las subdivisiones fisiológicas de Asciende (85/92,5% LT1 y 115% PAM/VAM) son convenciones de prescripción, no umbrales metabólicos adicionales medidos. Si falta PAM/VAM válido por encima de LT2 se usa un proxy explícito (1,3×potencia LT2 / 1,2×velocidad LT2) registrado en los metadatos.
- Las cinco bandas por reserva cardíaca usan la ecuación de Karvonen; su partición en cinco no se presenta como el calculador Karvonen de TrainingPeaks.
- El método de ritmo Asciende usa porcentajes de velocidad, convirtiendo después a tiempo/distancia. No se atribuye a Friel una tabla de ritmos con fronteras modificadas.
- RPE solo aparece cuando el método lo define en este producto; no se derivan FC, potencia o ritmo equivalentes en métodos de una sola métrica.
- La prescripción de zonas sigue siendo estimada. No valida equivalencia con INSCYD ni sustituye pruebas de tolerancia individual.

## Guardado, informes y publicación

Cada zona conserva método, versión, referencia, fórmula, fuente, FCmáx/FCreposo cuando proceda y marca de edición manual. Se utiliza el JSON existente de las zonas y su historial, sin migración de Supabase. El PDF conserva la cantidad nativa y referencia elegida. Los históricos no se recalculan en la base de datos.

Versión del núcleo fisiológico: **1.1.0**. Se incluyen las correcciones de la primera auditoría (economía, MLSS, unidades, umbrales y sustratos).

Se detectó que el `dist` previo contenía una excepción incondicional por ausencia de configuración Supabase. El build ahora falla si faltan URL/clave pública de Lab; `.env.example` documenta las variables. La configuración local `.env` está excluida de Git. El build publicado solo incorpora las claves públicas de cliente de los proyectos existentes, nunca claves de servidor.

## Verificación

- 5 pruebas de límites y conversión 5/7 fisiológicas.
- 5 pruebas de métodos de autor, reserva cardíaca, ritmo, deporte y entradas inválidas.
- 5 pruebas de guardado con respuestas Supabase simuladas (primer registro, preservación por métrica, bloqueo, fila ausente y error). No se modifican registros reales para probar.
- Comprobación de interfaz en una vista aislada con datos ficticios: 7 zonas, cambio a 5, Coggan potencia, Friel ciclismo y aplicación local. No es una sesión de atleta real.
- Compilación TypeScript y build de producción; revisión de espacios del diff. Comprobación negativa: un build sin URL/clave pública falla antes de producir un paquete inválido.

## Referencias

- Joe Friel, FC por deporte: https://www.trainingpeaks.com/learn/articles/joe-friel-s-quick-guide-to-setting-zones/
- Andrew Coggan, niveles por potencia y FC: https://www.trainingpeaks.com/blog/power-training-levels/
- Calculadores TrainingPeaks, número nativo de zonas y potencia de carrera: https://help.trainingpeaks.com/hc/en-us/articles/360017420092-Zones-Calculator-Overview


## Flujo automático posterior al test

Las zonas fisiológicas de 5 y 7 se calculan al procesar la medición; no requieren VO₂ si existen lactato, FC y cargas válidos. El selector de métodos ya no obliga a reescribir referencias disponibles: precarga FCmáx, FC/potencia LT2 o velocidad del ritmo LT2. Las alternativas FTP/LTHR usan LT2 solo como proxy declarado; quedan registrados origen y condición de aproximación, también en PDF. Los cambios manuales y el guardado de una prescripción alternativa son opcionales. Karvonen requiere además FC de reposo real; no se inventa ese dato.

Cinco pruebas dirigidas adicionales verifican el cálculo 5/7 sin VO₂, las referencias de FC/potencia, los ritmos de carrera/natación y el rechazo de datos ausentes o incompatibles. Núcleo: 1.1.1.
