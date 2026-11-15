# Comprobación en Chromium real del primer "Resolver" tras cargar la página (corrección de la noche 9).
#   npm run build && python3 scripts/comprobar-primer-resolver.py
# Cada caso abre la página en un contexto nuevo (caché vacía, caché de red desactivada) y pulsa
# "Resolver" UNA vez en cuanto el botón está activo (en el 3x3 resuelto y con un scramble cargado;
# en el 5x5, con sus tablas de varios segundos). Comprueba que se ve "Generando tablas… X s" (si
# las tablas no están) y que la respuesta llega sin otro clic. Escritorio y móvil (CPU ×4).
import asyncio, json, os, time
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(RAIZ, 'dist/index.html')
CONFIGS = [
    ('escritorio', dict(viewport={'width': 1280, 'height': 900}), 1),
    ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True), 4),
]
MSG = """() => [...document.querySelectorAll('#mensajes .mensaje')].map(d => d.textContent).join(' | ')"""

async def caso(b, cfg, opts, cpu, puzzle, cargar):
    ctx = await b.new_context(**opts)
    pg = await ctx.new_page()
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
    cdp = await ctx.new_cdp_session(pg)
    await cdp.send('Network.setCacheDisabled', {'cacheDisabled': True})
    if cpu > 1: await cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
    t0 = time.time()
    await pg.goto(URL, wait_until='commit')
    if puzzle != '3x3':
        await pg.wait_for_selector('#selector .chip')
        await pg.locator('#selector .chip', has_text=puzzle).first.click()
    if cargar:
        await pg.wait_for_function("!document.getElementById('cargar').disabled", timeout=60000)
        await pg.click('#cargar')
    await pg.wait_for_function("!document.getElementById('resolver').disabled", timeout=60000)
    t_clic = time.time() - t0
    await pg.click('#resolver')  # un solo clic
    vistos = []
    generando = False
    for _ in range(1200):
        m = await pg.evaluate(MSG)
        if m and (not vistos or vistos[-1] != m): vistos.append(m)
        if 'Generando tablas' in m: generando = True
        listo = await pg.evaluate("!document.getElementById('solucion').hidden || /ya está resuelto/.test(document.getElementById('mensajes').textContent)")
        if listo: break
        await asyncio.sleep(0.05)
    t_fin = time.time() - t0
    res = {'clic_a_los_s': round(t_clic, 2), 'respuesta_a_los_s': round(t_fin, 2), 'vio_generando': generando,
           'resuelto': listo, 'mensajes': vistos[:3] + (vistos[-1:] if len(vistos) > 3 else []), 'errores': errores}
    await ctx.close()
    return res

async def main():
    resumen = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'),
                                    args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for cfg, opts, cpu in CONFIGS:
            for puzzle, cargar in [('3x3', False), ('3x3', True), ('5x5', True)]:
                clave = f"{cfg}/{puzzle}/{'scramble' if cargar else 'resuelto'}"
                resumen[clave] = await caso(b, cfg, opts, cpu, puzzle, cargar)
                print(clave, json.dumps(resumen[clave], ensure_ascii=False))
        await b.close()
    with open(os.path.join(RAIZ, 'docs/capturas/primer-resolver.json'), 'w') as f:
        json.dump(resumen, f, ensure_ascii=False, indent=2)
    malos = [k for k, v in resumen.items() if not v['resuelto'] or v['errores']]
    print('FALLOS:', malos if malos else 'ninguno')

asyncio.run(main())
