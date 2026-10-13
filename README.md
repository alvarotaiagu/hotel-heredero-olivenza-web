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
13. Barra de reserva fija (solo móvil)

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

## Paquete A «Acabado editorial y gestos» (2026-10-13)

Del documento «Ideas · Hotel Heredero (web) · 2026-10-13». Todo se apaga con movimiento reducido o sin GSAP.

- **Grano de papel:** `--grano` es una tesela SVG con `feTurbulence` en un data-URI (alfa ≈ 3 %). El navegador la rasteriza una vez y la repite; no hay canvas. Va sobre el papel y la cal, nunca sobre el azul ni la tinta. La regla va al final de `estilos.css` porque el `background` abreviado de cada sección la pisaría.
- **Rótulos de lámina:** «N.º 01 · Habitaciones»… con un contador de CSS en las `.eti[data-lamina]`. Si se quita el módulo taurino, o con la galería oculta, la numeración sigue seguida (en la «Sobria», la galería es la 07 y «Cómo llegar» la 08).
- **Coordenadas bajo el hero:** 38° 41′ 27″ N · 7° 05′ 38″ O. Salen del nodo de OpenStreetMap 6865899993 «Hotel Heredero», en la Carretera de Badajoz y con su mismo teléfono; Nominatim lo da en 38,69094 · −7,09385.
- **Aperturas en arco:** las fotos (`.arco`, `.salones__gran`, `.mesa__foto--ancha`) y las secciones de color (`.historia`, `.taurino`) entran por una puerta con la forma del portal que crece desde abajo.
  - Es una transición CSS de `clip-path` entre dos `path()` con los mismos comandos. La clase la pone un IntersectionObserver (`main.js` § 3b), y no hay ningún tween de GSAP sobre `clip-path`.
  - `recortar()` ya no escribe el `clip-path` en línea: deja el arco en la variable `--arco`. La apertura usa `--revela-0`/`--revela-1` y, al acabar, el JS quita las clases y queda el recorte de reposo.
  - Las secciones usan una puerta más ancha que la caja, que al final se quita, así que el pin de «Desde 1985» no queda recortado.
  - En la «Sobria», la apertura es un rectángulo (`inset`).
- **Cordón con volumen:** cada hebra tiene una luz en el lomo (un tercer path de óvalos estrechos, desplazados hacia la luz y en oro muy claro) y una sombra (el cuerpo desplazado 1–2 px, oscuro y semitransparente). Son **6 nodos por cordón**, sin filtros ni blur.
- **Cabecera:** al bajar, el logo pasa a la versión compacta, `marca/logo-compacto.svg`, que va en línea.
  - El compacto son los mismos trazados de `marco.svg` y `hh.svg`, sin los rótulos «Grupo Hoteles» y «Heredero», que a 34 px no se leen. No se redibuja nada, y casa trazo a trazo con el entero.
  - Sobre «Desde 1985» y sobre el pie, la cabecera pasa a azul con texto cal. En escritorio el pie es más bajo que la pantalla y no llega a la cabecera; en el móvil, sí.
- **Barra de reserva en el móvil** (< 1000 px): «Reservar» y «Llamar».
  - Sale al dejar el hero y se esconde sobre la reserva, en el pie, con el menú abierto y mientras está el aviso de cookies.
  - Funciona solo con observadores: ningún `resize` la toca. Con `?revision` el mando sube por encima.
- **El gesto se enseña solo:** en la primera visita de la sesión, cuando el cordón ya rodea el portal, la vista se desliza 60 px y vuelve con un muelle. Usa la misma `pintar()` que el dedo. No se hace con movimiento reducido ni si la persona ya ha arrastrado.
- **El nudo se aprieta:** «Reservar» del pie da un tirón al lazo (escala 0,96 y vuelta, 250 ms, con la Web Animations API) y luego lleva a la reserva.
  - Para eso, el cordón del pie son dos tramos seguidos: el arco del logo, que no se mueve, y el lazo.
  - `progreso()` reparte el dibujo entre los tramos según su longitud.

**Lo que guarda en el navegador** (también en el aviso de cookies y en `privacidad.html`):
- `localStorage` `heredero-cookies`: que ha visto el aviso.
- `sessionStorage` `heredero-gesto`: que ya se le enseñó el gesto. Se borra al cerrar la pestaña.

**Arreglos de la revisión del paquete D:**
- Los `select` de adultos y niños medían 11,5 px (iOS hacía zoom); ahora ningún campo baja de 16 px.
- `#r-habs` se sincroniza al cargar y en `pageshow`.
- Las anclas llevan el foco a su sección.
- `esBarra` solo actúa en táctil.
- `lagSmoothing(0)` también cuando no hay cortina.
- `movido` del carril ya no se queda colgado.
- `aria-hidden` en el SVG de la raya.

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
- Cada cordón son 6 nodos SVG: el trazo de la máscara, la sombra, el alma, dos `<path>` con todas las hebras de cada tono y la luz. Tiene un tope de 1.800 hebras.
- La máscara solo cubre la caja del cordón.
- Se construye cuando se acerca a la pantalla.
- Antes de estos arreglos había tareas de 1,5 s en móvil. El fotograma más largo durante la cortina era de 117 ms.
- **Paquete A (luz y sombra):** medido en un Pixel 7 emulado con CPU ×4 y GSAP/Lenis locales, contando solo los fotogramas desde que arranca la cortina hasta que se retira.
  - Con 10 pasadas de cada versión intercaladas, el fotograma más largo fue de 350–400 ms en la versión anterior y de 300–367 ms en esta. **No empeora.** El p95 sigue en 17 ms.
  - Sin estrangular la CPU, el máximo es de 33 ms en las dos.
  - Construir el cordón del portal cuesta unos 120 ms con CPU ×4. Se probó a adelantarlo a antes de la cortina y no bajaba el máximo, así que no se hizo.
  - Los fotogramas largos que quedan caen a +0,2 s y +0,4 s del arranque y no son de `Cordon.crear`.
  - Los 117 ms de arriba se midieron con otro método; para comparar, usa siempre el mismo método con las dos versiones intercaladas.

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
- **`node verificar.mjs --capturas`:** 108 comprobaciones, con capturas en `pruebas/`. GSAP y Lenis se sirven desde una copia local para que la cortina no dependa del CDN ese día. Comprueba:
  - la cortina: fotogramas a medias, el agujero sin fondo opaco y `display:none` en las tres pasadas;
  - los cordones, muestreando el `dashoffset` con la rueda;
  - el pin;
  - el POST del formulario de reserva (interceptado) y el `mailto` de eventos;
  - el visor por nombre;
  - las densidades;
  - el móvil: solapes de 360 a 768, arrastre táctil real, menú y la barra del móvil (0 `refresh`);
  - movimiento reducido, sin GSAP y CDN lento;
  - las recetas de borrado;
  - el paquete A:
    - el grano;
    - las láminas, leídas como se pintan con `DOMSnapshot`;
    - las coordenadas;
    - las aperturas congeladas a medias a 1440, a 390 y en la «Sobria»;
    - los nodos del cordón;
    - la cabecera;
    - la barra móvil;
    - el gesto y su `sessionStorage`;
    - el tirón del nudo;
    - los campos de 16 px o más;
  - el contraste;
  - que existen los 132 archivos que enlaza `index.html`.
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
