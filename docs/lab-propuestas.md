# Propuestas para el dashboard profesional del Lab

Este documento recoge elementos pedidos que no se pueden presentar fielmente con los campos y flujos locales actuales. No se añadieron cálculos, columnas ni contratos para cubrirlos.

## Revisión y publicación del pasaporte

- No existe una entidad de borrador revisable separada del perfil fisiológico actual.
- El procesamiento de `LabWorkflow` aplica fisiología al perfil y puede actualizar zonas automáticamente. Para que el profesional revise antes de publicar, se necesita definir un flujo de revisión que no actualice el perfil al completar el procesamiento.
- No hay historial de publicaciones del pasaporte con autor, fecha y diferencias. Los snapshots e historiales actuales son de perfiles, zonas y tests; no identifican qué estado se envió al Hub.
- Un flujo robusto de borrador, aprobación, versión publicada y auditoría requiere soporte backend. No simularlo ni persistirlo únicamente en el navegador.

## Métricas o referencias no disponibles de forma consistente

- Confianza multi-módulo unificada basada en dispositivo, completitud de protocolo, faltantes y concordancia entre métodos; definir criterios por módulo y método antes de clasificarla.
- Concordancia entre métodos para asignar confianza fisiológica: el resultado guarda LT/VT y calidad general, pero no persiste una evaluación de concordancia común a todos los módulos. La UI puede explicar la calidad guardada y los faltantes observables; una puntuación cruzada requeriría definir criterios clínicos/de producto.
- Previsualización numérica exacta de las siete zonas que enviará Hub: el contrato actual las arma dentro de la Edge Function. El modal informa las entradas y tipos de zona que se enviarán, pero no replica ese cálculo en el cliente.
- Lactato: valores paralelos por Dmax, 4 mmol y baseline+1. En la fase actual se presenta la curva disponible, LT1/LT2 vigentes y FC/RPE asociados si tienen valor.
- Calor y altitud: SpO₂, sodio de sudor, duración/días de aclimatación y medida explícita de decaimiento, donde no exista campo con valor.
- Fuerza y potencia: asimetrías izquierda/derecha en %, RSI, RFD, estimación de 1RM y benchmarks específicos por deporte.
- Bioquímica: rangos de referencia específicos para atletas junto con el rango clínico y fecha/hora de toma separadas.
- ISAK: referencias por deporte cuando no haya una población de referencia seleccionada y compatible con los datos de la medición.

## Operación del inicio

- La vista del profesional muestra estados derivados de tests existentes, fecha/antigüedad y vínculo local con Hub. Para que el estado de vínculo sea confiable en cada consulta, la lista debe exponer `hub_user_id` o permitir consultarlo desde la tabla local de atletas; no inferir vínculo solo desde que el atleta aparezca en una respuesta del RPC.
- El umbral de antigüedad de 60 días conserva el corte que ya utilizaba el dashboard. Si el equipo quiere otro criterio, debe definirlo como regla de producto.

## Deuda de publicación del pasaporte del atleta — prioridad alta

**Condición explícita: antes de abrir el Lab a otros profesionales o atletas externos.** Esta fase cambia solo la presentación y mantiene las consultas y permisos existentes. El inicio puede tomar el perfil fisiológico actual, pero hoy no existe una señal fiable de que ese snapshot haya sido aprobado por un profesional; el procesamiento puede actualizarlo automáticamente. No se puede garantizar desde la interfaz que el atleta vea exclusivamente datos revisados.

La propuesta mínima de backend es:

1. Añadir `tests.published_at` como marca de publicación al atleta.
2. Ajustar RLS para que el atleta solo pueda leer tests y resultados cuyo `published_at` no sea nulo, manteniendo el acceso profesional actual.
3. Añadir al flujo profesional el botón **“Publicar al atleta”**, que fija la publicación del test revisado.

No se implementa en esta fase: el usuario pidió conservar quién puede ver qué y no tocar backend, RLS ni migraciones.

## Campos atleta que no están en las consultas actuales

- El perfil fisiológico que consulta hoy el dashboard contiene cinco zonas, generadas como `physiology_zones`; no se consulta `athlete_training_zones`, donde se mantiene el modelo de siete zonas. Se muestran todas las zonas existentes en el perfil cargado y no se fabrican las faltantes. Para mostrar siete zonas en el pasaporte hace falta permitir la lectura de esa fuente existente.
- Las consultas de antropometría del dashboard/historial no incluyen suma de seis pliegues, ratio músculo-óseo ni perímetros. Solo se presentan masa muscular y masa ósea que sí llegan en el perfil. No se añadió comparativa antropométrica ni se derivó un ratio.
- El pasaporte cargado no incluye ritmo ni potencia LT1/LT2. Solo se presentan FC cuando existe; no se transforma velocidad/potencia a partir de otros campos.
- El panel de bioquímica disponible en esta fase muestra primero el semáforo y oculta los valores en el detalle expandible de la vista existente. No se incorporó a la home una consulta nueva de paneles o marcadores.
