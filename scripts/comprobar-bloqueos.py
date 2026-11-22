# Comprobación en Chromium real del cubo vendado (opcional; Python + Playwright + Chrome).
#   npm run build && python3 scripts/comprobar-bloqueos.py
# Escritorio (1280 px, claro) y móvil (390 px, oscuro, táctil), con 3D (WebGL por software) y sin 3D (2D):
#   - crear un bloque tocando piezas en el editor (2D: pegatinas del dibujo; 3D: un toque en el modelo),
#     ver el error de un bloque imposible al momento, aplicar y esperar al análisis (Worker);
#   - cargar ejemplos (1x2x2, CAB) e importar una firma;
#   - scramble, cargar, resolver y reproducir la solución hasta el final (×8 en 3D), con la fase
#     (geometría / permutación) en la barra cuando la estrategia es la B;
#   - en 3D, las pegatinas vecinas de un mismo bloque se dibujan unidas (lados sin encoger);
#   - sin errores en consola ni scroll horizontal.
# Capturas en docs/capturas/bloqueos-*.jpg.
import asyncio, json, os
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(RAIZ, 'dist/index.html')
OUT = os.path.join(RAIZ, 'docs/capturas')
CONFIGS = [
    ('escritorio', dict(viewport={'width': 1280, 'height': 900}, color_scheme='light')),
    ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme='dark')),
]

INFO = """() => {
  const v = window.cuboSolver.vista3D('editor');
  const g = v && v.escena.geometria;
  return {
    paso: document.getElementById('paso').textContent,
    resumen: document.getElementById('sol-resumen').textContent,
    fases: [...document.querySelectorAll('#fases .fase')].map((b) => b.dataset.fase),
    unidas: g ? g.pegatinas.filter((q) => q.expandir).length : null,
    analisis: document.getElementById('bloq-analisis').textContent,
    scroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
}"""

async def esperar_scramble(pg):
    await pg.wait_for_function("!document.getElementById('scramble').classList.contains('generando') && document.getElementById('scramble').textContent.length > 0", timeout=120000)

async def resolver_y_reproducir(pg, modo3d, fallos, clave):
    await pg.click('#cargar')
    await pg.evaluate(f"() => {{ const b = document.querySelector('#modo-editor button[data-modo=\"{'3d' if modo3d else '2d'}\"]'); if (b) b.click(); }}")
    await pg.click('#resolver')
    await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=120000)
    err = await pg.evaluate("document.querySelector('#mensajes .mensaje.error') ? document.getElementById('mensajes').textContent : null")
    if err: fallos.append(f'{clave}: {err}'); return None
    await pg.click('#r-inicio')
    while (await pg.inner_text('#r-velocidad')) != '×8':
        await pg.click('#r-velocidad')
    await pg.click('#r-play')
    await pg.wait_for_timeout(500)
    d = await pg.evaluate(INFO)
    await pg.wait_for_function("document.getElementById('paso').textContent.includes('Resuelto')", timeout=120000)
    ok = await pg.evaluate("window.cuboSolver.resuelto()")
    if not ok: fallos.append(f'{clave}: no queda resuelto')
    return d

async def main():
    os.makedirs(OUT, exist_ok=True)
    errores, fallos, resumen = [], [], {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'),
                                    args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for cfg, opts in CONFIGS:
            for modo3d in (True, False):
                clave = f"{cfg}/{'3d' if modo3d else '2d'}"
                ctx = await b.new_context(**opts)
                pg = await ctx.new_page()
                pg.on('pageerror', lambda e, c=clave: errores.append(f'{c}: {e}'))
                pg.on('console', lambda m, c=clave: errores.append(f'{c}: {m.text}') if m.type == 'error' else None)
                await pg.goto(URL)
                await esperar_scramble(pg)
                await pg.locator('#selector .chip', has_text='3x3').first.click()
                await esperar_scramble(pg)
                modo = '3d' if modo3d else '2d'
                await pg.evaluate(f"() => {{ for (const id of ['modo-previa', 'modo-editor']) {{ const b = document.querySelector('#' + id + ' button[data-modo=\"{modo}\"]'); if (b) b.click(); }} }}")
                # 1) crear un bloque tocando piezas
                await pg.click('#bloq-nuevo')
                if modo3d:
                    # toque en el centro del lienzo 3D (la pieza que se ve delante) y en la del 2D para la segunda
                    lienzo = pg.locator('#vista3d-editor canvas')
                    caja = await lienzo.bounding_box()
                    pos = {'x': caja['width'] / 2, 'y': caja['height'] / 2}
                    if opts.get('has_touch'): await lienzo.tap(position=pos)
                    else: await lienzo.click(position=pos)
                    await pg.wait_for_timeout(200)
                    n = await pg.evaluate("document.querySelectorAll('#bloq-grupos li').length && document.querySelector('#bloq-grupos li .piezas').textContent")
                    if not n or 'vacío' in n: fallos.append(f'{clave}: el toque en 3D no añade ninguna pieza ({n})')
                    # el resto en 2D (más preciso)
                    await pg.evaluate("() => document.querySelector('#modo-editor button[data-modo=\"2d\"]').click()")
                    await pg.click('#bloq-quitar')
                    await pg.click('#bloq-nuevo')
                for i in (8, 7):  # UFR y UF
                    await pg.locator(f'#vista-editor [data-i="{i}"]').click()
                txt = await pg.inner_text('#bloq-grupos')
                if 'UFR + UF' not in txt: fallos.append(f'{clave}: el bloque no tiene UFR + UF ({txt})')
                await pg.locator('#panel-bloqueos').screenshot(path=f'{OUT}/bloqueos-{cfg}-{modo}-editar.jpg', quality=70, type='jpeg')
                await pg.click('#bloq-aplicar')
                await pg.wait_for_function("/24 geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                if modo3d:
                    await pg.evaluate("() => { for (const id of ['modo-previa', 'modo-editor']) { const b = document.querySelector('#' + id + ' button[data-modo=\"3d\"]'); if (b) b.click(); } }")
                await esperar_scramble(pg)
                d = await resolver_y_reproducir(pg, modo3d, fallos, clave + '/pareja')
                resumen[clave + '/pareja'] = d and {k: d[k] for k in ('resumen', 'fases', 'unidas')}
                # 2) varios bloques con la estrategia B forzada: la barra de fases y el paso dicen la fase
                await pg.select_option('#bloq-config', 'ej:varios')
                await pg.wait_for_function("/1\\.440 geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                await pg.select_option('#bloq-estrategia', 'B')
                await esperar_scramble(pg)
                await pg.click('#cargar')
                await pg.click('#resolver')
                await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=120000)
                fb = await pg.evaluate("() => ({ fases: [...document.querySelectorAll('#fases .fase')].map((b) => b.dataset.fase), resumen: document.getElementById('sol-resumen').textContent })")
                if 'estrategia B' not in fb['resumen'] or 'Permutación' not in fb['fases']: fallos.append(f'{clave}: B forzada sin fases ({fb})')
                await pg.click('#r-adelante')
                await pg.wait_for_function("document.getElementById('paso').textContent.startsWith('Paso 1/')")
                paso1 = await pg.inner_text('#paso')
                if 'Geometría' in fb['fases'] and 'Geometría' not in paso1: fallos.append(f'{clave}: el paso 1 no dice la fase ({paso1})')
                await pg.wait_for_timeout(500)
                await pg.locator('#panel-resolver').screenshot(path=f'{OUT}/bloqueos-{cfg}-{modo}-fases.jpg', quality=70, type='jpeg')
                resumen[clave + '/varios-B'] = fb
                await pg.select_option('#bloq-estrategia', '')
                # 3) ejemplo 1x2x2 (las pegatinas del bloque, unidas en 3D)
                await pg.select_option('#bloq-config', 'ej:1x2x2')
                await pg.wait_for_function("/4 geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                await esperar_scramble(pg)
                d = await resolver_y_reproducir(pg, modo3d, fallos, clave + '/1x2x2')
                resumen[clave + '/1x2x2'] = d and {k: d[k] for k in ('resumen', 'fases', 'unidas')}
                if modo3d and d and not d['unidas']: fallos.append(f'{clave}: en 3D no hay pegatinas unidas')
                await pg.click('#r-inicio')
                await pg.wait_for_timeout(400)
                await pg.locator('#panel-resolver').screenshot(path=f'{OUT}/bloqueos-{cfg}-{modo}-1x2x2.jpg', quality=70, type='jpeg')
                # 3) CAB (espacio pequeño: óptima por BFS) y una firma importada (Bicube)
                await pg.select_option('#bloq-config', 'ej:cab')
                await pg.wait_for_function("/15\\.704 geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                await esperar_scramble(pg)
                d = await resolver_y_reproducir(pg, modo3d, fallos, clave + '/cab')
                resumen[clave + '/cab'] = d and {k: d[k] for k in ('resumen', 'fases', 'unidas')}
                await pg.locator('#panel-scramble').screenshot(path=f'{OUT}/bloqueos-{cfg}-{modo}-cab.jpg', quality=70, type='jpeg')
                await pg.evaluate("() => { document.querySelector('.bloq-mas').open = true; }")
                await pg.fill('#bloq-firma', '1680008C2FB461')
                await pg.click('#bloq-importar')
                await pg.wait_for_function("/centros opuestos/.test(document.getElementById('bloq-errores').textContent)")
                await pg.fill('#bloq-firma', 'E0400B43FC5A1')
                await pg.click('#bloq-importar')
                await pg.wait_for_function("/121 geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                await esperar_scramble(pg)
                d = await resolver_y_reproducir(pg, modo3d, fallos, clave + '/bicube')
                resumen[clave + '/bicube'] = d and {k: d[k] for k in ('resumen', 'fases', 'unidas')}
                info = await pg.evaluate(INFO)
                if info['scroll']: fallos.append(f'{clave}: scroll horizontal')
                await pg.screenshot(path=f'{OUT}/bloqueos-{cfg}-{modo}-pagina.jpg', quality=60, type='jpeg', full_page=True)
                # volver al 3x3 normal para no dejar bloques guardados
                await pg.select_option('#bloq-config', 'vacia')
                await ctx.close()
        await b.close()
    print(json.dumps({'resumen': resumen, 'fallos': fallos, 'errores': errores}, ensure_ascii=False, indent=1))
    if fallos or errores: raise SystemExit(1)

asyncio.run(main())
