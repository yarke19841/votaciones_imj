# SPEC DE REGLAS FUNCIONALES — Votaciones IMJ

**Identificador:** SPEC-FUNC-001  
**Versión:** 1.0 (consolidación inicial)  
**Estado:** Reglas conocidas y pendientes de validación identificadas  
**Proyecto:** votaciones_imj  
**Relacionado:** [SPEC de diseño](./SPEC_DE_DISENO.md)

## 1. Propósito y alcance

Definir el comportamiento funcional del sistema de votaciones de Ministerio Jezreel, tanto en simulacros como en elecciones oficiales. El diseño visual se rige por `SPEC_DE_DISENO.md`; este documento rige procesos, datos, autorizaciones y controles. No sustituye las reglas de seguridad, RLS ni los requisitos legales que deban establecerse.

## 2. Entidades y conceptos

- **Miembro:** persona del padrón, identificada por su ID interno y su cédula normalizada.
- **Territorio:** agrupación de miembros; la carga del padrón debe permitir asociar cada fila al territorio seleccionado.
- **Habilitación electoral:** autorización para participar en la elección de un año, gestionada por personal autorizado.
- **Asistencia electoral (check-in):** constancia de que el miembro llegó a la iglesia y fue registrado para la jornada.
- **Elección:** proceso de votación de un año, con tipo **simulacro** u **oficial**, estado y configuración.
- **Candidato:** persona incluida en una lista electoral, con fotografía y estado de habilitación.
- **Voto:** selección enviada y registrada dentro de la elección correspondiente.
- **Ronda:** fase de votación, incluidas eventuales rondas de desempate.

## 3. Padrón e importación

**RF-001.** El padrón debe permitir importar miembros con **nombre completo y cédula**. El operador selecciona un territorio antes de cargar el archivo; todas las filas válidas de esa carga se asocian a dicho territorio.

**RF-002.** La cédula se normaliza para búsqueda y control de duplicados. La representación visible original puede conservarse.

**RF-003.** Se deben poder exportar listados de miembros **habilitados y no habilitados** para votar.

**RF-004.** La importación no debe crear duplicados involuntarios dentro del mismo ámbito de identidad. Las reglas de identidad y coexistencia entre territorios deben respetar el modelo compartido con el sistema de miembros.

**RF-005.** La pantalla de asistencia rápida **no crea miembros**. La creación/importación se realiza por flujos administrativos separados.

## 4. Habilitación electoral

**RF-006.** Los líderes y pastores autorizados habilitan a los miembros que cumplen los requisitos electorales; la habilitación no equivale a registrar asistencia.

**RF-007.** El padrón de habilitados es compartido entre simulacro y votación oficial **para el mismo año electoral**. No se debe obligar a una segunda habilitación por pasar del simulacro a la elección oficial.

**RF-008.** La habilitación y sus modificaciones deben respetar los permisos por rol y alcance territorial.

**RF-009.** El estado `is_active` del registro de miembro no debe interpretarse automáticamente como habilitación electoral, salvo que el esquema y las reglas de negocio lo definan expresamente. Distinguir ambos conceptos en API, interfaz e indicadores.

## 5. Llegada y asistencia electoral

**RF-010.** Al llegar a la iglesia, el votante ingresa su cédula. El sistema localiza su registro y registra su llegada/asistencia electoral.

**RF-011.** El acceso al voto requiere **ambas condiciones**: habilitación electoral válida y asistencia registrada para la elección/jornada aplicable.

**RF-012.** Si la votación aún no está abierta, el votante habilitado y presente pasa a una pantalla de **espera de apertura**, desde la que puede verificar si ya se abrió.

**RF-013.** Registrar la asistencia debe ser idempotente: una segunda solicitud no crea una asistencia duplicada y debe informar que ya existía.

**RF-014.** La asistencia debe asociarse inequívocamente con la elección y el ámbito temporal/jornada correspondiente. Los filtros de fecha y jornada (práctica/final) se conservan donde existan en la interfaz administrativa.

**RF-015.** La asistencia rápida permite **buscar únicamente por cédula** y marcar asistencia a miembros existentes. No muestra ni ejecuta creación rápida de miembros. Mantiene el diseño de referencia de `AdminCheckIn.jsx`, incluido el selector de elección, fecha, jornada, indicadores y la acción de activar miembro existente, sujeta a permisos.

**RF-016.** Los indicadores deben mostrar el padrón de referencia, asistentes únicos y porcentaje de asistencia. Fórmula: `asistentes únicos elegibles / total del padrón de referencia × 100`. La definición exacta del denominador (habilitados electorales frente a miembros activos) debe resolverse antes de publicar indicadores oficiales.

## 6. Elecciones, estados y apertura

**RF-017.** El sistema soporta elecciones **anuales**, tanto **simulacro** como **oficial**, con datos y resultados separados por año, tipo y ronda.

**RF-018.** **Solo un tipo de votación puede estar abierto a la vez** (simulacro u oficial). La validación debe imponerse en el backend/base de datos, no solo ocultando botones.

**RF-019.** El botón **Cerrar votaciones** cierra la votación que esté activa; no debe cerrar una elección diferente ni reabrir otra implícitamente.

**RF-020.** El simulacro es opcional y no reemplaza la votación oficial.

**RF-021.** El sistema debe distinguir preparación, apertura y cierre. Las transiciones de estado deben ser autorizadas, registradas y validadas en servidor.

## 7. Candidatos y cupos

**RF-022.** La administración permite gestionar candidatos oficiales con **nombre, género, fotografía y estado**, incluida edición y sustitución de foto.

**RF-023.** El catálogo de candidatos/fotografías del simulacro se conserva como referencia reutilizable entre años, sin mezclar votos ni resultados de años diferentes.

**RF-024.** La configuración electoral define cupos por categoría. La referencia visual aprobada muestra **2 mujeres y 3 hombres**; esos valores son **ejemplo de configuración**, no constantes inmutables sin confirmación.

**RF-025.** La interfaz de votación debe mostrar el avance de selección por categoría y evitar superar los cupos configurados.

**RF-026.** Los candidatos inactivos o no habilitados no pueden recibir votos nuevos en una elección donde no estén habilitados.

## 8. Emisión del voto

**RF-027.** Solo puede emitir un voto un miembro habilitado electoralmente, con asistencia válida, cuando la elección correspondiente está abierta.

**RF-028.** La selección se valida en servidor contra candidatos elegibles, cupos, año, tipo, ronda y estado abierto.

**RF-029.** Un votante no puede votar dos veces en la misma elección/ronda. La prevención debe ser transaccional y respaldada por restricciones de datos, no únicamente por el estado de la interfaz.

**RF-030.** Tras registrar el voto, mostrar confirmación y bloquear una nueva emisión en esa elección/ronda.

**RF-031.** El simulacro y la votación oficial mantienen registros independientes. La habilitación compartida no implica que los votos del simulacro se trasladen a la elección oficial.

## 9. Resultados, desempates y exportación

**RF-032.** Los resultados se consultan por **año, tipo y ronda**.

**RF-033.** Los resultados deben mostrar candidatos, conteos y estados derivados de la configuración y reglas de adjudicación, incluyendo empates.

**RF-034.** Si existe empate que afecta el último cupo, se identifica el puesto pendiente y se habilita un flujo de preparación de desempate, sin adjudicar arbitrariamente el cupo.

**RF-035.** La regla previamente definida indica que **los mismos votantes que votaron** deben participar en la ronda de desempate; se debe restringir la elegibilidad de esa ronda al conjunto de votantes de la ronda correspondiente, según la regla definitiva del proceso.

**RF-036.** La exportación de resultados debe incluir agregados por año/tipo/ronda y **no revelar selecciones individuales ni vincular votante con candidato**.

## 10. Seguridad, roles y auditoría

**RF-037.** Las acciones administrativas (habilitar, activar, configurar, abrir, cerrar, gestionar candidatos, exportar) requieren permisos explícitos.

**RF-038.** El control de acceso debe aplicarse en base de datos/API (incluidas políticas RLS cuando corresponda), no solamente en React.

**RF-039.** Registrar auditoría de acciones administrativas relevantes: usuario, operación, entidad, fecha/hora y cambios, sin revelar el contenido del voto individual.

**RF-040.** Proteger el secreto del voto. La información de asistencia y de participación puede usarse para verificar que alguien votó, pero no para reconstruir su selección.

**RF-041.** La solución se integra con el entorno de datos compartidos de Bethel_IMJ según los límites de acceso de cada iglesia. No se debe asumir acceso irrestricto entre iglesias.

## 11. Criterios mínimos de aceptación

- [ ] La carga de nombre+cédula asocia el territorio seleccionado.
- [ ] La búsqueda de asistencia rápida solo acepta cédula y no crea miembros.
- [ ] La asistencia repetida no duplica registros.
- [ ] No puede votar quien no esté habilitado o no haya registrado su llegada.
- [ ] La pantalla de espera se presenta si todavía no se ha abierto la elección.
- [ ] Nunca hay dos elecciones activas simultáneamente.
- [ ] La apertura/cierre se controla desde servidor.
- [ ] No se acepta doble voto en la misma elección/ronda.
- [ ] Los cupos se validan también en servidor.
- [ ] Simulacro y oficial comparten habilitación anual, no votos.
- [ ] Los empates de último cupo se detectan y no se resuelven arbitrariamente.
- [ ] La exportación no revela el voto individual.
- [ ] Los permisos y la auditoría se verifican con pruebas.

## 12. Pendientes de validación antes de implementar como definitivos

1. Definición exacta del **padrón denominador** de participación y de asistentes únicos en el indicador.
2. Política de **activación de miembros** desde Asistencia Rápida y si activar miembro puede o no habilitar electoralmente.
3. Alcance preciso de **asistencia por simulacro/oficial**, fecha y jornada; si se reutiliza entre rondas.
4. Si en una ronda de desempate votan **todos los votantes de la ronda anterior** o únicamente quienes votaron por candidaturas empatadas; la regla conocida exige mantener el mismo universo, pero falta detallar el criterio exacto.
5. Reglas de voto incompleto, abstención, votos nulos, corrección de voto y expiración de sesión.
6. Configuración definitiva de cupos por género/categoría y condiciones de adjudicación.
7. Matriz exacta de roles, permisos, alcance territorial y administración multiiglesia.
8. Estados y nombres exactos de tablas, restricciones y políticas RLS vigentes en el repositorio.

> **Instrucción para agentes:** no convertir pendientes de validación en decisiones de producto implícitas. Confirmar con la responsable antes de modificar reglas electorales sensibles.

## 13. Referencias visuales

- [SPEC de diseño](./SPEC_DE_DISENO.md)
- [Figma — Votaciones IMJ, referencias visuales](https://www.figma.com/design/EbqaWBgNWuUSs2mhloRfh5) (carga de capturas pendiente de confirmación).

**Principio rector:** Un votante habilitado, presente y autorizado puede votar una sola vez por elección/ronda, con secreto del voto y trazabilidad administrativa.
