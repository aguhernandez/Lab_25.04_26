# Auditoría de las seis mejoras metabólicas — 29 de octubre de 2026

Alcance: motor compartido, constructor fisiológico, sensibilidad/referencias, sesiones completas, calidad del protocolo y seguimiento longitudinal. Base revisada: `7c0380f`. Las correcciones cambian el algoritmo a **1.2.0**. Los resultados históricos guardados no se sobrescriben: requieren recálculo para aplicar las correcciones.

## Hallazgos y correcciones

| Área | Problema encontrado | Corrección |
| --- | --- | --- |
| Motor / combustible | El gráfico de demanda aún calculaba grasa/CHO con una relación lineal de RER; FatMax tenía una ecuación duplicada que admitía gases fuera del rango válido. | Demanda, sesiones y FatMax usan `fuelFromGasExchange`. Gases inválidos producen valores no disponibles, sin recortar RER a 0,7–1 ni sustituirlos silenciosamente. Grasa/CHO son fracciones de la energía aeróbica, no del total aeróbico más anaeróbico. |
| Motor / cinética | El RER estimado tenía saltos en 50, 70 y 85 % de VO₂max. La regresión recortaba un intercepto negativo sin volver a ajustar la pendiente. | Curva RER continua; regresión conserva su ajuste. Dentro de etapas se interpola VO₂; fuera se utiliza el ajuste o la curva inferida. Recuperación a carga cero anclada al supuesto de reposo de 3,5 ml/kg/min. |
| Motor / energía glucolítica | El factor `producción × 3` no explicitaba volumen de distribución ni qué equivalente energético estaba usando. | Equivalente ATP de escenario: `producción (mmol/L/min) × distribución (L/kg) × (1,5 ATP/lactato ÷ 5 ATP/O₂) × 22,414 ml/mmol`. **No** es la oxidación completa de lactato (3 O₂/lactato), ni el equivalente empírico del incremento de lactato sanguíneo. Se etiqueta como estimación glucolítica; no incluye fosfocreatina. |
| Ritmos / zonas | Un ritmo de natación sin sufijo podía tratarse como ritmo por km. Con potencia de carrera disponible, el análisis de lactato podía elegir esa potencia como eje. El resultado guardaba el ritmo de la etapa más cercana pese a interpolar velocidad. | El deporte determina la unidad implícita; carrera/natación usan velocidad. El ritmo de LT1/LT2 se convierte desde la velocidad interpolada y alimenta las zonas con esa misma referencia. |
| Objetivos | Una duración prescrita no intervenía en la interpolación. Otra ruta ordenaba los datos por respuesta, uniendo ramas distintas. | Dos modos explícitos: interpolación con duración prescrita, o VO₂ al final con cinética exponencial, τ y VO₂ inicial configurables. Se rechazan objetivos inalcanzables, extrapolaciones, cargas repetidas, mesetas y cruces múltiples (también dentro de un rango). Plantillas antiguas conservan modo de etapas. |
| Sensibilidad / referencias | Solo se aplicaba un desplazamiento de todas las etapas; no se exploraban errores que cambian la forma de la curva. Los rangos podían quedar visibles tras editar entradas. El cálculo estadístico saltaba a z=1,96 con 31 grados de libertad. | Escenarios sistemáticos y una etapa por vez, por entrada. Se limpian los resultados al cambiar datos o supuestos. Valores no finitos/participantes repetidos se rechazan. Se mantiene la distribución t de Student a partir de 31 grados de libertad mediante expansión numérica; se muestran IC del sesgo y de los límites de concordancia. |
| Sesión | Por debajo de la primera etapa se conservaba su VO₂; las cargas se aproximaban a una cuadrícula, especialmente relevante en velocidades bajas. Redondeos internos distorsionaban el estado. | Demanda evaluada en las cargas exactas de los bloques, reposo explícito, estado continuo, punto inicial t=0 e integración analítica de VO₂ por intervalo. Lactato integrado con subpasos de hasta 1 s y retardo sanguíneo exponencial; precisión completa en parámetros internos. Los acumulados quedan no disponibles si falta combustible válido en algún tramo. |
| Carbohidratos | Objetivo inicial de **30 g/min = 1.800 g/h**. El simulador de carrera recomendaba ingerir lo mismo que estimaba oxidar. | Objetivo **30 g/h**, conversión interna `/60`; tablas metabólicas muestran tasas en g/h. Etiquetas separan oxidación e ingesta; la estimación de oxidación no genera una recomendación de ingesta. |
| Calidad del protocolo | Una muestra basal temprana o futura podía satisfacer el recordatorio final. Cuatro filas duplicadas de un estadio podían contar como cuatro muestras. Se sugería otro test de lactato incluso en un protocolo sin tomas previstas. | Solo muestras ya transcurridas, del estadio correcto y próximas al momento previsto (tolerancia anticipada de 30 s). Se cuentan estadios muestreados, no filas. Recomendación adicional solo cuando hay un plan de lactato. Fechas de calibración vacías/inválidas/futuras no eliminan el aviso. |
| Longitudinal | Los datos del par anterior podían mostrarse al cambiar tests. Selecciones iniciales podían quedar vacías tras carga asíncrona. MDC persistía al cambiar de unidad o tests. Solo había LT2 en W. | Datos ligados al par solicitado; selección válida tras carga, control de errores y limpieza de MDC al cambiar el contexto. LT2 se puede comparar en W o velocidad (km/h); se comparan también duraciones personalizadas y se bloquea comparar un test consigo mismo. |

## Fórmulas y límites revisados

- VO₂ final: `V(t)=V0+(Vestable−V0)(1−exp(−t/τ))`. Su inversa calcula el VO₂ estable requerido para alcanzar el objetivo al final; no significa permanecer en el objetivo durante todo el bloque. Las etapas incrementales no demuestran estado estable ni calibran τ.
- VO₂ integrado por intervalo: `Vestable·Δt+(Vinicial−Vestable)·τ·(1−exp(−Δt/τ))`. Conversión a litros: multiplicar por kg y dividir por 1.000 y 60 si el tiempo está en segundos.
- Combustible: grasa `1,695·VO₂−1,701·VCO₂`; CHO `4,585·VCO₂−3,226·VO₂`, gases en L/min y resultados en g/min. Participaciones energéticas con 9 y 4 kcal/g, respectivamente. La estimación durante transiciones utiliza un RER supuesto a partir de etapas, **no** gases dinámicos medidos.
- Repetibilidad: error típico `SD(diferencias)/√2`; MDC95 `1,96·√2·error típico`. Un MDC sin sesgo, modalidad, protocolo y condiciones comparables no demuestra mejora.
- Bland–Altman: sesgo medio y límites `sesgo ± 1,96·SD(diferencias)`; sus intervalos son aproximados y requieren pares independientes, homogeneidad y normalidad razonable de diferencias.

## Verificación

Pruebas de regresión con referencias analíticas independientes: VO₂ final y su integral, gramos acumulados, reposo, continuidad entre bloques, tasas inválidas, igualdad de combustible entre motores, precisión de regresión, objetivos ambiguos/inalcanzables, ritmos de natación/carrera, recordatorios de muestras y estadística. Se mantienen pruebas de zonas de cinco/siete bandas, métodos alternativos y fórmulas anteriores. **118 pruebas en 19 archivos pasaron** con `npm test`; `npm run build` completó correctamente.

Revisión de interfaz local con datos sintéticos: constructor temporal, rechazo de un objetivo de 90 % en un segundo, sensibilidad y limpieza al editar entradas, recuperación pasiva y ambos gráficos con el CSS de producción.

## Límites que no resuelve una corrección de software

El modelo de lactato sigue siendo un escenario de un compartimento, con parámetros parcialmente inferidos. La masa de distribución, producción/oxidación y cinética individual requieren mediciones de referencia. No hay una cohorte externa disponible en este repositorio para establecer exactitud individual ni equivalencia con INSCYD. Las tasas de combustible, el componente lento de VO₂, fosfocreatina, agotamiento de reservas y la cinética individual de recuperación no quedan validados por estas pruebas de software. La sensibilidad muestra escenarios muestreados; no es un intervalo de confianza, no cubre todas las combinaciones de error ni promete límites de peor caso. Las plantillas siguen siendo locales al navegador.

No se cambian tablas, funciones ni políticas de Supabase; no se requiere migración. Se compila y publica el frontend y sus fuentes en GitHub. El despliegue público debe identificar el nuevo build para comprobar que está utilizando esta versión.

## Fuentes consultadas

- [Jeukendrup y Wallis, calorimetría durante ejercicio](https://pubmed.ncbi.nlm.nih.gov/15702454/): ecuaciones y limitaciones por intensidad y bicarbonato.
- [Frayn, oxidación desde intercambio gaseoso](https://pubmed.ncbi.nlm.nih.gov/6618956/): supuestos de calorimetría no proteica.
- [Bland y Altman, concordancia](https://pubmed.ncbi.nlm.nih.gov/2868172/): concordancia no equivale a correlación.
- [Cinética de VO₂, estimación y precisión](https://pubmed.ncbi.nlm.nih.gov/28450551/): necesidad de transiciones y tratamiento de mediciones adecuados.
- [Estudio del equivalente de acumulación de lactato](https://pmc.ncbi.nlm.nih.gov/articles/PMC10847225/): el equivalente de lactato sanguíneo es una aproximación empírica, distinta de convertir producción bruta o combustión completa.
- [Constructor de zonas INSCYD](https://inscyd.com/feature/training-zone-builder) y [funciones](https://inscyd.com/features): referencia de flujo de producto, no especificación de sus algoritmos internos.
