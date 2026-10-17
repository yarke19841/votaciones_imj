# SPEC DE DISEÑO — Votaciones IMJ

**Identificador:** SPEC-UI-001  
**Estado:** Vigente — estándar de diseño  
**Ámbito:** Todas las pantallas del sistema Votaciones IMJ

## 1. Objetivo
Mantener una identidad visual uniforme basada en las pantallas existentes y aprobadas. Una modificación funcional no autoriza un rediseño.

## 2. Fuente de verdad
Las pantallas existentes y aprobadas del repositorio son la referencia visual oficial. Antes de desarrollar o modificar una pantalla, revisar la pantalla equivalente y sus componentes.

Conservar estructura, distribución, colores, fondos, tipografía, espaciados, márgenes, alineación, encabezados, navegación, tarjetas, tablas, indicadores, botones, campos, estados, mensajes y comportamiento responsive.

No introducir nuevos patrones visuales sin aprobación.

## 3. Pantallas nuevas y derivadas
- Reutilizar componentes y estilos existentes.
- Si hay una pantalla equivalente, replicar fielmente su presentación.
- Si no existe un patrón equivalente, solicitar aprobación antes de introducirlo.
- No cambiar otras pantallas por efecto secundario de una modificación.

## 4. Caso de referencia: Asistencia Rápida
**Original:** `AdminCheckIn.jsx`  
**Derivada:** `AdminQuickCheckIn.jsx`

La pantalla derivada debe conservar exactamente el diseño original: distribución, encabezado, campos, botones, tarjetas, panel de participación y comportamiento responsive.

**Únicos cambios funcionales y textuales autorizados:**
1. Título: **⚡ Asistencia Rápida**.
2. Búsqueda únicamente por cédula.
3. Eliminar y deshabilitar la creación rápida de miembros, tanto su formulario como su función en este componente.
4. Conservar la acción de activar miembros de la pantalla original.
5. Conservar los selectores de elección, fecha y tipo de jornada (práctica/final).
6. Conservar el panel y los estilos de indicadores de participación.

No modificar las reglas electorales, permisos ni lógica de asistencia por motivos de diseño.

## 5. Componentes compartidos
Preferir componentes y estilos centralizados para Button, Input, Select, Card, StatusBadge, KPIBox y PageHeader. Los nombres y rutas son orientativos: adaptar a la estructura real del repositorio sin crear duplicados innecesarios.

## 6. Procedimiento obligatorio
1. Identificar la pantalla aprobada de referencia.
2. Comparar su implementación y estilos.
3. Cambiar solo lo solicitado.
4. Reutilizar los componentes existentes.
5. Comprobar que no se afectaron otros módulos.
6. Comparar visualmente antes y después en móvil y escritorio.
7. Solicitar aprobación para diferencias visuales nuevas.

## 7. Criterios de aceptación QA
- [ ] Diseño consistente con la pantalla aprobada.
- [ ] Tipografía, colores, espaciados y componentes equivalentes.
- [ ] Estados de botones, campos y mensajes consistentes.
- [ ] Distribución responsive coherente en móvil y escritorio.
- [ ] Funcionalidades existentes preservadas.
- [ ] Sin diferencias visuales no autorizadas.
- [ ] Sin regresiones en las demás pantallas.

## 8. Instrucción obligatoria para agentes
> Utiliza las pantallas existentes y aprobadas como fuente de verdad del diseño. No crees estilos, estructuras, componentes visuales ni distribuciones diferentes cuando exista una referencia equivalente. Conserva la identidad visual del sistema y modifica únicamente la funcionalidad solicitada. Solicita aprobación antes de introducir nuevos patrones visuales.

**Principio rector:** Una sola identidad visual, múltiples módulos, experiencia consistente.

## 9. Referencias visuales en Figma

**Archivo de referencia:** [Votaciones IMJ — Referencias visuales aprobadas](https://www.figma.com/design/EbqaWBgNWuUSs2mhloRfh5)

Este archivo centraliza las referencias visuales del módulo de votaciones. **Estado actual: pendiente de incorporar las imágenes originales aprobadas y de validar cada pantalla.** La creación del archivo no implica aprobación de nuevos diseños.

Una vez incorporadas las imágenes originales, registrar para cada pantalla su nombre, enlace al frame/nodo específico, fecha de aprobación y correspondencia con el componente del repositorio. Los agentes deben comparar contra esas referencias antes de modificar la interfaz. No inventar ni recrear imágenes en sustitución de las aprobadas.

## 10. Inventario de imágenes de referencia recibidas (16-10-2026)

Las siguientes capturas fueron proporcionadas por la responsable del proyecto como referencias visuales. **No se deben recrear ni sustituir por imágenes generadas.** La carga de sus archivos originales en Figma permanece pendiente de confirmación técnica.

| Referencia | Imagen recibida | Contenido | Aplicación |
| --- | --- | --- | --- |
| IMJ-MOV-01 | IMG_2725.jpeg | Ingreso por cédula, espera, selección de 2 mujeres y 3 hombres, confirmación de voto | Votación móvil IMJ |
| IMJ-ADM-01 | 312E94F7-4EEC-430F-996C-64DC35BDE0B3(1).jpeg | Candidatos oficiales, resultados, catálogo de simulacro | Administración IMJ |
| IMJ-ADM-01 (duplicada) | 312E94F7-4EEC-430F-996C-64DC35BDE0B3.jpeg | Misma composición administrativa | No generar diseño adicional |
| IMJ-ADM-01 (duplicada) | 312E94F7-4EEC-430F-996C-64DC35BDE0B3(2).jpeg | Misma composición administrativa | No generar diseño adicional |
| IMJ-ADM-01 (captura de visor) | IMG_2729.jpeg | Misma composición en captura con márgenes negros | No utilizar márgenes del visor como diseño |
| BETHEL-ADM-01 | IMG_2730.jpeg | Panel de votaciones y habilitados de Bethel | Referencia exclusiva Bethel |

### 10.1 Separación de identidades
- **IMJ:** azul marino, blanco y azul claro, con paloma institucional y estilo mostrado en las capturas de IMJ.
- **Bethel:** identidad propia de la captura de Bethel; no trasplantar logotipo, tipografía o paleta de Bethel a IMJ.
- Los nombres, cifras, fotografías y fechas que aparecen en las propuestas son datos ilustrativos, no datos de producción.

### 10.2 Criterio para agentes
Comparar cada nueva pantalla contra la imagen correspondiente a su iglesia y módulo. Mantener la navegación lateral, jerarquía, espaciados, tarjetas y controles de la referencia, salvo modificación expresamente aprobada. La referencia móvil y la de escritorio responden a contextos de uso diferentes; no trasladar un layout de escritorio a móvil sin adaptación.

**Figma:** [Votaciones IMJ — Referencias visuales aprobadas](https://www.figma.com/design/EbqaWBgNWuUSs2mhloRfh5). Hasta que se complete la carga y se registren IDs de frames, este enlace corresponde al archivo contenedor y no constituye evidencia de que las capturas ya estén colocadas en su lienzo.
