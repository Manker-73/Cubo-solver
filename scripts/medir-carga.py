# Medición repetible de la carga de la app en Chromium real (Python + Playwright + Chrome).
#   npm run build && python scripts/medir-carga.py [--dir dist] [--reps 5] [--etiqueta base] [--salida f.json]
#                                                       [--comp gzip|brotli|nada] [--traza] [--solo fast3g-x4]
# Sirve el directorio con scripts/servidor-pages.mjs (gzip nivel 6, max-age=600 y ETag, como GitHub Pages) y, para cada
# condición (red Fast 3G / Slow 3G de DevTools × CPU ×1 / ×4), repite N veces con un contexto nuevo (caché vacía):
#   1. portada fría (#/), 2. portada con caché (otra pestaña del mismo contexto), 3. 3x3 en frío (#/wca/3x3).
# Métricas (ms desde el inicio de la navegación, medidas dentro de la página):
#   fcp      primer pintado con contenido (Paint Timing);
#   portada  las tarjetas de la portada están en el DOM y el hilo principal ha quedado libre (un setInterval de 20 ms
#            las ve: si hay una tarea larga, no corre hasta que acaba) — «se ve la portada»;
#   usable   fin de la última tarea larga (> 50 ms, Long Tasks API) antes de 1 s sin tareas largas a partir de
#            `portada` (TTI simplificado) — «se puede usar»;
#   listo3x3 (solo en #/wca/3x3) scramble generado y «Cargar» activo (incluye las tablas de Kociemba en el Worker);
#   kb       bytes transferidos (Resource Timing: transferSize de la página y de sus recursos).
# Con --traza, además, --reps-traza (5) cargas frías (mediana) sin red simulada con CPU ×1 y ×4 y la traza de Chromium: tiempo de parseo,
# compilación y ejecución del JavaScript en el hilo principal y en los Workers.
# Resultado: medianas por condición (y todas las repeticiones en --salida).
import argparse, asyncio, json, os, statistics, subprocess, sys, time
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('CHROME') or next((c for c in [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'] if os.path.exists(c)), None)
# Perfiles de red de DevTools (front_end/core/sdk/NetworkManager.ts)
REDES = {
    'fast3g': dict(latency=562.5, downloadThroughput=1.6 * 1000 * 1000 / 8 * 0.9, uploadThroughput=750 * 1000 / 8 * 0.9),
    'slow3g': dict(latency=2000, downloadThroughput=500 * 1000 / 8 * 0.8, uploadThroughput=500 * 1000 / 8 * 0.8),
}
CONDICIONES = [(r, c) for r in ('fast3g', 'slow3g') for c in (1, 4)]

SONDA = """(() => {
  const m = window.__m = { lt: [] };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) m.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  const t = setInterval(() => {
    if (!m.portada && document.querySelector('a.tarjeta-seccion')) m.portada = performance.now();
    const s = document.getElementById('scramble'), c = document.getElementById('cargar');
    if (!m.listo && window.cuboSolver && s && s.textContent.length > 0 && !s.classList.contains('generando') && c && !c.disabled
        && document.getElementById('panel-resolver') && !document.getElementById('panel-resolver').hidden) m.listo = performance.now();
    if (m.portada && (m.listo || !location.hash.startsWith('#/wca'))) {
      const ult = m.lt.length ? m.lt[m.lt.length - 1] : null;
      const fin = ult ? ult[0] + ult[1] : 0;
      if (performance.now() - Math.max(fin, m.listo || m.portada) > 1200) { m.fin = true; clearInterval(t); }
    }
  }, 20);
  try { localStorage.setItem('cubo-solver:modo3d', JSON.stringify({ previa: '3d', edicion: '3d', solucion: '3d' })); } catch (e) {}
})();"""

RECOGER = """() => {
  const m = window.__m, nav = performance.getEntriesByType('navigation')[0];
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  const rec = performance.getEntriesByType('resource');
  return { portada: m.portada, listo: m.listo || null, lt: m.lt, fcp: fcp ? fcp.startTime : null,
    transfer: (nav ? nav.transferSize : 0) + rec.reduce((s, r) => s + (r.transferSize || 0), 0),
    decodificado: (nav ? nav.decodedBodySize : 0) + rec.reduce((s, r) => s + (r.decodedBodySize || 0), 0),
    recursos: rec.map((r) => [r.name.split('/').pop(), r.transferSize, Math.round(r.responseEnd)]),
    domContentLoaded: nav ? nav.domContentLoadedEventEnd : null, load: nav ? nav.loadEventEnd : null };
}"""


def usable(m):
    # TTI simplificado: desde `portada`, buscar la primera ventana de 1 s sin tareas largas
    t = m['portada']
    for ini, dur in sorted(m['lt']):
        if ini + dur <= t: continue
        if ini - t >= 1000: break
        t = max(t, ini + dur)
    return t


async def cargar(ctx, url, red, cpu, espera_listo):
    pg = await ctx.new_page()
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    cdp = await ctx.new_cdp_session(pg)
    await cdp.send('Network.enable')
    if red: await cdp.send('Network.emulateNetworkConditions', dict(offline=False, **REDES[red]))
    await cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
    await pg.goto(url, wait_until='commit', timeout=300000)
    await pg.wait_for_function('() => window.__m && window.__m.fin', timeout=300000, polling=200)
    m = await pg.evaluate(RECOGER)
    m['usable'] = usable(m)
    m['errores'] = errores
    if espera_listo and not m['listo']: m['errores'].append('3x3 sin listo')
    await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    await pg.close()
    return m


async def traza(b, base, cpu):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    await ctx.add_init_script(SONDA)
    pg = await ctx.new_page()
    cdp = await ctx.new_cdp_session(pg)
    await cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
    await b.start_tracing(page=pg, categories=['devtools.timeline', 'v8', 'v8.execute', 'disabled-by-default-v8.compile', 'blink', 'loading'])
    await pg.goto(base + '#/', wait_until='commit')
    await pg.wait_for_function('() => window.__m && window.__m.fin', timeout=300000, polling=200)
    datos = json.loads(await b.stop_tracing())
    await ctx.close()
    ev = datos['traceEvents'] if isinstance(datos, dict) else datos
    hilos = {(e['pid'], e['tid']): e['args']['name'] for e in ev if e.get('ph') == 'M' and e.get('name') == 'thread_name'}
    NOMBRES = {'EvaluateScript': 'evaluar (total)', 'v8.compile': 'compilar', 'v8.compileModule': 'compilar',
               'V8.CompileCode': 'compilar (perezoso)', 'v8.parseOnBackground': 'parsear en segundo plano',
               'ParseHTML': 'parsear HTML', 'v8.run': 'ejecutar', 'FunctionCall': 'llamadas', 'MajorGC': 'GC', 'MinorGC': 'GC',
               'V8.GC_SCAVENGER': 'GC', 'UpdateLayoutTree': 'estilos', 'Layout': 'maquetar', 'Paint': 'pintar'}
    # el renderer de la página: el que tiene EvaluateScript con más duración
    pids = {}
    for e in ev:
        if e.get('name') == 'EvaluateScript' and e.get('ph') == 'X': pids[e['pid']] = pids.get(e['pid'], 0) + e.get('dur', 0)
    pid = max(pids, key=pids.get) if pids else None
    res = {}
    for e in ev:
        if e.get('pid') != pid or e.get('ph') != 'X' or e.get('name') not in NOMBRES: continue
        hilo = hilos.get((e['pid'], e['tid']), '?')
        hilo = 'principal' if hilo == 'CrRendererMain' else ('worker' if 'Worker' in hilo else hilo)
        k = f"{hilo}: {NOMBRES[e['name']]}"
        res[k] = res.get(k, 0) + e.get('dur', 0) / 1000
    return {k: round(v, 1) for k, v in sorted(res.items())}


def mediana(xs):
    xs = [x for x in xs if x is not None]
    return round(statistics.median(xs)) if xs else None


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='dist'); ap.add_argument('--reps', type=int, default=5)
    ap.add_argument('--etiqueta', default='base'); ap.add_argument('--salida'); ap.add_argument('--comp', default='gzip')
    ap.add_argument('--puerto', default='8765'); ap.add_argument('--traza', action='store_true'); ap.add_argument('--solo')
    ap.add_argument('--pagina', default='index.html'); ap.add_argument('--reps-traza', type=int, default=5)
    a = ap.parse_args()
    srv = subprocess.Popen(['node', os.path.join(RAIZ, 'scripts/servidor-pages.mjs'), os.path.join(RAIZ, a.dir), a.puerto, a.comp], stdout=subprocess.PIPE)
    srv.stdout.readline()
    base = f'http://127.0.0.1:{a.puerto}/' + ('' if a.pagina == 'index.html' else a.pagina)
    todo = {'etiqueta': a.etiqueta, 'dir': a.dir, 'comp': a.comp, 'reps': a.reps, 'condiciones': {}}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            if a.traza:
                todo['traza'] = {}
                for c in (1, 4):
                    ts = [await traza(b, base, c) for _ in range(a.reps_traza)]
                    todo['traza'][f'cpu{c}'] = {k: round(statistics.median([t.get(k, 0) for t in ts]), 1) for k in sorted({k for t in ts for k in t})}
                print('traza', json.dumps(todo['traza'], ensure_ascii=False), flush=True)
            for red, cpu in CONDICIONES:
                clave = f'{red}-x{cpu}'
                if a.solo and a.solo != clave: continue
                reps = {'fria': [], 'cache': [], 'wca3x3': []}
                for i in range(a.reps):
                    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
                    await ctx.add_init_script(SONDA)
                    reps['fria'].append(await cargar(ctx, base + '#/', red, cpu, False))
                    reps['cache'].append(await cargar(ctx, base + '#/', red, cpu, False))
                    await ctx.close()
                    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
                    await ctx.add_init_script(SONDA)
                    reps['wca3x3'].append(await cargar(ctx, base + '#/wca/3x3', red, cpu, True))
                    await ctx.close()
                med = {}
                for k, rs in reps.items():
                    med[k] = {'fcp': mediana([r['fcp'] for r in rs]), 'portada': mediana([r['portada'] for r in rs]),
                              'usable': mediana([r['usable'] for r in rs]), 'kb': round(statistics.median([r['transfer'] for r in rs]) / 1024, 1)}
                    if k == 'wca3x3': med[k]['listo3x3'] = mediana([r['listo'] for r in rs])
                errs = sorted({e for rs in reps.values() for r in rs for e in r['errores']})
                todo['condiciones'][clave] = {'medianas': med, 'repeticiones': reps, 'errores': errs}
                print(clave, json.dumps(med), ('ERRORES ' + str(errs)) if errs else '', flush=True)
            await b.close()
    finally:
        srv.terminate()
    if a.salida:
        with open(a.salida, 'w', encoding='utf-8') as f: json.dump(todo, f, ensure_ascii=False, indent=1)

asyncio.run(main())
