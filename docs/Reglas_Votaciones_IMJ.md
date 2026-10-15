# SPEC — Reglas de Votaciones IMJ

Actualizado: 12 de octubre de 2026 (Panamá).

Este documento reúne todas las reglas confirmadas en esta conversación y las reglas recuperadas del código. Es la referencia para los agentes que trabajen en Votaciones. Documentar un requisito no significa que ya esté implementado o probado.

## 1. Objetivo y base compartida

- Votaciones debe ser un módulo administrable para preparar y realizar elecciones cada año.
- Debe utilizar la misma base de datos de Bethel_IMJ.
- La próxima elección indicada por Yarquelis es 2027; la elección anterior indicada es 2026.
- Repositorio de referencia: https://github.com/yarke19841/votaciones_imj
- Conservar los registros territoriales de Bethel. No reemplazarlos ni asumir que pertenecer a un listado habilita automáticamente para votar.
- Preparar y verificar los cambios en preproducción antes de proponer su aplicación en producción.

## 1.1 Identidad visual y experiencias — confirmado

- Confirmado el 7 de octubre: todas las pantallas deben ser responsive, adaptándose a diferentes tamaños de celular, tablet y PC, en orientación vertical y horizontal. Aplicar a votantes y Administración: contenido y controles legibles, menú adaptable, formularios y tarjetas que se reorganicen sin cortar acciones ni provocar desplazamiento horizontal de toda la página. Las tablas extensas pueden usar desplazamiento dentro de su propio contenedor accesible. Verificar anchos representativos, incluidos celulares pequeños.

- Paleta confirmada: blanco y azul marino. Aplicarla a las pantallas del votante y al panel administrativo; reemplaza los acentos crema/verde/dorado de propuestas anteriores.
- Nombre visible de la iglesia: Ministerio Jezreel. Bethel_IMJ es la referencia de la base compartida, no el nombre de la interfaz.
- Usar el logo de la app de la iglesia; la paloma sustituye la B inventada en las propuestas. No presentar un símbolo generado como si fuera el archivo oficial.
- Separar las pantallas del votante de las de Administración: cédula, espera, papeleta y confirmación para votar; configuración y operación en el panel administrativo.
- Líderes y pastores territoriales reciben solo las acciones y el ámbito autorizados.

## 2. Elecciones anuales — confirmado

- Permitir crear elecciones cada año desde el panel.
- Cada año tiene sus propios candidatos oficiales, votos y resultados.
- Conservar el historial de años anteriores sin sobrescribirlo.
- El año electoral debe ser explícito; no depender únicamente del título o del año de creación del registro.
- Mostrar el año de la elección seleccionada en las pantallas correspondientes. Eliminar los textos fijos de 2025 encontrados en el código.
- Los simulacros y las elecciones oficiales deben tener resultados independientes.
- Al crear Votaciones 2027 (o cualquier año posterior), ofrecer dos opciones: Simulacro y Votaciones del año en curso (por ejemplo, Votaciones 2027).
- El año de la elección define los participantes y resultados; el simulacro usa como referencia de candidatos el simulacro 2026, sin convertirse en la elección oficial de 2026.

## 3. Candidatos y fotos — confirmado

- Administrar candidatos de práctica y candidatos oficiales como conjuntos diferenciados.
- Confirmado el 6 de octubre: el simulacro de cada año utiliza siempre los candidatos y fotos del simulacro 2026. No crear una lista nueva de candidatos de práctica cada año ni usar los candidatos oficiales 2026 para este fin.
- La votación oficial del año actual utiliza exclusivamente los candidatos que se carguen para ese año.
- Los candidatos oficiales corresponden a su elección anual; cada año puede tener candidatos nuevos.
- Permitir subir y cambiar fotos de candidatos desde el panel.
- Las fotos de candidatos de práctica deben estar disponibles para los simulacros de todos los años.
- Reutilizar una foto de práctica no implica reutilizar sus votos o resultados.
- Conservar el historial de candidatos y resultados oficiales de cada elección.

- Confirmado el 6 de octubre: los candidatos oficiales del año no se muestran en la experiencia de votación mientras la votación oficial esté en preparación; aparecen al abrir la votación oficial de ese año. Abrir el simulacro no revela los candidatos oficiales. La carga administrativa previa sigue siendo necesaria; esta regla de visibilidad no impide preparar el catálogo con los permisos correspondientes.

## 4. Habilitación desde los listados y territorios — confirmado

- Ser miembro registrado o aparecer en Bethel no autoriza automáticamente a votar.
- Debe existir habilitación explícita para la elección correspondiente.
- Los listados del líder son la fuente para seleccionar a los miembros que se habilitarán.
- Confirmado el 6 de octubre: se usarán ambos mecanismos:
  - El líder puede habilitar desde su propio listado.
  - Administración también puede seleccionar el listado del líder y habilitar miembros.
- Confirmado el 6 de octubre: Administración y el pastor de territorio también pueden habilitar personas para votar. El pastor habilita personas de su territorio; este permiso no concede acceso a otros territorios ni facultades de apertura/cierre o gestión de candidatos. Se conserva el permiso del líder sobre su propio listado.
- La habilitación debe comprobarse al permitir votar; no basta con que exista una pantalla administrativa que marque al miembro como habilitado.
- Conservar separado el estado de la persona en Bethel y su habilitación electoral.
- Confirmado el 6 de octubre: el simulacro y la votación oficial del mismo año comparten el mismo padrón de votantes habilitados para esa elección anual. No exigir una habilitación administrativa independiente para cada tipo.
- Compartir habilitación no comparte votos ni el estado de participación: cada persona puede votar una vez en simulacro y una vez en oficial.
- Confirmado el 6 de octubre: participar o votar en el simulacro NO es requisito para votar en la oficial. Una persona habilitada puede omitir el simulacro y votar directamente en la oficial, cumpliendo los demás requisitos aplicables.
- La habilitación es un estado explícito de autorización (en el esquema revisado existe election_member.can_vote); no debe deducirse de haber emitido un voto en simulacro.
- Registrar participación en simulacro no cambia por sí solo la habilitación electoral ni habilita automáticamente a alguien no autorizado.
- No asumir que las tablas actuales de personas de Bethel y miembros electorales representan automáticamente la misma identidad: la integración debe relacionarlas de forma verificable.

## 5. Identidad única y voto único — confirmado

- La cédula identifica a la persona para Votaciones.
- Confirmado el 6 de octubre: una persona que aparece en varios territorios con registros distintos representa un único votante por votación.
- Mantener los registros territoriales separados; no fusionarlos para implementar esta regla.
- Evitar que variaciones de formato de la misma cédula generen identidades electorales distintas.
- Una persona solo puede emitir una papeleta por votación o ronda.
- Haber participado en un simulacro no consume el derecho a votar en la elección oficial.
- El control de voto único debe funcionar también frente a solicitudes simultáneas o reintentos.

## 6. Una sola votación abierta — confirmado

- Solo puede estar abierto un tipo de votación a la vez: simulacro u oficial.
- Al abrir simulacro, la oficial permanece cerrada.
- Al abrir oficial, el simulacro permanece cerrado.
- No permitir que dos aperturas simultáneas dejen ambas votaciones abiertas.
- El panel debe identificar claramente el año y tipo de la votación activa.

## 7. Cerrar votaciones y resultados — confirmado

- El botón «Cerrar votaciones» cierra únicamente la votación que esté abierta.
- No debe cerrar automáticamente la elección más reciente por su fecha de creación.
- Al cerrar, obtener y mostrar los resultados de ese año y ese tipo de votación.
- Mantener separados los votos y resultados de simulacro y oficial.
- Conservar resultados históricos.
- Permitir consultar y exportar resultados desde el panel.

## 8. Voto secreto — obligatorio en el SPEC

- El sistema debe proteger el secreto del voto.
- La administración puede conocer quién está habilitado y quién ya participó, sin conocer sus candidatos elegidos.
- No guardar una relación consultable entre la identidad del votante y sus selecciones.
- Las exportaciones no deben revelar qué candidato eligió cada persona.
- El secreto del voto y el voto único no son opciones desactivables desde el panel.
- Hallazgo: el código y modelo actuales de cast_vote relacionan voter_member_id con candidate_id. Eso no cumple este requisito y debe corregirse.
- La solución concreta debe evaluarse antes de afirmar que garantiza anonimato; separar tablas por sí solo no prueba una garantía absoluta.

## 9. Administración desde el panel — confirmado

Todo lo configurable debe gestionarse desde el panel, sin modificar código para preparar cada año.

| Área | Funciones requeridas |
| --- | --- |
| Elecciones | Crear elecciones por año y configurar título. |
| Cupos | Configurar la cantidad de hombres y mujeres para la elección. |
| Candidatos oficiales | Agregar, editar, activar o desactivar candidatos y gestionar sus fotos por elección. |
| Práctica | Usar los candidatos y fotos del simulacro 2026 como referencia reutilizable para el simulacro de cada año. |
| Habilitados | Seleccionar y activar miembros desde los listados de líderes. |
| Operación | Abrir simulacro u oficial; cerrar únicamente la votación activa. |
| Resultados | Consultar y exportar por año y tipo; conservar el historial. |

- Las acciones deben estar sujetas a permisos.
- Los permisos no pueden permitir desactivar voto secreto, voto único o la regla de una sola votación abierta.
- Poder consultar información no equivale a poder editarla.
- El pastor de territorio tiene permiso confirmado para habilitar votantes de su territorio. Siguen pendientes los demás permisos de registro, asistencia y operación electoral; no deducirlos del nombre del rol.

## 9.1 Ingreso y espera — confirmado

- El votante entra al enlace de Votaciones e ingresa su cédula.
- Confirmado el 6 de octubre: el flujo visible es enlace → cédula → selección → envío. Si la votación está abierta/habilitada y la persona tiene autorización, acceder a la selección sin exigir una segunda activación técnica del moderador (como notes="1"). Si aún no está abierta, conservar la pantalla de espera.
- Solo un envío válido por persona y votación: tras votar, un nuevo ingreso o reintento no permite emitir otra papeleta. La participación del simulacro y la oficial sigue siendo independiente.
- Todo lo administrable se configura desde el panel: candidatos habilitados, fotos, cupos, padrón y apertura/cierre. Los controles obligatorios de voto único, secreto y una sola votación abierta no son desactivables.
- Si la votación correspondiente todavía no está abierta, mostrar «Esperar votaciones», sin revelar candidatos ni permitir enviar votos.
- Al estar abierta, una persona habilitada puede acceder a la papeleta correspondiente y elegir candidatos, cumpliendo las demás comprobaciones aplicables.
- La pantalla de espera debe permitir comprobar si ya se abrió la votación sin volver a habilitar a la persona.
- Estar en espera o conocer una cédula no autoriza por sí solo a votar ni modifica el padrón.

## 9.2 Candidatos habilitados y cupos por género — confirmado

- Administración selecciona qué candidatos están habilitados/activos para participar y configura cuántas mujeres y cuántos hombres debe escoger cada votante.
- La habilitación de candidatos y la habilitación de personas para votar son estados distintos.
- Ejemplo confirmado: hay 8 candidatos habilitados, 4 mujeres y 4 hombres; los cupos de selección son 2 mujeres y 3 hombres.
- En ese ejemplo, impedir seleccionar una tercera mujer o un cuarto hombre. Permitir desmarcar y sustituir selecciones.
- Para enviar la papeleta deben cumplirse exactamente los cupos configurados: 2 mujeres y 3 hombres en el ejemplo. No aceptar más ni menos, conservando la regla de selección exacta del flujo existente.
- Mostrar los contadores por género y los cupos antes de confirmar el voto.
- Aplicar los límites en la interfaz y volver a validarlos en la operación que guarda el voto; rechazar peticiones manipuladas, candidatos inactivos o de otra votación.
- No fijar los números del ejemplo en el código: son configurables por elección desde Administración.

## 9.3 Asistencia electoral e indicador de presencia — confirmado

- Al llegar a la iglesia, los votantes deben ingresar/registrarse para tomar su asistencia electoral. El registro de llegada debe estar disponible antes de abrir la votación.
- La asistencia es importante y forma parte del flujo electoral; no eliminarla al simplificar el ingreso por cédula.
- Confirmado el 6 de octubre: registrar la llegada/asistencia es un requisito adicional para votar. Al ingresar al llegar a la iglesia, registrar que la persona llegó para votar y verificar su habilitación electoral; si está habilitada y tiene asistencia registrada, queda apta para votar cuando se abra la votación correspondiente.
- El acceso y el envío del voto deben comprobar los tres requisitos: habilitación explícita para la elección anual, asistencia de llegada válida para el evento correspondiente y votación abierta; además, la persona no debe haber votado ya en esa ronda.
- Confirmado el 6 de octubre: tras ingresar la cédula al llegar, registrar asistencia y verificar la habilitación electoral, el votante pasa a la segunda pantalla aprobada «Esperar votaciones». Mostrar «Asistencia registrada» y «Habilitado para votar» únicamente si ambas comprobaciones fueron exitosas. Al abrir la votación correspondiente puede continuar desde esa pantalla a elegir; no debe registrarse de nuevo ni duplicarse la asistencia. Registrar la llegada no debe exigir que ya esté abierta la votación.
- Si falta asistencia, no permitir elegir/enviar y explicar que debe registrar su llegada. Si falta habilitación electoral, la asistencia por sí sola no la concede.
- Mostrar en el panel el total de miembros, la cantidad presente y su porcentaje. Ejemplo confirmado: 300 miembros, 150 presentes, 50 % presente.
- Fórmula: presentes ÷ total de miembros × 100. No sustituir silenciosamente el total de miembros por el número de habilitados o de votos emitidos; mostrar esos indicadores por separado si se incluyen.
- Ratificado el 8 de octubre: mantener este porcentaje sobre el total de miembros, no sobre los habilitados para votar.
- Cada persona cuenta una sola vez en la asistencia del evento, aunque reingrese o aparezca en varios registros territoriales. Conservar los registros de Bethel separados.
- Registrar asistencia no emite votos ni habilita automáticamente a una persona no autorizada. Estar presente, estar habilitado y haber votado son estados distintos.
- No deducir un requisito de quórum, porcentaje mínimo o apertura automática a partir del indicador: ninguno ha sido confirmado.
- Corrección de Yarquelis del 9 de octubre, ratificada el 12 de octubre: la ayuda de otra persona es opcional. El votante ingresa con su cédula, el sistema registra automáticamente la asistencia válida de llegada y muestra «Esperando apertura de votaciones». No exigir confirmación administrativa, validación de una solicitud del teléfono por un asistente ni una segunda activación del moderador como paso obligatorio. El votante puede usar teléfono, tablet o PC. Esta corrección sustituye la interpretación anterior de confirmación presencial obligatoria.
- El registro automático no concede habilitación electoral, no emite votos y no debe duplicar la asistencia al reingresar. Conocer la cédula o registrar asistencia no demuestra por sí solo identidad ni ubicación actual; conservar las comprobaciones geográficas y el control de voto único sin inventar pasos adicionales al flujo aprobado.
- Pendiente precisar el universo del total de miembros y verificar técnicamente la protección del ingreso automático sin introducir una aprobación humana obligatoria.

### 9.3.1 Personas pendientes de votar — confirmado el 12 de octubre

- Mostrar en Administración la cantidad y el listado de personas habilitadas que todavía no han emitido un voto válido en la votación/ronda seleccionada. Distinguir las que tienen asistencia registrada y siguen pendientes de votar de las que no registraron llegada.
- Calcular el estado por identidad única y por año, tipo y ronda; un voto de simulacro no marca como votada la oficial y una participación anterior no marca como votado un desempate.
- Al registrar un voto válido, actualizar el estado de participación y retirar a la persona de pendientes para esa ronda. Un intento rechazado por ubicación no registra voto ni elimina a la persona de pendientes.
- Esta consulta informa quién participó, nunca sus selecciones. Respetar permisos y ámbitos territoriales existentes; no crear un listado público de cédulas o miembros.

## 9.5 Decisiones configurables por Administración — confirmado el 7 de octubre

- Administración define desde el panel la ubicación/radio permitidos y si una ronda de desempate exige nueva asistencia o utiliza asistencia válida del evento de origen. Confirmado el 8 de octubre: solo Administración puede aprobar excepciones geográficas; no delegar ese permiso a líderes ni pastores territoriales.
- No exigir que la usuaria fije esos valores durante la programación: implementar los controles para que Administración pueda configurarlos antes de operar.
- Cuando falte un valor necesario, mostrar «Pendiente de configuración» y explicar qué debe completar Administración; no asignar un valor arbitrario ni omitir la comprobación.
- La política de asistencia del desempate no altera su padrón: únicamente quienes votaron válidamente en la ronda de origen pueden participar. Una asistencia ajena al evento no basta.
- Estos ajustes no pueden desactivar voto único, secreto, habilitación ni la regla de una sola votación abierta.

## 9.4 Ubicación de la iglesia y excepciones — confirmado el 7 de octubre

- Confirmado el 13 de octubre: cuando la ubicación actual comprobada esté fuera del radio permitido y no exista una excepción administrativa vigente, mostrar al votante **«Está fuera del límite permitido para votar»** al intentar acceder a la papeleta o enviar el voto. Bloquear la operación sin registrar participación ni conteos. Si el GPS está denegado, no disponible o no permite comprobar la ubicación, mostrar un mensaje específico de ubicación no verificable; no afirmar que está fuera del radio.

- Confirmado el 7 de octubre: agregar una pantalla propia «Ubicación y excepciones» al menú administrativo de Votaciones. Su configuración y permisos se gestionan desde el panel.

- Restringir el voto a quienes estén en la iglesia o dentro del rango geográfico autorizado alrededor de su ubicación, salvo excepción aprobada.
- Confirmado el 12 de octubre: la asistencia de llegada no sustituye la ubicación actual. Si una persona registra asistencia en la iglesia y luego se va a su casa fuera del radio, no puede votar desde allí salvo excepción geográfica vigente aprobada exclusivamente por Administración. Conservar su asistencia histórica sin asumir que sigue físicamente presente.
- Comprobar nuevamente la ubicación actual al acceder a la papeleta y al enviar el voto; no reutilizar indefinidamente las coordenadas de llegada. Si estaba dentro al abrir la papeleta pero salió antes de enviar, rechazar el envío sin registrar participación ni conteos de voto. Si no se puede comprobar ubicación actual, no presumir que está dentro; mostrar el motivo y conservar la opción de revisión administrativa ya acordada.
- Aplicar esta regla como comprobación adicional a habilitación electoral, asistencia/sesión válidas, apertura y voto único; no reemplazar esos requisitos con la ubicación.
- Confirmado el 7 de octubre y precisado el 8 de octubre: la pantalla de ubicación y excepciones debe ser configurable desde Administración, sin modificar código. Permitir editar la ubicación/punto de la iglesia y el radio permitido; consultar y gestionar las excepciones autorizadas con su ámbito/vigencia. Solo Administración puede aprobarlas. El radio se introduce en esa pantalla antes de operar, no es una decisión necesaria para continuar programando. Si no está configurado, bloquear la operación que lo requiere y mostrar el ajuste pendiente; no inventar un valor.
- No inventar coordenadas ni fijar un radio sin confirmación. La configuración no permite desactivar el voto único, la habilitación electoral ni el secreto del voto.
- Una excepción de ubicación autoriza a una persona a votar fuera del área únicamente en el ámbito electoral aprobado; no habilita automáticamente a miembros no autorizados, no registra asistencia presencial ficticia y no revela sus selecciones.
- Registrar quién aprobó la excepción y su ámbito; mantener esa autorización separada de los conteos secretos de voto.
- Si no puede verificarse la ubicación, no tratarlo como estar dentro del área; explicar el problema y permitir solicitar revisión/excepción, sin aprobarla automáticamente.
- La geolocalización del dispositivo es un control adicional, no una prueba suficiente de identidad ni una garantía absoluta de presencia. No afirmar que es imposible falsearla.
- Pendiente validar el punto exacto, configurar/probar el radio en el panel y precisar vigencia por evento/ronda y cómo se acredita el requisito de asistencia para un votante autorizado fuera del área. La aprobación de excepciones corresponde exclusivamente a Administración. No marcarlo presente físicamente por recibir una excepción.

## 10. Reglas recuperadas del código existente

Estas reglas se encontraron en el código revisado. Se conservan como referencia del flujo existente y deben contrastarse con las decisiones de Yarquelis antes de cambiar su significado.

### 10.1 Ingreso y asistencia

- Ingreso mediante cédula.
- El flujo consulta al miembro y su estado activo.
- Requiere asistencia presencial registrada para la elección.
- La asistencia distingue práctica/oficial y fecha en la pantalla de check-in.
- Hallazgo: el ingreso actual no comprueba can_vote y no filtra la asistencia por fecha y tipo. Debe evitarse que la asistencia de práctica habilite por error el acceso oficial.

### 10.2 Papeleta y cupos

- Se configura required_male y required_female por elección.
- Para enviar la papeleta se exige seleccionar exactamente esas cantidades.
- Se muestran únicamente candidatos activos del conjunto correspondiente: simulacro u oficial.
- La papeleta se carga con la elección abierta y una fase activa.
- El código heredado usa notes = "1" como señal adicional para cargar la papeleta. La instrucción posterior del 6 de octubre define acceso directo a la selección cuando la votación está abierta y la persona habilitada; no conservar ese indicador técnico como un segundo requisito de acceso.

### 10.3 Apertura, cierre y horario

- El código mantiene estado abierta/cerrada y horas de apertura/cierre.
- Revalida el estado antes de guardar el voto.
- Los resultados existentes clasifican votos dentro y fuera del horario de apertura/cierre.
- La implementación nueva debe aplicar el cierre al registrar el voto, no depender únicamente de excluir votos después en la pantalla de resultados.

### 10.4 Ganadores y desempates — mecanismo confirmado el 6 de octubre

- Los resultados ordenan candidatos por cantidad de votos, separados por género.
- Los cupos configurados determinan los puestos disponibles.
- Se detecta empate en el límite de los cupos.
- Confirmado el 6 de octubre: crear una ronda de desempate solo con los candidatos empatados en el límite de los cupos y los puestos pendientes del género correspondiente. Quienes ya ganaron conservan su puesto. Ejemplo: Ana gana un puesto y María/Carmen empatan por el segundo; la nueva ronda incluye solo María/Carmen para elegir una. El padrón del desempate se confirmó posteriormente: quienes emitieron un voto válido en la ronda de origen. La necesidad de un nuevo check-in sigue pendiente.
- La función existente copia asistencia desde la elección de origen para la nueva ronda.
- Una nueva ronda permite volver a votar a sus participantes habilitados; no borra ni sobrescribe los votos de la ronda anterior.
- Confirmado el 6 de octubre: los votantes del desempate son las mismas personas que emitieron un voto válido en la ronda de origen; estar habilitado o presente sin haber votado esa ronda no basta para participar en su desempate. Cada participante puede emitir un único voto nuevo en la ronda de desempate.
- Aclarado el 7 de octubre: el padrón autorizado del desempate conserva exactamente las mismas identidades y cantidad de votantes válidos de la ronda original; no agregar ni sustituir personas. Ejemplo: si 150 personas votaron en la ronda original, esas mismas 150 quedan autorizadas para el desempate. La cantidad de votos efectivamente emitidos en el desempate puede ser menor si alguna no vuelve a votar; no registrar votos automáticamente ni exigir un total idéntico como condición de cierre.
- Confirmado el 7 de octubre: Administración configura si el desempate requiere nueva asistencia o reutiliza asistencia válida del evento de origen. Mientras la política no esté configurada, no abrir esa ronda. No copiar asistencia ajena al evento ni ampliar el padrón de quienes votaron la ronda de origen.
- No establecer requisitos de antigüedad, servicio o candidatura que no estén expresamente aprobados.

## 11. Criterios de aceptación

1. Crear la elección 2027 y después otra anual sin alterar los datos históricos.
2. Administrar candidatos y cupos desde el panel.
3. Reutilizar fotos de práctica en otro año sin reutilizar votos.
   - Para 2027, la papeleta de simulacro debe mostrar los candidatos y fotos del simulacro 2026; la oficial debe mostrar únicamente los cargados para 2027.
4. Mantener candidatos oficiales vinculados a su elección.
5. Un líder habilita desde su listado y Administración puede habilitar desde ese mismo listado.
6. Un miembro registrado pero no habilitado no puede votar.
   - Los habilitados para la elección anual son los mismos en simulacro y oficial; no se habilitan dos veces.
7. La misma cédula en varios registros territoriales no permite votar dos veces.
8. Votar en simulacro no impide votar en oficial.
   - Un votante habilitado que no participó en simulacro también puede votar en oficial; el sistema no exige votos ni asistencia de práctica como condición de participación previa.
9. Dos intentos simultáneos no registran dos papeletas de la misma persona.
10. Dos aperturas simultáneas no dejan dos tipos abiertos.
11. Cerrar votaciones cierra la activa, aunque exista un borrador más reciente.
12. Los resultados corresponden al año, tipo y ronda cerrados.
13. Los permisos y exportaciones no revelan las selecciones de una persona.
14. El sistema rechaza votos después del cierre.
15. Ningún cambio elimina o modifica registros territoriales de Bethel para cumplir las reglas electorales.
16. Un pastor territorial habilita votantes de su territorio y no puede habilitar personas de otros territorios; Administración conserva acceso general y cada líder su listado.
17. Ingresar por cédula antes de la apertura muestra «Esperar votaciones», sin candidatos; una vez abierta permite la papeleta a los votantes autorizados.
18. Con 4 candidatas y 4 candidatos activos y cupos 2 mujeres/3 hombres, impedir sobreselección y rechazar al guardar una selección distinta, incluso por una petición directa.

19. El desempate permite votar solo a quienes emitieron un voto válido en la ronda de origen; admite un voto nuevo por persona sin alterar la ronda anterior.
20. Con total de miembros 300 y presentes 150, el panel muestra 50 % presente; un reingreso no aumenta el conteo. El registro de llegada funciona antes de abrir votaciones y no habilita ni emite votos por sí mismo. Sin asistencia válida no se permite votar, aunque la persona esté habilitada y la votación abierta.
21. El ingreso registra asistencia automáticamente y muestra espera, sin aprobación obligatoria de otra persona; la ayuda es opcional y no hay doble registro al reingresar.
22. Llegar, registrar asistencia y luego salir del radio no permite votar fuera del área sin excepción administrativa vigente. Salir después de abrir la papeleta también impide enviarla. El intento rechazado no cuenta como voto.
23. El panel identifica habilitados pendientes de votar por ronda y distingue asistencia registrada; muestra participación, no selecciones, y no mezcla simulacro, oficial ni desempates.

## 12. Estado técnico verificado y pendientes

Verificación de lectura: 5–6 de octubre de 2026. Estas observaciones no son reglas nuevas y pueden cambiar al implementar.

- Bethel_IMJ contiene tablas electorales y tablas de personas/listados de Bethel, sin relación declarada entre member y people.
- La estructura electoral revisada no tiene un campo explícito de año.
- Preproducción revisada contiene el esquema de Bethel, pero aún no las tablas electorales.
- Se encontraron vote y election_voter con RLS desactivado. Revisar también sus permisos efectivos antes de aplicar una corrección.
- La función de desempate existente usa SECURITY DEFINER; deben revisarse autorización, permisos de ejecución y su configuración.
- La restricción única encontrada en cast_vote evita repetir el mismo candidato por persona/elección, pero no demuestra por sí sola el límite de una papeleta por persona.

🟡 POR DEFINIR:
- Permisos para abrir/cerrar votaciones, editar cupos y gestionar candidatos además de Administración. La habilitación por el pastor territorial ya está confirmada. La asistencia de llegada se registra automáticamente al ingresar; no está pendiente aprobar un asistente obligatorio.
- Requisitos de candidatos oficiales y quién aprueba su postulación.
- Implementar y verificar la configuración administrativa de asistencia en desempates; Administración elige la política antes de abrirlos. Su padrón es quienes votaron válidamente en la ronda de origen.
- Universo exacto del indicador de total de miembros y protección técnica del registro automático de llegada. La ayuda de otra persona es opcional; no exigir confirmación humana obligatoria.
- Validación del punto exacto y configuración/prueba del radio de la iglesia desde el panel; vigencia de excepciones geográficas y tratamiento de asistencia de votantes autorizados fuera del área. Solo Administración aprueba excepciones, confirmado el 8 de octubre.
- Cómo recopilar/verificar cédulas que falten en los listados de Bethel.
- Tratamiento de registros históricos que ya relacionan identidad y voto, sin destruir el historial.
- Qué acciones de edición se permiten después de abrir o cerrar una votación.

## 13. Instrucciones para todos los agentes

- Leer este SPEC antes de analizar, implementar o verificar Votaciones.
- Las instrucciones posteriores de Yarquelis tienen prioridad; incorporarlas sin perder reglas vigentes.
- Distinguir requisitos confirmados, comportamiento del código y asuntos por definir.
- No declarar cumplimiento sin verificarlo.
- No inventar reglas ni resolver decisiones de negocio pendientes mediante suposiciones.
- Mantener las reglas de secreto, voto único y exclusión de aperturas en la capa que registra los datos, además de reflejarlas en la interfaz.
- Documentar qué se implementó, qué se probó y qué sigue pendiente.
- Confirmado el 8 de octubre: informar de inmediato cuando una decisión, aprobación o acceso faltante impida continuar. Explicar qué falta, qué parte bloquea y qué trabajo puede continuar sin ello. No detener tareas independientes por una configuración operativa pendiente ni dar a entender que se está trabajando cuando no hay ejecución activa. Distinguir avances realizados de próximos pasos; no prometer avances o avisos en segundo plano sin un mecanismo activo.

## Aclaración del 14 de octubre de 2026 — panel y QA

- El panel abre en Operación para abrir/cerrar la votación preparada. Ubicación y excepciones tiene pantalla propia en el menú; no mostrar latitud, longitud o radio en la entrada de operación.
- La prueba de aceptación se entrega con elección, cupos, candidatos, fotos, padrón y rondas preparados. La usuaria opera la votación; no debe configurar de nuevo la prueba para poder votar.

## Personal de registro — confirmado el 14 de octubre de 2026

- Rol electoral Personal de registro: Administración asigna las cuentas y el día autorizado. Solo se activa en esa fecha, según la hora de Panamá; no hereda permisos administrativos.
- Al crear una persona nueva, la misma operación la habilita para la elección anual y registra su asistencia de la ronda activa. Es la excepción explícita a la regla general de que el alta no habilita.
- Comprobar ubicación actual dentro del radio antes de crear/habilitar/registrar asistencia. Si falla el GPS, está fuera, falta configuración o no hay ingreso/votación activos, rechazar sin altas parciales. No sustituye las validaciones frescas de ubicación al consultar papeleta y enviar voto.
- No duplicar cédulas normalizadas ni permitir que otra alta eluda una revocación. Las personas existentes requieren revisión administrativa.
- Personal de registro y Administración tienen un listado de personas creadas en el día, indicando persona, creador, fecha/hora Panamá, asistencia y habilitación. Administración puede consultar fechas anteriores.
- Solo Administración puede revocar habilitaciones, con motivo y auditoría. Conservar la persona y asistencia; bloquear votos posteriores, sin borrar votos válidos ya emitidos ni revelar selecciones.
- Demo y app final deben compartir diseño, pantallas, menú, reglas y funcionamiento. QA verifica contra lo acordado; datos ficticios y entorno son las diferencias. Entregar la demo preparada para probar Administración, Votante y Personal de registro.
