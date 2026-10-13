# Hotel Heredero *** · Olivenza · «El portal»

Rediseño de `hotelheredero.net`. La web actual es una plantilla de Paraty Tech de hacia 2013: sin HTTPS, no responsive, con jQuery 1.8. Esta versión está en local, con `noindex` en todas las páginas y **sin publicar**.

- **Encargo:** `../hotel-heredero-olivenza-bocetos/PROMPT-A-portal.md`
- **Datos y fuentes:** `../hotel-heredero-olivenza-bocetos/DATOS-HEREDERO.md`
- **Bocetos:** `../hotel-heredero-olivenza-bocetos/index.html` (se eligió A con lo mejor de B y C el 2026-10-13)

## Concepto: «Cordón»

El logo del hotel es un **portal**: un arco con hombros sobre un rectángulo, un HH con las barras en S y tres estrellas. Olivenza fue portuguesa casi cinco siglos, y su manuelino está lleno de cordones (las columnas torsas de la Magdalena parecen cabos de barco).

La web es un **cordón de oro trenzado** que:

1. **Cortina:** dibuja el portal del logo con el HH dentro. Después el portal se abre como un agujero que crece y deja ver el hero.
2. **Hero:** rodea la foto, que va dentro del arco del logo. La panorámica de la fachada **se arrastra con el dedo** para mirar por la puerta.
3. **Habitaciones:** cuelga en **festón** bajo los arcos de las fotos.
4. **Salones:** entra con la **S** de las H, pasa por detrás de la foto del banquete y baja por el margen.
5. **Desde 1985:** es una **columna torsa** pineada. Se dibuja mientras el contador pasa de 36 a 152 habitaciones.
6. **Olivenza:** hace de **raya** de frontera, con Olivenza a un lado y Portugal (Elvas) al otro.
7. **Pie:** cierra el arco **alrededor del logo** y **se anuda en «Reservar»**. Es el objeto que se completa al final.

### Paleta

Los colores están medidos, no elegidos a ojo.

| Token | Color | De dónde sale |
|---|---|---|
| tinta | `#231E20` | logo |
| cal | `#F5EBD3` | fachada |
| azul | `#132638` | cristal de la entrada |
| oro | `#B08A3E` / `#D9B76E` | solo el cordón: nunca texto sobre claro |

Contrastes medidos por `verificar.mjs`: todos ≥ 5,6:1.

### Letras

- **Gloock** para títulos, por su cercanía a la didona del HH.
- **Albert Sans** para el texto.
- El logo no se ha redibujado: es un calco SVG con un 98,8 % de coincidencia con el original (`marca/`).

## Mapa de secciones

1. Cortina «el portal»
2. Hero con el portal arrastrable
3. **Consultar disponibilidad**: un formulario real que hace POST al motor de Paraty
4. Habitaciones
5. Salones Olivenza, con carril de fotos, visor y el formulario «Cuéntenos su celebración» (prepara un `mailto:`)
6. A la mesa
7. Desde 1985
8. Olivenza
9. *Módulo taurino* (se puede quitar)
10. *Galería* (solo en la versión «Sobria»)
11. Cómo llegar, con el mapa solo bajo clic
12. Pie «el nudo»

### Reservas

El formulario envía a `https://heredero-olivenza-dot-hoteles-heredero.appspot.com/booking1`, el mismo motor que usa su web hoy. Lleva `startDate`/`endDate` en `dd/mm/aaaa`, `numRooms` y `adultsRoom1..3`/`childrenRoom1..3`, y se abre en una pestaña nueva.

Se probó el 2026-10-13: abre el paso 1 con las fechas ya puestas. **Si Paraty cambia el endpoint, esto deja de funcionar.** Hay que confirmarlo con el hotel antes de publicar.

## §5 bis «Nivel»

- **Se quitan del kit común:** la pila sticky, la marquesina y el cursor propio. También los botones magnéticos.
- **Se añade:** el cordón trenzado (`js/cordon.js`) y **la puerta que se mira arrastrando**.
- **Gesto táctil del hero:** arrastre horizontal con inercia y vuelta a los topes, con `touch-action: pan-y`. El scroll vertical sobre el portal sigue funcionando (probado con eventos táctiles reales). En teclado, flechas con el portal enfocado.
- **El objeto se completa en el pie:** el cordón cierra el portal alrededor del logo y se anuda en «Reservar».
- **Foco del teclado con forma de portal:** el arco arriba (`border-radius` de arco), en azul sobre claro y oro sobre oscuro.
- **Opción de menú elegida: inactividad.** A los 18 s sin tocar nada, el portal enseña la siguiente vista con un fundido (fachada → terraza → salón con ventanal). No guarda nada en el navegador.

### Presupuesto de rendimiento

Medido el 2026-10-13 en un Pixel 7 emulado, con 4G lento (1,6 Mbps, 150 ms) y CPU ×4, con los CDN reales. Son tres pasadas (`PerformanceObserver`).

| Medida | Resultado |
|---|---|
| **LCP** | **2,47 / 2,60 / 2,57 s**. El elemento es la foto de la fachada, que va precargada con `<link rel="preload">` en AVIF. En una pasada anterior salió 4,2 s porque los CDN compiten por la red. |
| **INP** | **40 ms** (abrir y cerrar el menú). |
| **Cortina** | `main.js` llega a los ~2,3 s y la cortina se retira a los ~5,2 s. |

Sobre la cortina:
- Si GSAP llega **después de 2,5 s**, la cortina no se anima.
- Si a los 2,6 s ningún script la ha tomado, **se va sola por CSS**.

Rendimiento del cordón:
- Cada cordón son 4 nodos SVG (dos `<path>` con todas las hebras de cada tono). Tiene un tope de 1.800 hebras.
- La máscara solo cubre la caja del cordón.
- Se construye cuando se acerca a la pantalla.
- Antes de estos arreglos había tareas de 1,5 s en móvil. El fotograma más largo durante la cortina es ahora de 117 ms.

**Para bajar de 2 s** habría que mostrar la cortina solo una vez por sesión o quitarla en móvil. Es una decisión de Álvaro, porque chocaría con la cortina obligatoria del PLIEGO.

## Mando de densidades (solo con `?revision`)

Hay dos versiones:
- **«Cordón»:** el cordón en todas las secciones y todas las fotos en arco.
- **«Sobria»:** el cordón solo en la cortina, el portal, la columna y el nudo, y las fotos rectas salvo la del hero. **Añade** una galería completa filtrable (30 fotos: Habitaciones · Salones · Cafetería · El hotel).

El mando no guarda nada en el navegador. La URL lleva `&densidad=sobria` para volver a ella.

### Receta de borrado del mando (comprobada por `verificar.mjs`)

1. En `index.src.html`:
   - borra el bloque entre `<!-- ============ MANDO DE MAQUETA` y `fin del MANDO DE MAQUETA ============ -->`;
   - en el script del `<head>`, borra las líneas de `// MANDO DE MAQUETA (no viaja al cliente)` hasta su `}`.
2. En `js/main.js`, borra el bloque `16. MANDO DE MAQUETA` hasta `fin del MANDO DE MAQUETA`.
3. Opcional: en `css/estilos.css`, borra el bloque `.mando`. Las reglas `densidad-sobria` y la sección `#galeria` quedan inertes y también se pueden borrar.
4. Ejecuta `node construir.mjs`.

### Receta de borrado del módulo taurino (comprobada)

1. En `index.src.html`, borra entre `<!-- ============ 8. MÓDULO TAURINO` y `fin del MÓDULO TAURINO ============ -->`, y quita el `<link>` de `css/taurino.css`.
2. Borra `css/taurino.css`.
3. Ejecuta `node construir.mjs`.

## Cómo se trabaja

- **Edita siempre los `*.src.html`.** `node construir.mjs` genera los `.html`:
  - convierte cada `<img data-foto="nombre">` en un `<picture>` con AVIF, WebP y JPG en todos los anchos de `img/fotos/fotos.json`;
  - mete en línea el HH de la cortina;
  - pone `?v=<huella>` a CSS y JS (con `versionar.mjs`).
- **`node verificar.mjs --capturas`:** 81 comprobaciones, con capturas en `pruebas/`. GSAP y Lenis se sirven desde una copia local para que la cortina no dependa del CDN ese día. Comprueba:
  - la cortina: fotogramas a medias, el agujero sin fondo opaco y `display:none` en las tres pasadas;
  - los cordones, muestreando el `dashoffset` con la rueda;
  - el pin;
  - el POST del formulario de reserva (interceptado) y el `mailto` de eventos;
  - el visor por nombre;
  - las densidades;
  - el móvil: solapes de 360 a 768, arrastre táctil real, menú y la barra del móvil (0 `refresh`);
  - movimiento reducido, sin GSAP y CDN lento;
  - las recetas de borrado;
  - el contraste;
  - que existen los 137 archivos que enlaza `index.html`.
- **Fotos:** son las de su propia web, con una gradación común (sutil) y en formatos responsive. La receta está en el scratchpad de la sesión.
  - No se usan las de banco de imágenes de su web (la pareja y el toro).
  - **Están casi todas a 800 px y las panorámicas a 1920×650. Ninguna se amplía por encima de su tamaño.** El portal del hero no pasa de 650 px de alto por eso.

## Pendientes para el hotel

- [ ] Originales de las fotos a resolución completa, y fotos del restaurante Puente Ajuda (ahora solo hay de la cafetería, rotuladas como tal) y de la fachada nueva.
- [ ] El logo en vector y el nombre de su tipografía (el SVG actual es un calco al 98,8 %).
- [ ] El nombre del fundador (1985) y si quiere salir en «Desde 1985». Las fechas de las ampliaciones entre 1985 y 2003.
- [ ] Aforo y nombre de cada uno de los seis salones.
- [ ] Ofertas y precios vigentes (no se publica ninguno).
- [ ] Si el sello SICTED «Compromiso de Calidad Turística» sigue vigente.
- [ ] Confirmar con Paraty que el motor acepta reservas desde otro dominio (hoy funciona) y la URL de «Mis reservas» con HTTPS (la actual es `http://`).
- [ ] Titular y NIF para el aviso legal y la privacidad (marcados como pendientes).
- [ ] Dominio y HTTPS. El objetivo de la propuesta es justo ese: hoy la web no tiene SSL.

## Decisiones

- **Sin opiniones ni nota de Google** (3,8 con 1.445 reseñas). La prueba social son cifras propias: 1985, 152 habitaciones, 900 invitados.
- **Solo en castellano.**
- **Trato de usted.**
- **Lo taurino es un módulo tipográfico** que se puede quitar. Solo dice lo comprobado: su tradición y que la Feria del Toro de marzo abre la temporada.
- **Olivenza:** solo datos comprobados y sin distancias. No se citan la esfera armilar ni el cordón de la portada del Ayuntamiento porque no están verificados.
