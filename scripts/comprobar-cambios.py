# Comprobación en Chromium real del cambio de puzzle (opcional; Python + Playwright + Chrome).
#   python3 scripts/comprobar-cambios.py
# Escritorio y móvil: cambia de puzzle muchas veces seguidas (cada ~120 ms) y comprueba,
# justo después de cada clic y mientras llegan las respuestas, que el panel del scramble
# y el de resolver son del mismo puzzle y que la etiqueta del tipo de scramble es la suya.
# Mide cuánto tarda en verse el scramble (0 ms si estaba precargado) y guarda capturas
# en docs/capturas/cambios-*.jpg.
import asyncio, json, os, time
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Noche 11: la app abre en la portada; las herramientas están en #/wca (WCA Puzzles).
URL = 'file://' + os.path.join(RAIZ, 'dist/index.html') + '#/wca'
OUT = os.path.join(RAIZ, 'docs/capturas')
SECUENCIA = ['Pyraminx', '7x7', 'Skewb', 'Megaminx', 'Square-1', '3x3', '6x6', '2x2', '4x4', '5x5']
ESTADO = {'2x2', '3x3', 'Pyraminx', 'Skewb', 'Square-1'}
CONFIGS = [
    ('escritorio', dict(viewport={'width': 1280, 'height': 900}, color_scheme='light')),
    ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme='dark')),
]
COMPROBAR = """() => {
  const chip = document.querySelector('#selector .chip[aria-pressed="true"]').textContent;
  return { chip, scr: document.getElementById('panel-scramble').dataset.puzzle, res: document.getElementById('panel-resolver').dataset.puzzle,
    tipo: document.getElementById('tipo-scramble').textContent, generando: document.getElementById('scramble').classList.contains('generando') };
}"""
ID = {'2x2': '2x2', '3x3': '3x3', '4x4': '4x4', '5x5': '5x5', '6x6': '6x6', '7x7': '7x7', 'Pyraminx': 'pyraminx', 'Skewb': 'skewb', 'Square-1': 'square1', 'Megaminx': 'megaminx'}

def revisar(d, fallos, donde):
    esperado = ID[d['chip']]
    if d['scr'] != esperado or d['res'] != esperado:
        fallos.append(f"{donde}: chip {d['chip']}, scramble {d['scr']}, resolver {d['res']}")
    tipo_ok = d['tipo'] == 'estado aleatorio' if d['chip'] in ESTADO else d['tipo'].startswith('movimientos aleatorios')
    if not tipo_ok:
        fallos.append(f"{donde}: etiqueta '{d['tipo']}' en {d['chip']}")

async def main():
    os.makedirs(OUT, exist_ok=True)
    resumen, errores = {}, []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'),
                                    args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for cfg, opts in CONFIGS:
            ctx = await b.new_context(**opts)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, c=cfg: errores.append(f'{c}: {e}'))
            pg.on('console', lambda m, c=cfg: errores.append(f'{c}: {m.text}') if m.type == 'error' else None)
            await pg.goto(URL)
            await pg.wait_for_timeout(300)
            fallos, capturas, esperas = [], [], []
            for vuelta in range(3):
                for k, nombre in enumerate(SECUENCIA):
                    t0 = time.time()
                    await pg.locator('#selector .chip', has_text=nombre).first.click()
                    d = await pg.evaluate(COMPROBAR)
                    revisar(d, fallos, f'vuelta {vuelta + 1}, tras pulsar {nombre}')
                    if vuelta == 0 and k < 4:
                        f = f'/tmp/cambio-{cfg}-{k}.png'
                        await pg.screenshot(path=f)
                        capturas.append((f, nombre, d['generando']))
                    # unas cuantas comprobaciones más mientras llegan respuestas
                    for _ in range(3):
                        await pg.wait_for_timeout(35)
                        revisar(await pg.evaluate(COMPROBAR), fallos, f'vuelta {vuelta + 1}, {nombre} (+ms)')
                    if vuelta == 2:
                        # última vuelta: ¿estaba el scramble al momento (precargado)? y cuánto tardó si no
                        if d['generando']:
                            await pg.wait_for_function("!document.getElementById('scramble').classList.contains('generando')", timeout=60000)
                            esperas.append((nombre, 'generando', round((time.time() - t0) * 1000)))
                        else:
                            esperas.append((nombre, 'al momento'))
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=f'/tmp/cambio-{cfg}-final.png')
            capturas.append((f'/tmp/cambio-{cfg}-final.png', 'final', False))
            resumen[cfg] = {'fallos': fallos[:10], 'n_fallos': len(fallos), 'vuelta3_scramble_al_pulsar': esperas}
            print(cfg, json.dumps(resumen[cfg], ensure_ascii=False), flush=True)
            # hoja de capturas
            from PIL import Image, ImageDraw
            ims = [Image.open(f).convert('RGB') for f, _, _ in capturas]
            h = 900 if cfg == 'escritorio' else 1100
            ims = [i.resize((int(i.width * h / i.height), h)) for i in ims]
            W = sum(i.width for i in ims) + 10 * len(ims)
            hoja = Image.new('RGB', (W, h + 40), 'white')
            dr = ImageDraw.Draw(hoja)
            x = 0
            for (f, nombre, gen), im in zip(capturas, ims):
                hoja.paste(im, (x, 40))
                dr.text((x + 6, 10), f"{'justo tras pulsar ' + nombre if nombre != 'final' else 'al final'}{' (generando)' if gen else ''}", fill='black')
                x += im.width + 10
            hoja = hoja.resize((W // 2, (h + 40) // 2))
            hoja.save(f'{OUT}/cambios-{cfg}.jpg', quality=80)
            await ctx.close()
        await b.close()
    with open(os.path.join(OUT, 'cambios.json'), 'w') as f:
        json.dump({'resumen': resumen, 'errores': errores}, f, indent=1, ensure_ascii=False)
    print('errores de consola:', errores)
    assert not errores
    assert all(r['n_fallos'] == 0 for r in resumen.values())

asyncio.run(main())
