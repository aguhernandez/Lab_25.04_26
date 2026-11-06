# Auditoría del flujo LAB — 6 de noviembre de 2026

## Problemas comprobados y correcciones

- Había dos importadores en la fase de mediciones. El nuevo archivo respiratorio no alimentaba la misma ruta de datos que el importador de series. Se conserva un único importador multimarcas con mapeo de columnas, elección de hoja/fila de encabezado y unidades de tiempo y gases. Admite CSV, XLS, XLSX y XLSM. La misma serie genera los estadios y el archivo respiratorio usados en cálculo y validación.
- La detección de L/min también coincidía con ml/min y podía multiplicar por mil un valor ya expresado en ml/min. Se corrigió y se cubrió con pruebas de unidades. HRV ya no se identifica como frecuencia cardíaca.
- El guardado del test solo avanza después de comprobar las escrituras de estadios y el cierre. Una escritura fallida muestra error y no permite avanzar. Las series se guardan por lotes y se recuperan con paginación.
- Los gráficos por carga conectaban puntos cronológicos de recuperación con el trabajo incremental. Se separa la rama incremental, se ordena por carga y se usan segmentos lineales para evitar trayectorias artificiales. La vista por estadio conserva la secuencia completa.
- La deriva cardíaca requiere un protocolo explícito de carga constante, al menos veinte minutos, datos válidos y carga estable dentro del 3 %. Un resultado histórico incremental no muestra deriva aunque el antiguo snapshot la contenga. Esto no altera los registros originales.
- El perfil elegía el último test sin comprobar su modalidad. VO₂ y lactato seleccionan evaluaciones con las mediciones correspondientes. Se muestran evolución de VO₂ medido, umbrales en carga y pulso, comparación de curvas de lactato y acceso a cada test. Se comparan deportes por separado; los huecos no se sustituyen por cero. Los tests sin snapshot se calculan desde sus muestras. ISAK abre el resultado existente en vez de iniciar otra medición.
- Se restauran gases desde la serie canónica al reabrir el resultado y se evita perder un pico respiratorio al recalcular una serie sin pulso. No se copian automáticamente las zonas actuales del atleta sobre resultados históricos.
- Se corrigió un error de sintaxis en el cambio reciente de SSO que impedía compilar el código de main.

## Comprobación

129 pruebas aprobadas en 21 archivos, incluidas pruebas del componente real de importación/cierre, fallo de persistencia y elección del test por modalidad. Compilación de producción con TypeScript y Vite. Revisión de datos y esquema de Supabase en modo lectura: los tests históricos pueden tener muestras sin snapshot; no se ejecutaron migraciones ni se modificaron mediciones reales.

La herramienta de navegador no tenía superficies disponibles en esta sesión: no se pudo realizar una comprobación visual interactiva. Las pruebas de componentes verifican el flujo y los datos, pero no sustituyen una inspección del trazado de píxeles en el navegador.

## Límites explícitos

El mapeo multimarcas trabaja con archivos tabulares; un formato propietario necesita exportación CSV/Excel. La tabla heredada de estadios exige pulso: los gases sin pulso se conservan en la serie y permiten obtener VO₂, sin inventar frecuencia cardíaca ni zonas. No se considera suficiente un dato aislado de VO₂ para validar VO₂max o prescribir umbrales. La evolución gráfica no certifica una mejora: deben revisarse protocolo, condiciones y método. Los resultados históricos guardados no se sobrescriben: para actualizar fórmulas se utiliza Recalcular y se revisa antes de guardar.
