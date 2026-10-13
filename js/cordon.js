/* ------------------------------------------------------------------
   Cordón · Hotel Heredero
   El cordón manuelino de la web: un trenzado de dos cabos sobre un
   trazado guía. Cada «hebra» es una elipse girada respecto a la
   tangente; todas las de un tono van en UN solo <path> (dos tonos =
   dos paths), así que un cordón de 2.000 px son 3 nodos, no 500.
   Se descubre con una <mask> cuyo trazado blanco anima
   stroke-dashoffset (pathLength=1): progreso(0) oculto, progreso(1) entero.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let cuenta = 0;

  /* Geometría del marco del logo (marca/geometria.json), normalizada por el
     ancho de la línea central (875 px): un arco de semielipse con «hombros». */
  const LOGO = { repisa: 0.03826, hombro: 0.25989, rx: 0.49969, ry: 0.41945 };
  /* De dónde viene la luz que da volumen a las hebras (arriba, algo a la izquierda). */
  const LUZ = { x: -0.42, y: -0.91 };

  /* Portal abierto por abajo: sube por la izquierda, arco, baja por la derecha. */
  function portal(x, y, w, h, cerrar) {
    const sh = y + Math.min(LOGO.hombro * w, h * 0.62);
    const l = LOGO.repisa * w;
    const d = `M${f(x)},${f(y + h)} L${f(x)},${f(sh)} L${f(x + l)},${f(sh)}`
      + ` A${f(LOGO.rx * w)} ${f(LOGO.ry * w)} 0 0 1 ${f(x + w - l)},${f(sh)}`
      + ` L${f(x + w)},${f(sh)} L${f(x + w)},${f(y + h)}`;
    return cerrar ? d + ' Z' : d;
  }
  const f = (n) => (Math.round(n * 10) / 10).toString();

  /* El mismo portal como clip-path de CSS (en px de la caja). */
  function recortePortal(w, h) {
    return `path('${portal(0, 0, w, h, true)}')`;
  }

  function el(nombre, atrs, padre) {
    const e = document.createElementNS(NS, nombre);
    for (const k in atrs) e.setAttribute(k, atrs[k]);
    if (padre) padre.appendChild(e);
    return e;
  }

  /* svg: <svg> destino (su viewBox ya en px de su caja).
     d: trazado guía.  op.grosor: diámetro del cordón en px. */
  function crear(svg, d, op) {
    op = op || {};
    const g = Math.max(3, op.grosor || 7);
    const id = 'cordon-m' + (++cuenta);

    const guia = el('path', { d }, null);
    svg.appendChild(guia);                     // hay que estar en el DOM para medir
    const L = guia.getTotalLength();
    const caja = guia.getBBox();
    guia.remove();

    // paso entre hebras; tope de hebras para que un cordón larguísimo no pese
    let paso = g * 0.6;
    if (L / paso > 1800) paso = L / 1800;
    const n = Math.max(2, Math.floor(L / paso));
    const rx = g * 0.62, ry = g * 0.27;
    // la luz del lomo: un óvalo más estrecho en la cara de cada hebra que mira a la luz
    const lrx = rx * 0.6, lry = Math.max(0.35, ry * 0.32), lsep = ry * 0.42;
    // UNA muestra por hebra (getPointAtLength es caro); la tangente sale de las vecinas
    const pts = new Array(n + 1);
    for (let i = 0; i <= n; i++) pts[i] = guia.getPointAtLength((i / n) * L);
    let a = '', b = '', luz = '';
    const ovalo = (cx, cy, ex, ey, erx, ery, deg) => `M${f(cx + ex)},${f(cy + ey)}A${f(erx)} ${f(ery)} ${deg} 1 0 ${f(cx - ex)},${f(cy - ey)}`
      + `A${f(erx)} ${f(ery)} ${deg} 1 0 ${f(cx + ex)},${f(cy + ey)}Z`;
    for (let i = 0; i <= n; i++) {
      const c = pts[i];
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n, i + 1)];
      const th = Math.atan2(p1.y - p0.y, p1.x - p0.x) + 1.01;   // ~58° de torsión
      const co = Math.cos(th), si = Math.sin(th);
      const deg = f(th * 180 / Math.PI);
      const e = ovalo(c.x, c.y, co * rx, si * rx, rx, ry, deg);
      if (i % 2) a += e; else b += e;
      // normal de la hebra hacia la luz (arriba a la izquierda): ahí brilla el oro
      let nx = -si, ny = co;
      if (nx * LUZ.x + ny * LUZ.y < 0) { nx = -nx; ny = -ny; }
      luz += ovalo(c.x + nx * lsep, c.y + ny * lsep, co * lrx, si * lrx, lrx, lry, deg);
    }

    // la máscara solo cubre la caja del cordón: repintar una máscara del tamaño
    // de la pantalla en cada fotograma ahogaba los móviles (medido en Pixel 7)
    const mg = g * 3;
    const defs = el('defs', {}, svg);
    const mask = el('mask', {
      id, maskUnits: 'userSpaceOnUse',
      x: f(caja.x - mg), y: f(caja.y - mg), width: f(caja.width + 2 * mg), height: f(caja.height + 2 * mg),
    }, defs);
    const trazo = el('path', {
      d, fill: 'none', stroke: '#fff', 'stroke-width': f(g * 3.2),
      'stroke-linecap': 'butt', 'stroke-linejoin': 'round',
      pathLength: '1', 'stroke-dasharray': '1 2', 'stroke-dashoffset': '1',
    }, mask);

    // 6 nodos por cordón: el trazo de la máscara + sombra, alma, dos cabos y luz.
    // Sin filtros ni blur: la sombra es el cuerpo desplazado 1-2 px y la luz, otro path.
    const grupo = el('g', { class: 'cordon__cuerpo', mask: `url(#${id})` }, svg);
    const so = Math.max(1, Math.min(2, g * 0.2));
    el('path', { d, class: 'cordon__sombra', fill: 'none', 'stroke-width': f(g * 1.1), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', transform: `translate(${f(so * 0.5)} ${f(so)})` }, grupo);
    el('path', { d, class: 'cordon__alma', fill: 'none', 'stroke-width': f(g * 0.78), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, grupo);
    el('path', { d: b, class: 'cordon__cabo-a', 'stroke-width': f(g * 0.07) }, grupo);
    el('path', { d: a, class: 'cordon__cabo-b', 'stroke-width': f(g * 0.07) }, grupo);
    el('path', { d: luz, class: 'cordon__luz' }, grupo);

    let ultimo = -1;
    const api = {
      longitud: L,
      grupo,
      progreso(p) {
        p = Math.max(0, Math.min(1, p));
        // el umbral ahorra repintados, pero los extremos se aplican siempre
        // (si no, el último paso de un tween se quedaba en 0,9998)
        if (Math.abs(p - ultimo) < 0.0005 && p !== 0 && p !== 1) return;
        if (p === ultimo) return;
        ultimo = p;
        trazo.setAttribute('stroke-dashoffset', f4(1 - p));
      },
      valor: () => ultimo,
    };
    api.progreso(op.progreso != null ? op.progreso : 0);
    return api;
  }
  const f4 = (n) => (Math.round(n * 10000) / 10000).toString();

  /* Vacía y dimensiona un <svg class="cordon"> a SU PROPIA caja (no la del
     padre: el del portal sobresale 14 px y el viewBox del padre lo reescalaba). */
  function lienzo(svg) {
    const caja = svg.getBoundingClientRect();
    while (svg.firstChild) svg.firstChild.remove();
    svg.setAttribute('viewBox', `0 0 ${f(caja.width)} ${f(caja.height)}`);
    return { w: caja.width, h: caja.height, caja };
  }

  window.Cordon = { crear, portal, recortePortal, lienzo, LOGO };
})();
