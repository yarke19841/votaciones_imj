# Especificaciones de Votaciones IMJ

Actualizado: 17 de octubre de 2026 (Panamá).

Este índice reúne los SPEC del repositorio. Un requisito documentado no acredita que esté implementado, desplegado o aprobado mediante pruebas.

| Documento | Ámbito |
| --- | --- |
| [Reglas consolidadas actuales](./Reglas_Votaciones_IMJ.md) | Decisiones confirmadas por Yarquelis, reglas electorales y pendientes; lectura inicial obligatoria. |
| [SPEC de reglas funcionales](../SPEC_REGLAS_FUNCIONALES.md) | Requisitos identificados RF, procesos, permisos y criterios funcionales. Conserva importación/exportación del padrón como requisitos sujetos a verificación de implementación. |
| [SPEC de diseño](../SPEC_DE_DISENO.md) | Identidad, logo, colores, tipografía compartida, componentes, referencias visuales y adaptación responsive. |

## Precedencia

1. Instrucciones y correcciones más recientes de Yarquelis.
2. Reglas consolidadas actuales de `Reglas_Votaciones_IMJ.md`.
3. SPEC funcional y de diseño, cada uno dentro de su ámbito y conservando lo vigente que no contradiga las decisiones anteriores.

Los elementos provisionales de capturas antiguas no invalidan decisiones posteriores. El logo oficial recibido el 17 de octubre reemplaza la «J» y la paloma provisional: base circular blanca, diseño azul marino y exterior integrado al fondo, sin recuadro rectangular. Colores y tipografía se comparten entre Administración, votantes y móvil; los valores y la familia técnica aproximada se documentan en el SPEC de diseño.

## Referencias y evidencia

- [Entrega de la demo para pruebas](./ENTREGA_DEMO.md): importación territorial, exportación, excepciones GPS, verificación y recorrido.

- [Logo oficial original de Ministerio Jezreel](./referencias/Logo_Oficial_Jezreel.png).
- [Referencia administrativa aprobada](./referencias/Referencia_Administracion_IMJ.jpeg): candidatos oficiales, resultados y catálogo del simulacro. Los datos ilustrativos no son datos de producción.
- [Estado verificable y aceptación](./REAL_ACCEPTANCE.md): evidencia fechada, pruebas realizadas y límites; no es una fuente de nuevas reglas de negocio.

Conservar los originales en `docs/referencias/` junto al código para que el proyecto no dependa únicamente de enlaces externos. Las variantes aplicadas en la interfaz deben preservar el emblema y permitir comparar con esos originales. Los enlaces Figma del SPEC de diseño son referencias externas; no prueban que se hayan cargado o validado sus imágenes.

Al actualizar una regla, registrar la decisión sin borrar requisitos vigentes, conciliar los SPEC afectados y mantener separado el estado de implementación. No resolver pendientes sensibles mediante suposiciones ni declarar listas funciones sin evidencia.
