# Entrega de pendientes — 31 de octubre de 2026

## Cambios implementados

1. Ubicación única de Ministerio Jezreel en `voting_private.church_location`: `9.03782, -79.46696`. Tabla privada, RLS y sin acceso directo de clientes. La aplicación muestra el punto como solo lectura; cada elección hereda ese punto al configurar su radio. El trigger impide sustituirlo mediante los parámetros antiguos de guardado. El radio permanece configurable y puede quedar pendiente. Se retiraron los botones de trasladar la DEMO/QA a la ubicación del teléfono.
2. Asistencia Rápida conectada a las APIs actuales: buscar una cédula exacta normalizada, consultar una fecha de Panamá y jornada/ronda, habilitar electoralmente una persona existente por separado y registrar asistencia asistida. No crea miembros, identidades ni votos. No cambia estados de activación de miembros de Bethel.
3. Registro asistido exclusivo de Administración, con fecha actual, ronda con ingreso/votación abierta, GPS actual dentro del radio y auditoría. Origen `assisted`, diferenciado de `gps`. Restricción única por ronda/identidad conserva idempotencia. En desempate solo admite participantes de la ronda de origen.
4. Resultados incorpora el botón de preparar desempate después de elegir su política de asistencia; la apertura sigue siendo una acción separada.

## Validación

- Compilación Vite y 162 comprobaciones locales: 9 JavaScript, 73 SQL, 36 registro, 20 importación y 24 ubicación/asistencia.
- Base Supabase QA reactivada. Migración aplicada y 29 comprobaciones de recorrido electoral completadas dentro de una transacción revertida. La ronda QA que ya estaba en ingreso se cerró únicamente dentro de esa transacción y se restauró mediante ROLLBACK.
- Navegador → API local → PostgreSQL PGlite con las migraciones reales: simulacro, llegada/espera, apertura, selección exacta, envío, confirmación, cierre y resultados. Oficial con dos votantes ficticios produce empate en ambos últimos cupos. Reingresar no permite un segundo voto. Desempate reutiliza el padrón de origen, excluye a quien no participó, acepta un voto válido y muestra ganadores al cerrar.
- CSV descargado desde el navegador y revisado: año, tipo, ronda, candidato, género, votos y clasificación; sin identidad ni selección individual de votantes.
- Asistencia Rápida probada desde el navegador; muestra la persona existente, registra una sola asistencia, conserva la habilitación separada y no inventa un denominador cuando faltan identidades. Revisada a 320/390 píxeles sin desplazamiento horizontal del contenido.
- Producción: migración aplicada; 6 comprobaciones de instalación con fixtures descartados mediante ROLLBACK. Ubicación, herencia en nueva elección, búsqueda exacta, ausencia de efectos de la consulta, rechazo de ronda en preparación y falta de ejecución administrativa anónima.
- Se conserva la DEMO 2098 en ingreso, radio de 400 metros, cero participación y cero votos al instalar. No se abrió ni cerró la DEMO de la responsable. El test completo de producción se evitó al detectar esa ronda activa; la restricción de una sola ronda activa impidió que una primera prueba sintética la solapara y esa transacción se revirtió.

## Límites de la evidencia

El navegador aislado usa identidad administrativa y GPS simulados explícitamente en archivos de `tests/`; no certifica Auth remoto ni la precisión del GPS del iPhone. La producción usa el cliente Supabase y GPS reales, sin importar esos adaptadores. Los archivos de prueba no forman parte del build publicado. Para ejecución manual en la iglesia se necesitan permisos de ubicación precisa y estar dentro del radio. Esta entrega no declara anonimato criptográfico ni elimina pendientes de cobertura de miembros o decisiones de producto no confirmadas.

Los avisos del asesor de seguridad se revisaron: las funciones nuevas exigen Administración, tienen `search_path` fijo y ejecución anónima revocada. La tabla privada no necesita una política de acceso directo; ese acceso permanece denegado. Los avisos sobre otras funciones de Bethel/Auth son ajenos a esta entrega y no se presentan como resueltos.

## Reproducir pruebas

- `npm run test:all`
- `npm run build`
- `npm run dev:isolated` inicia una base en memoria y el adaptador HTTP para pruebas de navegador. La herramienta de preview administrado debe ejecutar ese script como comando dev temporal; restaurar `dev: vite` antes de empaquetar.
- Documentos: `SPEC_REGLAS_FUNCIONALES.md`, `SPEC_DE_DISENO.md`, `docs/Reglas_Votaciones_IMJ.md` y esta evidencia. Documento de reglas guardado conservando su identidad, versión 29.
