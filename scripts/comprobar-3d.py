# Comprobación de la vista 3D en Chromium real (opcional; necesita Python + Playwright y Chrome).
#   python3 scripts/comprobar-3d.py [--rapido] [puzzles...]
# Para cada configuración (escritorio / móvil 390 px, tema claro / oscuro) y cada puzzle:
# reproduce el scramble animado en la vista previa, lo carga, lo resuelve y reproduce la
# solución en 3D hasta el final (×8), da un paso atrás animado, prueba a pintar tocando el
# modelo 3D y a resaltar una pieza. Mide los FPS de las animaciones, guarda capturas en
# docs/capturas/ y falla si hay errores en la consola.
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(RAIZ, 'dist/index.html')
OUT = os.path.join(RAIZ, 'docs/capturas')
TODOS = ['2x2', '3x3', '4x4', '5x5', '6x6', '7x7', 'Pyraminx', 'Skewb', 'Square-1', 'Megaminx']
CONFIGS = [
    ('escritorio-claro', dict(viewport={'width': 1280, 'height': 900}, color_scheme='light')),
    ('movil-oscuro', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, color_scheme='dark')),
    ('escritorio-oscuro', dict(viewport={'width': 1280, 'height': 900}, color_scheme='dark')),
    ('movil-claro', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, color_scheme='light')),
]

async def texto(pg, sel):
    return (await pg.locator(sel).text_content()) or ''

async def velocidad(pg, boton, objetivo):
    for _ in range(4):
        if (await texto(pg, boton)).strip() == f'×{objetivo}':
            return
        await pg.click(boton)

async def esperar_texto(pg, sel, patron, ms):
    await pg.wait_for_function(f"(document.querySelector({json.dumps(sel)}).textContent || '').includes({json.dumps(patron)})", timeout=ms)

async def probar(pg, cfg, nombre, capturas, res):
    fila = {'config': cfg, 'puzzle': nombre}
    await pg.locator('#selector .chip', has_text=nombre).first.click()
    await pg.wait_for_function("!document.getElementById('nuevo').disabled", timeout=60000)
    await pg.wait_for_timeout(300)
    assert await pg.locator('#vista3d-scramble canvas').is_visible(), 'la vista previa no está en 3D'
    # scramble animado en la vista previa
    await velocidad(pg, '#s-velocidad', 8)
    await pg.click('#s-inicio')
    await pg.evaluate("cuboSolver.vista3D('previa').reiniciarEstadisticas()")
    t0 = time.time()
    await pg.click('#s-play')
    await pg.wait_for_timeout(250)
    if capturas:
        await pg.locator('#vista3d-scramble').screenshot(path=f'{OUT}/{cfg}-{nombre}-scramble.png')
    await esperar_texto(pg, '#paso-scramble', 'Scramble aplicado', 120000)
    fila['scramble_s'] = round(time.time() - t0, 1)
    fila['fps_scramble'] = await pg.evaluate("cuboSolver.vista3D('previa').estadisticas()")
    # cargar, resolver y reproducir en 3D
    await pg.click('#cargar')
    await pg.click('#resolver')
    await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('.mensaje.error')", timeout=120000)
    assert not await pg.locator('.mensaje.error').count(), await texto(pg, '#mensajes')
    assert await pg.locator('#vista3d-editor canvas').is_visible(), 'la solución no se reproduce en 3D'
    n = await pg.locator('#movs li').count()
    fila['movs'] = n
    await velocidad(pg, '#r-velocidad', 8)
    await pg.evaluate("cuboSolver.vista3D('editor').reiniciarEstadisticas()")
    t0 = time.time()
    await pg.click('#r-play')
    await pg.wait_for_timeout(400)
    if capturas:
        await pg.locator('#vista3d-editor').screenshot(path=f'{OUT}/{cfg}-{nombre}-solucion.png')
    await esperar_texto(pg, '#paso', 'Resuelto', 300000)
    fila['solucion_s'] = round(time.time() - t0, 1)
    fila['fps_solucion'] = await pg.evaluate("cuboSolver.vista3D('editor').estadisticas()")
    # el modelo dice resuelto
    # paso atrás animado
    await velocidad(pg, '#r-velocidad', 1)
    await pg.click('#r-atras')
    await esperar_texto(pg, '#paso', f'Paso {n - 1}/{n}', 5000)
    await pg.click('#r-adelante')
    await esperar_texto(pg, '#paso', 'Resuelto', 5000)
    # resaltar una pieza (la que está en el centro de la vista) con transparencia
    await pg.evaluate("""() => { const v = cuboSolver.vista3D('editor'); const r = v.canvas.getBoundingClientRect();
        const k = v.pegatinaEn(r.left + r.width / 2, r.top + r.height / 2);
        const g = v.escena.geometria; v.resaltarPiezas(k >= 0 ? [g.pegatinas[k].pieza] : [], 'transparencia'); }""")
    await pg.wait_for_timeout(150)
    if capturas:
        await pg.locator('#vista3d-editor').screenshot(path=f'{OUT}/{cfg}-{nombre}-resaltado.png')
    await pg.evaluate("cuboSolver.vista3D('editor').resaltar(null)")
    # pintar tocando el modelo 3D (sin solución, en 3D)
    await pg.click('#resetear')
    if await pg.locator('#modo-editor button[data-modo="3d"]').get_attribute('aria-pressed') != 'true':
        await pg.click('#modo-editor button[data-modo="3d"]')
    await pg.locator('#paleta .color').nth(3).click()  # un color que no tenga la pegatina del centro de la vista
    antes = await pg.evaluate("JSON.stringify(cuboSolver.editor())")
    caja = await pg.locator('#vista3d-editor canvas').bounding_box()
    pos = {'x': caja['width'] / 2, 'y': caja['height'] / 2}
    if 'movil' in cfg:
        await pg.locator('#vista3d-editor canvas').tap(position=pos)
    else:
        await pg.locator('#vista3d-editor canvas').click(position=pos)
    await pg.wait_for_timeout(100)
    despues = await pg.evaluate("JSON.stringify(cuboSolver.editor())")
    fila['pintar3D'] = antes != despues
    await pg.click('#modo-editor button[data-modo="2d"]')
    await pg.click('#resetear')
    res.append(fila)
    print(json.dumps(fila), flush=True)

async def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    puzzles = args or TODOS
    configs = CONFIGS[:2] if '--rapido' in sys.argv else CONFIGS
    os.makedirs(OUT, exist_ok=True)
    res, errores = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'),
                                    args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for cfg, opts in configs:
            ctx = await b.new_context(**opts)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, c=cfg: errores.append(f'{c}: {e}'))
            pg.on('console', lambda m, c=cfg: errores.append(f'{c}: {m.text}') if m.type == 'error' else None)
            await pg.goto(URL)
            await pg.wait_for_timeout(1500)
            assert await pg.evaluate('cuboSolver.estado().webgl'), 'sin WebGL'
            for nombre in puzzles:
                await probar(pg, cfg, nombre, True, res)
            # sin scroll horizontal
            ancho = await pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            assert ancho <= 0, f'{cfg}: scroll horizontal de {ancho}px'
            await pg.screenshot(path=f'{OUT}/{cfg}-pagina.png', full_page=False)
            await ctx.close()
        await b.close()
    with open(os.path.join(OUT, 'resultados.json'), 'w') as f:
        json.dump({'filas': res, 'errores': errores}, f, indent=1, ensure_ascii=False)
    print('errores de consola:', errores)
    assert not errores
    assert all(r['pintar3D'] for r in res), 'pintar en 3D no cambió el estado en algún caso'

asyncio.run(main())
