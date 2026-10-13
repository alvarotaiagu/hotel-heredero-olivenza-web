/* ------------------------------------------------------------------
   Hotel Heredero · «El portal» · la fachada con profundidad
   Un <canvas> WebGL encima de la pista del portal desplaza cada píxel
   según su profundidad (img/fotos/<nombre>-prof.webp, blanco = cerca):
   la marquesina y la escalinata se adelantan y el edificio se aleja al
   arrastrar, al mover el ratón o al inclinar el móvil.
   - El arrastre y la inercia siguen siendo los de main.js (§ 6): aquí
     solo se lee la posición de la pista, así que sin canvas queda la web
     de siempre. La foto LCP sigue debajo, visible.
   - Pinta solo cuando algo cambia y nunca fuera de pantalla.
   - Si los fotogramas pasan de 20 ms baja la calidad; si aun así no
     llega, se retira y queda la foto.
   - Sin GSAP, con movimiento reducido, sin WebGL o si falta un mapa: nada.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const ventana = document.getElementById('portal-ventana');
  const chip = document.getElementById('portal-inclinar');
  const portal = window.__portal;
  // «con-movimiento» ya implica GSAP del CDN y ningún movimiento reducido
  if (!ventana || !portal || !raiz.classList.contains('con-movimiento')) return;

  const fino = matchMedia('(pointer: fine)').matches;
  const AMP_X = 0.05;          // recorrido total cerca-lejos: ±2,5 % del ancho de la ventana
  const AMP_Y = 0.02;          // ±1 % del alto: los bordes de arriba y abajo no se estiran
  const LENTO = 20;            // ms por fotograma a partir de los que se baja la calidad
  const NIVELES = [            // alta · media · baja
    { pasos: 12, dpr: 2 },
    { pasos: 6, dpr: 1.5 },
    { pasos: 1, dpr: 1 },
  ];
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));

  const est = {
    vivo: false, lista: false, motivo: '', nivel: 0, dibujos: 0,
    o: [0, 0], fijo: null, mezcla: 0, vistaA: 0, vistaB: -1,
  };
  window.__profundidad = {
    estado: () => ({ ...est, o: est.o.slice(), ancho: lienzo ? lienzo.width : 0, alto: lienzo ? lienzo.height : 0 }),
    // para las pruebas y las capturas: fija el desplazamiento (null lo suelta)
    fijar: (o) => { est.fijo = o; pedir(); },
  };

  let lienzo = null, gl = null;

  /* ---------- esperar: load, cortina fuera y un rato libre ---------- */
  const cargada = () => new Promise((r) => {
    if (document.readyState === 'complete') r(); else addEventListener('load', r, { once: true });
  });
  const sinCortina = () => new Promise((r) => {
    if (raiz.classList.contains('cortina-fuera')) return r();
    const mo = new MutationObserver(() => {
      if (raiz.classList.contains('cortina-fuera')) { mo.disconnect(); r(); }
    });
    mo.observe(raiz, { attributes: true, attributeFilter: ['class'] });
  });
  const libre = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 200)));
  const imagen = (src) => new Promise((ok, ko) => {
    const im = new Image();
    im.decoding = 'async';
    im.fetchPriority = 'low';
    im.onload = () => ok(im);
    im.onerror = ko;
    im.src = src;
  });
  // una foto ya rota (complete sin naturalWidth) no volverá a dar «load»: se rechaza, no se espera
  const decodificada = (im) => (im.complete
    ? (im.naturalWidth ? im.decode().catch(() => {}).then(() => im) : Promise.reject(new Error('foto rota')))
    : new Promise((ok, ko) => { im.addEventListener('load', () => ok(im), { once: true }); im.addEventListener('error', ko, { once: true }); }));

  /* ---------- WebGL ---------- */
  const VERT = `attribute vec2 aPos; varying vec2 vPos;
void main() { vPos = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const frag = (pasos, alta) => `#define PASOS ${pasos}
precision ${alta ? 'highp' : 'mediump'} float;
uniform sampler2D uFoto0, uProf0, uFoto1, uProf1;
uniform vec2 uEsc; uniform float uDesp; uniform vec2 uO; uniform float uMezcla;
varying vec2 vPos;
// p = punto de la foto que se ve en s: un punto de profundidad d aparece desplazado o·(d − ½)
vec2 buscar(sampler2D prof, vec2 s, vec2 o) {
  // junto a los bordes de la foto el desplazamiento se apaga: nunca se lee fuera
  vec2 m = min(s, 1.0 - s);
  o *= clamp(m / (abs(o) * 0.5 + 1e-4), 0.0, 1.0);
#if PASOS == 1
  return s - o * (texture2D(prof, s).r - 0.5);
#else
  // de cerca a lejos: la primera capa que el mapa alcanza es la superficie (lo cercano tapa)
  float paso = 1.0 / float(PASOS);
  float capa = 1.0;
  vec2 p = s - o * 0.5;
  float d = texture2D(prof, p).r;
  vec2 pAnt = p; float fAnt = d - capa;
  for (int i = 0; i < PASOS; i++) {
    if (d >= capa) break;
    pAnt = p; fAnt = d - capa;
    capa -= paso;
    p = s - o * (capa - 0.5);
    d = texture2D(prof, p).r;
  }
  float f = d - capa;
  return mix(pAnt, p, fAnt < 0.0 ? -fAnt / (f - fAnt + 1e-5) : 1.0);
#endif
}
void main() {
  vec2 s = vec2(vPos.x * uEsc.x + uDesp, 1.0 - vPos.y);
  // el elástico de los topes: fuera de la foto se ve el azul de la ventana
  if (s.x < 0.0 || s.x > 1.0) { gl_FragColor = vec4(0.0); return; }
  vec4 c = texture2D(uFoto0, buscar(uProf0, s, uO));
  if (uMezcla > 0.0) c = mix(c, texture2D(uFoto1, buscar(uProf1, s, uO)), uMezcla);
  gl_FragColor = vec4(c.rgb, 1.0);
}`;

  const programas = [];
  let altaPrec = false;
  function programa(n) {
    if (programas[n]) return programas[n];
    const sh = (tipo, src) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag(NIVELES[n].pasos, altaPrec)));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    ['uFoto0', 'uProf0', 'uFoto1', 'uProf1', 'uEsc', 'uDesp', 'uO', 'uMezcla'].forEach((k) => { u[k] = gl.getUniformLocation(p, k); });
    gl.useProgram(p);
    gl.uniform1i(u.uFoto0, 0); gl.uniform1i(u.uProf0, 1); gl.uniform1i(u.uFoto1, 2); gl.uniform1i(u.uProf1, 3);
    return (programas[n] = { p, u });
  }

  function textura(fuente, gris) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    subir(t, fuente, gris);
    return t;
  }
  function subir(t, fuente, gris) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    const f = gris ? gl.LUMINANCE : gl.RGB;
    gl.texImage2D(gl.TEXTURE_2D, 0, f, f, gl.UNSIGNED_BYTE, fuente);
  }

  /* ---------- vistas: la foto de cada una y su mapa ---------- */
  const vistas = Array.from(ventana.querySelectorAll('.portal__vista')).map((v) => {
    const pic = v.querySelector('picture[data-foto]');
    return { img: v.querySelector('img'), nombre: pic && pic.dataset.foto, foto: null, prof: null };
  });
  function prepararVista(i) {
    const v = vistas[i];
    if (!v || v.foto) return Promise.resolve();
    // una vista sin foto o sin mapa no se puede pintar: mejor retirarse que dejarla congelada
    if (!v.img || !v.nombre) return Promise.reject(new Error('vista sin foto'));
    return v.cargando || (v.cargando = cargarVista(v));
  }
  async function cargarVista(v) {
    const [img, mapa] = await Promise.all([decodificada(v.img), imagen(`img/fotos/${v.nombre}-prof.webp`)]);
    if (!est.vivo) return;
    v.prof = textura(mapa, true);
    v.foto = textura(img, false);
    // si el navegador cambia de tamaño en el srcset, la textura se rehace con la nueva
    img.addEventListener('load', () => { if (est.vivo && v.foto) { subir(v.foto, img, false); pedir(); } });
  }

  /* ---------- entradas ---------- */
  const raton = { x: 0, y: 0 };
  const incl = { x: 0, y: 0 };
  let xAnt = null, velX = 0, tAnt = 0, tFundido = 0;

  function objetivo() {
    if (est.fijo) return est.fijo;
    // al arrastrar, lo cercano va por delante del dedo (velocidad de la pista, px por fotograma)
    const arr = lim(velX / 14, -1, 1);
    return [lim(arr - raton.x * 0.7 - incl.x * 0.8, -1, 1), lim(-raton.y * 0.7 - incl.y * 0.8, -1, 1)];
  }

  /* ---------- bucle bajo demanda ---------- */
  let pedido = 0, visible = false, seguido = false, saltar = 5;
  let muestras = [];
  // umbral real: 20 ms, o algo más que el refresco de la pantalla si va capada a 30 Hz
  // (iOS en ahorro de energía): si no, bajaría de calidad sin estar lento
  let lento = LENTO;
  const medirRefresco = () => new Promise((r) => {
    const ts = [];
    const f = (t) => {
      ts.push(t);
      if (ts.length < 8) { requestAnimationFrame(f); return; }
      const d = ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b);
      r(d[d.length >> 1]);
    };
    requestAnimationFrame(f);
  });
  function pedir() {
    if (pedido || !est.vivo || !visible || document.hidden) return;
    pedido = requestAnimationFrame(cuadro);
  }

  function medirFotograma(t) {
    if (seguido && tAnt) {
      if (saltar > 0) saltar--;
      else {
        muestras.push(t - tAnt);
        if (muestras.length >= 10) {
          const media = muestras.reduce((a, b) => a + b, 0) / muestras.length;
          muestras = [];
          if (media > lento) bajar();
        }
      }
    }
    tAnt = t;
  }

  function cuadro(t) {
    pedido = 0;
    medirFotograma(t);
    if (!est.vivo) return;
    const e = portal.estado();
    const dt = seguido ? Math.min(64, t - (cuadro.t || t)) : 16;
    cuadro.t = t;
    // velocidad de la pista, suavizada
    const dx = xAnt === null ? 0 : e.x - xAnt;
    xAnt = e.x;
    velX += (dx - velX) * 0.25;
    if (Math.abs(velX) < 0.02) velX = 0;
    const obj = objetivo();
    const k = 1 - Math.exp(-dt / 110);
    est.o[0] += (obj[0] - est.o[0]) * k;
    est.o[1] += (obj[1] - est.o[1]) * k;
    // cambio de vista (inactividad de main.js): fundido de 1,4 s como el del CSS
    if (e.actual !== (est.vistaB >= 0 ? est.vistaB : est.vistaA)) {
      if (est.vistaB >= 0) est.vistaA = est.vistaB;
      est.vistaB = e.actual;
      tFundido = t;
    }
    let fundiendo = false;
    if (est.vistaB >= 0) {
      const vB = vistas[est.vistaB];
      if (!vB.foto) {
        // una sola suscripción por vista, no una por fotograma mientras carga
        if (!vB.cargando) prepararVista(est.vistaB).then(pedir, () => retirar('mapa'));
        tFundido = t;
        est.mezcla = 0;
      } else {
        const m = lim((t - tFundido) / 1400, 0, 1);
        est.mezcla = m * m * (3 - 2 * m);
        if (m >= 1) { est.vistaA = est.vistaB; est.vistaB = -1; est.mezcla = 0; } else fundiendo = true;
      }
    }
    dibujar(e);
    if (!est.lista && est.dibujos) aparecer();
    const quieto = Math.abs(obj[0] - est.o[0]) < 0.002 && Math.abs(obj[1] - est.o[1]) < 0.002 && velX === 0;
    if (quieto) { est.o[0] = obj[0]; est.o[1] = obj[1]; }
    seguido = !quieto || fundiendo;
    if (seguido) pedir();
  }

  // el primer fotograma ya pintado, y entonces aparece (la foto de debajo nunca se oculta)
  let apareciendo = false;
  function aparecer() {
    if (apareciendo) return;
    apareciendo = true;
    requestAnimationFrame(() => {
      if (!est.vivo) return;
      lienzo.classList.add('es-lista');
      est.lista = true;
      inclinacion();
    });
  }

  function dibujar(e) {
    const A = vistas[est.vistaA];
    if (!e.w || !A || !A.foto) return;
    const pr = programa(est.nivel);
    gl.viewport(0, 0, lienzo.width, lienzo.height);
    gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uEsc, e.vw / e.w, 1);
    gl.uniform1f(pr.u.uDesp, -e.x / e.w);
    gl.uniform2f(pr.u.uO, est.o[0] * AMP_X * e.vw / e.w, est.o[1] * AMP_Y);
    const B = est.vistaB >= 0 ? vistas[est.vistaB] : null;
    const mezcla = B && B.foto ? est.mezcla : 0;
    gl.uniform1f(pr.u.uMezcla, mezcla);
    const atar = (u, t) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); };
    atar(0, A.foto); atar(1, A.prof);
    atar(2, mezcla ? B.foto : A.foto); atar(3, mezcla ? B.prof : A.prof);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    est.dibujos++;
  }

  function medirLienzo() {
    if (!lienzo) return;
    const dpr = Math.min(devicePixelRatio || 1, NIVELES[est.nivel].dpr);
    const w = Math.round(ventana.clientWidth * dpr), h = Math.round(ventana.clientHeight * dpr);
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
    pedir();
  }

  function bajar() {
    if (est.nivel >= NIVELES.length - 1) { retirar('lento'); return; }
    est.nivel++;
    saltar = 5;
    medirLienzo();
  }

  const quitas = [];
  function retirar(motivo) {
    if (!est.vivo && est.motivo) return;
    est.vivo = false;
    est.motivo = motivo;
    cancelAnimationFrame(pedido);
    pedido = 0;
    quitas.forEach((q) => q());
    if (chip) chip.hidden = true;
    if (!lienzo) return;
    const fuera = lienzo;
    fuera.classList.remove('es-lista');
    est.lista = false;
    setTimeout(() => fuera.remove(), 700);
  }
  function escuchar(obj, ev, fn, op) {
    obj.addEventListener(ev, fn, op);
    quitas.push(() => obj.removeEventListener(ev, fn, op));
  }

  /* ---------- inclinación del móvil ---------- */
  let base = null;
  function alInclinar(e) {
    if (e.gamma === null || e.beta === null) return;
    let g = e.gamma, b = e.beta;
    const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    if (ang === 90) [g, b] = [b, -g];
    else if (ang === -90 || ang === 270) [g, b] = [-b, g];
    // la primera lectura es la postura neutra, que se recentra despacio
    if (!base) base = { g, b };
    base.g += (g - base.g) * 0.01;
    base.b += (b - base.b) * 0.01;
    incl.x = lim((g - base.g) / 12, -1, 1);
    incl.y = lim((b - base.b) / 12, -1, 1);
    pedir();
  }
  function inclinacion() {
    if (fino || typeof DeviceOrientationEvent === 'undefined') return;
    escuchar(window, 'deviceorientation', alInclinar);
    // Android da lecturas sin pedir nada. Si en 1 s no ha llegado ninguna y hay
    // requestPermission (iOS), el permiso solo se puede pedir con un toque: el chip.
    // (Chrome también tiene requestPermission: por eso se mira antes si ya llegan.)
    if (!chip || typeof DeviceOrientationEvent.requestPermission !== 'function') return;
    const t = setTimeout(() => {
      if (base || !est.vivo) return;
      chip.hidden = false;
      escuchar(chip, 'click', () => {
        chip.hidden = true;
        DeviceOrientationEvent.requestPermission().catch(() => {});
      });
    }, 1000);
    quitas.push(() => clearTimeout(t));
  }

  /* ---------- arranque ---------- */
  async function arrancar() {
    await cargada();
    await sinCortina();
    await libre();
    lento = Math.max(LENTO, Math.min(await medirRefresco(), 34) * 1.25);
    lienzo = document.createElement('canvas');
    lienzo.className = 'portal__prof';
    lienzo.setAttribute('aria-hidden', 'true');
    try {
      gl = lienzo.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    } catch (e) { gl = null; }
    if (!gl) { lienzo = null; est.motivo = 'sin-webgl'; return; }
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    altaPrec = !!(hp && hp.precision > 0);
    est.vivo = true;
    try {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      programa(0);
      est.vistaA = portal.estado().actual;
      await prepararVista(est.vistaA);
    } catch (e) {
      retirar('mapa');
      return;
    }
    if (!est.vivo) return;
    escuchar(lienzo, 'webglcontextlost', () => retirar('contexto'));
    ventana.appendChild(lienzo);
    medirLienzo();
    const ro = new ResizeObserver(medirLienzo);
    ro.observe(ventana);
    quitas.push(() => ro.disconnect());
    const io = new IntersectionObserver((es) => {
      visible = es[es.length - 1].isIntersecting;
      if (visible) { saltar = 5; seguido = false; pedir(); }
    });
    io.observe(ventana);
    quitas.push(() => io.disconnect());
    escuchar(document, 'visibilitychange', () => { if (!document.hidden) { saltar = 5; seguido = false; pedir(); } });
    portal.escuchar(pedir);
    quitas.push(() => portal.escuchar(null));
    if (fino) {
      escuchar(window, 'pointermove', (e) => {
        // con el botón pulsado manda el arrastre: la posición del ratón no empuja en contra
        if (e.pointerType !== 'mouse' || e.buttons) return;
        raton.x = lim(e.clientX / innerWidth * 2 - 1, -1, 1);
        raton.y = lim(e.clientY / innerHeight * 2 - 1, -1, 1);
        pedir();
      }, { passive: true });
      escuchar(document.documentElement, 'pointerleave', () => { raton.x = 0; raton.y = 0; pedir(); });
    }
    // el primer fotograma se pinta cuando el portal está a la vista (si ya se bajó,
    // lo hará el IntersectionObserver al volver): nunca se pinta fuera de pantalla
    const r = ventana.getBoundingClientRect();
    visible = r.bottom > 0 && r.top < innerHeight;
    pedir();
    // las otras vistas, en ratos libres
    for (let i = 0; i < vistas.length; i++) {
      if (i === est.vistaA) continue;
      await libre();
      try { await prepararVista(i); } catch (e) { retirar('mapa'); return; }
    }
  }
  arrancar().catch(() => retirar('error'));
})();
