# DEMO conectada a producción

Preparada por solicitud de Yarquelis el 17 de octubre de 2026.

Elección: **DEMO — Prueba técnica con datos ficticios**, año técnico **2098**. El año permite reservar 2027 para la elección real. Hay una ronda de simulacro y una oficial ficticia, ambas inicialmente en preparación. Cupos: **2 mujeres y 3 hombres**, entre 4 candidatas y 4 candidatos ficticios por catálogo.

| Cédula ficticia | Habilitación de prueba |
| --- | --- |
| DEMO-PROD-001 | Habilitada |
| DEMO-PROD-002 | Habilitada |
| DEMO-PROD-003 | Sin habilitar; permite comprobar rechazo |
| DEMO-PROD-004 | Habilitada |
| DEMO-PROD-005 | Habilitada |
| DEMO-PROD-006 | Habilitada |

Los seis registros se identifican como DEMO, no pertenecen a territorios/células ni alteran membresías de Bethel. Sus IDs son -917200001 a -917200006. Las habilitaciones pertenecen exclusivamente a la elección DEMO; no habilitan para una elección real. Los candidatos del catálogo de práctica están marcados DEMO y deben sustituirse/desactivarse al preparar el catálogo real de referencia 2026.

## Recorrido

1. Ingresar a Administración con una cuenta real activa de Bethel.
2. Seleccionar la elección DEMO 2098. En Ubicación y excepciones escribir el radio que se desea probar y usar **Usar mi ubicación para la DEMO**. No hay coordenadas ni radio inventados por defecto.
3. En Operación iniciar el ingreso del simulacro. Ingresar como votante con DEMO-PROD-001: se registra llegada y se muestra espera.
4. Abrir el simulacro desde Administración, continuar como votante, elegir exactamente 2 mujeres y 3 hombres y enviar.
5. Comprobar reingreso, voto repetido, DEMO-PROD-003 sin habilitar, cierre y resultados. Preparar desempate si corresponde; requiere política explícita de asistencia.
6. Cerrar la activa antes de iniciar la oficial ficticia. Una persona habilitada puede omitir el simulacro y votar directamente en oficial.

Cada ronda admite un voto válido por identidad. Para repetir una ronda ya cerrada se conserva el historial y se prepara otra ronda/elección de prueba; no borrar votos ni reabrir una ronda cerrada mediante SQL.

La DEMO usa la misma API y validaciones de servidor que la versión real. GPS y excepciones siguen activos. El sitio conserva el acceso privado existente: los dispositivos de prueba deben poder abrirlo con la cuenta propietaria; hacer público el sitio requiere una decisión de acceso separada.

Falta aceptación visual y recorrido manual de la usuaria. No se afirma que las pruebas SQL sustituyan esa validación.
