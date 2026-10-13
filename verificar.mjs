/* Verificación de la web del Hotel Heredero (Playwright, bajando con la rueda).
   Uso: node verificar.mjs [--capturas]   → capturas en ./pruebas/ */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium, devices } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8743;                 // puerto propio de esta web
const CAPTURAS = process.argv.includes('--capturas');
const DIR_CAP = path.join(RAIZ, 'pruebas');
if (CAPTURAS) fs.mkdirSync(DIR_CAP, { recursive: true });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.avif': 'image/avif' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
console.log('sirviendo en ' + BASE);

const fallos = [];
const mal = (m) => { fallos.push(m); console.log('  FALLO  ' + m); };
const ok = (m) => console.log('  ok     ' + m);
const info = (m) => console.log('  ·      ' + m);
const comprobar = (cond, m, detalle) => (cond ? ok(m) : mal(m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const cap = async (page, nombre, op) => { if (CAPTURAS) await page.screenshot({ path: path.join(DIR_CAP, nombre + '.png'), ...(op || {}) }); };
const sinCookies = () => { try { localStorage.setItem('heredero-cookies', 'si'); } catch (e) {} };
// el gesto del portal ya enseñado en esta sesión (para que no se cruce con otras pruebas)
const sinGesto = () => { try { sessionStorage.setItem('heredero-gesto', '1'); } catch (e) {} };
// textos generados por CSS (el contador de las láminas) tal como se pintan
const laminas = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  const s = await cdp.send('DOMSnapshot.captureSnapshot', { computedStyles: [] });
  const L = s.documents[0].layout.text.map((i) => (i >= 0 ? s.strings[i] : ''));
  const r = [];
  L.forEach((t, i) => { if (t === 'N.º ') r.push(L.slice(i, i + 4).join('').replace(/\s+/g, ' ').trim()); });
  await cdp.detach();
  return r;
};
// congela las aperturas en arco a medias (transitionrun → pausa al 18 % del tiempo: la
// curva va muy cargada al principio y a esa altura la puerta ya va por la mitad)
const congelarAperturas = () => {
  document.addEventListener('transitionrun', (e) => {
    if (!window.__congelar || e.propertyName !== 'clip-path' || !e.target.classList.contains('revela')) return;
    e.target.getAnimations().forEach((a) => { if (a.transitionProperty === 'clip-path') { a.pause(); a.currentTime = a.effect.getTiming().duration * 0.18; } });
    (window.__congelados = window.__congelados || []).push(e.target);
  }, true);
};
const soltarAperturas = (page) => page.evaluate(() => { window.__congelar = false; (window.__congelados || []).forEach((el) => el.getAnimations().forEach((a) => a.play())); });

const browser = await chromium.launch({ headless: true });

/* GSAP y Lenis desde una copia local durante las pruebas: así la cortina no
   depende de lo que tarde el CDN ese día (si tarda >2,5 s se retira sin animar,
   que es lo que debe hacer la web, pero entonces no hay cortina que probar). */
const CDN = {
  'gsap.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'ScrollTrigger.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
  'lenis.min.js': 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
};
const CACHE = path.join(os.tmpdir(), 'heredero-cdn');
fs.mkdirSync(CACHE, { recursive: true });
for (const [n, u] of Object.entries(CDN)) {
  const f = path.join(CACHE, n);
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()));
}

async function nueva(op = {}, { cdnReal = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...op });
  if (!cdnReal) await ctx.route(/(gsap\.min|ScrollTrigger\.min|lenis\.min)\.js$/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) }));
  const page = await ctx.newPage();
  page._errores = [];
  page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page._errores.push('consola: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
  return { ctx, page };
}
async function bajarA(page, sel, margen = 0) {
  for (let i = 0; i < 160; i++) {
    const top = await page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
    if (Math.abs(top - margen) < 30) break;
    await page.mouse.wheel(0, Math.max(-450, Math.min(450, top - margen)));
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(600);
}
// espera a que la cortina se retire de verdad (el CDN tarda distinto cada vez)
const esperarCortina = async (page, extra = 600) => {
  await page.waitForFunction(() => { const c = document.getElementById('cortina'); return !c || getComputedStyle(c).display === 'none'; }, null, { timeout: 12000 });
  await page.waitForTimeout(extra);
};
const offsetMascara = (page, sel) => page.evaluate((s) => {
  const p = document.querySelector(s + ' mask path');
  return p ? +p.getAttribute('stroke-dashoffset') : null;
}, sel);

/* ================= 0. archivos ================= */
console.log('\n0. Archivos');
for (const f of fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'))) {
  const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  comprobar(/<meta name="robots" content="noindex/.test(s), `${f}: noindex`);
  comprobar(!/<!--svg:/.test(s), `${f}: sin marcadores de construir.mjs sin expandir`);
}
comprobar(fs.existsSync(path.join(RAIZ, '.nojekyll')) && fs.existsSync(path.join(RAIZ, '404.html')) && fs.existsSync(path.join(RAIZ, 'manifest.json')), '.nojekyll, 404.html y manifest.json');
comprobar(fs.existsSync(path.join(RAIZ, 'img/og.jpg')), 'og:image en img/og.jpg');
{
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href)="([^"]+)"/g)) for (const parte of (m[1] === 'srcset' ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !fs.existsSync(path.join(RAIZ, r)));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza (fotos en todos sus anchos y formatos)`, faltan);
}
const css = fs.readFileSync(path.join(RAIZ, 'css/estilos.css'), 'utf8');
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{\s*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:\s*flex/.test(css), 'cookies: display:flex solo en :not([hidden])');
comprobar(/\.menu-movil\s*\{[^}]*height:\s*100dvh/.test(css), 'menú móvil con height:100dvh');
comprobar(/html\.cortina-fuera \.cortina/.test(css), 'regla de retirada de la cortina con el ancestro (especificidad)');
const mainJs = fs.readFileSync(path.join(RAIZ, 'js/main.js'), 'utf8');
comprobar(/autoRound:\s*false/.test(mainJs), 'trazos con autoRound:false');
comprobar(/esBarra\(\)\) return/.test(mainJs), 'resize: la barra del móvil no rehace nada');
{
  // paquete A · 1: grano de papel con feTurbulence en una tesela (sin canvas por fotograma)
  const idx = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  comprobar(/--grano:\s*url\("data:image\/svg\+xml,[^"]*feTurbulence/.test(css) && /body\s*\{[^}]*var\(--grano\)/.test(css) && !/<canvas/i.test(idx) && !/getContext\(/.test(mainJs),
    'grano: tesela SVG con feTurbulence en --grano, sobre el papel; sin canvas');
  // paquete A · 2: la apertura es una transición CSS (ningún tween de GSAP toca clip-path)
  comprobar(/\.revela\.es-abriendo\s*\{[^}]*transition:\s*clip-path/.test(css) && !/gsap\.[a-zA-Z]+\([^)]*clipPath/.test(mainJs) && !/style\.clipPath\s*=/.test(mainJs),
    'aperturas: transición CSS de clip-path, sin GSAP ni clip-path en línea');
}

/* contraste de los tokens de texto (WCAG 2) */
console.log('\n0b. Contraste');
const lum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const PARES = [
  ['tinta', '#231E20', 'papel', '#FBF7EE'], ['tinta-2', '#5A5053', 'papel', '#FBF7EE'], ['tinta-2', '#5A5053', 'cal', '#F5EBD3'],
  ['ocre-txt', '#8E4A1B', 'papel', '#FBF7EE'], ['ocre-txt', '#8E4A1B', 'cal', '#F5EBD3'], ['azul-txt', '#1E3A55', 'cal', '#F5EBD3'],
  ['cal', '#F5EBD3', 'azul', '#132638'], ['cal-tenue', '#C8CED6', 'azul', '#132638'], ['oro-sobre-azul', '#D9B76E', 'azul', '#132638'],
  ['tinta (btn oro)', '#231E20', 'oro-claro', '#D9B76E'], ['cal (btn)', '#F5EBD3', 'tinta', '#231E20'], ['taurino p', '#D8CFC4', 'tinta', '#231E20'],
  ['tinta-2', '#5A5053', 'blanco', '#FFFFFF'],
];
for (const [a, ca, b, cb] of PARES) { const r = ratio(ca, cb); comprobar(r >= 4.5, `${a} sobre ${b}: ${r.toFixed(2)}`); }

/* ================= 1. escritorio: cortina y hero ================= */
console.log('\n1. Escritorio · cortina y hero');
{
  const { ctx, page } = await nueva();
  await page.addInitScript(sinGesto);
  await page.addInitScript(() => {
    window.__m = [];
    const t0 = performance.now();
    const muestra = () => {
      const c = document.getElementById('cortina');
      if (c) {
        const m = document.getElementById('cortina-muro');
        const mp = document.querySelector('#cortina-cordon mask path');
        window.__m.push({
          t: Math.round(performance.now() - t0), display: getComputedStyle(c).display,
          bg: getComputedStyle(c).backgroundColor, huecos: ((m && m.getAttribute('d')) || '').split('M').length - 1,
          cordon: mp ? +mp.getAttribute('stroke-dashoffset') : null,
        });
      }
      if (performance.now() - t0 < 4500) setTimeout(muestra, 40);
    };
    setTimeout(muestra, 0);
  });
  await page.goto(BASE);
  await page.waitForTimeout(900);
  await cap(page, '01-cortina-trazo');
  await page.waitForTimeout(1250);
  await cap(page, '02-cortina-abre');
  await page.waitForTimeout(2600);
  const m = await page.evaluate(() => window.__m);
  const trazo = m.filter((x) => x.cordon !== null && x.cordon > 0.05 && x.cordon < 0.95);
  comprobar(trazo.length >= 3, 'cortina: el cordón se dibuja (fotogramas a medias)', trazo.length);
  comprobar(m.some((x) => x.display !== 'none' && x.bg === 'rgba(0, 0, 0, 0)' && x.huecos >= 2), 'cortina: se abre un agujero con forma de portal, sin fondo opaco');
  const fin = await page.evaluate(() => ({ d: getComputedStyle(document.getElementById('cortina')).display, c: document.documentElement.classList.contains('cortina-fuera') }));
  comprobar(fin.d === 'none' && fin.c, 'cortina: acaba en display:none', fin);
  const hero = await page.evaluate(() => {
    const h = document.querySelector('.hero__tit');
    return { partido: h.classList.contains('es-partido'), visto: h.classList.contains('es-visto'), label: h.getAttribute('aria-label') };
  });
  comprobar(hero.partido && hero.visto && /Una puerta abierta/.test(hero.label), 'hero: titular partido, visible y con aria-label', hero);
  comprobar((await offsetMascara(page, '#portal')) === 0, 'hero: el cordón rodea el portal entero');

  /* paquete A · 1: rótulos de lámina y coordenadas */
  const lam = await laminas(page);
  const esperadas = ['Habitaciones', 'Salones Olivenza', 'A la mesa', 'Desde 1985', 'Olivenza', 'Tradición taurina', 'Cómo llegar'];
  comprobar(lam.length === esperadas.length && lam.every((t, i) => t === `N.º ${String(i + 1).padStart(2, '0')} · ${esperadas[i].toUpperCase()}`),
    'rótulos: «N.º 01 · Habitaciones» … «N.º 07 · Cómo llegar», seguidos', lam);
  const coord = await page.evaluate(() => { const c = document.querySelector('.hero__coord'); const r = c.getBoundingClientRect(); return { t: c.textContent, vis: r.height > 0 && getComputedStyle(c).visibility === 'visible' }; });
  comprobar(/38° 41′ 27″ N · 7° 05′ 38″ O/.test(coord.t) && coord.vis, 'hero: coordenadas del nodo de OSM del hotel (38° 41′ 27″ N · 7° 05′ 38″ O)', coord);
  const grano = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundImage, hero: getComputedStyle(document.querySelector('.hero')).backgroundImage, historia: getComputedStyle(document.querySelector('.historia')).backgroundImage, canvas: document.querySelectorAll('canvas').length }));
  comprobar(/feTurbulence/.test(grano.body) && /feTurbulence/.test(grano.hero) && grano.historia === 'none' && grano.canvas === 0, 'grano: sobre el papel y la cal, no sobre el azul', { historia: grano.historia, canvas: grano.canvas });

  /* paquete A · 3: el cordón con volumen (luz y sombra), como mucho 6 nodos */
  const vol = await page.evaluate(() => [...document.querySelectorAll('svg.cordon, #cortina-cordon svg')].flatMap((svg) => [...svg.querySelectorAll('g.cordon__cuerpo')].map((g) => ({
    nodos: g.querySelectorAll('path').length + 1,                   // + el trazo de su máscara
    luz: !!g.querySelector('.cordon__luz'), sombra: !!g.querySelector('.cordon__sombra'),
    filtros: !!svg.querySelector('filter') || getComputedStyle(g).filter !== 'none',
  }))));
  comprobar(vol.length >= 2 && vol.every((v) => v.nodos <= 6 && v.luz && v.sombra && !v.filtros), `cordón con volumen: luz y sombra en los ${vol.length} cordones construidos, ≤ 6 nodos, sin filtros`, vol.slice(0, 3));

  /* paquete A · 5: cabecera compacta al bajar */
  const cabArriba = await page.evaluate(() => ({ entero: +getComputedStyle(document.querySelector('.cab__logo')).opacity, compacto: +getComputedStyle(document.querySelector('.cab__compacto')).opacity }));
  const cursor = await page.evaluate(() => ({ propio: !!document.querySelector('.cursor,#cursor'), body: getComputedStyle(document.body).cursor }));
  comprobar(!cursor.propio && cursor.body !== 'none', 'sin cursor propio (se quitó del kit): el del sistema intacto', cursor);
  const ck = await page.evaluate(() => ({ h: document.getElementById('cookies').hidden, d: getComputedStyle(document.getElementById('cookies')).display }));
  comprobar(!ck.h && ck.d === 'flex', 'cookies: el aviso aparece tras la cortina', ck);
  await page.click('#ck-si');
  const ck2 = await page.evaluate(() => ({ d: getComputedStyle(document.getElementById('cookies')).display, ls: localStorage.getItem('heredero-cookies') }));
  comprobar(ck2.d === 'none' && ck2.ls === 'si', 'cookies: «Entendido» lo cierra de verdad', ck2);
  const mando = await page.evaluate(() => ({ h: document.getElementById('mando').hidden, d: getComputedStyle(document.getElementById('mando')).display }));
  comprobar(mando.h && mando.d === 'none', 'sin ?revision no hay mando', mando);
  await cap(page, '03-hero');

  // foco con forma de portal
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const foco = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { tag: e.tagName, o: s.outlineStyle, r: s.borderTopLeftRadius }; });
  comprobar(foco.o === 'solid' && /999px|16px/.test(foco.r), 'foco del teclado con forma de portal', foco);

  /* cordones con el scroll */
  console.log('\n2. Escritorio · cordones y secciones');
  const valores = [];
  for (let i = 0; i < 40; i++) {
    const top = await page.evaluate(() => document.getElementById('habitaciones').getBoundingClientRect().top);
    valores.push(await offsetMascara(page, '.habs__fila'));
    if (top < -500) break;
    await page.mouse.wheel(0, 140); await page.waitForTimeout(110);
  }
  const vs = valores.filter((v) => v !== null);
  const baja = vs.every((v, i) => i === 0 || v <= vs[i - 1] + 0.02);
  comprobar(vs[0] > 0.9 && Math.min(...vs) < 0.05 && baja, 'festón: se dibuja con el scroll, de 1 a 0 sin retroceder', vs.map((v) => +v.toFixed(2)));

  await page.waitForTimeout(500);
  const cabAbajo = await page.evaluate(() => { const c = document.getElementById('cab'); return { azul: c.classList.contains('es-azul'), entero: +getComputedStyle(document.querySelector('.cab__logo')).opacity, compacto: +getComputedStyle(document.querySelector('.cab__compacto')).opacity, ancho: Math.round(document.querySelector('.cab__compacto').getBoundingClientRect().width) }; });
  await bajarA(page, '#historia', 0);
  // el cambio de clase va en el siguiente fotograma tras el scroll (y Lenis aún frena): esperar a que llegue
  await page.waitForFunction(() => document.getElementById('cab').classList.contains('es-azul'), null, { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(300);
  const cabAzul = await page.evaluate(() => { const c = document.getElementById('cab'), s = getComputedStyle(c); const h = document.getElementById('historia').getBoundingClientRect(); return { azul: c.classList.contains('es-azul'), fondo: s.backgroundColor, texto: s.color, logo: getComputedStyle(document.querySelector('.cab__compacto')).color, top: Math.round(h.top), bottom: Math.round(h.bottom), sy: Math.round(scrollY) }; });
  await cap(page, '13-cabecera-azul-1440', { clip: { x: 0, y: 0, width: 1440, height: 160 } });
  comprobar(cabArriba.entero === 1 && cabArriba.compacto === 0 && !cabAbajo.azul && cabAbajo.entero === 0 && cabAbajo.compacto === 1 && cabAbajo.ancho <= 36
    && cabAzul.azul && /rgba?\(19, 38, 56/.test(cabAzul.fondo) && cabAzul.texto === 'rgb(245, 235, 211)' && cabAzul.logo === 'rgb(245, 235, 211)',
  'cabecera: logo compacto al bajar y azul con texto cal sobre «Desde 1985»', { cabArriba, cabAbajo, cabAzul });
  const h0 = await page.evaluate(() => ({ n: document.getElementById('historia-n').textContent, act: [...document.querySelectorAll('.hito')].findIndex((h) => h.classList.contains('es-activo')) }));
  await cap(page, '04-historia-inicio');
  for (let i = 0; i < 11; i++) { await page.mouse.wheel(0, 150); await page.waitForTimeout(70); }
  await page.waitForTimeout(900);
  const h1 = await page.evaluate(() => ({ n: document.getElementById('historia-n').textContent, act: [...document.querySelectorAll('.hito')].findIndex((h) => h.classList.contains('es-activo')), top: document.getElementById('historia-fijo').getBoundingClientRect().top, col: +document.querySelector('.historia__columna mask path').getAttribute('stroke-dashoffset') }));
  await cap(page, '05-historia-final');
  comprobar(h0.n === '36' && h0.act === 0 && h1.n === '152' && h1.act >= 2 && Math.abs(h1.top) < 4 && h1.col < 0.4, 'desde 1985: pineada, contador 36 → 152, hitos y columna avanzan', { h0, h1 });

  // el resto de la página: todas las imágenes cargan
  await bajarA(page, '#pie', 200);
  await page.waitForTimeout(800);
  comprobar((await offsetMascara(page, '#pie-nudo')) < 0.05, 'pie: el cordón cierra el portal y se anuda en «Reservar»');
  await cap(page, '06-pie');
  // rotas = pedidas y sin píxeles (las diferidas que aún no se han pedido no cuentan)
  const rotas = await page.evaluate(() => [...document.images].filter((i) => i.id !== 'visor-img' && i.currentSrc && i.complete && !i.naturalWidth).map((i) => i.currentSrc));
  comprobar(rotas.length === 0, 'ninguna imagen pedida sale rota', rotas);
  const desb = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  comprobar(desb === 0, 'sin desbordamiento horizontal', desb);

  /* textos prohibidos */
  const txt = await page.evaluate(() => document.body.innerText);
  const prohibidos = [/€/, /inolvidable/i, /paraíso/i, /con encanto/i, /experiencia única/i, /PENDIENTE/, /TODO/, /lorem/i, /sin gastos de gestión/i, /casa rural/i];
  const hallados = prohibidos.filter((r) => r.test(txt)).map(String);
  comprobar(hallados.length === 0, 'portada sin textos prohibidos (precios, «inolvidable», PENDIENTE…)', hallados);

  /* visor: cada foto del carril abre la suya */
  const nombres = await page.$$eval('#carril-salones [data-nombre]', (bs) => bs.map((b) => b.dataset.nombre));
  let bienVisor = 0;
  for (const n of nombres) {
    await page.evaluate((x) => document.querySelector(`#carril-salones [data-nombre="${x}"]`).click(), n);
    await page.waitForTimeout(120);
    const abierto = await page.evaluate(() => ({ v: !document.getElementById('visor').hidden, n: document.getElementById('visor-img').dataset.nombre }));
    if (abierto.v && abierto.n === n) bienVisor++;
    await page.keyboard.press('Escape');
  }
  comprobar(bienVisor === nombres.length && nombres.length === 6, `visor: las ${nombres.length} fotos del carril abren la suya (por nombre) y Escape cierra`, bienVisor);

  /* mapa bajo clic */
  comprobar(await page.evaluate(() => !document.querySelector('#mapa iframe')), 'mapa: sin iframe hasta pedirlo');
  await page.evaluate(() => document.getElementById('mapa-btn').click());
  comprobar(await page.evaluate(() => /google\.com\/maps\?q=.*output=embed/.test((document.querySelector('#mapa iframe') || {}).src || '')), 'mapa: al pulsar, iframe de Google Maps sin API key');

  /* formulario de eventos → mailto */
  await page.fill('#e-nombre', 'Lucía Pérez');
  await page.fill('#e-inv', '140');
  await page.fill('#e-fecha', '2027-05');
  await page.selectOption('#e-tipo', 'Comunión');
  await page.evaluate(() => { window.__nav = null; });
  await page.route('mailto:*', (r) => r.abort());
  await page.evaluate(() => document.querySelector('#form-evento button[type=submit]').click());
  await page.waitForTimeout(200);
  const mailto = await page.evaluate(() => document.getElementById('form-evento').dataset.mailto || '');
  const cuerpo = decodeURIComponent((mailto.split('body=')[1] || ''));
  comprobar(mailto.startsWith('mailto:info@hotelheredero.net?subject=') && /Comunión/.test(decodeURIComponent(mailto)) && /Lucía Pérez/.test(cuerpo) && /140/.test(cuerpo) && /mayo de 2027/.test(cuerpo), 'eventos: el mailto lleva asunto y cuerpo bien codificados', cuerpo.slice(0, 160));

  /* paquete A · 8: el nudo se aprieta antes de ir a la reserva */
  await bajarA(page, '#pie', 200);
  await page.waitForTimeout(900);
  await page.click('#pie-btn');
  await page.waitForTimeout(90);
  const tiron = await page.evaluate(() => {
    const svg = document.querySelector('.cordon--nudo');
    const grupos = svg.querySelectorAll('g.cordon__cuerpo');
    const lazo = grupos[grupos.length - 1];
    const m = new DOMMatrix(getComputedStyle(lazo).transform);
    const anims = lazo.getAnimations();
    return { tramos: grupos.length, escala: +m.a.toFixed(3), duracion: anims[0] && anims[0].effect.getTiming().duration, arco: grupos[0].getAnimations().length, boton: document.getElementById('pie-btn').getAnimations().filter((a) => !(a instanceof CSSTransition)).length, scroll: Math.round(scrollY) };
  });
  await page.waitForTimeout(1700);
  const llega = await page.evaluate(() => ({ top: Math.round(document.getElementById('reservar').getBoundingClientRect().top), foco: document.activeElement.id }));
  comprobar(tiron.tramos === 2 && tiron.escala < 0.99 && tiron.escala >= 0.95 && tiron.duracion === 250 && tiron.arco === 0 && tiron.boton === 1 && Math.abs(llega.top) < 4 && llega.foco === 'r-entrada',
    'nudo: «Reservar» del pie aprieta el lazo (escala ~0,96, 250 ms; el arco del logo quieto) y luego lleva a la reserva', { tiron, llega });

  comprobar(page._errores.length === 0, 'consola limpia y sin 404', page._errores);
  await ctx.close();
}

/* ================= 3. reserva → motor de Paraty ================= */
console.log('\n3. Formulario de reserva');
{
  const { ctx, page } = await nueva();
  await page.addInitScript(sinCookies);
  let peticion = null;
  await ctx.route('**/booking1**', async (r) => { peticion = { url: r.request().url(), metodo: r.request().method(), datos: r.request().postData() }; await r.fulfill({ status: 200, contentType: 'text/html', body: '<p>motor</p>' }); });
  await page.goto(BASE);
  await esperarCortina(page);
  // con el foco en la ventana de reserva, las anclas también llevan el foco: el siguiente Tab sigue en la sección
  await page.evaluate(() => document.querySelector('.nav a[href="#salones"]').click());
  await page.waitForTimeout(1300);
  const focoAncla = await page.evaluate(() => ({ id: document.activeElement.id, tabindex: document.activeElement.getAttribute('tabindex') }));
  comprobar(focoAncla.id === 'salones' && focoAncla.tabindex === '-1', 'anclas: el foco viaja a la sección de destino', focoAncla);
  const accion = await page.evaluate(() => { const f = document.getElementById('form-reserva'); return { a: f.action, m: f.method, t: f.target }; });
  comprobar(accion.a === 'https://heredero-olivenza-dot-hoteles-heredero.appspot.com/booking1' && accion.m === 'post' && accion.t === '_blank', 'reserva: action, POST y pestaña nueva', accion);
  // salida antes de la entrada → no se envía
  const hoy = new Date(); const iso = (d) => d.toISOString().slice(0, 10);
  const en = new Date(hoy.getTime() + 20 * 864e5), sa = new Date(hoy.getTime() + 22 * 864e5);
  await page.evaluate(([a, b]) => { document.getElementById('r-entrada').value = a; document.getElementById('r-salida').value = b; }, [iso(sa), iso(en)]);
  await page.evaluate(() => document.querySelector('.reserva__ir').click());
  await page.waitForTimeout(300);
  const av = await page.textContent('#reserva-aviso');
  comprobar(/posterior/.test(av) && !peticion, 'reserva: salida anterior a la entrada → aviso y no se envía', av);
  // correcto, 2 habitaciones
  await page.evaluate(([a, b]) => { document.getElementById('r-entrada').value = a; document.getElementById('r-salida').value = b; }, [iso(en), iso(sa)]);
  await page.selectOption('#r-habs', '2');
  const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), page.evaluate(() => document.querySelector('.reserva__ir').click())]);
  await page.waitForTimeout(800);
  const datos = new URLSearchParams(peticion ? peticion.datos : '');
  const dmy = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  comprobar(!!popup && peticion && peticion.metodo === 'POST' && datos.get('startDate') === dmy(en) && datos.get('endDate') === dmy(sa)
    && datos.get('namespace') === 'heredero-olivenza' && datos.get('language') === 'SPANISH' && datos.get('numRooms') === '2'
    && datos.get('adultsRoom2') === '2' && !datos.has('adultsRoom3'), 'reserva: POST al motor con fechas dd/mm/aaaa y ocupación por habitación', peticion && peticion.datos);
  await ctx.close();
}
{
  // el navegador recuerda «2 habitaciones» al recargar: se simula sirviendo el select ya en 2
  const { ctx, page } = await nueva();
  await page.addInitScript(sinCookies);
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')
    .replace('<option value="1" selected>1</option><option value="2">2</option>', '<option value="1">1</option><option value="2" selected>2</option>');
  await ctx.route(/localhost:\d+\/(index\.html)?(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(BASE);
  await page.waitForTimeout(500);
  const hab = await page.evaluate(() => ({ v: document.getElementById('r-habs').value, h2: document.querySelector('.ocupa[data-hab="2"]').hidden, d2: document.querySelector('.ocupa[data-hab="2"]').disabled, h3: document.querySelector('.ocupa[data-hab="3"]').hidden }));
  comprobar(hab.v === '2' && !hab.h2 && !hab.d2 && hab.h3, 'reserva: con «2 habitaciones» recordado al cargar, la habitación 2 se ve y se envía', hab);
  await ctx.close();
}

/* ================= 4. densidades (?revision) ================= */
console.log('\n4. Mando de densidades');
{
  const { ctx, page } = await nueva();
  await page.goto(BASE + 'index.html?revision');
  await esperarCortina(page, 200);
  const conCk = await page.evaluate(() => ({ ck: !document.getElementById('cookies').hidden, m: document.getElementById('mando').hidden }));
  comprobar(conCk.ck && conCk.m, 'mando: se aparta mientras está el aviso de cookies', conCk);
  await page.click('#ck-si');
  comprobar(await page.evaluate(() => !document.getElementById('mando').hidden), 'mando: aparece al cerrar las cookies');
  const antes = await page.evaluate(() => ({ fest: getComputedStyle(document.querySelector('.cordon--feston')).display, gal: getComputedStyle(document.getElementById('galeria')).display, clip: getComputedStyle(document.querySelector('.habs__arcos .arco')).clipPath !== 'none' }));
  await page.click('[data-densidad-btn="sobria"]');
  await page.waitForTimeout(500);
  const sob = await page.evaluate(() => ({
    clase: document.documentElement.classList.contains('densidad-sobria'),
    fest: getComputedStyle(document.querySelector('.cordon--feston')).display,
    portal: getComputedStyle(document.querySelector('.cordon--portal')).display,
    nudo: getComputedStyle(document.querySelector('.cordon--nudo')).display,
    clip: getComputedStyle(document.querySelector('.habs__arcos .arco')).clipPath,
    clipHero: getComputedStyle(document.getElementById('portal-ventana')).clipPath !== 'none',
    gal: getComputedStyle(document.getElementById('galeria')).display,
    fotos: document.querySelectorAll('#galeria-rejilla li').length,
    url: location.search,
    desb: document.documentElement.scrollWidth - innerWidth,
  }));
  comprobar(antes.fest !== 'none' && antes.gal === 'none' && antes.clip, '«Cordón»: festón y arcos a la vista, sin galería', antes);
  // (las fotos que aún no han entrado esperan con su apertura rectangular: inset, nunca un arco)
  comprobar(sob.clase && sob.fest === 'none' && sob.portal !== 'none' && sob.nudo !== 'none' && !/path/.test(sob.clip) && sob.clipHero && sob.gal !== 'none' && sob.fotos === 30 && sob.desb === 0, '«Sobria»: cordón solo en portal/columna/nudo, fotos rectas, galería completa (30)', sob);
  await page.click('[data-filtro="habitaciones"]');
  const filtradas = await page.evaluate(() => [...document.querySelectorAll('#galeria-rejilla li')].filter((l) => !l.hidden).length);
  comprobar(filtradas === 8, 'galería: el filtro «Habitaciones» deja 8', filtradas);
  await bajarA(page, '#galeria', 80);
  await cap(page, '07-sobria-galeria');
  await page.evaluate(() => document.querySelector('#galeria-rejilla [data-nombre="bano"]').click());
  comprobar(await page.evaluate(() => document.getElementById('visor-img').dataset.nombre === 'bano'), 'galería: la miniatura abre su foto en el visor');
  await page.keyboard.press('Escape');
  await page.click('[data-densidad-btn="cordon"]');
  const vuelta = await page.evaluate(() => ({ c: document.documentElement.classList.contains('densidad-sobria'), g: getComputedStyle(document.getElementById('galeria')).display }));
  comprobar(!vuelta.c && vuelta.g === 'none', 'se puede volver a «Cordón»', vuelta);
  comprobar(page._errores.length === 0, 'densidades: consola limpia', page._errores);
  await ctx.close();
}

/* ================= 5. móvil ================= */
console.log('\n5. Móvil');
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024]]) {
  const { ctx, page } = await nueva({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 700 });
  await page.addInitScript(sinCookies);
  await page.goto(BASE);
  await esperarCortina(page, 1800);
  const r = await page.evaluate(() => {
    const a = document.getElementById('portal-ventana').getBoundingClientRect(), t = document.querySelector('.hero__tit').getBoundingClientRect(), c = document.getElementById('cab').getBoundingClientRect();
    return { portalAbajo: a.bottom, tituloArriba: t.top, portalArriba: a.top, cab: c.bottom, desb: document.documentElement.scrollWidth - innerWidth };
  });
  comprobar(r.portalAbajo <= r.tituloArriba + 1 && r.portalArriba >= r.cab - 1 && r.desb === 0, `${w}×${h}: portal arriba, titular debajo, sin solaparse ni desbordar`, r);
  await cap(page, `08-movil-${w}x${h}`);
  await ctx.close();
}
{
  const { ctx, page } = await nueva({ ...devices['Pixel 7'] });
  await page.addInitScript(sinCookies);
  await page.goto(BASE);
  await esperarCortina(page, 600);
  // menú móvil con la cabecera ya fija
  await page.evaluate(() => scrollTo(0, 1400));
  await page.waitForTimeout(500);
  await page.tap('#menu-btn');
  await page.waitForTimeout(700);
  const menu = await page.evaluate(() => { const m = document.getElementById('menu-movil').getBoundingClientRect(); return { alto: m.height, top: m.top, vis: getComputedStyle(document.getElementById('menu-movil')).visibility, vh: innerHeight }; });
  comprobar(menu.vis === 'visible' && menu.top <= 0.5 && menu.alto >= menu.vh - 1, 'menú móvil: cubre toda la pantalla con la cabecera fija', menu);
  await cap(page, '10-movil-menu');
  await page.tap('#menu-btn');
  await page.waitForTimeout(700);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('menu-movil')).visibility === 'hidden'), 'menú móvil: el mismo botón lo cierra');

  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(page);
  const caja = await page.evaluate(() => { const r = document.getElementById('portal-ventana').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const x0 = await page.evaluate(() => window.__portal.estado().x);
  // arrastre táctil horizontal de verdad (eventos táctiles)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: caja.x, y: caja.y }] });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: caja.x - i * 16, y: caja.y + i * 0.5 }] }); await espera(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(900);
  const x1 = await page.evaluate(() => window.__portal.estado());
  const pista = await page.evaluate(() => document.getElementById('portal-pista-txt').classList.contains('es-oculta'));
  comprobar(x1.x < x0 - 60 && x1.x >= x1.min - 1 && pista, 'portal: el dedo arrastra la vista en horizontal (y la pista se va)', { x0, x1, pista });
  await cap(page, '09-movil-portal-arrastrado');
  // y el scroll vertical sobre el portal sigue funcionando (touch-action: pan-y)
  const y0 = await page.evaluate(() => scrollY);
  const xa = await page.evaluate(() => window.__portal.estado().x);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: caja.x, y: caja.y + 60 }] });
  for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: caja.x + i * 0.4, y: caja.y + 60 - i * 22 }] }); await espera(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(900);
  const y1 = await page.evaluate(() => scrollY), xb = await page.evaluate(() => window.__portal.estado().x);
  comprobar(y1 > y0 + 100 && Math.abs(xb - xa) < 2, 'portal: deslizar en vertical sobre él hace scroll de la página y no mueve la vista', { y0, y1, xa, xb });

  // la barra del navegador: cambiar solo la altura no rehace nada
  await page.evaluate(() => { window.__refrescos = 0; ScrollTrigger.addEventListener('refresh', () => window.__refrescos++); });
  await page.addStyleTag({ content: '.hero{min-height:844px!important}.historia__fijo{min-height:844px!important}' });
  await page.evaluate(() => scrollTo(0, 2600));
  await page.waitForTimeout(600);
  const ref = () => page.evaluate(() => document.getElementById('salones').getBoundingClientRect().top);
  const t0 = await ref();
  const vp = page.viewportSize();
  const tops = [];
  for (let i = 0; i < 6; i++) {
    await page.setViewportSize({ width: vp.width, height: vp.height + (i % 2 ? 0 : 56) });
    await page.waitForTimeout(350);
    tops.push(Math.round((await ref()) - t0));
  }
  await page.setViewportSize(vp);
  await page.waitForTimeout(400);
  const refrescos = await page.evaluate(() => window.__refrescos);
  comprobar(refrescos === 0 && tops.every((t) => Math.abs(t) <= 1), 'barra del móvil: 6 cambios de alto → 0 refresh y nada salta', { refrescos, tops });
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await page.waitForTimeout(700);
  comprobar(await page.evaluate(() => window.__refrescos) > 0, 'al girar el móvil sí se rehace');
  await page.setViewportSize(vp);
  comprobar(page._errores.length === 0, 'móvil: consola limpia', page._errores);

  // LCP real: 4G y CPU ×4 (se anota en el README, no se exige aquí)
  await ctx.close();
}

/* ================= 6. movimiento reducido ================= */
console.log('\n6. Movimiento reducido');
{
  const { ctx, page } = await nueva({ reducedMotion: 'reduce' });
  await page.addInitScript(sinCookies);
  await page.addInitScript(() => { window.__c = []; const f = () => { const c = document.getElementById('cortina'); if (c) window.__c.push(getComputedStyle(c).display); if (window.__c.length < 12) setTimeout(f, 30); }; setTimeout(f, 0); });
  await page.goto(BASE);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({
    cortina: window.__c, partidos: document.querySelectorAll('.es-partido').length,
    portal: +document.querySelector('#portal mask path').getAttribute('stroke-dashoffset'),
    feston: +document.querySelector('.habs__fila mask path').getAttribute('stroke-dashoffset'),
    n: document.getElementById('historia-n').textContent,
    hitos: [...document.querySelectorAll('.hito')].every((h) => h.classList.contains('es-activo')),
    pin: !!document.querySelector('.pin-spacer'),
    revela: document.querySelectorAll('.revela').length,
    arco: getComputedStyle(document.querySelector('.habs__arcos .arco')).clipPath.slice(0, 5),
    historia: getComputedStyle(document.querySelector('.historia')).clipPath,
    gesto: sessionStorage.getItem('heredero-gesto'),
    x0: window.__portal.estado().x,
  }));
  await page.waitForTimeout(3500);
  const xr = await page.evaluate(() => ({ x: window.__portal.estado().x, gesto: sessionStorage.getItem('heredero-gesto') }));
  comprobar(r.revela === 0 && r.arco === 'path(' && r.historia === 'none' && xr.gesto === null && xr.x === r.x0, 'reducido: sin aperturas (fotos y secciones ya a la vista) y sin enseñar el gesto', { r, xr });
  comprobar(r.cortina.every((d) => d === 'none'), 'reducido: la cortina no pinta ni un fotograma', r.cortina);
  comprobar(r.partidos === 0 && r.portal === 0 && r.feston === 0, 'reducido: titulares enteros y cordones completos', r);
  comprobar(r.n === '152' && r.hitos && !r.pin, 'reducido: «Desde 1985» sin pin, con todo el contenido (152 y los cuatro hitos)', r);
  await bajarA(page, '#historia', 0);
  await cap(page, '11-reducido-historia');
  comprobar(page._errores.length === 0, 'reducido: consola limpia', page._errores);
  await ctx.close();
}

/* ================= 7. sin GSAP (CDN caído) ================= */
console.log('\n7. Sin GSAP');
{
  const { ctx, page } = await nueva();
  await page.addInitScript(sinCookies);
  await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/gsap/, (r) => r.abort());
  await page.goto(BASE);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({
    cortina: getComputedStyle(document.getElementById('cortina')).display,
    movimiento: document.documentElement.classList.contains('con-movimiento'),
    feston: +document.querySelector('.habs__fila mask path').getAttribute('stroke-dashoffset'),
    n: document.getElementById('historia-n').textContent,
    revela: document.querySelectorAll('.revela').length,
    tapadas: [...document.querySelectorAll('.salones__gran, .mesa__foto--ancha, .historia, .taurino')].filter((e) => getComputedStyle(e).clipPath !== 'none').length,
  }));
  comprobar(r.cortina === 'none' && !r.movimiento && r.feston === 0 && r.n === '152' && r.revela === 0 && r.tapadas === 0, 'sin GSAP: sin cortina, todo a la vista (sin aperturas) y los cordones completos', r);
  await cap(page, '12-sin-gsap', { fullPage: true });
  const errs = page._errores.filter((e) => !/gsap|ERR_FAILED|cdnjs/i.test(e));
  comprobar(errs.length === 0, 'sin GSAP: sin errores propios', errs);
  await ctx.close();
}

/* ================= 7b. CDN lento: la cortina no espera ================= */
console.log('\n7b. CDN lento');
{
  const { ctx, page } = await nueva();
  await page.addInitScript(sinCookies);
  await ctx.route(/(gsap\.min|ScrollTrigger\.min|lenis\.min)\.js$/, async (r) => { await espera(3200); await r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) }); });
  const t0 = Date.now();
  await page.goto(BASE);
  await esperarCortina(page, 0);
  const tarda = Date.now() - t0;
  await page.waitForTimeout(2300);
  const r = await page.evaluate(() => ({ visto: document.querySelector('.hero__tit').classList.contains('es-visto'), portal: +document.querySelector('#portal mask path').getAttribute('stroke-dashoffset') }));
  comprobar(tarda < 5200 && r.visto && r.portal === 0, 'CDN lento (3,2 s): la cortina se retira sin animarse y el hero entra igual', { tarda, ...r });
  await ctx.close();
}

/* ================= 9. paquete A · aperturas en arco ================= */
console.log('\n9. Aperturas en arco');
for (const [w, h, q, nombre] of [[1440, 900, '', '1440'], [390, 844, '', '390'], [1440, 900, '?revision&densidad=sobria', 'sobria-1440']]) {
  const { ctx, page } = await nueva({ viewport: { width: w, height: h } });
  await page.addInitScript(sinCookies);
  await page.addInitScript(sinGesto);
  await page.addInitScript(congelarAperturas);
  await page.goto(BASE + q);
  await esperarCortina(page, 400);
  if (nombre !== 'sobria-1440') await cap(page, `14-hero-${nombre}`);
  const antes = await page.evaluate(() => ({ n: document.querySelectorAll('.revela').length, clip: getComputedStyle(document.querySelector('.habs__arcos .arco')).clipPath }));
  await page.evaluate(() => { window.__congelar = true; });
  await bajarA(page, '#habitaciones', w < 700 ? 40 : 90);
  await page.waitForTimeout(200);
  const medio = await page.evaluate(() => {
    const a = document.querySelector('.habs__arcos .arco');
    // el arco de reposo tal como lo serializa el navegador (normaliza el path)
    const d = document.createElement('div');
    d.style.clipPath = a.style.getPropertyValue('--arco');
    document.body.appendChild(d);
    const arco = getComputedStyle(d).clipPath;
    d.remove();
    return { congelada: (window.__congelados || []).includes(a), clip: getComputedStyle(a).clipPath, arco };
  });
  await cap(page, `15-apertura-${nombre}`);
  await soltarAperturas(page);
  await page.waitForTimeout(1600);
  const fin = await page.evaluate(() => { const a = document.querySelector('.habs__arcos .arco'); return { revela: a.classList.contains('revela'), clip: getComputedStyle(a).clipPath }; });
  const forma = nombre === 'sobria-1440' ? /^inset\(/ : /^path\(/;
  // a mitad: ni cerrada ni abierta (una puerta intermedia); al acabar, el arco de reposo
  const bien = antes.n >= 12 && /inset\(100%/.test(antes.clip) && medio.congelada && forma.test(medio.clip) && !/inset\(100%/.test(medio.clip) && medio.clip !== medio.arco && medio.clip !== 'inset(0px)'
    && !fin.revela && (nombre === 'sobria-1440' ? fin.clip === 'none' : fin.clip === medio.arco);
  comprobar(bien, nombre === 'sobria-1440' ? 'aperturas «Sobria»: la foto se abre en rectángulo (inset) y queda recta' : `aperturas ${w}: la foto se abre con una puerta que crece desde abajo y queda en su arco`, { antes, medio: { ...medio, clip: medio.clip.slice(0, 60), arco: medio.arco.slice(0, 40) }, fin: { ...fin, clip: fin.clip.slice(0, 40) } });
  if (nombre === '1440') {
    // una sección de color: «Desde 1985» entra por la puerta y luego queda sin recorte (el pin no se toca)
    await page.evaluate(() => { window.__congelar = true; window.__congelados = []; });
    // se lee en cuanto entra (la red de seguridad de 2,2 s de abrir() la cerraría si se espera)
    for (let i = 0; i < 120; i++) {
      if (await page.evaluate(() => document.querySelector('.historia').getBoundingClientRect().top < innerHeight * 0.75)) break;
      await page.mouse.wheel(0, 260); await page.waitForTimeout(60);
    }
    await page.waitForTimeout(300);
    const sec = await page.evaluate(() => { const s = document.querySelector('.historia'); return { congelada: (window.__congelados || []).includes(s), clip: getComputedStyle(s).clipPath.slice(0, 5) }; });
    await cap(page, '15-apertura-seccion-1440');
    await soltarAperturas(page);
    await page.waitForTimeout(1800);
    const sec2 = await page.evaluate(() => ({ revela: document.querySelector('.historia').classList.contains('revela'), clip: getComputedStyle(document.querySelector('.historia')).clipPath }));
    comprobar(sec.congelada && sec.clip === 'path(' && !sec2.revela && sec2.clip === 'none', 'aperturas: «Desde 1985» entra por la puerta del portal y queda sin recorte', { sec, sec2 });
  }
  comprobar(page._errores.length === 0, `aperturas ${nombre}: consola limpia`, page._errores);
  await ctx.close();
}

/* ================= 10. paquete A · barra de reserva en el móvil ================= */
console.log('\n10. Barra de reserva (móvil)');
{
  const { ctx, page } = await nueva({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.addInitScript(sinGesto);
  await page.goto(BASE + '?revision');
  await esperarCortina(page, 300);
  const estado = () => page.evaluate(() => {
    const b = document.getElementById('barra-res'), r = b.getBoundingClientRect(), m = document.getElementById('mando');
    return { ver: b.classList.contains('es-visible') && getComputedStyle(b).visibility === 'visible', top: Math.round(r.top), mando: m.hidden ? null : Math.round(m.getBoundingClientRect().bottom) };
  });
  const ir = async (sel, margen = 0) => { await page.evaluate(([s, m]) => scrollTo(0, document.querySelector(s).getBoundingClientRect().top + scrollY - m), [sel, margen]); await page.waitForTimeout(700); };
  const e = {};
  e.hero = await estado();
  await ir('#salones', 100);
  e.cookies = await estado();                                   // el aviso de cookies sigue abierto
  await page.click('#ck-si');
  await page.waitForTimeout(600);
  e.salones = await estado();
  await cap(page, '16-barra-movil-390');
  await page.tap('#menu-btn'); await page.waitForTimeout(600);
  e.menu = await estado();
  await page.tap('#menu-btn'); await page.waitForTimeout(600);
  await ir('#reservar', 60);
  e.reservar = await estado();
  await ir('#pie', 100);
  e.pie = await estado();
  comprobar(!e.hero.ver && !e.cookies.ver && e.salones.ver && !e.menu.ver && !e.reservar.ver && !e.pie.ver,
    'barra móvil: sale al dejar el hero; se esconde con el aviso de cookies, el menú, sobre la reserva y en el pie', e);
  comprobar(e.salones.mando !== null && e.salones.mando <= e.salones.top, 'barra móvil: no tapa el mando de ?revision (sube por encima)', e.salones);
  // los dos botones: Reservar al formulario, Llamar al teléfono
  const enl = await page.evaluate(() => [...document.querySelectorAll('#barra-res a')].map((a) => [a.textContent.trim(), a.getAttribute('href'), Math.round(a.getBoundingClientRect().height)]));
  comprobar(JSON.stringify(enl.map((x) => x.slice(0, 2))) === JSON.stringify([['Reservar', '#reservar'], ['Llamar', 'tel:+34924490835']]) && enl.every((x) => x[2] >= 44), 'barra móvil: «Reservar» va a #reservar y «Llamar» al teléfono, con botones de 44 px o más', enl);
  // ningún campo de los formularios por debajo de 16 px (iOS hace zoom si no)
  const chicos = await page.evaluate(() => [...document.querySelectorAll('#form-reserva select, #form-reserva input:not([type=hidden]), #form-evento select, #form-evento input, #form-evento textarea')]
    .map((c) => [c.id || c.name, parseFloat(getComputedStyle(c).fontSize)]).filter(([, t]) => t < 16));
  comprobar(chicos.length === 0, 'formularios a 390: todos los campos miden 16 px o más (sin zoom en iOS)', chicos);
  // la barra del navegador: cambiar solo el alto no la mueve ni rehace nada
  await ir('#salones', 100);
  const antes = await estado();
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(400);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
  const despues = await estado();
  comprobar(antes.ver && despues.ver && antes.top === despues.top, 'barra móvil: el resize de la barra del navegador no la cambia', { antes, despues });
  comprobar(page._errores.length === 0, 'barra móvil: consola limpia', page._errores);
  await ctx.close();
}
{
  const { ctx, page } = await nueva();
  await page.addInitScript(sinCookies);
  await page.addInitScript(sinGesto);
  await page.goto(BASE + '?revision');
  await esperarCortina(page, 300);
  await bajarA(page, '#salones', 100);
  const r = await page.evaluate(() => ({ d: getComputedStyle(document.getElementById('barra-res')).display, c: document.documentElement.classList.contains('con-barra') }));
  comprobar(r.d === 'none' && !r.c, 'barra móvil: no existe en escritorio (≥ 1000 px)', r);
  await ctx.close();
}

/* ================= 11. paquete A · el gesto se enseña solo ================= */
console.log('\n11. El gesto se enseña solo');
{
  const { ctx, page } = await nueva();
  await page.addInitScript(sinCookies);
  await page.addInitScript(() => {
    window.__xs = [];
    const t0 = performance.now();
    // se muestrea desde que se retira la cortina (el portal ya está medido)
    const f = () => { if (window.__portal && document.documentElement.classList.contains('cortina-fuera')) window.__xs.push(window.__portal.estado().x); if (performance.now() - t0 < 9000) setTimeout(f, 30); };
    setTimeout(f, 0);
  });
  const mide = async () => {
    await esperarCortina(page, 0);
    await page.waitForTimeout(4200);
    return page.evaluate(() => { const xs = window.__xs; const x0 = xs[0]; return { x0, desvio: Math.round(Math.max(...xs.map((x) => Math.abs(x - x0)))), final: xs[xs.length - 1], guardado: sessionStorage.getItem('heredero-gesto') }; });
  };
  await page.goto(BASE);
  const g1 = await mide();
  await page.reload();
  const g2 = await mide();
  comprobar(g1.desvio >= 55 && g1.desvio <= 70 && Math.abs(g1.final - g1.x0) < 0.5 && g1.guardado === '1' && g2.desvio === 0,
    'gesto: en la primera visita la vista se desliza ~60 px y vuelve; en la misma sesión ya no (sessionStorage)', { g1, g2 });
  const txt = await page.evaluate(() => document.querySelector('#cookies p').textContent);
  const priv = fs.readFileSync(path.join(RAIZ, 'privacidad.html'), 'utf8');
  comprobar(/se desliza/.test(txt) && /almacenamiento de sesión/.test(priv), 'gesto: el aviso de cookies y la privacidad dicen lo que se guarda');
  await ctx.close();
}

/* ================= 8. recetas de borrado (sobre copias en memoria) ================= */
console.log('\n8. Recetas de borrado');
{
  const src = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const quitarEntre = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marcas no encontradas: ' + a); return s.slice(0, i) + s.slice(j + b.length); };
  // taurino
  let sinToros = quitarEntre(src, '<!-- ============ 8. MÓDULO TAURINO', 'fin del MÓDULO TAURINO ============ -->');
  sinToros = sinToros.replace(/<link rel="stylesheet" href="css\/taurino\.css[^"]*">\n?/, '');
  // mando
  let sinMando = quitarEntre(src, '<!-- ============ MANDO DE MAQUETA', 'fin del MANDO DE MAQUETA ============ -->');
  sinMando = quitarEntre(sinMando, '    // MANDO DE MAQUETA (no viaja al cliente): solo con ?revision', "if (q.get('densidad') === 'sobria') h.classList.add('densidad-sobria');\n    }");
  const js = fs.readFileSync(path.join(RAIZ, 'js/main.js'), 'utf8');
  const jsSinMando = quitarEntre(js, '  /* ============ 16. MANDO DE MAQUETA', 'fin del MANDO DE MAQUETA ============ */');
  for (const [nombre, html, jsMod] of [['taurino', sinToros, null], ['mando', sinMando, jsSinMando]]) {
    const { ctx, page } = await nueva();
    await page.addInitScript(sinCookies);
    await ctx.route(/localhost:\d+\/(index\.html)?(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
    if (jsMod) await ctx.route(/js\/main\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: jsMod }));
    await page.goto(BASE + (nombre === 'mando' ? '?revision' : ''));
    await esperarCortina(page);
    const r = await page.evaluate(() => ({
      taurino: !!document.getElementById('taurino'), mando: !!document.getElementById('mando'),
      anclas: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.querySelector(h)),
      sobria: document.documentElement.classList.contains('densidad-sobria'),
    }));
    if (nombre === 'taurino') comprobar(!r.taurino && r.anclas.length === 0 && page._errores.length === 0, 'quitar el módulo taurino: sin errores ni anclas rotas', { r, e: page._errores });
    else comprobar(!r.mando && !r.sobria && r.anclas.length === 0 && page._errores.length === 0, 'quitar el mando: sin errores, y ?revision ya no hace nada', { r, e: page._errores });
    await ctx.close();
  }
}

await browser.close();
servidor.close();
console.log(`\n${fallos.length ? fallos.length + ' FALLOS' : 'TODO OK'}`);
process.exit(fallos.length ? 1 : 0);
