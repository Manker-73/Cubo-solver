# Comprobación en Chromium real de la sección Cuboids (noche 15; Python + Playwright + Chrome).
#   npm run build && python scripts/comprobar-cuboides.py
# (CHROME=ruta del ejecutable; por defecto el Chrome instalado.)
#
# En escritorio 1280 / móvil 390 (táctil) × oscuro / claro × 2D / 3D:
#   - portada: la tarjeta «Cuboids» es un enlace con los tres puzzles y «más pronto»; un toque la abre;
#   - para 3x3x1, 3x3x2 y 2x2x3: elegir el chip (la URL pasa a #/cuboids/<id>), Nuevo scramble, Cargar,
#     Resolver, unos pasos animados con el reproductor y luego hasta «Resuelto»; la solución deja el
#     puzzle resuelto; tiempo de las tablas y de la solución;
#   - las rutas de siempre (#/wca/3x3, #/bandaged) siguen funcionando;
#   - sin errores de consola ni scroll horizontal, tema pedido de verdad (data-theme).
# Colocar piezas con los tres: scripts/comprobar-colocar.py (PUZZLES=cuboids).
# Capturas en docs/capturas/cuboids-*.jpg.
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'file:///' + os.path.join(RAIZ, 'dist/index.html').replace('\\', '/').lstrip('/')
OUT = os.path.join(RAIZ, 'docs/capturas')
CHROME = os.environ.get('CHROME') or next((c for c in [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'] if os.path.exists(c)), None)
DISPOSITIVOS = [
    ('escritorio', dict(viewport={'width': 1280, 'height': 860})),
    ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)),
]
CUBOIDES = [('3x3x1', '3x3x1 Floppy'), ('3x3x2', '3x3x2 Domino'), ('2x2x3', '2x2x3 Tower')]
LISTO = "() => window.cuboSolver && document.getElementById('scramble').textContent.length > 0 && !document.getElementById('scramble').classList.contains('generando') && !document.getElementById('cargar').disabled"


async def pulsar(pg, sel, tactil):
    loc = pg.locator(sel).first
    await loc.scroll_into_view_if_needed()
    if tactil: await loc.tap()
    else: await loc.click()


async def comprobar(b, dispositivo, opts, tema, modo, errores, fallos, resumen):
    clave = f'{dispositivo}/{tema}/{modo}'
    ctx = await b.new_context(**opts)
    guardado = 'claro' if tema == 'light' else 'oscuro'
    await ctx.add_init_script(f"""try {{ localStorage.setItem('cubo-solver:tema', '{guardado}');
      localStorage.setItem('cubo-solver:modo3d', JSON.stringify({{ previa: '{modo}', edicion: '{modo}', solucion: '{modo}' }})); }} catch (e) {{}}""")
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e, c=clave: errores.append(f'{c}: {e}'))
    pg.on('console', lambda m, c=clave: errores.append(f'{c}: {m.text}') if m.type == 'error' else None)
    tactil = bool(opts.get('has_touch'))
    await pg.goto(BASE + '#/')
    await pg.wait_for_selector('a.tarjeta-seccion[href="#/cuboids"]')
    tarjeta = await pg.evaluate("""() => { const a = document.querySelector('a.tarjeta-seccion[href="#/cuboids"]'); const r = a.getBoundingClientRect();
      return { texto: a.textContent, alto: r.height, tema: document.documentElement.dataset.theme, bloqueadas: [...document.querySelectorAll('.tarjeta-bloqueada .nombre')].map((x) => x.textContent) }; }""")
    if tarjeta['tema'] != tema: fallos.append(f'{clave}: tema {tarjeta["tema"]}')
    if 'más pronto' not in tarjeta['texto'] or '3x3x2' not in tarjeta['texto']: fallos.append(f'{clave}: tarjeta {tarjeta["texto"]}')
    if 'Cuboids' in tarjeta['bloqueadas']: fallos.append(f'{clave}: Cuboids sigue bloqueada')
    if (dispositivo, modo) == ('escritorio', '3d') or (dispositivo, modo) == ('movil', '2d'):
        await pg.screenshot(path=f'{OUT}/cuboids-portada-{dispositivo}-{tema}.jpg', quality=70, type='jpeg', full_page=False)
    await pulsar(pg, 'a.tarjeta-seccion[href="#/cuboids"]', tactil)
    await pg.wait_for_function(LISTO, timeout=120000)
    datos = {}
    for pid, nombre in CUBOIDES:
        t0 = time.time()
        chip = pg.locator('#selector .chip', has_text=nombre).first
        if tactil: await chip.tap()
        else: await chip.click()
        await pg.wait_for_function(f"() => window.cuboSolver.estado().puzzle === '{pid}' && location.hash === '#/cuboids/{pid}'", timeout=60000)
        await pg.wait_for_function(LISTO, timeout=120000)
        await pulsar(pg, '#nuevo', tactil)
        await pg.wait_for_function(LISTO, timeout=120000)
        scr = (await pg.text_content('#scramble')).split()
        await pulsar(pg, '#cargar', tactil)
        t1 = time.time()
        await pulsar(pg, '#resolver', tactil)
        await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=120000)
        msSol = round((time.time() - t1) * 1000)
        err = await pg.evaluate("() => { const e = document.querySelector('#mensajes .mensaje.error'); return e && document.getElementById('mensajes').textContent; }")
        if err:
            fallos.append(f'{clave}/{pid}: {err}'); continue
        n = await pg.evaluate("document.querySelectorAll('#movs li').length")
        # unos pasos animados (3D: el giro se anima) y luego hasta el final
        await pulsar(pg, '#r-play', tactil)
        await pg.wait_for_timeout(900)
        if (dispositivo, tema, modo) in (('escritorio', 'dark', '3d'), ('movil', 'light', '3d'), ('escritorio', 'light', '2d'), ('movil', 'dark', '2d')):
            await pg.locator('#panel-resolver').scroll_into_view_if_needed()
            await pg.screenshot(path=f'{OUT}/cuboids-{pid}-{dispositivo}-{tema}-{modo}-reproduciendo.jpg', quality=70, type='jpeg')
        await pulsar(pg, '#r-fin', tactil)
        await pg.wait_for_function("/Resuelto/.test(document.getElementById('paso').textContent)", timeout=60000)
        if not await pg.evaluate('window.cuboSolver.resuelto()'): fallos.append(f'{clave}/{pid}: la solución no deja el puzzle resuelto')
        scroll = await pg.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
        if scroll: fallos.append(f'{clave}/{pid}: scroll horizontal')
        aviso = await pg.evaluate("() => (document.getElementById('aviso-tablas') || {}).textContent || ''")
        datos[pid] = {'scramble': len(scr), 'solucion': n, 'msResolver': msSol, 's': round(time.time() - t0, 1)}
    # rutas de siempre
    for h, sec, pz in (('#/wca/3x3', 'wca', '3x3'), ('#/bandaged', 'bandaged', '3x3'), ('#/cuboids/2x2x3', 'cuboids', '2x2x3')):
        await pg.evaluate(f"location.hash = '{h}'")
        await pg.wait_for_function(f"() => window.cuboSolver.estado().seccion === '{sec}' && window.cuboSolver.estado().puzzle === '{pz}'", timeout=60000)
    resumen[clave] = datos
    print(clave, json.dumps(datos), flush=True)
    await ctx.close()


async def main():
    os.makedirs(OUT, exist_ok=True)
    errores, fallos, resumen = [], [], {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for dispositivo, opts in DISPOSITIVOS:
            for tema in ('dark', 'light'):
                for modo in ('3d', '2d'):
                    try:
                        await comprobar(b, dispositivo, opts, tema, modo, errores, fallos, resumen)
                    except Exception as e:
                        fallos.append(f'{dispositivo}/{tema}/{modo}: excepción {e}')
                        print('EXCEPCIÓN', dispositivo, tema, modo, e, flush=True)
        await b.close()
    print('errores de consola:', errores or 'ninguno')
    print('fallos:', fallos or 'ninguno')
    sys.exit(1 if errores or fallos else 0)

asyncio.run(main())
