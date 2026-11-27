# Primer uso de un puzzle (sesión «carga más rápida»): tiempo desde elegirlo hasta ver su scramble, en Chromium real.
#   npm run build && python scripts/medir-primer-uso.py --dir A --etiqueta antes --dir dist --etiqueta despues [--reps 5]
# Para cada versión (intercaladas) y CPU ×1 / ×4 (móvil 390 px, sin red simulada: es lo que pasa DESPUÉS de cargar):
# página nueva en la portada, se espera a que quede quieta y a que los Workers respondan, se elige el puzzle (cambiando
# la ruta, como al tocar su tarjeta o su chip) y se mide hasta que su scramble está a la vista (dibujado, con «Cargar»
# activo). Con el registro perezoso, ese tiempo incluye construir el puzzle (en la página y en el Worker); antes, se
# construían todos al cargar la página. Mediana de --reps.
import argparse, asyncio, json, os, statistics, subprocess, sys
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('CHROME') or next((c for c in [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'] if os.path.exists(c)), None)
PUZZLES = [('3x3', '#/wca/3x3'), ('7x7', '#/wca/7x7'), ('megaminx', '#/wca/megaminx'), ('4x4 vendado', '#/bandaged?puzzle=4x4')]
# El instante se toma dentro de la página: al cambiar la ruta y cuando el scramble está a la vista (setInterval de 10 ms).
MEDIR = """(hash) => new Promise((ok) => {
  const t0 = performance.now();
  location.hash = hash;
  const i = setInterval(() => {
    const s = document.getElementById('scramble'), c = document.getElementById('cargar');
    if (location.hash.startsWith(hash.split('?')[0]) && s && s.textContent.length > 0 && !s.classList.contains('generando')
        && document.querySelector('#vista-scramble svg, #vista-scramble canvas') && c && !c.disabled) {
      clearInterval(i); ok(performance.now() - t0);
    }
  }, 10);
})"""


async def una(b, base, hash_, cpu):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    await ctx.add_init_script("try { localStorage.setItem('cubo-solver:modo3d', JSON.stringify({ previa: '3d', edicion: '3d', solucion: '3d' })); } catch (e) {}")
    pg = await ctx.new_page()
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    cdp = await ctx.new_cdp_session(pg)
    await pg.goto(base + '#/')
    await pg.wait_for_selector('a.tarjeta-seccion')
    await pg.wait_for_function("/Web Worker|hilo principal/.test((document.getElementById('modo-calculo') || {}).textContent || '')")
    await pg.wait_for_timeout(1500)  # que acabe el arranque (Workers incluidos)
    await cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
    ms = await pg.evaluate(MEDIR, hash_)
    await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    await ctx.close()
    if errores: raise RuntimeError(f'{hash_}: {errores[:2]}')
    return ms


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', action='append'); ap.add_argument('--etiqueta', action='append')
    ap.add_argument('--reps', type=int, default=5); ap.add_argument('--salida'); ap.add_argument('--puerto', type=int, default=8791)
    a = ap.parse_args()
    dirs = a.dir or ['dist']
    etiquetas = a.etiqueta or [os.path.basename(os.path.normpath(d)) for d in dirs]
    srvs, bases = [], []
    for k, d in enumerate(dirs):
        s = subprocess.Popen(['node', os.path.join(RAIZ, 'scripts/servidor-pages.mjs'), os.path.join(RAIZ, d), str(a.puerto + k)], stdout=subprocess.PIPE)
        s.stdout.readline(); srvs.append(s); bases.append(f'http://127.0.0.1:{a.puerto + k}/')
    res = {e: {} for e in etiquetas}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            for cpu in (1, 4):
                for nombre, hash_ in PUZZLES:
                    vals = {e: [] for e in etiquetas}
                    for _ in range(a.reps):
                        for e, base in zip(etiquetas, bases): vals[e].append(round(await una(b, base, hash_, cpu)))
                    for e in etiquetas:
                        res[e][f'{nombre} x{cpu}'] = {'mediana': round(statistics.median(vals[e])), 'todas': vals[e]}
                    print(f'{nombre} ×{cpu}: ' + ' · '.join(f'{e} {round(statistics.median(vals[e]))} ms' for e in etiquetas), flush=True)
            await b.close()
    finally:
        for s in srvs: s.terminate()
    if a.salida:
        with open(a.salida, 'w', encoding='utf-8') as f: json.dump(res, f, ensure_ascii=False, indent=1)

asyncio.run(main())
