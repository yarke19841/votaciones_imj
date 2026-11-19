# Entrega de quórum y Recepción · 8 de noviembre de 2026

Quórum exclusivo de Administración, porcentaje por elección y conteo de habilitados presentes / habilitados totales antes de abrir. Actualización cada cinco segundos, sin apertura automática ni duplicados. Sin porcentaje elegido no se presume un mínimo.

Recepción es el permiso de registro por elección/fecha existente, ampliado para buscar y registrar llegadas de personas existentes, además de crear/habilitar personas nuevas. Respeta denegaciones/revocaciones, ubicación y radio fijos, auditoría y voto secreto. No concede permisos administrativos. No se asignó una cuenta real ni se modificó el acceso privado del alojamiento.

## Evidencia

- `npm run test:all`: 195 comprobaciones locales aprobadas: 9 JS, 73 SQL, 36 registro, 20 importación, 24 iglesia/asistencia rápida y 33 quórum/Recepción.
- `npm run build`: Vite correcto. El comando normal de desarrollo conserva Vite; las credenciales y adaptadores de la prueba no forman parte del paquete de producción.
- Migración aditiva `20261108134442_quorum_reception_permissions.sql` aplicada a preproducción y producción. Funciones con `search_path` vacío y sin ejecución anónima; tablas electorales sin acceso directo de anon/authenticated. La consulta de personal elimina el campo de quórum administrativo.
- Preproducción: nueve comprobaciones transaccionales aprobadas (`tests/quorum-reception-rollback.sql`), todas revertidas. La jornada QA preexistente se cerró solo dentro de la transacción y se restauró con ROLLBACK. No se cambiaron perfiles, contraseñas o cuentas.
- Navegador: interfaz React real sobre PGlite y RPC reales mediante servidor HTTP de pruebas. Administración configuró 75 %, registró 0 de 2; Recepción registró una llegada y se actualizó automáticamente a 1 de 2. Alta desde Recepción actualizó a 2 de 3. Cambiar a 50 % mostró quórum alcanzado, sin abrir votación ni emitir votos. Recepción mostró únicamente sus formularios y listado de altas.
- Producción: DEMO 2098 sigue con simulacro en ingreso y oficial en preparación. Porcentaje real sigue sin configurar. Coordenadas fijas 9.03782 / -79.46696 conservadas. No se añadieron votos ni datos ficticios de la prueba a producción.

## Límites y puesta en uso

El navegador usó cuentas ficticias y GPS simulado; no demuestra GPS real en la iglesia ni inicio de sesión de otra persona. Administración debe elegir porcentaje, fecha autorizada y cuenta de Recepción. Hace falta el correo de esa persona para asignarla y revisar el acceso privado del alojamiento, sin ampliar la audiencia por suposición. Se mantienen las métricas históricas sobre total de miembros separadas de este nuevo quórum sobre habilitados.
