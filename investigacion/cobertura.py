# Cuánto del JavaScript se ejecuta de verdad en la portada (cobertura de V8 por funciones, Chromium real).
#   node investigacion/prototipos.mjs && python investigacion/cobertura.py [variante ...]
# Mide, en la página (no en los Workers), los bytes de las funciones que han llegado a ejecutarse hasta que la
# portada queda quieta, y lo mismo tras abrir el 3x3 (#/wca/3x3). Es la cota de lo que un build por trozos
# tendría que descargar para la portada (lo demás se podría cargar al entrar en una sección).
import asyncio, json, os, subprocess, sys
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('CHROME') or next((c for c in [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'] if os.path.exists(c)), None)
LISTO = "() => window.cuboSolver && document.getElementById('scramble').textContent.length > 0 && !document.getElementById('scramble').classList.contains('generando') && !document.getElementById('cargar').disabled"


def usados(fuente_len, funciones):
    marca = bytearray(fuente_len)
    rangos = [r for f in funciones for r in f['ranges']]
    rangos.sort(key=lambda r: (r['startOffset'], -r['endOffset']))  # exteriores primero
    for r in rangos:
        v = 1 if r['count'] > 0 else 0
        marca[r['startOffset']:r['endOffset']] = bytes([v]) * (r['endOffset'] - r['startOffset'])
    return sum(marca)


async def medir_una(b, url, hash_):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = await ctx.new_page()
    cdp = await ctx.new_cdp_session(pg)
    await cdp.send('Profiler.enable'); await cdp.send('Debugger.enable')
    fuentes = {}
    cdp.on('Debugger.scriptParsed', lambda e: fuentes.__setitem__(e['scriptId'], e))
    await cdp.send('Profiler.startPreciseCoverage', {'callCount': False, 'detailed': False})
    await pg.goto(url + hash_)
    if hash_ == '#/':
        await pg.wait_for_selector('a.tarjeta-seccion'); await pg.wait_for_timeout(1500)
    else:
        await pg.wait_for_function(LISTO, timeout=120000); await pg.wait_for_timeout(1000)
    cov = (await cdp.send('Profiler.takePreciseCoverage'))['result']
    # el script de la app: el más largo de la página
    s = max((c for c in cov if c['scriptId'] in fuentes), key=lambda c: fuentes[c['scriptId']].get('length', 0))
    src = (await cdp.send('Debugger.getScriptSource', {'scriptId': s['scriptId']}))['scriptSource']
    u = usados(len(src), s['functions'])
    await ctx.close()
    return {'script_kb': round(len(src) / 1024, 1), 'ejecutado_kb': round(u / 1024, 1), 'pct': round(100 * u / len(src), 1)}


async def medir(b, url):
    return {'portada': await medir_una(b, url, '#/'), '3x3': await medir_una(b, url, '#/wca/3x3')}


async def main():
    variantes = sys.argv[1:] or ['base', 'abc']
    srv = subprocess.Popen(['node', os.path.join(RAIZ, 'investigacion/servidor.mjs'), os.path.join(RAIZ, 'investigacion/dist'), '8768'], stdout=subprocess.PIPE)
    srv.stdout.readline()
    salida = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            for v in variantes:
                salida[v] = await medir(b, f'http://127.0.0.1:8768/{v}/index.html')
                print(v, json.dumps(salida[v]), flush=True)
            await b.close()
    finally:
        srv.terminate()
    with open(os.path.join(RAIZ, 'investigacion/resultados/cobertura.json'), 'w', encoding='utf-8') as f: json.dump(salida, f, indent=1)

asyncio.run(main())
