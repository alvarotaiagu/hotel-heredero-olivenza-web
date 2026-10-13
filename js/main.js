/* ------------------------------------------------------------------
   Hotel Heredero · Olivenza · «El portal»
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const hayGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fino = matchMedia('(pointer: fine)').matches;
  const ancho = () => matchMedia('(min-width: 900px)').matches;
  // «con-movimiento» SOLO con GSAP y sin movimiento reducido: si no, los
  // titulares partidos se quedarían escondidos.
  const motion = hayGSAP && !quieto;
  if (motion) raiz.classList.add('con-movimiento');
  if (hayGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    // el resize lo gestionamos nosotros (la barra del móvil no rehace nada)
    ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load', ignoreMobileResize: true });
  }

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA
  let anchoVista = innerWidth, altoVista = innerHeight;
  // (solo en táctil: en escritorio, estirar la ventana en alto sí tiene que rehacer el pin)
  const esBarra = () => !fino && innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. titulares partidos en palabras ============ */
  function partir(h) {
    if (h.classList.contains('es-partido')) return;
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    let n = 0;
    const envolver = (nodo) => {
      if (nodo.nodeType === 3) {
        const frag = document.createDocumentFragment();
        nodo.textContent.split(/(\s+)/).forEach((t) => {
          if (!t.trim()) { frag.appendChild(document.createTextNode(t)); return; }
          const pal = document.createElement('span');
          pal.className = 'pal';
          pal.setAttribute('aria-hidden', 'true');
          const i = document.createElement('i');
          i.textContent = t;
          i.style.setProperty('--n', n++);
          pal.appendChild(i);
          frag.appendChild(pal);
        });
        nodo.replaceWith(frag);
      } else if (nodo.nodeType === 1) {
        Array.from(nodo.childNodes).forEach(envolver);
      }
    };
    Array.from(h.childNodes).forEach(envolver);
    h.classList.add('es-partido');
  }
  if (motion) {
    // los de abajo se parten ya; el del hero, cuando se abre la cortina (LCP)
    const vistos = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('es-visto'); vistos.unobserve(e.target); }
    }), { rootMargin: '0px 0px -12% 0px' });
    $$('[data-partir]').forEach((h) => {
      if (h.closest('.hero')) return;
      partir(h);
      vistos.observe(h);
    });
  }

  /* ============ 2. Lenis ============ */
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, lerp: 0.12 });
    if (hayGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
    } else {
      const bucle = (t) => { lenis.raf(t); requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }
  }
  const irA = (sel) => {
    const el = $(sel);
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - (sel === '#reservar' ? 0 : 70);
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
  };

  /* ============ 3. arcos: el marco del logo como recorte ============ */
  // El recorte va en la variable --arco (no en style.clipPath) para que la
  // apertura en arco (3b) pueda pasar por encima con sus propias clases.
  const recortar = (el) => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    el.style.setProperty('--arco', Cordon.recortePortal(w, h));
    el.classList.add('es-recortado');
  };
  const roArcos = new ResizeObserver((es) => es.forEach((e) => recortar(e.target)));
  $$('[data-arco]').forEach((el) => { recortar(el); roArcos.observe(el); });

  /* ============ 3b. aperturas en arco ============
     Fotos y secciones de color entran por una puerta con la forma del portal
     que crece desde abajo. Una transición CSS de clip-path entre dos path()
     con los mismos comandos (el navegador interpola cada número); la clase la
     pone un IntersectionObserver. Nada de GSAP sobre clip-path. Sin GSAP o con
     movimiento reducido no hay «con-movimiento» y todo está ya a la vista. */
  const REVELA = '.arco:not(.portal__ventana), .salones__gran, .mesa__foto--ancha, .historia, .taurino';
  // la puerta P(x,y,w,h) escalada s veces desde el punto (ox,oy)
  const puerta = (x, y, w, h, ox, oy, s) => `path('${Cordon.portal(ox + (x - ox) * s, oy + (y - oy) * s, w * s, h * s, true)}')`;
  function abrir(el) {
    const w = el.clientWidth, h = el.clientHeight;
    if (el.hasAttribute('data-arco')) {
      // la foto ya va en arco: la puerta es su propio recorte, que crece desde el pie
      el.style.setProperty('--revela-0', puerta(0, 0, w, h, w / 2, h, 0.02));
    } else {
      // rectángulo: una puerta más ancha que la caja, cuyos hombros quedan por
      // encima de las esquinas, crece desde el borde de abajo de lo que se ve
      const pw = w * 1.7, x = (w - pw) / 2, y = -pw * 0.12, ph = Math.max(h - y, pw * 0.5) + 2;
      const vista = innerHeight - el.getBoundingClientRect().top;     // solo se lee al abrirse
      const oy = Math.max(Math.min(h, vista - 8), Math.min(h, 40));
      el.style.setProperty('--revela-0', puerta(x, y, pw, ph, w / 2, oy, 0.02));
      el.style.setProperty('--revela-1', puerta(x, y, pw, ph, w / 2, oy, 1));
    }
    getComputedStyle(el).clipPath;                 // fija el punto de partida antes de la transición
    el.classList.add('es-abriendo', 'es-abierto');
    let hecho = false;
    const fin = (e) => {
      if (hecho || (e && (e.target !== el || e.propertyName !== 'clip-path'))) return;
      hecho = true;
      el.removeEventListener('transitionend', fin);
      // de vuelta al estado de reposo: la foto con su arco, la sección sin recorte
      el.classList.remove('revela', 'es-abriendo', 'es-abierto');
      el.style.removeProperty('--revela-0');
      el.style.removeProperty('--revela-1');
    };
    el.addEventListener('transitionend', fin);
    setTimeout(fin, 2200);                         // por si la transición no llega a correr
  }
  if (motion) {
    const ioRevela = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      ioRevela.unobserve(e.target);
      abrir(e.target);
    }), { rootMargin: '0px 0px -12% 0px' });
    $$(REVELA).forEach((el) => { el.classList.add('revela'); ioRevela.observe(el); });
  }

  /* ============ 4. cordones de cada sección ============ */
  const rel = (el, base) => {
    const r = el.getBoundingClientRect(), b = base.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
  };
  const f = (n) => Math.round(n * 10) / 10;

  // margen libre a los lados (el «canal» por donde baja el cordón sin pisar texto)
  const canal = (seccion) => {
    const env = $('.env', seccion);
    const g = env ? env.getBoundingClientRect().left - seccion.getBoundingClientRect().left : 16;
    return Math.max(8, Math.min(g / 2, 60));
  };

  /* Nudo alrededor de un botón (caja b), llegando desde (ax, ay). */
  function nudo(b, m, ax, ay) {
    const x0 = b.x - m, y0 = b.y - m, x1 = b.x + b.w + m, y1 = b.y + b.h + m;
    const ym = (y0 + y1) / 2;
    return ` C${f(ax)},${f(ym + (y1 - y0) * 1.6)} ${f(x0 - m * 3)},${f(y1 + m)} ${f(x0)},${f(ym)}`
      + ` C${f(x0)},${f(y0 - m)} ${f(x0 + m * 2)},${f(y0)} ${f((x0 + x1) / 2)},${f(y0)}`
      + ` L${f(x1 - m * 2)},${f(y0)} C${f(x1 + m)},${f(y0)} ${f(x1 + m)},${f(y1)} ${f(x1 - m * 2)},${f(y1)}`
      + ` L${f(x0 + (x1 - x0) * 0.42)},${f(y1)} C${f(x0 + (x1 - x0) * 0.2)},${f(y1)} ${f(x0 + (x1 - x0) * 0.25)},${f(y0 + (y1 - y0) * 0.2)} ${f(x0 + (x1 - x0) * 0.08)},${f(y1 + m * 3.5)}`;
  }

  const CONSTRUCTORES = {
    portal(svg, L) {
      const v = rel($('#portal-ventana'), svg);
      const m = ancho() ? 9 : 7;
      return { d: Cordon.portal(v.x - m, v.y - m, v.w + 2 * m, v.h + m + (ancho() ? 0 : m)), grosor: ancho() ? 8 : 6 };
    },
    feston(svg, L) {
      const arcos = $$('#habs-arcos .arco').map((a) => rel(a, svg));
      const filas = [];
      arcos.forEach((a) => {
        const fila = filas.find((r) => Math.abs(r[0].y - a.y) < 8);
        fila ? fila.push(a) : filas.push([a]);
      });
      const caida = Math.min(30, L.w * 0.04);
      let d = '';
      filas.forEach((fila) => {
        fila.sort((p, q) => p.x - q.x);
        const yb = Math.max(...fila.map((a) => a.y + a.h)) + 8;
        const xs = [fila[0].x - 14];
        for (let i = 0; i < fila.length - 1; i++) xs.push((fila[i].x + fila[i].w + fila[i + 1].x) / 2);
        xs.push(fila[fila.length - 1].x + fila[fila.length - 1].w + 14);
        d += `M${f(xs[0])},${f(yb)}`;
        for (let i = 1; i < xs.length; i++) d += ` Q${f((xs[i - 1] + xs[i]) / 2)},${f(yb + caida * 2)} ${f(xs[i])},${f(yb)}`;
      });
      return { d, grosor: ancho() ? 7 : 5 };
    },
    ese(svg, L) {
      const sec = svg.parentElement;
      const c = canal(sec);
      const foto = rel($('.salones__gran', sec), svg);
      const W = L.w, H = L.h;
      const ya = 52, xr = W - c, xl = c;
      const d = `M-20,${ya} C${f(W * .22)},${ya - 40} ${f(W * .32)},${ya + 46} ${f(W * .55)},${ya + 10}`
        + ` S${f(xr)},${ya - 12} ${f(xr)},${ya + 60}`
        + ` L${f(xr)},${f(foto.y + foto.h * .5)}`
        + ` C${f(xr)},${f(foto.y + foto.h * .9)} ${f(xl)},${f(foto.y + foto.h * .6)} ${f(xl)},${f(foto.y + foto.h + 40)}`
        + ` L${f(xl)},${f(H - 140)} C${f(xl)},${f(H - 60)} ${f(W * .2)},${f(H - 40)} ${f(W * .5)},${f(H - 26)}`;
      return { d, grosor: ancho() ? 7 : 5 };
    },
    columna(svg, L) {
      const W = L.w, H = L.h;
      // columna torsa: un solo cordón vertical y grueso; sus hebras oblicuas son la torsión
      const g = Math.max(16, Math.min(W * 0.36, 40));
      return { d: `M${f(W / 2)},${f(g * 0.4)} L${f(W / 2)},${f(H - g * 0.4)}`, grosor: g };
    },
    raya(svg, L) {
      const W = L.w, H = L.h, y = H / 2, a = H * 0.18;
      let d = `M-20,${f(y)}`;
      const tramos = Math.max(3, Math.round(W / 360));
      for (let i = 0; i < tramos; i++) {
        const x0 = -20 + (W + 40) * i / tramos, x1 = -20 + (W + 40) * (i + 1) / tramos;
        d += ` C${f(x0 + (x1 - x0) * .35)},${f(y - a * (i % 2 ? -1 : 1))} ${f(x0 + (x1 - x0) * .65)},${f(y + a * (i % 2 ? -1 : 1))} ${f(x1)},${f(y)}`;
      }
      return { d, grosor: ancho() ? 8 : 6 };
    },
    nudo(svg, L) {
      const p = rel($('#pie-portal'), svg);
      const b = rel($('#pie-btn'), svg);
      const m = 14;
      // el logo trae su marco: el cordón lo rodea a 14 px (mismo arco del logo)
      const k = p.w / 920;
      const x = p.x + 21.5 * k - m, y = p.y + 9.1 * k - m, w = 875 * k + 2 * m, h = (1087.5 - 9.1) * k + 2 * m;
      let d = `M${f(x + w * .5)},${f(y + h)} L${f(x)},${f(y + h)}` + Cordon.portal(x, y, w, h).replace(/^M[^L]+/, '');
      // de la esquina inferior derecha del portal, al botón y el nudo. El nudo
      // es un segundo tramo (se dibuja después del primero) para que pueda
      // apretarse solo él al pulsar «Reservar» (§ 14).
      const sx = x + w, sy = y + h;
      const [ax, ay, mg] = ancho() ? [b.x - 30, b.y + b.h + 10, 10] : [b.x + b.w + 20, b.y + b.h + 4, 9];
      if (ancho()) d += ` C${f(sx + 60)},${f(sy + 30)} ${f(b.x - 80)},${f(b.y + b.h * 2.4)} ${f(ax)},${f(ay)}`;
      else d += ` C${f(sx + 10)},${f(sy + 40)} ${f(b.x + b.w + 30)},${f(b.y - 40)} ${f(ax)},${f(ay)}`;
      return { d: [d, `M${f(ax)},${f(ay)}` + nudo(b, mg, ax, ay)], grosor: ancho() ? 7 : 6 };
    },
  };

  const cordones = {};               // tipo → { svg, apis: [...], valor }
  function construir(svg) {
    const tipo = svg.dataset.cordon;
    const L = Cordon.lienzo(svg);
    if (!L.w || !L.h) return;
    const def = CONSTRUCTORES[tipo](svg, L);
    const prev = tipo in deseado ? deseado[tipo] : (motion ? 0 : 1);
    // varios trazados = tramos seguidos de un mismo cordón: cada uno se dibuja
    // en su parte del progreso, en proporción a su longitud
    const ds = Array.isArray(def.d) ? def.d : [def.d];
    const apis = ds.map((d) => Cordon.crear(svg, d, { grosor: def.grosor, progreso: 0 }));
    const total = apis.reduce((s, a) => s + a.longitud, 0) || 1;
    let acum = 0;
    apis.forEach((a) => { a.desde = acum / total; a.peso = a.longitud / total || 1; acum += a.longitud; });
    cordones[tipo] = { svg, apis, valor: prev, w: L.w, h: L.h };
    pintarCordon(cordones[tipo], prev);
  }
  const pintarCordon = (c, p) => c.apis.forEach((a) => a.progreso((p - a.desde) / a.peso));
  const deseado = {};                // progreso pedido, aunque el cordón aún no esté construido
  const progreso = (tipo, p) => {
    deseado[tipo] = p;
    const c = cordones[tipo];
    if (!c) return;
    c.valor = p;
    pintarCordon(c, p);
  };
  const svgsCordon = $$('svg[data-cordon]');
  // rehacer solo si cambia la caja de verdad (el resize de la barra no la cambia;
  // el cambio de fuente sí, y lo caza este mismo observador)
  const roCordon = new ResizeObserver((es) => es.forEach((e) => {
    const svg = e.target.querySelector('svg[data-cordon]');
    if (!svg) return;
    const c = cordones[svg.dataset.cordon];
    if (!c) return;
    const r = svg.getBoundingClientRect();
    if (Math.abs(c.w - r.width) < 1 && Math.abs(c.h - r.height) < 2) return;
    clearTimeout(svg._t);
    svg._t = setTimeout(() => construir(svg), 120);
  }));
  // construir cada cordón cuando se acerca a la pantalla: construirlos todos al
  // cargar daba tareas de más de 1 s que frenaban la cortina en móvil
  const cerca = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    cerca.unobserve(e.target);
    construir(e.target);
    roCordon.observe(e.target.parentElement);
  }), { rootMargin: '80% 0px 80% 0px' });
  svgsCordon.forEach((s) => cerca.observe(s));

  // los de sección se dibujan con el scroll
  function scrubCordon(tipo, trigger, start, end) {
    if (!motion) { progreso(tipo, 1); return; }
    ScrollTrigger.create({ trigger, start, end, scrub: 0.6, onUpdate: (s) => progreso(tipo, s.progress) });
  }
  scrubCordon('feston', '#habitaciones', 'top 70%', 'center 55%');
  scrubCordon('ese', '#salones', 'top 80%', 'bottom 70%');
  scrubCordon('raya', '.raya', 'top 85%', 'bottom 45%');
  scrubCordon('nudo', '#pie-nudo', 'top 85%', 'bottom 92%');

  /* ============ 5. cortina: el portal se dibuja y se abre ============ */
  const cortina = $('#cortina');
  let heroEntrado = false;
  let ensenarGesto = null;           // lo pone el portal (§ 6): el gesto se enseña solo
  function entradaHero() {
    if (heroEntrado) return;
    heroEntrado = true;
    if (ensenarGesto) ensenarGesto();
    const h1 = $('.hero__tit');
    if (motion) {
      partir(h1);
      requestAnimationFrame(() => requestAnimationFrame(() => h1.classList.add('es-visto')));
      const o = { v: deseado.portal || 0 };
      gsap.to(o, { v: 1, duration: 1.7, ease: 'power2.inOut', delay: 0.15, onUpdate: () => progreso('portal', o.v) });
      gsap.from(['.hero .eti', '.hero__entra', '.hero__acc', '.hero__coord', '.portal__estrellas'], { opacity: 0.02, y: 18, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 0.25, immediateRender: true });
    } else {
      progreso('portal', 1);
    }
  }

  function retirarCortina() {
    if (!cortina || cortina.hidden) return;
    cortina.hidden = true;
    raiz.classList.add('cortina-fuera');
    document.body.style.removeProperty('overflow');
    if (lenis) lenis.start();
    if (hayGSAP) { gsap.ticker.lagSmoothing(0); ScrollTrigger.refresh(); }
    entradaHero();
    mostrarCookies();
  }

  // la cortina no espera: si GSAP y Lenis han tardado en llegar del CDN, se retira sin animarla
  clearTimeout(window.__redCortina);
  const tarde = performance.now() > 2500;
  if (cortina && motion && !tarde) {
    raiz.classList.add('cortina-js');                   // la anima el JS: fuera la retirada por CSS
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    const red = setTimeout(retirarCortina, 5500);         // red de seguridad

    const W = innerWidth, H = innerHeight;
    const lienzo = $('#cortina-lienzo');
    lienzo.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const muro = $('#cortina-muro');
    const hh = $('#cortina-hh');
    const txt = $('#cortina-txt');
    // el portal del logo, centrado (proporción de la línea central del marco)
    const pw = Math.min(W * 0.42, H * 0.46 / 1.232, 330);
    const ph = pw * 1.232;
    const px = (W - pw) / 2, py = (H - ph) / 2 - H * 0.03;
    const cx = W / 2, cy = py + ph / 2;
    const marcoD = Cordon.portal(px, py, pw, ph, true);
    const cuerda = $('#cortina-cordon');
    const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
    sv.setAttribute('overflow', 'visible');
    cuerda.appendChild(sv);
    const api = Cordon.crear(sv, marcoD, { grosor: Math.max(6, pw * 0.026), progreso: 0 });
    // el HH del logo en su sitio dentro del portal (cajas de marca/geometria.json)
    const k = pw / 875;
    hh.setAttribute('x', f(px + (104 - 21.5) * k));
    hh.setAttribute('y', f(py + (417 - 9.1) * k));
    hh.setAttribute('width', f(711 * k));
    hh.setAttribute('height', f(456 * k));

    const rect = `M0,0H${W}V${H}H0Z`;
    const pintaMuro = (s) => {
      const w = pw * s, h = ph * s;
      muro.setAttribute('d', s <= 0 ? rect : rect + ' ' + Cordon.portal(cx - w / 2, cy - h / 2, w, h, true));
    };
    pintaMuro(0);
    cortina.classList.add('es-muro');     // a partir de aquí el azul lo pone el muro (agujero de verdad)

    const est = { p: 0 };
    // escala final: que el portal sobrepase la pantalla por todos los lados
    const sFin = Math.max(W / pw, H / ph) * 2.4;
    const tl = gsap.timeline({ onComplete: () => { clearTimeout(red); retirarCortina(); } });
    tl.to(est, { p: 1, duration: 1.15, ease: 'power2.inOut', autoRound: false, onUpdate: () => api.progreso(est.p) })
      .to(hh, { opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.35')
      .fromTo(txt, { opacity: 0, letterSpacing: '1.1em' }, { opacity: 1, letterSpacing: '.5em', duration: 0.7, ease: 'power3.out', immediateRender: false }, '<')
      .to([hh, txt], { opacity: 0, duration: 0.3, ease: 'power1.in' }, '+=0.25')
      // la puerta se abre: el hueco del portal aparece y crece por encima de usted
      .add(() => entradaHero(), '<0.1')
      // El agujero se pinta UNA vez y lo que crece es la capa entera con un
      // transform de CSS (compuesto en la GPU): redibujar el muro en cada
      // fotograma frenaba la cortina casi el doble en móvil. El rectángulo
      // exterior escalado sobre un punto interior sigue tapando la pantalla.
      .add(() => {
        pintaMuro(1);
        lienzo.style.willChange = 'transform';
      }, '<')
      .fromTo(lienzo, { scale: 1, transformOrigin: `${f(cx)}px ${f(cy)}px` }, { scale: sFin, duration: 1.05, ease: 'expo.inOut', immediateRender: false }, '<');
  } else if (cortina) {
    cortina.hidden = true;
    raiz.classList.add('cortina-fuera');
    // sin cortina que animar, el scroll ya manda desde el principio (como al retirarla)
    if (hayGSAP) gsap.ticker.lagSmoothing(0);
    entradaHero();
  } else {
    if (hayGSAP) gsap.ticker.lagSmoothing(0);
    entradaHero();
  }

  /* ============ 6. el portal: mirar arrastrando ============ */
  (function portal() {
    const ventana = $('#portal-ventana');
    const pista = $('#portal-pista');
    const pistaTxt = $('#portal-pista-txt');
    if (!ventana || !pista) return;
    const RATIO = 1920 / 650;           // las tres panorámicas tienen la misma proporción
    const FOCO = 0.3;                   // la puerta giratoria de la fachada
    let x = 0, min = 0, vw = 0, w = 0, arr = null, vel = 0, inercia = 0, ensenado = false;
    // la capa de profundidad (profundidad.js) escucha cada pintado y cada cambio de vista
    let oyente = null;
    const avisar = () => { if (oyente) oyente(); };

    const medir = () => {
      const h = ventana.clientHeight;
      vw = ventana.clientWidth;
      w = h * RATIO;
      pista.style.width = f(w) + 'px';
      min = Math.min(0, vw - w);
      if (!pista._iniciada) { x = -(w * FOCO - vw / 2); pista._iniciada = true; }
      x = Math.max(min, Math.min(0, x));
      pintar();
    };
    const pintar = () => { pista.style.transform = `translate3d(${f(x)}px,0,0)`; avisar(); };
    new ResizeObserver(medir).observe(ventana);

    // el primer arrastre (o las flechas) esconde la pista: ya sabe mirar, no hace falta enseñárselo
    const ocultarPista = () => { ensenado = true; if (pistaTxt) pistaTxt.classList.add('es-oculta'); };
    ventana.addEventListener('dragstart', (e) => e.preventDefault());
    ventana.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      cancelAnimationFrame(inercia);
      arr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: x, t: performance.now(), ult: e.clientX, dir: null };
      vel = 0;
    });
    addEventListener('pointermove', (e) => {
      if (!arr || e.pointerId !== arr.id) return;
      const dx = e.clientX - arr.x0, dy = e.clientY - arr.y0;
      if (!arr.dir) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        arr.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        if (arr.dir === 'h') { ventana.setPointerCapture(e.pointerId); ventana.classList.add('es-arrastrando'); ocultarPista(); }
      }
      if (arr.dir !== 'h') return;
      const ahora = performance.now();
      vel = (e.clientX - arr.ult) / Math.max(1, ahora - arr.t) * 16;
      arr.ult = e.clientX; arr.t = ahora;
      x = Math.max(min - 40, Math.min(40, arr.base + dx));     // un poco de elástico en los bordes
      pintar();
      tocado();
    });
    const soltar = (e) => {
      if (!arr || (e && e.pointerId !== arr.id)) return;
      const eraH = arr.dir === 'h';
      arr = null;
      ventana.classList.remove('es-arrastrando');
      if (!eraH) return;
      const paso = () => {
        vel *= 0.92;
        x += quieto ? 0 : vel;
        // vuelta a los topes
        if (x > 0) x += (0 - x) * 0.2;
        if (x < min) x += (min - x) * 0.2;
        pintar();
        if (Math.abs(vel) > 0.2 || x > 0.5 || x < min - 0.5) inercia = requestAnimationFrame(paso);
        else { x = Math.max(min, Math.min(0, x)); pintar(); }
      };
      inercia = requestAnimationFrame(paso);
    };
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', soltar);

    // teclado: flechas con el portal enfocado
    ventana.tabIndex = 0;
    ventana.setAttribute('role', 'img');
    ventana.setAttribute('aria-label', 'Vista del hotel por la puerta. Use las flechas para mirar a los lados.');
    ventana.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      x = Math.max(min, Math.min(0, x + (e.key === 'ArrowLeft' ? 80 : -80)));
      pintar(); ocultarPista(); tocado();
    });

    /* menú §5 bis · inactividad: a los 18 s quieto, la puerta enseña la siguiente vista */
    const vistas = $$('.portal__vista', pista);
    let actual = 0, reloj = 0;
    const siguiente = () => {
      const r = ventana.getBoundingClientRect();
      if (document.hidden || r.bottom < 0 || r.top > innerHeight) { tocado(); return; }
      vistas[actual].classList.remove('es-activa');
      actual = (actual + 1) % vistas.length;
      vistas[actual].classList.add('es-activa');
      avisar();
      tocado();
    };
    function tocado() {
      clearTimeout(reloj);
      if (!quieto) reloj = setTimeout(siguiente, 18000);
    }
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, tocado, { passive: true }));
    tocado();

    /* el gesto se enseña solo: la primera vez en la sesión que entra el hero, la
       vista se desliza 60 px y vuelve con inercia (misma pintar() que el dedo).
       Se guarda en sessionStorage, que se borra al cerrar la pestaña. */
    const LLAVE_GESTO = 'heredero-gesto';
    function deslizar() {
      if (arr || ensenado) return;                 // si ya lo está tocando, no hace falta
      ensenado = true;
      try { sessionStorage.setItem(LLAVE_GESTO, '1'); } catch (e) {}
      cancelAnimationFrame(inercia);
      const x0 = x, dir = x0 - 60 >= min ? -1 : 1;
      const t0 = performance.now(), IDA = 560;
      let v = 0;
      const ida = (t) => {
        const p = Math.min(1, (t - t0) / IDA);
        x = x0 + dir * 60 * (1 - Math.pow(1 - p, 3));
        pintar();
        inercia = requestAnimationFrame(p < 1 ? ida : vuelta);
      };
      // vuelta como la del dedo al soltar: un muelle amortiguado, con un pelo de rebote
      const vuelta = () => {
        v = (v + (x0 - x) * 0.05) * 0.78;
        x += v;
        pintar();
        if (Math.abs(x - x0) > 0.3 || Math.abs(v) > 0.05) inercia = requestAnimationFrame(vuelta);
        else { x = x0; pintar(); }
      };
      inercia = requestAnimationFrame(ida);
    }
    function ensenar() {
      if (quieto || ensenado) return;
      try { if (sessionStorage.getItem(LLAVE_GESTO)) return; } catch (e) {}
      // cuando el cordón ya rodea la foto y el portal está a la vista
      setTimeout(() => {
        const io = new IntersectionObserver((es) => {
          if (!es[0].isIntersecting) return;
          io.disconnect();
          deslizar();
        }, { threshold: 0.6 });
        io.observe(ventana);
      }, 1900);
    }
    ensenarGesto = ensenar;
    if (heroEntrado) ensenar();
    window.__portal = { siguiente, estado: () => ({ x, min, actual, w, vw }), escuchar: (fn) => { oyente = fn; } };
  })();

  /* ============ 7. formulario de reserva → motor de Paraty ============ */
  (function reserva() {
    const form = $('#form-reserva');
    if (!form) return;
    const ent = $('#r-entrada'), sal = $('#r-salida'), habs = $('#r-habs'), aviso = $('#reserva-aviso');
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const deIso = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
    const mas = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    ent.min = iso(hoy); sal.min = iso(mas(hoy, 1));
    ent.value = iso(hoy); sal.value = iso(mas(hoy, 1));
    ent.addEventListener('change', () => {
      if (!ent.value) return;
      const e = deIso(ent.value);
      sal.min = iso(mas(e, 1));
      if (!sal.value || deIso(sal.value) <= e) sal.value = iso(mas(e, 1));
      aviso.textContent = '';
    });
    sal.addEventListener('change', () => { aviso.textContent = ''; });
    const ocupas = $$('.ocupa', form);
    const sincronizarHabs = () => {
      const n = +habs.value;
      ocupas.forEach((o) => { const on = +o.dataset.hab <= n; o.hidden = !on; o.disabled = !on; });
      form.classList.toggle('es-varias', n > 1);
    };
    habs.addEventListener('change', sincronizarHabs);
    // al recargar (o volver atrás) el navegador recuerda «2 habitaciones»:
    // los fieldset tienen que seguirle, o la 2 y la 3 se quedan ocultas y fuera del envío
    sincronizarHabs();
    addEventListener('pageshow', sincronizarHabs);
    // dd/mm/aaaa, que es lo que lee el motor (jQuery UI 'dd/mm/yy')
    const dmy = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    form.addEventListener('submit', (e) => {
      aviso.textContent = '';
      if (!ent.value || !sal.value) { e.preventDefault(); aviso.textContent = 'Indique las fechas de entrada y salida.'; return; }
      const a = deIso(ent.value), b = deIso(sal.value);
      if (a < hoy) { e.preventDefault(); aviso.textContent = 'La entrada no puede ser anterior a hoy.'; ent.focus(); return; }
      if (b <= a) { e.preventDefault(); aviso.textContent = 'La salida tiene que ser posterior a la entrada.'; sal.focus(); return; }
      $('#r-start').value = dmy(a);
      $('#r-end').value = dmy(b);
    });
  })();

  /* ============ 8. formulario de eventos → correo ============ */
  (function evento() {
    const form = $('#form-evento');
    if (!form) return;
    const aviso = $('#evento-aviso');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (id) => ($('#' + id).value || '').trim();
      if (!v('e-nombre')) { aviso.textContent = 'Díganos su nombre para poder contestarle.'; $('#e-nombre').focus(); return; }
      const mes = v('e-fecha');
      let fecha = '';
      if (mes) {
        const [a, m] = mes.split('-').map(Number);
        fecha = new Date(a, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      }
      const lineas = [
        'Hola, querría información para una celebración en el Hotel Heredero.',
        '',
        'Qué celebramos: ' + v('e-tipo'),
        fecha ? 'Fecha aproximada: ' + fecha : '',
        v('e-inv') ? 'Invitados: ' + v('e-inv') : '',
        'Nombre: ' + v('e-nombre'),
        v('e-tel') ? 'Teléfono: ' + v('e-tel') : '',
        v('e-msg') ? '\n' + v('e-msg') : '',
      ].filter((l, i) => l !== '' || i === 1);
      const asunto = 'Celebración: ' + v('e-tipo') + (fecha ? ' · ' + fecha : '');
      const url = 'mailto:info@hotelheredero.net?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(lineas.join('\n'));
      form.dataset.mailto = url;
      aviso.innerHTML = '';
      aviso.append('Le abrimos su correo con el mensaje preparado. Si no se abre, ');
      const a = document.createElement('a');
      a.href = url; a.textContent = 'pulse aquí';
      aviso.append(a, ' o escríbanos a info@hotelheredero.net.');
      location.href = url;
    });
  })();

  /* ============ 9. cifras que cuentan ============ */
  if (motion) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const fin = +e.target.dataset.cuenta, o = { n: 0 };
      gsap.to(o, { n: fin, duration: 1.4, ease: 'power2.out', onUpdate: () => (e.target.textContent = Math.round(o.n)) });
    }), { rootMargin: '0px 0px -10% 0px' });
    $$('[data-cuenta]').forEach((el) => io.observe(el));
  }

  /* ============ 10. desde 1985: la columna se enrosca ============ */
  (function historia() {
    const sec = $('#historia');
    if (!sec) return;
    const n = $('#historia-n');
    const hitos = $$('.hito', sec);
    const fijar = (p) => {
      // hito 1 (1985) = 36; durante el hito 2 crece; del 3 en adelante, 152
      const i = Math.min(hitos.length - 1, Math.floor(p * hitos.length));
      hitos.forEach((h, k) => h.classList.toggle('es-activo', k === i));
      const t = Math.max(0, Math.min(1, (p - 0.25) / 0.25));
      n.textContent = Math.round(36 + (152 - 36) * t);
      progreso('columna', p);
    };
    if (!hayGSAP || quieto) {
      // sin movimiento: todo a la vista, mismo contenido
      hitos.forEach((h) => h.classList.add('es-activo'));
      n.textContent = '152';
      progreso('columna', 1);
      return;
    }
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      fijar(0);
      const st = ScrollTrigger.create({
        trigger: '#historia-fijo', pin: true, start: 'top top', end: '+=240%', scrub: 0.5,
        onUpdate: (s) => fijar(s.progress),
      });
      return () => st.kill();
    });
    mm.add('(max-width: 899px)', () => {
      hitos.forEach((h) => h.classList.add('es-activo'));
      n.textContent = '36';
      const sts = [
        ScrollTrigger.create({ trigger: sec, start: 'top 75%', end: 'bottom 60%', scrub: 0.5, onUpdate: (s) => progreso('columna', s.progress) }),
        ScrollTrigger.create({ trigger: hitos[2], start: 'top 85%', once: false, onEnter: () => cuenta(36, 152), onLeaveBack: () => (n.textContent = '36') }),
      ];
      return () => sts.forEach((s) => s.kill());
    });
    function cuenta(a, b) {
      const o = { v: a };
      gsap.to(o, { v: b, duration: 1.3, ease: 'power2.out', onUpdate: () => (n.textContent = Math.round(o.v)) });
    }
  })();

  /* ============ 11. carril de fotos: arrastrar con el ratón ============ */
  (function carril() {
    const c = $('#carril-salones');
    if (!c) return;
    const enfocable = () => {
      const sobra = c.scrollWidth > c.clientWidth + 2;
      if (sobra) c.tabIndex = 0; else c.removeAttribute('tabindex');
    };
    enfocable();
    new ResizeObserver(enfocable).observe(c);
    c.addEventListener('dragstart', (e) => e.preventDefault());
    if (!fino) return;
    let a = null, movido = false;
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      a = { x: e.clientX, s: c.scrollLeft }; movido = false;
    });
    addEventListener('pointermove', (e) => {
      if (!a) return;
      const dx = e.clientX - a.x;
      if (Math.abs(dx) > 5) { movido = true; c.classList.add('es-arrastrando'); }
      if (movido) c.scrollLeft = a.s - dx;
    });
    // el clic que sigue al arrastre ya se ha despachado cuando corre el setTimeout:
    // si el arrastre acabó fuera del carril (sin clic), «movido» no se queda colgado
    // y no se come el siguiente clic o Intro
    addEventListener('pointerup', () => { a = null; setTimeout(() => { c.classList.remove('es-arrastrando'); movido = false; }, 0); });
    // si arrastró, el clic no abre el visor
    c.addEventListener('click', (e) => { if (movido) { e.preventDefault(); e.stopPropagation(); movido = false; } }, true);
  })();

  /* ============ 12. visor (abre por NOMBRE, nunca por posición) ============ */
  const PANORAMICAS = new Set(['fachada-panoramica', 'fachada-lateral', 'terraza-panoramica', 'salon-ventanal-panoramica',
    'banquete-panoramica', 'banquete-2', 'banquete-copas', 'mesa-detalle', 'salones-olivenza-panoramica',
    'cafeteria-panoramica', 'habitacion-dosel-panoramica', 'suite-salita']);
  const GALERIA = [
    ['habitacion-dosel', 'habitaciones', 'Habitación con cabecero de madera en forma de tejado'],
    ['habitacion-dosel-panoramica', 'habitaciones', 'Habitación con dos camas y cabecero de madera'],
    ['habitacion-tv', 'habitaciones', 'Habitación con escritorio y televisión'],
    ['habitacion-balcon', 'habitaciones', 'Escritorio y salida al balcón'],
    ['habitacion-ventana', 'habitaciones', 'Cama junto a la ventana con mesa en el balcón'],
    ['suite-salita', 'habitaciones', 'Salita de una suite con sofás azules'],
    ['suite-sofa', 'habitaciones', 'Zona de estar con sofá y cojín bordado'],
    ['bano', 'habitaciones', 'Baño con bañera'],
    ['banquete-panoramica', 'salones', 'Salón montado para banquete'],
    ['banquete-2', 'salones', 'Banquete con mesas largas'],
    ['banquete-copas', 'salones', 'Copas y mesas montadas'],
    ['mesa-detalle', 'salones', 'Detalle de una mesa de banquete'],
    ['salon-montaje', 'salones', 'Salón diáfano con mesas redondas'],
    ['salones-olivenza-panoramica', 'salones', 'Fachada de Salones Olivenza'],
    ['salones-olivenza', 'salones', 'Entrada a Salones Olivenza con alfombra roja'],
    ['terraza-panoramica', 'salones', 'La terraza para eventos al aire libre'],
    ['terraza-columnas', 'salones', 'La terraza vista entre columnas'],
    ['cafeteria-panoramica', 'cafeteria', 'La Cafetería del Ibérico'],
    ['cafeteria', 'cafeteria', 'Mesas de la cafetería'],
    ['cafeteria-barra', 'cafeteria', 'Barra de la cafetería'],
    ['detalle-cava', 'cafeteria', 'Cubitera con cava y flores'],
    ['fachada-panoramica', 'hotel', 'Fachada con la puerta giratoria'],
    ['fachada', 'hotel', 'Entrada principal del hotel'],
    ['fachada-lateral', 'hotel', 'Fachada lateral del hotel'],
    ['recepcion', 'hotel', 'Recepción con columnas y sillones'],
    ['salon-ventanal-panoramica', 'hotel', 'Salón con ventanal corrido'],
    ['salon-verde', 'hotel', 'Salón con sillones verdes'],
    ['escalera', 'hotel', 'Escalera de madera'],
    ['pasillo-placa', 'hotel', 'Pasillo con la placa del HH'],
    ['patio-arcos', 'hotel', 'Patio interior con arcos y vidriera'],
  ];
  const SERIES = {
    salones: $$('#carril-salones [data-nombre]').map((b) => [b.dataset.nombre, $('img', b).alt]),
    galeria: GALERIA.map(([n, , alt]) => [n, alt]),
  };
  const visor = $('#visor'), vImg = $('#visor-img'), vPie = $('#visor-pie'), vCnt = $('#visor-cuenta');
  let serie = [], idx = 0, antesFoco = null, cargando = null;
  const chica = (n) => 'img/fotos/' + n + (n === 'patio-arcos' ? '-548' : '-800') + '.jpg';
  function pintarFoto() {
    const [n, alt] = serie[idx];
    vImg.src = chica(n);
    vImg.dataset.nombre = n;
    if (PANORAMICAS.has(n)) {
      const g = new Image();
      cargando = g;
      g.onload = () => { if (cargando === g) vImg.src = g.src; };
      g.src = 'img/fotos/' + n + '-1920.jpg';
    } else cargando = null;
    vImg.alt = alt;
    vPie.textContent = alt;
    vCnt.textContent = (idx + 1) + ' / ' + serie.length;
  }
  function abrirVisor(clave, nombre) {
    serie = SERIES[clave] || [];
    if (!serie.length) return;
    idx = Math.max(0, serie.findIndex(([n]) => n === nombre));
    antesFoco = document.activeElement;
    visor.hidden = false;
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    pintarFoto();
    $('#visor-x').focus();
  }
  function cerrarVisor() {
    visor.hidden = true;
    document.body.style.removeProperty('overflow');
    if (lenis) lenis.start();
    if (antesFoco) antesFoco.focus();
  }
  const mover = (d) => { idx = (idx + d + serie.length) % serie.length; pintarFoto(); };
  $('#visor-x').addEventListener('click', cerrarVisor);
  $('#visor-ant').addEventListener('click', () => mover(-1));
  $('#visor-sig').addEventListener('click', () => mover(1));
  visor.addEventListener('click', (e) => { if (e.target === visor) cerrarVisor(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-visor]');
    if (b) abrirVisor(b.dataset.visor, b.dataset.nombre);
  });

  /* ============ 13. galería completa (solo «Sobria») ============ */
  function montarGaleria() {
    const ul = $('#galeria-rejilla');
    if (!ul || ul.children.length) return;
    GALERIA.forEach(([n, cat, alt]) => {
      const li = document.createElement('li');
      li.dataset.cat = cat;
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.visor = 'galeria'; b.dataset.nombre = n;
      b.setAttribute('aria-label', 'Ampliar: ' + alt);
      const img = document.createElement('img');
      img.src = chica(n); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      b.appendChild(img); li.appendChild(b); ul.appendChild(li);
    });
  }
  $$('.filtro').forEach((bt) => bt.addEventListener('click', () => {
    $$('.filtro').forEach((o) => { const on = o === bt; o.classList.toggle('es-activo', on); o.setAttribute('aria-pressed', String(on)); });
    const cat = bt.dataset.filtro;
    $$('#galeria-rejilla li').forEach((li) => { li.hidden = cat !== 'todo' && li.dataset.cat !== cat; });
    if (hayGSAP) ScrollTrigger.refresh();
  }));
  if (raiz.classList.contains('densidad-sobria')) montarGaleria();

  /* ============ 14. cabecera, menú y anclas ============ */
  // .sc = ha bajado (fondo y logo compacto); .es-azul = está sobre «Desde 1985» o el pie
  const cab = $('#cab');
  const azules = $$('.historia, .pie');
  let pendienteCab = 0;
  const alScroll = () => {
    pendienteCab = 0;
    cab.classList.toggle('sc', scrollY > 24);
    const y = cab.offsetHeight / 2;
    cab.classList.toggle('es-azul', azules.some((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; }));
  };
  addEventListener('scroll', () => { if (!pendienteCab) pendienteCab = requestAnimationFrame(alScroll); }, { passive: true });
  alScroll();

  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    if (lenis) abierto ? lenis.stop() : lenis.start();
  });
  /* el nudo se aprieta: al pulsar «Reservar» del pie, el lazo da un tirón breve
     (escala .96 y vuelta, 250 ms) antes de ir a la reserva. Solo el tramo del
     nudo, desde el centro del botón; el arco alrededor del logo no se mueve. */
  const TIRON = 250;
  function apretarNudo() {
    const btn = $('#pie-btn');
    const c = cordones.nudo;
    const claves = [{ transform: 'scale(1)' }, { transform: 'scale(.96)', offset: 0.4 }, { transform: 'scale(1)' }];
    const op = { duration: TIRON, easing: 'cubic-bezier(.4, 0, .3, 1)' };
    btn.animate(claves, op);
    if (c && c.apis.length > 1) {
      const lazo = c.apis[c.apis.length - 1].grupo;
      const b = rel(btn, c.svg);
      lazo.style.transformOrigin = `${f(b.x + b.w / 2)}px ${f(b.y + b.h / 2)}px`;
      lazo.animate(claves, op);
    }
  }
  $$('a[href^="#"]').forEach((a) => {
    const destino = a.getAttribute('href');
    if (destino.length < 2) return;
    a.addEventListener('click', (e) => {
      if (!$(destino)) return;
      e.preventDefault();
      cerrarMenu();
      const ir = () => {
        irA(destino);
        // el foco viaja con el scroll (como en un ancla normal): el siguiente Tab sigue desde allí
        setTimeout(() => {
          if (destino === '#reservar') { $('#r-entrada').focus({ preventScroll: true }); return; }
          const t = $(destino);
          if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
          t.focus({ preventScroll: true });
        }, 900);
      };
      if (a.id === 'pie-btn' && motion) { apretarNudo(); setTimeout(ir, TIRON); } else ir();
    });
  });
  addEventListener('keydown', (e) => {
    if (!visor.hidden) {
      if (e.key === 'Escape') cerrarVisor();
      else if (e.key === 'ArrowLeft') mover(-1);
      else if (e.key === 'ArrowRight') mover(1);
      else if (e.key === 'Tab') {
        const fs = $$('button', visor), pri = fs[0], ult = fs[fs.length - 1];
        if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
        else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
      }
      return;
    }
    if (e.key === 'Escape' && document.body.classList.contains('menu')) cerrarMenu();
  });

  /* ============ 15. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'heredero-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  let cookiesPendientes = !leer();
  function mostrarCookies() {
    if (!cookiesPendientes) { verMando(); return; }
    cookiesPendientes = false;
    ck.hidden = false;
    verMando();
  }
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', (e) => { e.preventDefault(); ck.hidden = false; verMando(); });
  if (!cortina || cortina.hidden) mostrarCookies();

  /* ============ 15b. barra de reserva en el móvil ============
     Fija abajo, solo por debajo de 1000 px. Sale al dejar el hero y se esconde
     sobre la reserva, en el pie, con el menú abierto y con el aviso de cookies.
     Todo con observadores: ningún resize (ni el de la barra del navegador)
     rehace nada aquí. */
  (function barraMovil() {
    const barra = $('#barra-res');
    if (!barra) return;
    const movil = matchMedia('(max-width: 999px)');
    const dentro = { hero: true, reservar: false, pie: false };
    const pintar = () => {
      const ver = movil.matches && !dentro.hero && !dentro.reservar && !dentro.pie
        && !document.body.classList.contains('menu') && ck.hidden;
      barra.classList.toggle('es-visible', ver);
      barra.setAttribute('aria-hidden', String(!ver));
      raiz.classList.toggle('con-barra', ver);     // el mando de ?revision sube por encima
    };
    const io = new IntersectionObserver((es) => { es.forEach((e) => { dentro[e.target.dataset.barra] = e.isIntersecting; }); pintar(); });
    [['hero', '.hero'], ['reservar', '#reservar'], ['pie', '#pie']].forEach(([k, s]) => { const el = $(s); if (el) { el.dataset.barra = k; io.observe(el); } });
    // el menú (clase del body) y el aviso de cookies (atributo hidden)
    const mo = new MutationObserver(pintar);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    mo.observe(ck, { attributes: true, attributeFilter: ['hidden'] });
    movil.addEventListener('change', pintar);
    pintar();
  })();

  /* ============ 17. mapa solo al pedirlo ============ */
  $('#mapa-btn').addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('Hotel Heredero, Carretera de Badajoz km 23,7, 06100 Olivenza') + '&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con el Hotel Heredero en Olivenza';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 18. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      if (hayGSAP) ScrollTrigger.refresh();
    }, 200);
  });
  addEventListener('load', () => { if (hayGSAP) ScrollTrigger.refresh(); });
})();
