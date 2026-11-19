# Entrega para pruebas de la demo

## Implementado en esta entrega

- Administración → Habilitados: importar CSV por territorio con vista previa (dos columnas: `nombre completo,cédula`, UTF-8, coma o punto y coma, hasta 500 personas/1 MB). Confirmación explícita antes de escribir. Si una fila falla, se revierte toda la carga.
- Repetir el archivo no duplica las mismas identidades en el territorio. Nombres conflictivos o identidades ambiguas requieren revisión. No se adivina identidad por nombre.
- Exportar habilitados y no habilitados según el filtro actual; cédulas limitadas a últimos cuatro caracteres por el modelo de identidad hash existente.
- Relaciones territoriales electorales en `voting_private.territorial_members`, con RLS y sin permisos de tabla para clientes. No se inventan células; las membresías de Bethel existentes se conservan.
- Solo Administración importa. Pastores asignados consultan/habilitan su territorio; líderes conservan sus listados de célula. La carga no habilita automáticamente ni registra llegada.
- Si el dispositivo no entrega GPS, el cliente envía coordenadas nulas y el servidor exige una excepción administrativa vigente. No se inventan coordenadas, asistencia ni habilitación.

## Verificación

Pruebas JavaScript de CSV, fórmulas de hoja de cálculo, GPS y selección; contratos locales electorales, registro e importación; comprobación de importación en producción mediante transacción revertida. `tests/import-production-rollback.sql` conserva el recorrido de prueba sin datos personales reales y sin abrir ninguna elección.

Comprobación de navegador: ingreso visible, logo/crédito y redirección administrativa al login. La revisión de los paneles autenticados y el voto desde el dispositivo de la responsable requiere su cuenta Bethel; no se creó una contraseña de prueba ni se omitió el login. Estas comprobaciones no sustituyen la aceptación manual.

## Cómo probar

1. Abrir `/#/admin` e ingresar con una cuenta administrativa activa de Bethel.
2. Seleccionar **DEMO — Prueba técnica con datos ficticios (2098)**.
3. En Ubicación y excepciones elegir radio y pulsar **Usar mi ubicación para la DEMO**.
4. En Operación iniciar el ingreso del simulacro. Abrir `/#/` con `DEMO-PROD-001` y permitir GPS: debe aparecer asistencia registrada y espera.
5. Abrir el simulacro en Administración. El votante selecciona exactamente **2 mujeres y 3 hombres**, envía y recibe confirmación. Reingresar debe informar que ya participó.
6. `DEMO-PROD-003` permite probar la falta de habilitación. Cerrar la votación para consultar resultados/exportación; después probar la oficial ficticia.
7. Para CSV, usar un territorio elegido conscientemente y datos claramente ficticios: la importación guarda personas en la base compartida. No importar una lista real como ensayo. La elección DEMO no crea un territorio ficticio ni aísla por sí sola una carga territorial.

La DEMO conserva el acceso privado del sitio. No borrar votos para repetir: conservar historial y preparar otra ronda/elección de prueba.

## Límites que siguen vigentes

No hay anonimato criptográfico frente a operadores privilegiados. Cédula/GPS no son identificación fuerte. Permanecen los avisos heredados de seguridad de otros módulos de Bethel; esta entrega no altera sus permisos. El registro de la marca Zykodio sigue pendiente y el crédito no declara marca registrada.
