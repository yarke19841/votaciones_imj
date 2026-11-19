# Padrón existente común a simulacro y oficial

La responsable confirmó el 19/11/2026 que el padrón electoral anterior es la fuente para simulacros y votación oficial. Se verificaron 243 registros, 232 activos, sin cédulas vacías, inválidas ni duplicados normalizados al comprobar la fuente. Estas cifras corresponden a la revisión; la pantalla consulta los datos vigentes.

`public.member` conserva los registros y estados. Administración puede consultarlos en Habilitados → Padrón electoral existente, buscar personas y exportar habilitados/no habilitados para la elección seleccionada. Los listados territoriales permanecen en su opción separada. No se copian automáticamente las 243 personas ni se crean membresías en Bethel.

Al habilitar expresamente a una persona con su cédula verificada, se reutiliza su identidad electoral canónica o se crea únicamente si aún no existe. La habilitación se registra por elección y sirve tanto para simulacro como para oficial. Cada ronda conserva sus asistencias y participaciones; votar en el simulacro no impide votar una vez en la oficial. No se trasladan votos o asistencias históricos ni se abre una elección por esta integración.

Los enlaces con el padrón se guardan en tabla privada sin acceso directo del cliente. Si cambia la cédula del registro de origen, se conserva el vínculo histórico, se muestra la habilitación anterior y se bloquea reasignarla. Administración puede revocarla conservando sus votos anteriores. Una persona inactiva no se habilita mediante esta pantalla. Todas las operaciones nuevas exigen administrador activo; resultados, Recepción, Nuevo ingreso, líderes y visitantes no reciben permisos de consulta o cambio del padrón maestro mediante estas RPC.

Validación específica: 41 comprobaciones en `npm run test:existing-roster`, incluidas fuente intacta, no habilitación por consulta, repetición sin duplicados, reutilización de identidad, simulacro/oficial con mismo habilitado y asistencias/votos separados, revocación tras cambio de documento y rechazo por rol. Compilación Vite correcta. La preparación y habilitación de la elección real siguen siendo decisiones administrativas explícitas.
