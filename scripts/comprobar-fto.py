# Comprobación del FTO en Chromium real (noche 12; necesita Python + Playwright y Chrome).
#   npm run build && python3 scripts/comprobar-fto.py
# 1) Tiempos en el navegador: tablas del solver, un scramble y una solución, en escritorio y con
#    la CPU a ×4 (como un móvil), importando los módulos de src/ desde un servidor local.
# 2) Recorrido en dist/index.html, escritorio y móvil (390 px), oscuro y claro: portada → WCA
#    Puzzles → FTO → scramble (vista previa animada) → cargar → resolver → solución en 3D hasta el
#    final (×8) → pintar tocando el modelo 3D. Sin errores de consola ni scroll horizontal.
#    Capturas en docs/capturas/fto-*.jpg y resultados en docs/capturas/fto-resultados.json.
import asyncio, functools, http.server, json, os, threading, time
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(RAIZ, 'dist/index.html') + '#/'
OUT = os.path.join(RAIZ, 'docs/capturas')
MOVIL = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
ESCRITORIO = dict(viewport={'width': 1280, 'height': 900})
CONFIGS = [('escritorio', 'oscuro', ESCRITORIO), ('escritorio', 'claro', ESCRITORIO), ('movil', 'oscuro', MOVIL), ('movil', 'claro', MOVIL)]

class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def servidor():
    h = functools.partial(Silencioso, directory=RAIZ)
    s = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s

async def tiempos(b, puerto, cpu):
    ctx = await b.new_context()
    pg = await ctx.new_page()
    cdp = await ctx.new_cdp_session(pg)
    if cpu > 1: await cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
    await pg.goto(f'http://127.0.0.1:{puerto}/README.md')
    r = await pg.evaluate("""async () => {
        const p = (await import('/src/puzzles/fto.js')).default;
        const { rngConSemilla } = await import('/src/core/rng.js');
        let t = performance.now(); p.inicializar(); const tablas = performance.now() - t;
        const rng = rngConSemilla(7), scr = [], sol = [], lon = [];
        for (let i = 0; i < 5; i++) {
          t = performance.now(); const s = p.generarScramble(rng); scr.push(performance.now() - t);
          const e = p.aplicarSecuencia(p.estadoResuelto(), s);
          t = performance.now(); const x = p.resolver(e); sol.push(performance.now() - t); lon.push(x.movimientos.length);
        }
        const m = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
        return { tablas_ms: Math.round(tablas), scramble_ms_medio: m(scr), solucion_ms_medio: m(sol), longitud_media: lon.reduce((a, b) => a + b, 0) / lon.length };
    }""")
    await ctx.close()
    return r

async def recorrido(b, disp, tema, opts, errores):
    fila = {'config': f'{disp}-{tema}'}
    ctx = await b.new_context(**opts)
    await ctx.add_init_script(f"try {{ localStorage.setItem('cubo-solver:tema', '{tema}') }} catch (e) {{}}")
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errores.append(f"{fila['config']}: {e}"))
    pg.on('console', lambda m: errores.append(f"{fila['config']}: {m.text}") if m.type == 'error' else None)
    await pg.goto(URL)
    fila['tema'] = await pg.evaluate('document.documentElement.dataset.theme')
    assert fila['tema'] == ('light' if tema == 'claro' else 'dark'), fila['tema']
    # portada: la tarjeta de WCA Puzzles ya no anuncia «FTO pronto»
    tarjeta = pg.locator('a.tarjeta-seccion[href="#/wca"]')
    texto = await tarjeta.text_content()
    assert 'pronto' not in texto and 'FTO' in texto, texto
    if disp == 'escritorio': await pg.screenshot(path=f'{OUT}/fto-{disp}-{tema}-portada.jpg', quality=82)
    await tarjeta.click()
    await pg.wait_for_selector('#selector .chip')
    chip = pg.locator('#selector .chip', has_text='FTO')
    assert await chip.count() == 1 and 'pronto' not in (await chip.text_content())
    await chip.click()
    await pg.wait_for_function("location.hash === '#/wca/fto'")
    t0 = time.time()
    await pg.wait_for_function("!document.getElementById('cargar').disabled", timeout=120000)
    fila['primer_scramble_s'] = round(time.time() - t0, 1)
    fila['scramble'] = (await pg.locator('#scramble').text_content()).strip()
    assert await pg.locator('#vista3d-scramble canvas').is_visible(), 'la vista previa no está en 3D'
    await pg.click('#s-inicio')
    await pg.click('#s-play')
    await pg.wait_for_timeout(600)
    await pg.locator('#panel-scramble').screenshot(path=f'{OUT}/fto-{disp}-{tema}-scramble.jpg', quality=82)
    # cargar y resolver
    await pg.click('#cargar')
    t0 = time.time()
    await pg.click('#resolver')
    await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('.mensaje.error')", timeout=120000)
    fila['resolver_s'] = round(time.time() - t0, 1)
    assert not await pg.locator('.mensaje.error').count(), await pg.locator('#mensajes').text_content()
    fila['movs'] = await pg.locator('#movs li').count()
    fila['fases'] = await pg.evaluate("[...document.querySelectorAll('#fases *')].map(x => x.textContent).filter(Boolean).slice(0, 3)")
    assert await pg.locator('#vista3d-editor canvas').is_visible(), 'la solución no se reproduce en 3D'
    for _ in range(4):
        if (await pg.locator('#r-velocidad').text_content()).strip() == '×8': break
        await pg.click('#r-velocidad')
    await pg.click('#r-play')
    await pg.wait_for_timeout(500)
    await pg.locator('#panel-resolver').screenshot(path=f'{OUT}/fto-{disp}-{tema}-solucion.jpg', quality=82)
    await pg.wait_for_function("(document.getElementById('paso').textContent || '').includes('Resuelto')", timeout=300000)
    fila['resuelto'] = await pg.evaluate('cuboSolver.resuelto()')
    assert fila['resuelto']
    # pintar tocando el modelo 3D
    await pg.click('#resetear')
    if await pg.locator('#modo-editor button[data-modo="3d"]').get_attribute('aria-pressed') != 'true':
        await pg.click('#modo-editor button[data-modo="3d"]')
    await pg.locator('#paleta .color').nth(4).click()
    antes = await pg.evaluate('JSON.stringify(cuboSolver.editor())')
    caja = await pg.locator('#vista3d-editor canvas').bounding_box()
    pos = {'x': caja['width'] / 2, 'y': caja['height'] / 2}
    if disp == 'movil': await pg.locator('#vista3d-editor canvas').tap(position=pos)
    else: await pg.locator('#vista3d-editor canvas').click(position=pos)
    await pg.wait_for_timeout(150)
    fila['pintar3D'] = antes != await pg.evaluate('JSON.stringify(cuboSolver.editor())')
    assert fila['pintar3D'], 'pintar tocando el modelo 3D no cambió el estado'
    await pg.locator('#vista3d-editor').screenshot(path=f'{OUT}/fto-{disp}-{tema}-pintar.jpg', quality=82)
    fila['scroll_horizontal_px'] = await pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    assert fila['scroll_horizontal_px'] <= 0
    await ctx.close()
    return fila

async def main():
    os.makedirs(OUT, exist_ok=True)
    srv = servidor()
    puerto = srv.server_address[1]
    resultado = {'tiempos': {}, 'recorridos': [], 'errores': []}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'),
                                    args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for nombre, cpu in [('escritorio', 1), ('movil_cpu_x4', 4)]:
            resultado['tiempos'][nombre] = await tiempos(b, puerto, cpu)
            print(nombre, json.dumps(resultado['tiempos'][nombre]), flush=True)
        for disp, tema, opts in CONFIGS:
            fila = await recorrido(b, disp, tema, opts, resultado['errores'])
            resultado['recorridos'].append(fila)
            print(json.dumps(fila, ensure_ascii=False), flush=True)
        await b.close()
    srv.shutdown()
    with open(os.path.join(OUT, 'fto-resultados.json'), 'w') as f:
        json.dump(resultado, f, indent=1, ensure_ascii=False)
    print('errores de consola:', resultado['errores'])
    assert not resultado['errores']

asyncio.run(main())
