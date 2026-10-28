# Estado de incertidumbre, validación y referencias

## Estado que muestra el producto

Los umbrales y métricas derivados se etiquetan como estimaciones del modelo salvo que el propio test contenga una medición directa. La versión del núcleo fisiológico se guarda junto a la instantánea de resultados, así como los datos por estadio, el protocolo, las medidas antropométricas no identificativas y los ajustes de umbral. La instantánea permite identificar la versión y recuperar los insumos registrados; una reproducción exacta requiere conservar esa versión ejecutable del código.

La sensibilidad a potencia, velocidad y lactato es un análisis de escenarios construido con el error indicado por el usuario. No representa una distribución de error observada y no debe presentarse como intervalo de confianza. Los intervalos de Bland–Altman y las estadísticas test–retest son herramientas de análisis disponibles en `scientificValidation.ts`; todavía no tienen una pantalla de importación de cohortes ni resultados propios del laboratorio.

## Validación pendiente

No hay un conjunto anonimizado de ciclismo o carrera ni mediciones de referencia del carro metabólico o de MLSS medido cargadas en este repositorio. Por tanto, no se han calculado sesgo, límites de acuerdo, repetibilidad, error estándar por métrica ni intervalos de confianza por atleta. El código no debe presentar los rangos de sensibilidad como reemplazo de esos análisis.

Para iniciar una validación se necesitan pares enlazados por un identificador seudónimo, protocolo y fecha; unidad, dispositivo y calibración; predicción congelada con versión del algoritmo; medición de referencia y reglas de aceptación definidas antes del análisis. Bland–Altman requiere una comparación pareada por participante y evaluar el sesgo y límites de acuerdo, no solo correlación. Test–retest debe mantener el mismo atleta y protocolo, con separación temporal registrada. Los conjuntos deben quitar identificadores directos y limitar acceso antes de importarse.

## Referencias poblacionales

Las referencias muestran deporte, sexo, nivel, tamaño de muestra, edad, especialidad, protocolo y tipo de evidencia cuando dichos datos constan en la fuente. Los filtros de edad solo incluyen referencias con un rango de edad publicado explícitamente; una media ± desviación estándar no se convierte en rango de elegibilidad. Las especialidades se registran en las notas como `Especialidad: fondo`, y edad como `Edad: 20-35`, junto con `n=`, el protocolo y la cita. Los datos ausentes se muestran como no informados, no se completan por inferencia.

Una media/rango de estudio describe la muestra publicada; no constituye por sí solo un percentil, intervalo diagnóstico o comparación ajustada por edad. Faltan referencias protocolizadas para VLamax, MLSS, LT1, FatMax, CarbMax, economía, glucógeno y durabilidad, así que el fingerprint deja esas comparaciones como no disponibles cuando no hay una referencia compatible.

## Antropometría

La fracción de masa adiposa calculada con el modelo anatómico Kerr–Ross de cinco componentes se conserva como tal. No se escribe en el campo de porcentaje de grasa corporal del atleta ni se mezcla con referencias de DEXA, bioimpedancia, pesaje hidrostático o ecuaciones de pliegues.

El porcentaje de grasa corporal depende del método. ISAK define técnicas y sitios de medición, pero no basta por sí solo para identificar la ecuación predictiva; la ecuación/modelo y el sitio deben registrarse en las notas. Cuando la fuente no identifica la ecuación, la interfaz lo señala como no informado y mantiene la comparación como contexto descriptivo.
