# La app en los cuatro sitios donde se usa, en Chromium real (sesión «carga más rápida»; Python + Playwright + Chrome).
#   npm run build && python scripts/comprobar-entornos.py            (SOLO=pages/escritorio/dark para una combinación)
# Entornos:
#   pages      dist/index.html servido como GitHub Pages (scripts/servidor-pages.mjs: gzip, caché)
#   file       dist/index.html abierto desde el disco (file://, como con doble clic)
#   artifact   dist/artifact.html dentro de un iframe de OTRO origen con sandbox (como claude.ai, que sirve el
#              artifact desde un dominio aparte); el HTML del artifact no trae <html>/<head>: se envuelve igual
#              que lo haría la página que lo aloja
#   sinworker  como pages, pero sin Web Workers (window.Worker no existe): todo en el hilo principal
# En cada uno (escritorio 1280 / móvil 390 táctil × oscuro / claro): portada → un puzzle de cada sección
# (WCA 3x3, Bandaged 3x3, Cuboids 2x2x3 Tower, Shape Mods Mirror Blocks) → Nuevo scramble → Cargar → Resolver →
# reproducir (un paso y ⇥) → «Resuelto» de verdad. Comprueba dónde se calcula (Worker o hilo principal),
# sin errores de consola ni scroll horizontal.
import asyncio, json, os, subprocess, sys, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import threading
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(RAIZ, 'dist')
CHROME = os.environ.get('CHROME') or next((c for c in [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'] if os.path.exists(c)), None)
DISPOSITIVOS = [
    ('escritorio', dict(viewport={'width': 1280, 'height': 860})),
    ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)),
]
RECORRIDO = [('#/wca/3x3', '3x3'), ('#/bandaged', '3x3'), ('#/cuboids/2x2x3', '2x2x3'), ('#/shapemods/mirror', 'mirror')]
LISTO = "() => window.cuboSolver && document.getElementById('scramble').textContent.length > 0 && !document.getElementById('scramble').classList.contains('generando') && !document.getElementById('cargar').disabled"
P_PAGES, P_ANFITRION, P_ARTIFACT = 8781, 8782, 8783


def servir_artifact():
    """Origen del artifact (otro puerto = otro origen): /artifact.html envuelto en un documento mínimo."""
    cuerpo = open(os.path.join(DIST, 'artifact.html'), encoding='utf-8').read()
    pagina = ('<!doctype html><html lang="es"><head><meta charset="utf-8">'
              '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + cuerpo + '</body></html>').encode('utf-8')

    class H(SimpleHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(pagina))); self.end_headers(); self.wfile.write(pagina)
        def log_message(self, *a): pass
    s = ThreadingHTTPServer(('127.0.0.1', P_ARTIFACT), H)
    threading.Thread(target=s.serve_forever, daemon=True).start()

    anfitrion = (f'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
                 f'<style>html,body{{margin:0;height:100%}}iframe{{border:0;width:100%;height:100%;display:block}}</style></head><body>'
                 f'<iframe id="art" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads" '
                 f'src="http://127.0.0.1:{P_ARTIFACT}/artifact.html"></iframe></body></html>').encode('utf-8')

    class A(SimpleHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(anfitrion))); self.end_headers(); self.wfile.write(anfitrion)
        def log_message(self, *a): pass
    s2 = ThreadingHTTPServer(('127.0.0.1', P_ANFITRION), A)
    threading.Thread(target=s2.serve_forever, daemon=True).start()
    return s, s2


async def objetivo(pg, entorno):
    """La página o el iframe del artifact (donde está la app)."""
    if entorno != 'artifact': return pg
    for _ in range(200):
        f = next((f for f in pg.frames if str(P_ARTIFACT) in f.url), None)
        if f: return f
        await asyncio.sleep(0.05)
    raise RuntimeError('no aparece el iframe del artifact')


async def ir(app, pg, entorno, base, hash_):
    if entorno == 'artifact': await app.evaluate(f"location.hash = {json.dumps(hash_)}")
    elif hash_ == '#/': await pg.goto(base + '#/')
    else: await app.evaluate(f"location.hash = {json.dumps(hash_)}")


async def pulsar(app, sel, tactil):
    loc = app.locator(sel).first
    await loc.scroll_into_view_if_needed()
    if tactil: await loc.tap()
    else: await loc.click()


async def comprobar(b, entorno, dispositivo, opts, tema, fallos, resumen):
    clave = f'{entorno}/{dispositivo}/{tema}'
    ctx = await b.new_context(**opts)
    guardado = 'claro' if tema == 'light' else 'oscuro'
    init = f"try {{ localStorage.setItem('cubo-solver:tema', '{guardado}'); }} catch (e) {{}}"
    if entorno == 'sinworker': init += " try { delete window.Worker; window.Worker = undefined; } catch (e) {}"
    await ctx.add_init_script(init)
    pg = await ctx.new_page()
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
    tactil = bool(opts.get('has_touch'))
    base = {'pages': f'http://127.0.0.1:{P_PAGES}/', 'sinworker': f'http://127.0.0.1:{P_PAGES}/',
            'file': 'file:///' + os.path.join(DIST, 'index.html').replace('\\', '/').lstrip('/'),
            'artifact': f'http://127.0.0.1:{P_ANFITRION}/'}[entorno]
    t0 = time.time()
    await pg.goto(base + ('#/' if entorno != 'artifact' else ''))
    app = await objetivo(pg, entorno)
    await app.wait_for_selector('a.tarjeta-seccion', timeout=60000)
    info = await app.evaluate("() => ({ tema: document.documentElement.dataset.theme, modo: (document.getElementById('modo-calculo') || {}).textContent || '' })")
    datos = {'portada_s': round(time.time() - t0, 2)}
    if info['tema'] != tema: fallos.append(f'{clave}: tema {info["tema"]}')
    for hash_, pid in RECORRIDO:
        await ir(app, pg, entorno, base, hash_)
        await app.wait_for_function(f"() => window.cuboSolver && window.cuboSolver.estado().puzzle === {json.dumps(pid)}", timeout=120000)
        await app.wait_for_function(LISTO, timeout=180000)
        await pulsar(app, '#nuevo', tactil)
        await app.wait_for_function(LISTO, timeout=180000)
        await pulsar(app, '#cargar', tactil)
        await pulsar(app, '#resolver', tactil)
        await app.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=180000)
        err = await app.evaluate("() => { const e = document.querySelector('#mensajes .mensaje.error'); return e && document.getElementById('mensajes').textContent; }")
        if err: fallos.append(f'{clave} {hash_}: {err}'); continue
        await pulsar(app, '#r-adelante', tactil)
        await app.wait_for_timeout(450)
        await pulsar(app, '#r-fin', tactil)
        await app.wait_for_function("/Resuelto/.test(document.getElementById('paso').textContent)", timeout=60000)
        if not await app.evaluate('window.cuboSolver.resuelto()'): fallos.append(f'{clave} {hash_}: no queda resuelto')
        datos[hash_] = await app.evaluate("document.querySelectorAll('#movs li').length")
    modo = await app.evaluate("() => (document.getElementById('modo-calculo') || {}).textContent || ''")
    datos['modo'] = 'worker' if 'Web Worker' in modo else ('hilo principal' if 'hilo principal' in modo else modo)
    quiero = 'hilo principal' if entorno == 'sinworker' else 'worker'
    if datos['modo'] != quiero: fallos.append(f'{clave}: calcula en «{modo}» (se esperaba {quiero})')
    if await app.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'): fallos.append(f'{clave}: scroll horizontal')
    if errores: fallos.append(f'{clave}: errores de consola {errores[:3]}')
    resumen[clave] = datos
    print(clave, json.dumps(datos, ensure_ascii=False), flush=True)
    await ctx.close()


async def main():
    solo = os.environ.get('SOLO')
    entornos = (os.environ.get('ENTORNOS') or 'pages,file,artifact,sinworker').split(',')
    srv = subprocess.Popen(['node', os.path.join(RAIZ, 'scripts/servidor-pages.mjs'), DIST, str(P_PAGES)], stdout=subprocess.PIPE)
    assert b'sirviendo' in srv.stdout.readline(), f'no arranca el servidor en {P_PAGES} (¿puerto ocupado?)'
    servir_artifact()
    fallos, resumen = [], {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            for entorno in entornos:
                for dispositivo, opts in DISPOSITIVOS:
                    for tema in ('dark', 'light'):
                        if solo and solo != f'{entorno}/{dispositivo}/{tema}': continue
                        try:
                            await comprobar(b, entorno, dispositivo, opts, tema, fallos, resumen)
                        except Exception as e:
                            fallos.append(f'{entorno}/{dispositivo}/{tema}: excepción {str(e)[:300]}')
                            print('EXCEPCIÓN', entorno, dispositivo, tema, str(e)[:300], flush=True)
            await b.close()
    finally:
        srv.terminate()
    print('fallos:', fallos or 'ninguno')
    sys.exit(1 if fallos else 0)

asyncio.run(main())
