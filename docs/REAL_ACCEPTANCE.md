# Votaciones Ministerio Jezreel — estado verificable

Actualizado 14 de octubre de 2026, Panamá. NO COMPLETO / NO PRODUCCIÓN.

## Fuentes

SPEC Library `libfile_7c80e27398e48191942133644a55ce7a`, versión23.
Repo real `yarke19841/votaciones_imj`, base `659f69f6fe38f43bf4b4f8c4eb2d9bc8ff03339b`.
Demo Site `appgprj_6ac6e13d65308191a8152ccbb17c946f`, fuente recuperada `7900d71fa4b26f62e5e450b697ea982a8a34c6ab`.
QA confirmada `mldaqivoqhneqldjuryj` Bethel_IMJ_Preproduccion_QA; producción `fepcnvcvgzxbjaoxnbcc` Bethel_IMJ.

## Cambios de código

Núcleo nuevo aditivo separado de tablas electorales históricas. Identidad canónica por cédula normalizada vinculada a registros territoriales sin fusionarlos; padrón anual explícito; asistencia automática independiente de habilitación; sesiones vinculadas a ronda; control geográfico en entrada, acceso y envío; voto único, participación privada y conteos agregados sin vínculo identidad–selecciones. Desempate restringido a participantes válidos de origen, candidatos empatados y puestos pendientes; política de asistencia explícita. Cierre exclusivo de activa.

Panel real para admin/líder/pastor según profiles activo, territorios activos y listados propios. Elecciones/cupos/ubicación; catálogo global práctica2026; candidatos oficiales anuales; carga privada de fotos; permisos por Storage RLS; habilitación desde listado exacto por ID; pendientes; excepciones vigentes admin-only/revocación; resultados calculados y CSV sin identidad. Cliente usa publishable/anon, nunca service_role. Se elimina .env del estado actual del repo; no se reescribe historia.

## Evidencia

- `npm test`:5 pruebas aprobadas (selección/cupos, GPS muestra fresca y fallo cerrado, clasificación ganadores/empates).
- `npm run test:sql`:73 comprobaciones aprobadas con PGlite, SQL completo y fixture con campos nullable y permisos predeterminados compatibles de Bethel/Supabase. Permisos reales de roles SQL, RLS, revocaciones, asistencia, cuota, identidad duplicada territorial, padrón exacto del desempate, política origen, fotos privadas, historia conservada.
- Compilación Vite correcta.
- QA lectura confirma migraciones `20261013033014_voting_core` y `20261013044207_voting_practice_catalog_and_photos` ya instaladas. Cero elecciones e identidades nuevas al inicio de esta ejecución.
- Correctiva instalada y conciliada en QA: historial remoto `20261013232950_voting_corrective`; lectura independiente del monitor confirma identity_people, eligibility y voting_staff_roster(uuid). No repetir.
- Permisos explícitos instalados en QA: `voting_explicit_api_permissions`. Los permisos predeterminados alojados daban EXECUTE directo a anon en RPC administrativas; sus guardas internas denegaban operaciones, pero se revocó ese privilegio innecesario. Lectura remota confirma cero RPC voting_ administrativas/de personal ejecutables por anon; conserva enter/ballot/submit/photo_visible.
- `tests/qa-rollback-contract.sql`:25 aserciones aprobadas en PostgreSQL QA remoto, con claims de roles existentes; asistencia/espera/GPS/cupos/excepciones/voto único/pendientes/cierre/resultados/desempate/práctica. Transacción revertida y ausencia de registros ficticios comprobada. Esto no equivale a login Auth por HTTP.
- `tests/qa-http-contract.py`:7 comprobaciones aprobadas usando exclusivamente publishable key QA. Ingreso y papeleta HTTP, fuera del radio rechazado, acceso administrativo anónimo denegado, seis envíos concurrentes con un único aceptado, reingreso ya votado. Conteos verificados por root y monitor:1 asistencia,1 participación,1 voto. Fixture temporal retirado de QA; conserva auditoría de la prueba. No valida apertura/cierre simultáneos ni fotografías HTTP ni login de personal.
- La primera solicitud de limpieza devolvió `Invalid or expired requestState`; una lectura posterior confirmó que el fixture seguía presente y que no había consulta activa. Se repitió una limpieza acotada al fixture y su elección quedó ausente. Este error actual no explica las pausas anteriores del planificador.
- Mensaje visible actualizado en código: «Está fuera del límite permitido para votar». SPEC v23 exige distinguir ese caso de GPS denegado/no disponible. Compilación y 5 pruebas de código aprobadas después del cambio. No publicado todavía.
- Producción lectura:0 funciones voting_ nuevas; contiene tablas históricas. No se modificó producción en esta ejecución.

## Pendientes y límites

1. Correctiva e integración SQL QA confirmadas; HTTP votante y concurrencia de envío confirmadas. El 14 de octubre pasaron las 31 comprobaciones de `tests/qa-staff-http.py`: login Auth real admin/leader, perfil propio por RLS, contraseña incorrecta rechazada, permisos de snapshots por rol, carga denegada al líder, subida/descarga idéntica de PNG por admin, fotos anónimas ocultas antes/después y visibles solo para ronda activa, dos aperturas simultáneas aceptan exactamente una y dos cierres aceptan exactamente uno, eliminación por Storage API y logout global. Después pasaron 29 comprobaciones de `tests/qa-scope-http.py`, incluido login Auth de pastor, listados exactos por rol y habilitación/revocación territorial. Líder limitado a su propio listado; pastor permite otro listado del territorio asignado pero rechaza territorio ajeno/inactivo; admin permite habilitar fuera de ese ámbito. Líder y pastor no leen snapshot administrativo, cierran rondas ni otorgan excepciones. Tres logout globales confirmados. Evidencia en `tests/qa-scope-results-20261014.json`. No equivale a prueba de navegador. Se repitieron 5 pruebas JS, 59 SQL locales y build sin errores en la ejecución anterior, sin cambios posteriores del código de aplicación.
2. Verificación soportada de navegador responsive/fotos/GPS. Sites control-browser no está disponible; no instalar/improvisar navegador para saltar su instrucción. Revisar acceso actual en próximo turno.
3. Cobertura implementada para todos los registros de membresía `is_member=true`, sin usar habilitación como denominador. Cuenta registros territoriales, identidades verificadas únicas y registros sin cédula vinculada. Solo ofrece total y porcentaje de miembros registrados cuando todos tienen identidad; de lo contrario informa cobertura pendiente. UI permite registrar cédula sin habilitar. La integridad/completitud del padrón de iglesia todavía requiere validación operativa; no identifica a personas sin cédula automáticamente.
4. Referencias de práctica usadas se versionan al editarlas. Rondas iniciadas/resultados conservan ID y foto; borradores siguen la versión nueva; actualizaciones obsoletas y seleccionar versiones retiradas se rechazan. Las políticas Storage impiden actualizar/borrar imágenes referenciadas por rondas iniciadas. Candidatos oficiales iniciados siguen bloqueados. Probado en SQL local y QA; pendiente validación HTTP de la nueva protección Storage y navegador.
5. GPS es coordenada enviada por navegador, susceptible de manipulación; cédula no prueba identidad. Se conserva flujo aprobado sin imponer asistente. No prometer anonimato criptográfico: operador privilegiado o correlación temporal puede inferir, aunque no se guarda relación identidad–selecciones.
6. App privada de QA publicada en https://votaciones-jezreel-qa.yarquelis83.chatgpt.site, conectada solo al proyecto QA. La demo anterior en memoria sigue separada. No se desplegó la integración en la base de producción ni se abrieron elecciones reales. Pendiente validar navegador/GPS y completar aceptación.

Orden pendiente:completar pruebas QA restantes y faltantes → producción solo tras aceptación completa. No dar por terminada esta tarea.

## Seguimiento

Ejecución del 14 de octubre: 31 comprobaciones HTTP iniciales y 29 nuevas de ámbitos aprobadas en QA. La limpieza pendiente de la elección ficticia `662a785b-51cf-4357-80da-b0b366792504` se completó junto al fixture territorial usando `tests/qa-scope-cleanup.sql`, conservando auditoría. Se desactivaron y bloquearon las tres cuentas ficticias; logout global confirmado. Se retiraron identidades, habilitaciones, personas, membresías, grupos, territorios, candidatos y rondas exclusivamente ficticios. La incidencia anterior de `Invalid or expired requestState` no se usa para inferir avance ni éxito. El entorno de archivos tuvo un 503 temporal anterior y volvió a responder. No hubo cambios en producción.

Root ejecutó implementación y pruebas en este chat aunque el planificador «Terminar Votaciones» estuviera desactivado. El monitor debe distinguir programación, ejecución activa y avance probado. Hitos de esta sesión están enumerados arriba; no presentar la habilitación de una tarea como evidencia de trabajo. No hay validación de app real desplegada ni aceptación final.

## Catálogo y conteo — 14 de octubre

Migración local CLI `20261014184342_voting_catalog_versions.sql`; instalada en QA como `20261014185545_voting_catalog_versions`. Pasaron 73 comprobaciones SQL locales, 5 JS y build. `tests/qa-catalog-rollback.sql`: 16 aserciones aprobadas en PostgreSQL QA, transacción revertida y cero personas/elecciones de prueba confirmados; cero rondas activas. Sin modificación de producción. Primer apply devolvió solicitud expirada; lectura confirmó ausencia antes de repetir.

Revisión de seguridad: RPC administrativas nuevas deniegan anon y verifican admin activo, search_path vacío. RLS sin políticas en tablas electorales es denegación intencional: solo RPC limitadas. El asesor sigue reportando funciones Bethel heredadas con search_path mutable, pg_trgm en public y configuración de contraseñas filtradas; no se modificó ese módulo ajeno. Referencias: [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [funciones privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No se declara auditoría completa de Bethel.

## Entrega privada QA para prueba manual

Site `appgprj_6acfd0ce1c548191a04200b5c47a48ff`, commit fuente `9909f9f5c459eda3fc230602644ae9d6e9dbbadf`, despliegue `appgdep_6acfd146a4cc8191828a1770f083a114`, estado `succeeded`. URL https://votaciones-jezreel-qa.yarquelis83.chatgpt.site (propietaria únicamente). Copia del código real con configuración pública QA, aviso visible y HashRouter para rutas estáticas. La clave cliente es publishable; sin service_role ni contraseña en código.

Se conserva intencionalmente un escenario QA DEMO 2027 para la usuaria: dos rondas en draft (práctica/oficial), 4 candidatos ficticios por conjunto con 8 PNG subidos mediante API Storage y 2 personas ficticias (`DEMO-QA-001` habilitada, `DEMO-QA-002` sin habilitar). Punto de iglesia proporcionado por usuaria y radio inicial de prueba 150 m, editable. No se ha iniciado ingreso ni abierto ronda. Cuenta administrativa QA desechable a141e010-2026-4014-8000-000000000001 activa para prueba, contraseña entregada privadamente a la usuaria y no incluida aquí. Cero sesiones residuales tras subir fotos. Los fixtures anteriores sí se retiraron; estos nuevos permanecen deliberadamente para prueba manual.

Ingreso administrativo: /#/admin/login. Iniciar ingreso desde Administración antes de probar cédula. Para registrar asistencia/votar se requiere ubicación real dentro del radio configurado; fuera se muestra el rechazo. Las fotos de candidaturas son marcadores QA, no imágenes oficiales. No se verificó UI en navegador: no se dispone de control-browser y Sites exige omitir esa QA. La publicación correcta no sustituye aceptación visual ni GPS en templo.

## Restauración visual y preparación QA — 14 de octubre

Se restauró la estructura de la referencia aprobada en las cuatro pantallas: encabezado marino con paloma decorativa vectorial recreada de referencia (no archivo oficial), ondas y ramas celestes, ingreso con cédula, espera con indicadores, contadores por género, tarjetas con marca y cupo completo, confirmación de participación por tipo/año. Tamaños fluidos para móvil/tablet/escritorio. No se asegura equivalencia visual sin revisar en navegador. No se guarda selección en el recibo local.

Reingreso ya votado navega a confirmación; una denegación de ubicación en la consulta conserva la espera y su mensaje; no se muestra asistencia/habilitación positiva sin respuesta del backend. Se añadió manejo de error de red al enviar para liberar el botón y no declarar éxito sin confirmación. Los criterios de cupos, voto único y ubicación permanecen en RPC. Cinco pruebas JS y compilación aprobadas. SQL sin cambios en esta restauración.

Administración dispone, solo en despliegue QA, de «Probar aquí con mi ubicación», que solicita GPS y guarda el punto de prueba con permisos administrativos en la elección seleccionada. No hay bypass geográfico ni asistencia ficticia. El despliegue normal exige VITE_APP_ENV=qa y URL QA para mostrarlo; la copia del Site QA fija exclusivamente ese proyecto. La ronda de simulacro QA está en checkin, oficial en draft; no se alteró producción. Pendiente QA visual y recorrido completo desde navegador antes de declarar listo.
