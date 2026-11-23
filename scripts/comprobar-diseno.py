# Comprobación en Chromium real del rediseño (noche 11; opcional: Python + Playwright + Chrome).
#   npm run build && python3 scripts/comprobar-diseno.py
# Escritorio (1280 px) y móvil (390 px, táctil), en tema oscuro y claro, SIN RED (toda petición que no sea
# el propio fichero se bloquea y se cuenta):
#   - portada: tarjetas de las secciones (las bloqueadas no son enlaces ni se abren por URL), botón de tema;
#   - WCA Puzzles: 3x3 con scramble, cargar, resolver y la solución en 3D reproducida hasta el final;
#   - Bandaged Cubes: un ejemplo (1x2x2), scramble, resolver y reproducir;
#   - las tres fuentes incrustadas cargadas (document.fonts), sin peticiones de red;
#   - el tema se cambia con el botón y se conserva al recargar; oscuro por defecto aunque el sistema esté en claro;
#   - objetivos táctiles visibles ≥ 44 px, foco visible con el teclado, sin scroll horizontal ni errores en consola.
# Capturas en docs/capturas/diseno-*.jpg y resumen en docs/capturas/diseno.json.
import asyncio, json, os, sys
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'file://' + os.path.join(RAIZ, 'dist/index.html')
OUT = os.path.join(RAIZ, 'docs/capturas')
DISPOSITIVOS = [
    ('escritorio', dict(viewport={'width': 1280, 'height': 900})),
    ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)),
]

# Objetivos táctiles: botones, enlaces y radios visibles de la página (fuera del texto corrido).
PEQUENOS = """() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; };
  return [...document.querySelectorAll('button, a[href], select, input, [role=radio], summary')]
    .filter((e) => vis(e) && !e.closest('p') && !e.classList.contains('saltar'))
    .map((e) => { const r = e.getBoundingClientRect(); return { t: (e.id || e.className || e.tagName) + ' ' + (e.textContent || '').trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((x) => x.w < 44 || x.h < 44);
}"""
FUENTES = """async () => { await document.fonts.ready;
  const ok = (f) => document.fonts.check(f);
  return { inter: ok('400 16px "Inter"') && [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Inter' && f.status === 'loaded'),
           bricolage: [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Bricolage Grotesque' && f.status === 'loaded'),
           mono: [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'JetBrains Mono' && f.status === 'loaded'),
           h1: getComputedStyle(document.querySelector('h1:not([hidden])')).fontFamily };
}"""


async def esperar_scramble(pg):
    await pg.wait_for_function("() => { const s = document.getElementById('scramble'); return s.textContent.length > 0 && !s.classList.contains('generando') && !document.getElementById('nuevo').disabled; }", timeout=90000)


async def resolver_y_reproducir(pg, nombre, fallos):
    await pg.click('#cargar')
    await pg.click('#resolver')
    await pg.wait_for_function("() => !document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=90000)
    err = await pg.evaluate("() => { const e = document.querySelector('#mensajes .mensaje.error'); return e && e.textContent; }")
    if err:
        fallos.append(f'{nombre}: {err}')
        return
    for _ in range(3):
        await pg.click('#r-velocidad')
    await pg.click('#r-play')
    await pg.wait_for_function("() => /Resuelto/.test(document.getElementById('paso').textContent)", timeout=120000)
    if not await pg.evaluate('window.cuboSolver.resuelto()'):
        fallos.append(f'{nombre}: la reproducción no deja el puzzle resuelto')


async def main():
    resumen = {}
    fallos = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'),
                                    args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for disp, opts in DISPOSITIVOS:
            for tema in ('oscuro', 'claro'):
                clave = f'{disp}-{tema}'
                info = resumen[clave] = {'red': [], 'errores': [], 'pequenos': {}, 'scroll': {}}
                # el sistema en claro: la app debe abrir en oscuro igualmente (si no hay nada guardado)
                ctx = await b.new_context(color_scheme='light', **opts)
                await ctx.route('**/*', lambda r, i=info: (r.continue_() if r.request.url.startswith('file://') or r.request.url.startswith('data:') or r.request.url.startswith('blob:') else (i['red'].append(r.request.url), r.abort())))
                pg = await ctx.new_page()
                pg.on('pageerror', lambda e, i=info: i['errores'].append(str(e)))
                pg.on('console', lambda m, i=info: i['errores'].append(m.text) if m.type == 'error' else None)

                # ---------- Portada ----------
                await pg.goto(BASE)
                await pg.wait_for_selector('#secciones-disponibles a')
                t0 = await pg.evaluate("document.documentElement.dataset.theme")
                if t0 != 'dark':
                    fallos.append(f'{clave}: no abre en oscuro por defecto ({t0})')
                if tema == 'claro':
                    await pg.click('#tema')
                    await pg.reload()
                    await pg.wait_for_selector('#secciones-disponibles a')
                    if await pg.evaluate("document.documentElement.dataset.theme") != 'light':
                        fallos.append(f'{clave}: el tema claro no se conserva al recargar')
                info['fuentes'] = await pg.evaluate(FUENTES)
                if not (info['fuentes']['inter'] and info['fuentes']['bricolage'] and info['fuentes']['mono']):
                    fallos.append(f'{clave}: fuentes sin cargar {info["fuentes"]}')
                # bloqueadas: no son enlaces y no navegan
                n_bloq = await pg.evaluate("document.querySelectorAll('.tarjeta-bloqueada a, .tarjeta-bloqueada button').length")
                if n_bloq:
                    fallos.append(f'{clave}: hay enlaces en las secciones bloqueadas')
                await pg.locator('.tarjeta-bloqueada').first.click()
                await pg.wait_for_timeout(200)
                if await pg.evaluate("window.cuboSolver.estado().seccion") != 'portada':
                    fallos.append(f'{clave}: un clic en una sección bloqueada navega')
                await pg.goto(BASE + '#/cuboids')
                await pg.wait_for_timeout(300)
                if await pg.evaluate("location.hash") != '#/':
                    fallos.append(f'{clave}: #/cuboids no redirige a la portada')
                # foco visible con el teclado
                await pg.keyboard.press('Tab')
                await pg.keyboard.press('Tab')
                foco = await pg.evaluate("() => { const e = document.activeElement; const cs = getComputedStyle(e); return { el: e.className || e.tagName, outline: cs.outlineStyle + ' ' + cs.outlineWidth }; }")
                info['foco'] = foco
                if foco['outline'].startswith('none'):
                    fallos.append(f'{clave}: foco sin contorno visible ({foco})')
                info['scroll']['portada'] = await pg.evaluate('document.documentElement.scrollWidth')
                info['pequenos']['portada'] = await pg.evaluate(PEQUENOS)
                await pg.screenshot(path=f'{OUT}/diseno-{disp}-{tema}-portada.jpg', quality=70, type='jpeg', full_page=True)

                # ---------- WCA Puzzles: 3x3 con la solución en 3D ----------
                await pg.click('a.tarjeta-seccion[href="#/wca"]')
                await esperar_scramble(pg)
                await pg.click('#selector .chip:has-text("3x3")')
                await esperar_scramble(pg)
                await pg.evaluate("() => { for (const id of ['modo-previa', 'modo-editor']) { const b = document.querySelector('#' + id + ' button[data-modo=\"3d\"]'); if (b) b.click(); } }")
                await resolver_y_reproducir(pg, f'{clave} WCA 3x3', fallos)
                info['wca3d'] = await pg.evaluate("() => ({ webgl: window.cuboSolver.estado().webgl, lienzo: !document.getElementById('vista3d-editor').hidden, hash: location.hash })")
                if not info['wca3d']['lienzo']:
                    fallos.append(f'{clave}: la solución del 3x3 no se ve en 3D')
                info['scroll']['wca'] = await pg.evaluate('document.documentElement.scrollWidth')
                info['pequenos']['wca'] = await pg.evaluate(PEQUENOS)
                await pg.screenshot(path=f'{OUT}/diseno-{disp}-{tema}-wca.jpg', quality=70, type='jpeg', full_page=True)

                # ---------- Bandaged Cubes ----------
                await pg.click('.volver')
                await pg.wait_for_selector('#portada:not([hidden])')
                await pg.click('a.tarjeta-seccion[href="#/bandaged"]')
                await esperar_scramble(pg)
                await pg.select_option('#bloq-config', 'ej:1x2x2') if await pg.locator('#bloq-config option[value="ej:1x2x2"]').count() else None
                await pg.wait_for_function("() => /geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=90000)
                await esperar_scramble(pg)
                await resolver_y_reproducir(pg, f'{clave} Bandaged', fallos)
                info['bandaged'] = await pg.evaluate("() => ({ hash: location.hash, bloqueos: window.cuboSolver.estado().bloqueos })")
                info['scroll']['bandaged'] = await pg.evaluate('document.documentElement.scrollWidth')
                info['pequenos']['bandaged'] = await pg.evaluate(PEQUENOS)
                await pg.screenshot(path=f'{OUT}/diseno-{disp}-{tema}-bandaged.jpg', quality=70, type='jpeg', full_page=True)

                ancho = opts['viewport']['width']
                for k, v in info['scroll'].items():
                    if v > ancho:
                        fallos.append(f'{clave} {k}: scroll horizontal ({v} > {ancho})')
                for k, v in info['pequenos'].items():
                    if v:
                        fallos.append(f'{clave} {k}: objetivos táctiles < 44 px: {v[:6]}')
                if info['red']:
                    fallos.append(f'{clave}: peticiones de red {info["red"][:5]}')
                if info['errores']:
                    fallos.append(f'{clave}: errores en consola {info["errores"][:5]}')
                await ctx.close()
        await b.close()
    resumen['fallos'] = fallos
    with open(f'{OUT}/diseno.json', 'w') as f:
        json.dump(resumen, f, ensure_ascii=False, indent=1)
    print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk not in ('pequenos',)} for k, v in resumen.items() if k != 'fallos'}, ensure_ascii=False, indent=1))
    print('FALLOS:' if fallos else 'Todo bien.', *fallos, sep='\n  ')
    sys.exit(1 if fallos else 0)

asyncio.run(main())
