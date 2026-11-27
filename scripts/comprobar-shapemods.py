# Comprobación en Chromium real de la sección Shape Mods (noche 16; Python + Playwright + Chrome).
#   npm run build && python scripts/comprobar-shapemods.py
# (CHROME=ruta del ejecutable; por defecto el Chrome instalado.)
#
# En escritorio 1280 / móvil 390 (táctil) × oscuro / claro × 2D / 3D:
#   - portada: la tarjeta «Shape Mods» es un enlace con los dos puzzles y «más pronto»; un toque la abre;
#   - para Mirror Blocks y Ghost Cube: elegir el chip (#/shapemods/<id>), Nuevo scramble, Cargar, Resolver,
#     un giro a mitad de animación, hasta «Resuelto»; la solución deja el puzzle resuelto;
#   - «Colocar piezas»: se abre en pantalla completa con la forma de cada pieza en la bandeja; Cancelar;
#   - tocar el puzzle para pintar explica que no se pinta;
#   - sin errores de consola ni scroll horizontal, tema pedido de verdad (data-theme).
# Capturas en docs/capturas/shapemods-*.jpg: resuelto, mezclado, a mitad de un giro y colocar piezas.
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
PUZZLES = [('mirror', 'Mirror Blocks'), ('ghost', 'Ghost Cube')]
LISTO = "() => window.cuboSolver && document.getElementById('scramble').textContent.length > 0 && !document.getElementById('scramble').classList.contains('generando') && !document.getElementById('cargar').disabled"


async def pulsar(pg, sel, tactil):
    loc = pg.locator(sel).first
    await loc.scroll_into_view_if_needed()
    if tactil: await loc.tap()
    else: await loc.click()


async def captura(pg, nombre):
    el = pg.locator('#panel-resolver').first
    await el.scroll_into_view_if_needed()
    await el.screenshot(path=f'{OUT}/{nombre}.jpg', quality=75, type='jpeg')


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
    await pg.wait_for_selector('a.tarjeta-seccion[href="#/shapemods"]')
    tarjeta = await pg.evaluate("""() => { const a = document.querySelector('a.tarjeta-seccion[href="#/shapemods"]');
      return { texto: a.textContent, tema: document.documentElement.dataset.theme, bloqueadas: [...document.querySelectorAll('.tarjeta-bloqueada .nombre')].map((x) => x.textContent) }; }""")
    if tarjeta['tema'] != tema: fallos.append(f'{clave}: tema {tarjeta["tema"]}')
    if 'más pronto' not in tarjeta['texto'] or 'Ghost' not in tarjeta['texto']: fallos.append(f'{clave}: tarjeta {tarjeta["texto"]}')
    if 'Shape Mods' in tarjeta['bloqueadas']: fallos.append(f'{clave}: Shape Mods sigue bloqueada')
    if modo == '3d':
        await pg.screenshot(path=f'{OUT}/shapemods-portada-{dispositivo}-{tema}.jpg', quality=70, type='jpeg', full_page=False)
    await pulsar(pg, 'a.tarjeta-seccion[href="#/shapemods"]', tactil)
    await pg.wait_for_function(LISTO, timeout=120000)
    datos = {}
    for pid, nombre in PUZZLES:
        t0 = time.time()
        chip = pg.locator('#selector .chip', has_text=nombre).first
        if tactil: await chip.tap()
        else: await chip.click()
        await pg.wait_for_function(f"() => window.cuboSolver.estado().puzzle === '{pid}' && location.hash === '#/shapemods/{pid}'", timeout=60000)
        await pg.wait_for_function(LISTO, timeout=120000)
        await pulsar(pg, '#resetear', tactil)
        await pg.wait_for_timeout(300)
        await captura(pg, f'shapemods-{pid}-{dispositivo}-{tema}-{modo}-resuelto')
        await pulsar(pg, '#nuevo', tactil)
        await pg.wait_for_function(LISTO, timeout=120000)
        scr = (await pg.text_content('#scramble')).split()
        await pulsar(pg, '#cargar', tactil)
        await pg.wait_for_timeout(300)
        await captura(pg, f'shapemods-{pid}-{dispositivo}-{tema}-{modo}-mezclado')
        # tocar el puzzle: no se pinta y se dice por qué
        if modo == '2d':
            # (el último polígono es el de delante: el dibujo 2D se pinta de atrás hacia delante)
            loc = pg.locator('#vista-editor [data-i]').last
            await loc.scroll_into_view_if_needed()
            if tactil: await loc.tap()
            else: await loc.click()
            await pg.wait_for_function("/un solo color/.test(document.getElementById('mensajes').textContent)", timeout=5000)
        t1 = time.time()
        await pulsar(pg, '#resolver', tactil)
        await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=120000)
        msSol = round((time.time() - t1) * 1000)
        err = await pg.evaluate("() => { const e = document.querySelector('#mensajes .mensaje.error'); return e && document.getElementById('mensajes').textContent; }")
        if err:
            fallos.append(f'{clave}/{pid}: {err}'); continue
        n = await pg.evaluate("document.querySelectorAll('#movs li').length")
        # a mitad de un giro (3D: la animación de un paso dura ~400 ms)
        await pulsar(pg, '#r-adelante', tactil)
        await pg.wait_for_timeout(170)
        await captura(pg, f'shapemods-{pid}-{dispositivo}-{tema}-{modo}-girando')
        await pg.wait_for_timeout(600)
        await pulsar(pg, '#r-fin', tactil)
        await pg.wait_for_function("/Resuelto/.test(document.getElementById('paso').textContent)", timeout=60000)
        if not await pg.evaluate('window.cuboSolver.resuelto()'): fallos.append(f'{clave}/{pid}: la solución no deja el puzzle resuelto')
        await pg.wait_for_timeout(500)
        await captura(pg, f'shapemods-{pid}-{dispositivo}-{tema}-{modo}-final')
        # colocar piezas: se abre con la forma de cada pieza en la bandeja
        await pulsar(pg, '#colocar-piezas', tactil)
        await pg.wait_for_selector('#colocar')
        formas = await pg.evaluate("document.querySelectorAll('#colocar-bandeja .muestra-pieza.forma svg').length")
        if formas < 20: fallos.append(f'{clave}/{pid}: la bandeja no enseña las formas ({formas})')
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/shapemods-{pid}-{dispositivo}-{tema}-{modo}-colocar.jpg', quality=70, type='jpeg')
        await pulsar(pg, '#colocar-cancelar', tactil)
        await pg.wait_for_function("!document.getElementById('colocar')", timeout=10000)
        scroll = await pg.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
        if scroll: fallos.append(f'{clave}/{pid}: scroll horizontal')
        datos[pid] = {'scramble': len(scr), 'solucion': n, 'msResolver': msSol, 'formasBandeja': formas, 's': round(time.time() - t0, 1)}
    for h, sec, pz in (('#/wca/3x3', 'wca', '3x3'), ('#/cuboids/2x2x3', 'cuboids', '2x2x3'), ('#/shapemods/mirror', 'shapemods', 'mirror')):
        await pg.evaluate(f"location.hash = '{h}'")
        await pg.wait_for_function(f"() => window.cuboSolver.estado().seccion === '{sec}' && window.cuboSolver.estado().puzzle === '{pz}'", timeout=60000)
    resumen[clave] = datos
    print(clave, json.dumps(datos), flush=True)
    await ctx.close()


async def main():
    os.makedirs(OUT, exist_ok=True)
    errores, fallos, resumen = [], [], {}
    solo = os.environ.get('SOLO')  # p. ej. SOLO=escritorio/dark/3d
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for dispositivo, opts in DISPOSITIVOS:
            for tema in ('dark', 'light'):
                for modo in ('3d', '2d'):
                    if solo and solo != f'{dispositivo}/{tema}/{modo}': continue
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
