# Comprobación funcional de los prototipos en Chromium real (antes de medirlos).
#   node investigacion/prototipos.mjs && python investigacion/comprobar-prototipos.py [variante ...]
# Para cada variante: portada (qué puzzles se han construido: __construidos, solo en las perezosas), que los
# cálculos van en Workers (#modo-calculo), y en 3x3, Megaminx, Ghost Cube y 4x4 vendado: scramble → cargar →
# resolver → final → «Resuelto». Sin errores de consola.
import asyncio, json, os, subprocess, sys
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('CHROME') or next((c for c in [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'] if os.path.exists(c)), None)
LISTO = "() => window.cuboSolver && document.getElementById('scramble').textContent.length > 0 && !document.getElementById('scramble').classList.contains('generando') && !document.getElementById('cargar').disabled"
RUTAS = ['#/wca/3x3', '#/wca/megaminx', '#/shapemods/ghost', '#/bandaged?puzzle=4x4']


async def comprobar(b, base, variante, fallos):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 860})
    pg = await ctx.new_page()
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
    await pg.goto(base + '#/')
    await pg.wait_for_selector('a.tarjeta-seccion')
    await pg.wait_for_timeout(1500)
    portada = await pg.evaluate("() => ({ construidos: (globalThis.__construidos || null) && [...globalThis.__construidos], modo: (document.getElementById('modo-calculo') || {}).textContent })")
    res = {'portada': portada}
    for ruta in RUTAS:
        await pg.evaluate(f"location.hash = {json.dumps(ruta)}")
        await pg.wait_for_function(LISTO, timeout=180000)
        await pg.click('#nuevo'); await pg.wait_for_function(LISTO, timeout=180000)
        await pg.click('#cargar'); await pg.wait_for_timeout(200)
        await pg.click('#resolver')
        await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=180000)
        await pg.click('#r-fin')
        await pg.wait_for_function("/Resuelto/.test(document.getElementById('paso').textContent)", timeout=60000)
        ok = await pg.evaluate('window.cuboSolver.resuelto()')
        res[ruta] = {'resuelto': ok, 'movs': await pg.evaluate("document.querySelectorAll('#movs li').length")}
        if not ok: fallos.append(f'{variante} {ruta}: no queda resuelto')
    res['modo'] = await pg.evaluate("(document.getElementById('modo-calculo') || {}).textContent")
    res['construidosAlFinal'] = await pg.evaluate("(globalThis.__construidos || null) && [...globalThis.__construidos]")
    if errores: fallos.append(f'{variante}: errores {errores[:3]}')
    if 'Worker' not in (res['modo'] or '') and 'worker' not in (res['modo'] or ''): fallos.append(f'{variante}: sin Worker ({res["modo"]})')
    print(variante, json.dumps(res, ensure_ascii=False), flush=True)
    await ctx.close()


async def main():
    variantes = sys.argv[1:] or ['base', 'a', 'b', 'c', 'abc', 'd']
    srv = subprocess.Popen(['node', os.path.join(RAIZ, 'investigacion/servidor.mjs'), os.path.join(RAIZ, 'investigacion/dist'), '8766'], stdout=subprocess.PIPE)
    srv.stdout.readline()
    fallos = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            for v in variantes:
                try:
                    await comprobar(b, f'http://127.0.0.1:8766/{v}/index.html', v, fallos)
                except Exception as e:
                    fallos.append(f'{v}: excepción {e}')
            await b.close()
    finally:
        srv.terminate()
    print('fallos:', fallos or 'ninguno')
    sys.exit(1 if fallos else 0)

asyncio.run(main())
