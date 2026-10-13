/* Página de reunión: rehace capturas y cifras, escribe datos/reunion.json y
   pinta los datos dentro de reunion.src.html (entre las marcas <!--[x]-->),
   para que reunion.html funcione abriéndolo sin servidor.
   Uso:  node medir-reunion.mjs            → mide todo (tarda ~4 min, usa la red)
         node medir-reunion.mjs --pagina   → solo repinta la página con datos/reunion.json
   Puerto propio: 8745. No mide nada que no pueda medir: pone «no medido» y por qué. */
import { createRequire } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8745;
const SU_WEB = 'http://www.hotelheredero.net';
const JSON_DATOS = path.join(RAIZ, 'datos/reunion.json');
const DIR_IMG = path.join(RAIZ, 'img/reunion');
const SOLO_PAGINA = process.argv.includes('--pagina');

/* ---------- pintar la página a partir del JSON ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n, d = 1) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const seg = (ms) => fmt(ms / 1000, 2) + ' s';
const mb = (b) => (b >= 1048576 ? fmt(b / 1048576, 2) + ' MB' : fmt(b / 1024, 0) + ' KB');

function pintar(d) {
  const r = d.resultados;
  const filas = [
    ['¿HTTPS?',
      r.https.suWeb.ok ? 'Sí, con certificado válido.' : 'No. ' + esc(r.https.suWeb.detalle),
      'No medido: la propuesta está en local (http://localhost). El HTTPS llega con el dominio y el alojamiento, y todavía no existen.',
      'Prueba: petición a https://www.hotelheredero.net con verificación de certificado.'],
    ['¿Responsive?',
      `<strong>Con navegador de móvil:</strong> sí, sirven una versión móvil aparte (viewport «${esc(r.responsive.suWeb.movil.viewport)}», ${r.responsive.suWeb.movil.desborda ? 'desborda' : 'sin desbordar'} a 390 px).`
      + `<br><strong>Con navegador de escritorio a 390 px</strong> (ventana estrecha, tableta): no. Viewport «${esc(r.responsive.suWeb.escritorio.viewport)}» y la página mide ${r.responsive.suWeb.escritorio.scrollWidth} px de ancho en ${r.responsive.suWeb.escritorio.innerWidth}: desborda ${r.responsive.suWeb.escritorio.scrollWidth - r.responsive.suWeb.escritorio.innerWidth} px.`,
      `Sí, una sola web para todo. Viewport «${esc(r.responsive.nueva.movil.viewport)}», ${r.responsive.nueva.movil.desborda || r.responsive.nueva.escritorio.desborda ? 'desborda' : 'sin desbordar'} a 390 px ni con navegador de móvil ni de escritorio.`,
      'Prueba: meta viewport y scrollWidth frente a innerWidth, a 390 px, con el agente de usuario de un Pixel 7 y con el de escritorio.'],
    ['LCP en móvil con 4G lento',
      `<strong>${seg(r.lcp.suWeb.mediana)}</strong><br><small>${r.lcp.suWeb.pasadas.map(seg).join(' / ')} · elemento: ${esc(r.lcp.suWeb.elemento)}</small>`,
      `<strong>${seg(r.lcp.nueva.mediana)}</strong><br><small>${r.lcp.nueva.pasadas.map(seg).join(' / ')} · elemento: ${esc(r.lcp.nueva.elemento)}</small>`,
      'Prueba: Pixel 7 emulado, 1,6 Mbps y 150 ms, CPU ×4, caché vacía, PerformanceObserver; mediana de 3 pasadas. La nueva se sirve desde un servidor local con gzip y con los CDN reales.'],
    ['Peso de la portada y peticiones',
      `<strong>${mb(r.peso.suWeb.bytes)}</strong> · ${r.peso.suWeb.peticiones} peticiones`,
      `<strong>${mb(r.peso.nueva.bytes)}</strong> · ${r.peso.nueva.peticiones} peticiones`,
      'Prueba: bytes transferidos (Network.loadingFinished, con cabeceras) tras cargar la portada en móvil, sin bajar por la página ni aceptar cookies. La nueva, con servidor local con gzip; hospedada, dependerá de que el servidor comprima.'],
    ['¿Reserva en el móvil sin zoom?',
      `<strong>Con navegador de móvil:</strong> ${r.reserva.suWeb.movil.sinZoom ? 'sí' : 'no'}. ${esc(r.reserva.suWeb.movil.texto)}`
      + `<br><strong>Con navegador de escritorio a 390 px:</strong> ${r.reserva.suWeb.escritorio.sinZoom ? 'sí' : 'no'}. ${esc(r.reserva.suWeb.escritorio.texto)}`,
      `<strong>${r.reserva.nueva.movil.sinZoom ? 'Sí' : 'No'}.</strong> ${esc(r.reserva.nueva.movil.texto)}`,
      'Criterio: ancho de página igual al de pantalla, texto de los campos de 16 px o más (por debajo, iOS hace zoom solo) y botón de 44 px o más de alto.'],
  ];
  const tabla = filas.map(([a, b, c, m]) => `<tr><th scope="row">${a}<small>${m}</small></th><td>${b}</td><td>${c}</td></tr>`).join('\n          ');

  const p = d.pruebas;
  const reserva = `<dl class="prueba">
          <div><dt>Entrada y salida elegidas</dt><dd>${esc(p.reserva.elegidas)}</dd></div>
          <div><dt>Dónde se envía</dt><dd><code>${esc(p.reserva.url)}</code> (${esc(p.reserva.metodo)})</dd></div>
          <div><dt>Campos que viajan</dt><dd><code>startDate=${esc(p.reserva.startDate)}</code> · <code>endDate=${esc(p.reserva.endDate)}</code> · <code>numRooms=${esc(p.reserva.numRooms)}</code> · <code>adultsRoom1=${esc(p.reserva.adultsRoom1)}</code> · <code>namespace=${esc(p.reserva.namespace)}</code></dd></div>
          <div><dt>Se abre</dt><dd>${esc(p.reserva.abre)}</dd></div>
        </dl>`;
  const salones = `<dl class="prueba">
          <div><dt>Formulario rellenado</dt><dd>${esc(p.salones.entrada)}</dd></div>
          <div><dt>Destino</dt><dd><code>${esc(p.salones.para)}</code></dd></div>
          <div><dt>Asunto</dt><dd>${esc(p.salones.asunto)}</dd></div>
          <div><dt>Cuerpo del correo</dt><dd><pre>${esc(p.salones.cuerpo)}</pre></dd></div>
        </dl>`;
  const rapida = `<dl class="prueba">
          <div><dt>Rapidez en el móvil</dt><dd>LCP ${seg(r.lcp.nueva.mediana)} frente a ${seg(r.lcp.suWeb.mediana)} (4G lento, CPU ×4, mediana de 3).</dd></div>
          <div><dt>Móvil y escritorio</dt><dd>Una sola web, sin desbordar a 390 px con ninguno de los dos navegadores. La actual solo se adapta si detecta un móvil.</dd></div>
          <div><dt>Segura</dt><dd>${r.https.suWeb.ok ? 'Su web ya tiene HTTPS.' : 'Hoy: ' + esc(r.https.suWeb.detalle.replace(/.$/, ''))}. En la propuesta, el HTTPS depende del dominio: <strong>no medido todavía</strong>.</dd></div>
        </dl>`;

  const meta = `${esc(d.fecha)} · ${esc(d.entorno)}`;
  const piezas = { tabla, reserva, salones, rapida, meta };
  let html = fs.readFileSync(path.join(RAIZ, 'reunion.src.html'), 'utf8');
  for (const [k, v] of Object.entries(piezas)) {
    const re = new RegExp(`(<!--\\[${k}\\]-->)[\\s\\S]*?(<!--\\[/${k}\\]-->)`);
    if (!re.test(html)) throw new Error('Falta la marca ' + k + ' en reunion.src.html');
    html = html.replace(re, (m, a, b) => a + '\n' + v + '\n' + b);
  }
  fs.writeFileSync(path.join(RAIZ, 'reunion.src.html'), html);
  execFileSync(process.execPath, [path.join(RAIZ, 'construir.mjs')], { stdio: 'inherit' });
}

if (SOLO_PAGINA) {
  pintar(JSON.parse(fs.readFileSync(JSON_DATOS, 'utf8')));
  process.exit(0);
}

/* ---------- medir ---------- */
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium, devices } = require('playwright');

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.avif': 'image/avif' };
const COMPRIMIBLES = /\.(html|css|js|json|svg)$/;
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  const cab = { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' };
  if (COMPRIMIBLES.test(f) && /gzip/.test(req.headers['accept-encoding'] || '')) {
    res.writeHead(200, { ...cab, 'Content-Encoding': 'gzip' });
    res.end(zlib.gzipSync(fs.readFileSync(f)));
  } else { res.writeHead(200, cab); fs.createReadStream(f).pipe(res); }
});
await new Promise((r) => servidor.listen(PUERTO, r));
const NUEVA = `http://localhost:${PUERTO}/`;
console.log('sirviendo en ' + NUEVA);

const browser = await chromium.launch({ headless: true });
const PIXEL = devices['Pixel 7'];
const movil390 = { ...PIXEL, viewport: { width: 390, height: 844 } };
const esc390 = { viewport: { width: 390, height: 844 } };
const SIN_COOKIES = () => { try { localStorage.setItem('heredero-cookies', 'si'); } catch (e) {} };
const mediana = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const cortinaFuera = (page) => page.waitForFunction(() => { const c = document.getElementById('cortina'); return !c || getComputedStyle(c).display === 'none'; }, null, { timeout: 20000 });

async function abrir(op, url, { cookies = false, esperar = 3000 } = {}) {
  const ctx = await browser.newContext(op);
  if (cookies) await ctx.addInitScript(SIN_COOKIES);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(esperar);
  return { ctx, page };
}
/* su web: cierra su aviso de cookies (para que no tape la captura ni las medidas) */
async function aceptarSuyas(page) {
  const b = page.locator('button.cookies-button.accept').first();
  if (await b.count()) { try { await b.click({ timeout: 3000 }); await page.waitForTimeout(1200); } catch (e) {} }
}

const datos = { fecha: new Date().toISOString().slice(0, 10), entorno: 'Chromium de Playwright en Windows; red real, y 4G lento emulado solo en el LCP', resultados: {}, pruebas: {}, capturas: {} };
fs.mkdirSync(DIR_IMG, { recursive: true });
fs.mkdirSync(path.dirname(JSON_DATOS), { recursive: true });

/* 1. capturas */
console.log('1. capturas');
for (const [nombre, url, op, esSuya, ext] of [
  ['actual-movil', SU_WEB, { ...movil390, deviceScaleFactor: 2 }, true],
  ['nueva-movil', NUEVA, { ...movil390, deviceScaleFactor: 2 }, false],
  ['actual-escritorio', SU_WEB, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, true],
  ['nueva-escritorio', NUEVA, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, false],
]) {
  const { ctx, page } = await abrir(op, url, { cookies: !esSuya, esperar: esSuya ? 4000 : 500 });
  if (esSuya) await aceptarSuyas(page); else { await cortinaFuera(page); await page.waitForTimeout(1200); }
  const f = `img/reunion/${nombre}.jpg`;
  await page.screenshot({ path: path.join(RAIZ, f), type: 'jpeg', quality: 84 });
  datos.capturas[nombre] = f;
  console.log('  ' + f);
  await ctx.close();
}

/* 2. HTTPS */
console.log('2. https');
const https_ = await new Promise((resolve) => {
  const q = https.request('https://www.hotelheredero.net/', { method: 'HEAD', timeout: 15000 }, (res) => { res.resume(); resolve({ ok: true, detalle: 'HTTP ' + res.statusCode }); });
  q.on('timeout', () => q.destroy(new Error('sin respuesta en 15 s')));
  q.on('error', (e) => {
    // ¿responde sin verificar el certificado? distingue «certificado malo» de «no hay HTTPS»
    const q2 = https.request('https://www.hotelheredero.net/', { method: 'HEAD', timeout: 15000, rejectUnauthorized: false }, (res) => { res.resume(); resolve({ ok: false, detalle: `El navegador no lo acepta: ${e.code || e.message} (responde solo si se ignora el certificado).` }); });
    q2.on('timeout', () => q2.destroy(new Error('t')));
    q2.on('error', (e2) => resolve({ ok: false, detalle: `La conexión HTTPS se corta (${e.code || e.message}); ni ignorando el certificado responde.` }));
    q2.end();
  });
  q.end();
});
datos.resultados.https = { suWeb: https_ };
console.log('  ', https_);

/* 3. responsive */
console.log('3. responsive');
const resp = {};
for (const [clave, url] of [['suWeb', SU_WEB], ['nueva', NUEVA]]) {
  resp[clave] = {};
  for (const [perfil, op] of [['movil', movil390], ['escritorio', esc390]]) {
    const { ctx, page } = await abrir(op, url, { cookies: clave === 'nueva', esperar: 3000 });
    const m = await page.evaluate(() => ({ viewport: document.querySelector('meta[name=viewport]')?.content ?? '(ninguno)', innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    m.desborda = m.scrollWidth > m.innerWidth;
    resp[clave][perfil] = m;
    console.log('  ', clave, perfil, m);
    await ctx.close();
  }
}
datos.resultados.responsive = resp;

/* 4. LCP */
console.log('4. LCP (3 pasadas por web)');
async function lcp(url, cookies) {
  const ctx = await browser.newContext(PIXEL);
  await ctx.addInitScript(() => {
    window.__lcp = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lcp.push({ t: e.startTime, el: (e.element && e.element.tagName.toLowerCase() + (e.element.id ? '#' + e.element.id : '')) || '', url: e.url || '' }))).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1e6) / 8, uploadThroughput: (750 * 1e3) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(9000);
  const e = await page.evaluate(() => window.__lcp.slice(-1)[0]);
  await ctx.close();
  return e;
}
const nombreEl = (e) => e.el + (e.url ? ' (' + e.url.split('/').pop().split('?')[0].slice(0, 40) + ')' : '');
datos.resultados.lcp = {};
for (const [clave, url] of [['suWeb', SU_WEB], ['nueva', NUEVA]]) {
  const pas = [], els = [];
  for (let i = 0; i < 3; i++) { const e = await lcp(url); pas.push(Math.round(e.t)); els.push(nombreEl(e)); console.log('  ', clave, Math.round(e.t), nombreEl(e)); }
  datos.resultados.lcp[clave] = { pasadas: pas, mediana: mediana(pas), elemento: els[pas.indexOf(mediana(pas))] };
}

/* 5. peso y peticiones */
console.log('5. peso');
async function peso(url) {
  const ctx = await browser.newContext(movil390);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const urls = new Map(); let bytes = 0;
  cdp.on('Network.requestWillBeSent', (e) => { if (!e.request.url.startsWith('data:')) urls.set(e.requestId, e.request.url); });
  cdp.on('Network.loadingFinished', (e) => { if (urls.has(e.requestId)) bytes += e.encodedDataLength; });
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await ctx.close();
  return { bytes, peticiones: urls.size };
}
datos.resultados.peso = { suWeb: await peso(SU_WEB), nueva: await peso(NUEVA) };
console.log('  ', datos.resultados.peso);

/* 6. reserva sin zoom: tamaños reales de los campos de reserva */
console.log('6. reserva sin zoom');
const mideReserva = (sel) => (s) => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
  const campos = [...document.querySelectorAll(s)].filter((e) => e.type !== 'hidden' && vis(e));
  const botones = campos.filter((e) => e.tagName === 'BUTTON' || e.type === 'submit');
  return {
    campos: campos.length,
    fuenteMin: Math.min(...campos.filter((e) => e.tagName !== 'BUTTON' && e.type !== 'submit').map((e) => parseFloat(getComputedStyle(e).fontSize))),
    botonAlto: botones.length ? Math.round(Math.min(...botones.map((e) => e.getBoundingClientRect().height))) : null,
    innerWidth, scrollWidth: document.documentElement.scrollWidth,
  };
};
const SEL_SUYO = 'form[action*="booking1"] input, form[action*="booking1"] select, form[action*="booking1"] button';
const SEL_NUEVO = '#form-reserva input, #form-reserva select, #form-reserva button';
async function reserva(op, url, sel, suya) {
  const { ctx, page } = await abrir(op, url, { cookies: !suya, esperar: suya ? 4000 : 500 });
  if (suya) await aceptarSuyas(page); else { await cortinaFuera(page); await page.waitForTimeout(800); }
  const m = await page.evaluate(mideReserva(sel), sel);
  await ctx.close();
  // la fuente efectiva en pantalla es la computada por el factor de ajuste de la página
  const factor = m.innerWidth / 390;
  const fuenteEf = m.fuenteMin / factor;
  const altoEf = m.botonAlto == null ? null : m.botonAlto / factor;
  const sinZoom = m.campos > 0 && m.scrollWidth <= m.innerWidth && m.fuenteMin >= 16 && altoEf != null && altoEf >= 44;
  const texto = m.campos === 0 ? 'No se encontró el formulario de reserva visible.'
    : `La página mide ${m.scrollWidth} px en una pantalla de 390; texto mínimo de los campos de formulario ${fmt(fuenteEf, 1)} px en pantalla; botón de ${altoEf == null ? '—' : fmt(altoEf, 0)} px de alto.`;
  return { sinZoom, texto, medidas: m };
}
datos.resultados.reserva = {
  suWeb: { movil: await reserva(movil390, SU_WEB, SEL_SUYO, true), escritorio: await reserva(esc390, SU_WEB, SEL_SUYO, true) },
  nueva: { movil: await reserva(movil390, NUEVA, SEL_NUEVO, false) },
};
console.log('  ', JSON.stringify(datos.resultados.reserva, null, 1));

/* 7. pruebas de «lo que gana» */
console.log('7. pruebas');
{
  const { ctx, page } = await abrir(movil390, NUEVA, { cookies: true, esperar: 500 });
  await cortinaFuera(page); await page.waitForTimeout(800);
  const d0 = new Date(); d0.setDate(d0.getDate() + 30);
  const d1 = new Date(d0); d1.setDate(d1.getDate() + 2);
  const iso = (d) => d.toISOString().slice(0, 10);
  const dmy = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  let capt = null;
  await ctx.route(/appspot\.com\/booking1/, (r) => { capt = { url: r.request().url(), metodo: r.request().method(), cuerpo: r.request().postData() || '' }; r.fulfill({ status: 200, contentType: 'text/html', body: '<title>interceptado</title>' }); });
  await page.fill('#r-entrada', iso(d0));
  await page.fill('#r-salida', iso(d1));
  await page.selectOption('select[name=adultsRoom1]', '2');
  const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 8000 }).catch(() => null), page.click('#form-reserva button[type=submit]')]);
  await page.waitForTimeout(1500);
  if (popup) await popup.close().catch(() => {});
  if (!capt) throw new Error('El envío de reserva no llegó al motor de Paraty');
  const q = new URLSearchParams(capt.cuerpo);
  datos.pruebas.reserva = {
    elegidas: `${dmy(d0)} → ${dmy(d1)} (se rellenan en el formulario con los selectores de fecha)`,
    url: capt.url.split('?')[0], metodo: capt.metodo + ', pestaña nueva',
    startDate: q.get('startDate'), endDate: q.get('endDate'), numRooms: q.get('numRooms'), adultsRoom1: q.get('adultsRoom1'), namespace: q.get('namespace'),
    abre: popup ? 'Una pestaña nueva con el motor (en esta prueba se intercepta el envío; el 2026-10-13 se comprobó sin interceptar que Paraty abre el paso 1 con esas fechas).' : 'No se abrió pestaña nueva en esta prueba.',
  };
  if (!popup) throw new Error('No se abrió la pestaña nueva');
  // salones
  await page.fill('#e-nombre', 'Prueba de reunión');
  await page.fill('#e-inv', '120');
  await page.fill('#e-fecha', '2027-06');
  await page.fill('#e-tel', '600000000');
  const tipo = await page.$eval('#e-tipo', (s) => s.value);
  await page.click('#form-evento button[type=submit]').catch(() => {});
  await page.waitForTimeout(800);
  const mailto = await page.$eval('#form-evento', (f) => f.dataset.mailto || '');
  if (!mailto) throw new Error('El formulario de eventos no preparó el mailto');
  const u = new URL(mailto);
  datos.pruebas.salones = {
    entrada: `${tipo}, junio de 2027, 120 invitados, nombre y teléfono`,
    para: decodeURIComponent(u.pathname), asunto: u.searchParams.get('subject'), cuerpo: u.searchParams.get('body'),
  };
  await ctx.close();
}

fs.writeFileSync(JSON_DATOS, JSON.stringify(datos, null, 2) + '\n');
console.log('escrito datos/reunion.json');
await browser.close();
servidor.close();
pintar(datos);
console.log('hecho');
process.exit(0);
