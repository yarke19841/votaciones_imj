# Consulta de resultados y revisión de ciberseguridad — 19/11/2026

Solicitud de la responsable: cuenta `resultados@imj.com`, exclusivamente para consultar resultados. Ninguna cuenta debe consultar datos ni operar fuera de sus permisos.

## Acceso

- Inicio de sesión común en `/#/admin/login`; destino exclusivo `/#/resultados`.
- Permiso independiente `voting_private.results_readers.enabled`, sin rol administrativo o de personal de Bethel. La cuenta dedicada mantiene su perfil Bethel inactivo.
- La autorización se valida en cada RPC. Conocer la URL no concede acceso. Deshabilitar el permiso impide consultas posteriores con una sesión existente.
- Solo se publican rondas cerradas: año, tipo, ronda, cupos, candidatos y votos agregados, total de participantes y clasificación calculada. Sin padrón, documentos, asistencia individual ni vínculo votante-selección.
- Exportación CSV agregada, sin fórmulas ejecutables por nombres con espacios o tabulaciones iniciales.
- Menú lateral conserva el diseño aprobado y presenta únicamente Resultados. Las rutas administrativas, Recepción y Nuevo ingreso redirigen a la pantalla autorizada.

## Hallazgos y correcciones

La revisión independiente encontró tablas electorales heredadas con permisos públicos, dos funciones administrativas heredadas sin guarda y un bucket antiguo público. El núcleo nuevo ya denegaba acceso directo a sus tablas.

La migración `secure_legacy_voting_access` revoca permisos anónimos de las seis tablas anteriores y añade una frontera RLS restrictiva de administrador activo. Conserva los registros y las consultas internas autorizadas de Nuevo ingreso. Protege las dos funciones heredadas, fija su search_path y cualifica sus relaciones. El bucket antiguo se vuelve privado, con reglas restrictivas que no alteran el bucket electoral actual. Los catálogos compartidos requieren la cuenta activa del módulo correspondiente.

Se añade revalidación de sesión al cambiar ruta, volver a la pestaña y recibir eventos Auth; cierre de sesión invalida la pantalla protegida. Se incorporan CSP, protección contra framing, MIME sniffing y política de referencias. Se retira una copia de login no utilizada que contenía una contraseña literal; no se reutiliza ni publica esa credencial.

## Verificación

Pruebas reproducibles: `npm run test:all` y `npm run build`. El contrato nuevo de resultados verifica autorización, rondas cerradas, ausencia de identidades, revocación y bloqueo de operaciones. El contrato específico de seguridad recrea las políticas públicas y las dos funciones heredadas para probar explícitamente su corrección; no omite esos objetos por ausencia en el fixture general.

El acceso del votante por cédula y geolocalización conserva el flujo aprobado. La cédula y el GPS no son prueba fuerte de identidad y no proporcionan protección contra manipulación del dispositivo. Esta revisión no equivale a una prueba de penetración completa ni promete seguridad absoluta.

Las contraseñas, tokens y credenciales de prueba no forman parte de este repositorio.
