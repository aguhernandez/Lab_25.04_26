# Auditoría de fórmulas LAB — 28/10/2026

Base revisada: commit local f538cf4, indicado en el contexto de continuidad. Auditoría estática dirigida del núcleo de lactato, VLamax, economía, simulación fisiológica, sustratos y estadísticas de validación. No constituye validación experimental, revisión visual completa ni auditoría exhaustiva de los doce bloques.

## Correcciones aplicadas

1. **Economía del simulador.** Con reducción fraccional del coste c, la carga equivalente es carga / (1 − c). Antes se multiplicaba por (1 + c). Para 300 W y una reducción del coste del 10 %, pasa de 330 a 333,33 W. Se conserva su carácter de escenario de sensibilidad, no predicción validada. Se rechazan entradas no finitas y volúmenes de distribución inválidos.
2. **MLSS medido.** Se admite incremento ≤ límite entre minutos 10 y 30 (por defecto 1 mmol/L). Antes se exigía < límite. La clasificación usa valores sin redondear; el redondeo queda para presentación. Se tolera solamente el error de representación de coma flotante. Se conserva la necesidad de prueba superior inestable para confirmar la mayor carga estable.
3. **Unidades de velocidad.** `1:30/100 m` equivale a 4 km/h; antes el parser compartido devolvía 1 km/h. Se admiten segundos decimales y se rechazan ritmos mal formados o unidades desconocidas, evitando interpretarlos como velocidades numéricas.
4. **Umbrales fuera de rango.** Si el test empieza por encima de la concentración objetivo, ya no se atribuye esa concentración al primer estadio. Se devuelve ausencia de umbral; no existe un cruce observado que permita interpolar.
5. **Combustible por gases en lactateAnalysis.** Se excluyen RER fuera de 0,70–1,00 y entradas no finitas. La oxidación sigue siendo una estimación desde gases medidos, no una medición directa de grasa o carbohidratos. Esta protección no sustituye confirmar estado estable y calibración ni modifica todas las rutas históricas de cálculo de combustible.
6. **Trazabilidad.** En la primera revisión, versión incrementada de 1.0.0 a 1.0.1; la ampliación de zonas posterior utiliza 1.1.0. No se reescriben las instantáneas históricas.

## Limitaciones relevantes para acercarse a INSCYD

- **Dinámica de lactato calibrada con LT2:** el exponente de producción se ajusta para acercar producción y oxidación en LT2. Un equilibrio próximo a LT2 no constituye una validación independiente del MLSS. La forma gaussiana de capacidad oxidativa, sus coeficientes y los rangos de estabilidad necesitan validación con datos reales.
- **IAT simplificado:** la opción denominada IAT usa baseline + incremento configurable. No reproduce por sí sola un protocolo completo de umbral anaeróbico individual con cinética de recuperación. Debe explicitarse el método o implementarse el protocolo elegido antes de afirmar equivalencia con IAT publicado.
- **Dmax discreto:** la selección se hace sobre puntos suavizados por regresión isotónica, no sobre una curva continua ajustada según un protocolo Dmax específico. Su resolución depende de los estadios.
- **Balance energético:** la demanda usa regresión; VO₂/RER se interpolan y fuera de los datos se mantienen los extremos. La cinética devuelve una tasa al final del esfuerzo, no el déficit de O₂ integrado de todo el esfuerzo. El factor empírico de lactato a equivalente de O₂ no valida el uso de producción bruta modelada como energía glucolítica. No debe interpretarse como partición energética medida.
- **VLamax:** la corrección por aclaramiento es una sensibilidad de un compartimento; las muestras sanguíneas no separan aparición y eliminación. El intervalo propagado incluye error instrumental/temporal supuesto, pero no toda la incertidumbre estructural ni una validación contra INSCYD.
- **Prescripción y combustible:** medir VO₂ y VCO₂ no garantiza estado estable. Faltan criterios comunes entre las distintas rutas de combustible y confirmación experimental de las zonas.
- **Validación externa:** el repositorio documenta que todavía faltan cohortes de referencia y resultados propios de acuerdo/repetibilidad. La existencia de funciones Bland–Altman y test–retest no prueba validez del motor.

Estas limitaciones requieren definir protocolos y obtener datos; no se sustituyen con coeficientes nuevos sin evidencia.

## Verificación

- Cinco pruebas de simulación fisiológica: aprobadas.
- Cinco pruebas de dinámica de lactato y MLSS: aprobadas.
- Cinco casos nuevos de regresión de unidades, rango de umbral y gases: aprobados.
- Cinco comprobaciones dirigidas de compatibilidad en lactateAnalysis: aprobadas.
- Build de producción y revisión de espacios del diff: verificados al cierre.
- Sin cambios de esquema ni migraciones de Supabase. Incluida en la publicación posterior de zonas de entrenamiento; consultar docs/training-zones-audit-2026-10-28.md.

## Referencias consultadas

- Heck y colaboradores, origen y definición de MLSS: https://pmc.ncbi.nlm.nih.gov/articles/PMC10840223/
- Beneke, metodología de MLSS (2003): https://pubmed.ncbi.nlm.nih.gov/12627312/
- Frayn, supuestos de cálculo de oxidación desde intercambio gaseoso (1983): https://pubmed.ncbi.nlm.nih.gov/6618956/
- di Prampero y Ferretti, equivalente energético empírico del lactato: https://hdl.handle.net/11379/540541
