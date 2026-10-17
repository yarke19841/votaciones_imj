# Versión conectada a producción — 17 de octubre de 2026

Autorización explícita de Yarquelis: «Que lo programe a producción». Sustituye la restricción anterior a QA para este despliegue. La aprobación no configura una elección ni habilita votantes automáticamente.

## Base y fuente

- Repositorio: `yarke19841/votaciones_imj`.
- Rama de preparación: `codex/production-20261017`, desde `work/votaciones-qa-20261013`, integrando los specs de `main`.
- Base compartida: `Bethel_IMJ`, proyecto `fepcnvcvgzxbjaoxnbcc`.
- Interfaz: React/Vite con HashRouter; credencial exclusivamente publishable, sin service_role.

## Instalación y evidencia

Las seis migraciones de `supabase/migrations/` se instalaron juntas mediante `voting_production_release_20261017`. El lote conserva el orden lexicográfico y el estado final seguro, evitando publicar las etapas intermedias. No ejecutar de nuevo las seis por asumir que sus versiones individuales deben figurar separadas en el historial de producción: el historial contiene el lote de liberación.

Se verificaron las dependencias y la ausencia de colisiones antes de instalar. Las migraciones son aditivas para Bethel: no migran ni eliminan el padrón, las membresías ni los votos históricos.

- 5 pruebas JavaScript, 73 comprobaciones SQL locales y 36 de registro diario: aprobadas.
- `tests/prod-rollback-contract.sql`: 25 comprobaciones aprobadas en PostgreSQL de producción, con personas ficticias y transacción revertida.
- Comprobación posterior: cero personas ficticias residuales, cero elecciones/identidades/participaciones nuevas; 1413 personas, 1047 membresías y 820 registros históricos de voto conservados.
- Bucket `voting-photos` privado. Solo cuatro RPC electorales ejecutables por `anon`: enter, ballot, submit y photo_visible. Rutas administrativas requieren Auth y rol/ámbito verificados en servidor.

## Uso inicial

Ingresar a Administración con una cuenta real activa de Bethel. Crear la elección, configurar ubicación/radio y cupos, preparar candidatos y fotos y habilitar votantes. Iniciar ingreso antes de abrir. Para comprobar la operación usar una elección claramente identificada como ficticia y conservar el historial de la prueba.

El catálogo de simulacro 2026 es administrable y se reutiliza entre años; su carga inicial sigue siendo necesaria. Los candidatos oficiales pertenecen al año seleccionado. No se copió automáticamente el catálogo ni las habilitaciones del sistema electoral heredado.

## Límites y pendientes

- Falta revisión visual en navegador/dispositivo: la infraestructura Sites disponible no ofrece el control de navegador admitido. Compilación/API/SQL no sustituyen esa aceptación.
- GPS es una observación del dispositivo, susceptible de manipulación, y cédula no prueba identidad. El flujo aprobado no exige asistente humano.
- Participación y conteos agregados se guardan separados; no se ofrece anonimato criptográfico frente a operadores privilegiados de base/logs.
- Si se pierde la respuesta de envío aceptado y el token ya caducó, reingresar por cédula comprueba la participación; el voto no se duplica.
- La interfaz requiere GPS disponible incluso para una excepción geográfica. Permitir excepción ante GPS denegado necesita completar el manejo del cliente conservando la comprobación del servidor.
- Hay registros de membresía sin cédula electoral vinculada: el indicador de total de miembros informa cobertura incompleta hasta completar identidades, sin sustituir el denominador por habilitados.
- Importación CSV territorial: requisito documentado; no se presenta como implementado en el módulo real.
- La base compartida conserva avisos de seguridad heredados en tablas/funciones de otros módulos y en tablas electorales antiguas. No se alteraron indiscriminadamente sus permisos. El núcleo nuevo usa tablas separadas con RLS y RPC limitadas.

Las pruebas HTTP/Storage/Auth y concurrencia registradas en `REAL_ACCEPTANCE.md` corresponden a QA; distinguirlas de la comprobación transaccional realizada en producción. La aceptación final de una elección real requiere recorrido manual de la usuaria.
