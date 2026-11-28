# Fuentes incrustadas: qué pesos y caracteres se usan de verdad, y que al recortarlas no cambia ningún texto
# (sesión «carga más rápida»; Python + Playwright + Chrome + Pillow).
#   python scripts/comprobar-fuentes.py inventario [dist]            pesos y caracteres usados por familia
#   python scripts/comprobar-fuentes.py comparar ANTES DESPUES        capturas de las mismas pantallas en las dos
#                                                                     versiones y diferencia píxel a píxel
# Pantallas (escritorio 1280 y móvil 390, oscuro y claro, en 2D): portada; cada puzzle de WCA, Cuboids y Shape Mods;
# Bandaged 3x3/4x4/5x5; una solución con su reproductor; el modo aprender (3x3 CFOP y principiantes, 2x2 Ortega,
# 4x4, Pyraminx, Skewb, Square-1) con su explicación; «Colocar piezas». Para que dos versiones den la misma
# pantalla: sin Worker y con el azar de la página fijado (mismos scrambles), y se tapan los textos con tiempos.
import asyncio, json, os, subprocess, sys
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('CHROME') or next((c for c in [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'] if os.path.exists(c)), None)
LISTO = "() => window.cuboSolver && document.getElementById('scramble').textContent.length > 0 && !document.getElementById('scramble').classList.contains('generando') && !document.getElementById('cargar').disabled"
WCA = ['2x2', '3x3', '4x4', '5x5', '6x6', '7x7', 'pyraminx', 'skewb', 'square1', 'megaminx', 'fto']
RUTAS = (['#/'] + [f'#/wca/{p}' for p in WCA] + ['#/cuboids/3x3x1', '#/cuboids/3x3x2', '#/cuboids/2x2x3', '#/shapemods/mirror', '#/shapemods/ghost']
         + ['#/bandaged', '#/bandaged?puzzle=4x4', '#/bandaged?puzzle=5x5'])
APRENDER = [('3x3', 'cfop'), ('3x3', 'principiantes'), ('2x2', 'ortega'), ('4x4', 'cfop'), ('pyraminx', 'principiantes'), ('skewb', 'principiantes'), ('square1', 'principiantes')]
TAPAR = ['#aviso-tablas', '#modo-calculo', '#mensajes', '#t-sol', '.tiempo', '#info-sol', '#sol-resumen']  # textos con tiempos medidos
# azar fijo en la página (sin Worker, los scrambles salen de aquí) y modo 2D
INICIO = """(() => {
  let s = 20261127 >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0); };
  try { Object.defineProperty(window, 'crypto', { configurable: true, value: { getRandomValues: (b) => { for (let i = 0; i < b.length; i++) b[i] = rnd() % 2 ** (8 * b.BYTES_PER_ELEMENT); return b; } } }); } catch (e) {}
  try { window.Worker = undefined; } catch (e) {}
  try { localStorage.setItem('cubo-solver:modo3d', JSON.stringify({ previa: '2d', edicion: '2d', solucion: '2d' })); localStorage.setItem('cubo-solver:tema', '%TEMA%'); } catch (e) {}
})();"""
INVENTARIO = """() => {
  const res = {};
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.replace(/\\s+/g, '');
    const el = n.parentElement;
    if (!t || !el || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const k = `${fam}|${cs.fontWeight}|${cs.fontStyle}`;
    res[k] = (res[k] || '') + t;
  }
  for (const k in res) res[k] = [...new Set(res[k])].sort().join('');
  return res;
}"""


async def pantallas(pg, accion):
    """Recorre las pantallas y llama a accion(nombre) en cada una."""
    await pg.wait_for_selector('a.tarjeta-seccion')
    await accion('portada')
    for r in RUTAS[1:]:
        await pg.evaluate(f"location.hash = {json.dumps(r)}")
        await pg.wait_for_function(LISTO, timeout=180000)
        await pg.wait_for_timeout(200)
        await accion(r)
    # una solución con el reproductor, y «Colocar piezas»
    await pg.evaluate("location.hash = '#/wca/3x3'"); await pg.wait_for_function(LISTO, timeout=180000)
    await pg.click('#cargar'); await pg.click('#resolver')
    await pg.wait_for_function("!document.getElementById('solucion').hidden", timeout=180000)
    await pg.click('#r-adelante'); await pg.wait_for_timeout(300)
    await accion('solucion-3x3')
    await pg.click('#colocar-piezas'); await pg.wait_for_selector('#colocar'); await pg.wait_for_timeout(300)
    await accion('colocar-3x3')
    await pg.click('#colocar-cancelar'); await pg.wait_for_function("!document.getElementById('colocar')")
    for pid, metodo in APRENDER:
        await pg.evaluate(f"location.hash = '#/wca/{pid}'"); await pg.wait_for_function(LISTO, timeout=180000)
        await pg.select_option('#sel-metodo', metodo)
        await pg.click('#cargar'); await pg.click('#resolver')
        await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=300000)
        await pg.click('#r-adelante'); await pg.wait_for_timeout(300)
        await accion(f'aprender-{pid}-{metodo}')
        await pg.select_option('#sel-metodo', '')


async def contexto(b, dispositivo, tema):
    opts = dict(viewport={'width': 1280, 'height': 860}) if dispositivo == 'escritorio' else dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx = await b.new_context(**opts)
    await ctx.add_init_script(INICIO.replace('%TEMA%', 'claro' if tema == 'light' else 'oscuro'))
    return ctx


def servir(d, puerto):
    s = subprocess.Popen(['node', os.path.join(RAIZ, 'scripts/servidor-pages.mjs'), os.path.join(RAIZ, d), str(puerto), 'nada'], stdout=subprocess.PIPE)
    assert b'sirviendo' in s.stdout.readline(), f'no arranca el servidor en {puerto} (¿puerto ocupado?)'
    return s


async def inventario(d):
    srv = servir(d, 8801)
    total = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME)
            for dispositivo in ('escritorio', 'movil'):
                ctx = await contexto(b, dispositivo, 'dark')
                pg = await ctx.new_page()
                await pg.goto('http://127.0.0.1:8801/#/')
                async def acc(nombre):
                    for k, v in (await pg.evaluate(INVENTARIO)).items(): total[k] = ''.join(sorted(set(total.get(k, '') + v)))
                await pantallas(pg, acc)
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    for k in sorted(total): print(f'{k}: {len(total[k])} caracteres: {total[k]}')
    return total


async def comparar(antes, despues):
    from PIL import Image, ImageChops
    out = os.path.join(RAIZ, 'docs/capturas/fuentes')
    os.makedirs(out, exist_ok=True)
    srvs = [servir(antes, 8801), servir(despues, 8802)]
    difs = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME)
            for dispositivo in ('escritorio', 'movil'):
                for tema in ('dark', 'light'):
                    capturas = {}
                    for k, puerto in (('antes', 8801), ('despues', 8802)):
                        ctx = await contexto(b, dispositivo, tema)
                        pg = await ctx.new_page()
                        await pg.goto(f'http://127.0.0.1:{puerto}/#/')
                        await pg.evaluate('document.fonts.ready')
                        async def acc(nombre, k=k, pg=pg):
                            nom = f'{dispositivo}-{tema}-{nombre}'.replace('#/', '').replace('/', '_').replace('?', '_').replace('=', '-')
                            f = os.path.join(out, f'{nom}-{k}.png')
                            await pg.evaluate('document.fonts.ready')
                            await pg.screenshot(path=f, full_page=True, mask=[pg.locator(s) for s in TAPAR], animations='disabled')
                            capturas.setdefault(nom, {})[k] = f
                        await pantallas(pg, acc)
                        await ctx.close()
                    for nom, fs in capturas.items():
                        a, d = Image.open(fs['antes']).convert('RGB'), Image.open(fs['despues']).convert('RGB')
                        if a.size != d.size:
                            difs.append((nom, 'tamaño distinto', a.size, d.size)); continue
                        bbox = ImageChops.difference(a, d).getbbox()
                        n = 0 if not bbox else sum(1 for px in ImageChops.difference(a, d).crop(bbox).getdata() if max(px) > 0)
                        print(f'{nom}: {"idénticas" if not n else f"{n} píxeles distintos en {bbox}"}', flush=True)
                        if n: difs.append((nom, n, bbox))
            await b.close()
    finally:
        for s in srvs: s.terminate()
    print('pantallas con diferencias:', difs or 'ninguna')
    return difs


if __name__ == '__main__':
    modo = sys.argv[1] if len(sys.argv) > 1 else 'inventario'
    if modo == 'inventario': asyncio.run(inventario(sys.argv[2] if len(sys.argv) > 2 else 'dist'))
    else: sys.exit(1 if asyncio.run(comparar(sys.argv[2], sys.argv[3])) else 0)
