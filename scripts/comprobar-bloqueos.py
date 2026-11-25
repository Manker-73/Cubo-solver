# Comprobación en Chromium real del cubo vendado (opcional; Python + Playwright + Chrome).
#   npm run build && python3 scripts/comprobar-bloqueos.py
# Escritorio (1280 px, claro) y móvil (390 px, oscuro, táctil), con 3D (WebGL por software) y sin 3D (2D):
#   - crear un bloque tocando piezas en el editor (2D: pegatinas del dibujo; 3D: un toque en el modelo),
#     ver el error de un bloque imposible al momento, aplicar y esperar al análisis (Worker);
#   - cargar ejemplos (1x2x2, CAB) e importar una firma;
#   - scramble, cargar, resolver y reproducir la solución hasta el final (×8 en 3D), con la fase
#     (geometría / permutación) en la barra cuando la estrategia es la B;
#   - en 3D, las pegatinas vecinas de un mismo bloque se dibujan unidas (lados sin encoger);
#   - sin errores en consola ni scroll horizontal.
# Capturas en docs/capturas/bloqueos-*.jpg.
#
# Noche 13: también el 4x4 y el 5x5 vendados (python3 scripts/comprobar-bloqueos.py nxn para solo
# esta parte; 3x3 para solo la de antes): escritorio y móvil, oscuro y claro, con y sin 3D:
#   - elegir el puzzle en el selector de Bandaged Cubes (la URL lleva puzzle=);
#   - pintar está desactivado (aviso al tocar);
#   - crear un bloque tocando piezas (en 3D, un toque en el modelo; en 2D, las pegatinas de UFR y de
#     la wing de UF), aplicar y esperar al análisis (Worker), cargar un ejemplo;
#   - scramble, cargar, resolver y reproducir hasta el final (×8);
#   - en 3D, las pegatinas del bloque se dibujan unidas;
#   - sin errores en consola ni scroll horizontal.
# Capturas en docs/capturas/bloqueos-nxn-*.jpg. (TAMANOS=5 para solo el 5x5.)
#
# Orden de los paneles de Bandaged Cubes (python3 scripts/comprobar-bloqueos.py orden; ETIQUETA=antes|despues
# para el nombre de las capturas): 3x3, 4x4 y 5x5 × escritorio 1280 / móvil 390 × oscuro / claro × 3D / 2D:
#   - orden en el DOM: Tus bloques → Resolver → Scramble (y en WCA Puzzles, Scramble → Resolver, como antes);
#   - escritorio: Tus bloques y Resolver en la misma fila (el cubo a la derecha) y el Scramble debajo, a todo
#     el ancho; móvil: una columna en ese orden;
#   - orden de tabulación = orden visual; foco visible;
#   - crear un bloque tocando el cubo de al lado (3D: el modelo; 2D: las pegatinas) con la lista y el cubo
#     a la vista a la vez (escritorio), aplicar y esperar al análisis;
#   - escritorio con «Tus bloques» más alto que el cubo: al bajar por la lista, el panel Resolver sigue a la
#     vista y nunca tapa el Scramble; móvil: nada fijo;
#   - sin errores en consola ni scroll horizontal. Capturas en docs/capturas/bandaged-orden-*.jpg.
import asyncio, json, os, sys
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Noche 11: el cubo vendado es su propia sección, Bandaged Cubes (#/bandaged), sin selector de puzzle.
URL = 'file://' + os.path.join(RAIZ, 'dist/index.html') + '#/bandaged'
OUT = os.path.join(RAIZ, 'docs/capturas')
CONFIGS = [
    ('escritorio', dict(viewport={'width': 1280, 'height': 900}, color_scheme='light')),
    ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme='dark')),
]

INFO = """() => {
  const v = window.cuboSolver.vista3D('editor');
  const g = v && v.escena.geometria;
  return {
    paso: document.getElementById('paso').textContent,
    resumen: document.getElementById('sol-resumen').textContent,
    fases: [...document.querySelectorAll('#fases .fase')].map((b) => b.dataset.fase),
    unidas: g ? g.pegatinas.filter((q) => q.expandir).length : null,
    analisis: document.getElementById('bloq-analisis').textContent,
    scroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    ancho: window.innerWidth,
  };
}"""

async def esperar_scramble(pg):
    await pg.wait_for_function("!document.getElementById('scramble').classList.contains('generando') && document.getElementById('scramble').textContent.length > 0", timeout=120000)

async def resolver_y_reproducir(pg, modo3d, fallos, clave):
    await pg.click('#cargar')
    await pg.evaluate(f"() => {{ const b = document.querySelector('#modo-editor button[data-modo=\"{'3d' if modo3d else '2d'}\"]'); if (b) b.click(); }}")
    await pg.click('#resolver')
    await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=120000)
    err = await pg.evaluate("document.querySelector('#mensajes .mensaje.error') ? document.getElementById('mensajes').textContent : null")
    if err: fallos.append(f'{clave}: {err}'); return None
    await pg.click('#r-inicio')
    while (await pg.inner_text('#r-velocidad')) != '×8':
        await pg.click('#r-velocidad')
    await pg.click('#r-play')
    await pg.wait_for_timeout(500)
    d = await pg.evaluate(INFO)
    await pg.wait_for_function("document.getElementById('paso').textContent.includes('Resuelto')", timeout=120000)
    ok = await pg.evaluate("window.cuboSolver.resuelto()")
    if not ok: fallos.append(f'{clave}: no queda resuelto')
    return d

async def comprobar_nxn(b, errores, fallos, resumen):
    """Noche 13: 4x4 y 5x5 vendados en escritorio y móvil, oscuro y claro, con y sin 3D."""
    tamanos = [int(x) for x in os.environ.get('TAMANOS', '4,5').split(',')]
    for N in tamanos:
        nombre = f'{N}x{N}'
        for cfg, opts in CONFIGS:
            for tema in ('oscuro', 'claro'):
                for modo3d in (True, False):
                    modo = '3d' if modo3d else '2d'
                    clave = f'{nombre}/{cfg}/{tema}/{modo}'
                    ctx = await b.new_context(**opts)
                    await ctx.add_init_script(f"try {{ localStorage.setItem('cubo-solver:tema', '{tema}'); }} catch (e) {{}}")
                    pg = await ctx.new_page()
                    pg.on('pageerror', lambda e, c=clave: errores.append(f'{c}: {e}'))
                    pg.on('console', lambda m, c=clave: errores.append(f'{c}: {m.text}') if m.type == 'error' else None)
                    await pg.goto(URL)
                    await esperar_scramble(pg)
                    await pg.click(f'#selector .chip[data-vendado="{nombre}"]')
                    await pg.wait_for_function(f"window.cuboSolver.estado().puzzle === 'vendado-{nombre}' && location.hash.includes('puzzle={nombre}')", timeout=60000)
                    await esperar_scramble(pg)
                    await pg.evaluate(f"() => {{ for (const id of ['modo-previa', 'modo-editor']) {{ const b = document.querySelector('#' + id + ' button[data-modo=\"{modo}\"]'); if (b) b.click(); }} }}")
                    # pintar: desactivado, con aviso
                    if not modo3d:
                        await pg.locator('#vista-editor [data-i="0"]').click()
                        await pg.wait_for_function("/no se puede pintar/.test(document.getElementById('mensajes').textContent)", timeout=10000)
                    # crear un bloque tocando piezas
                    await pg.click('#bloq-nuevo')
                    if modo3d:
                        lienzo = pg.locator('#vista3d-editor canvas')
                        caja = await lienzo.bounding_box()
                        pos = {'x': caja['width'] / 2, 'y': caja['height'] / 2}
                        if opts.get('has_touch'): await lienzo.tap(position=pos)
                        else: await lienzo.click(position=pos)
                        await pg.wait_for_timeout(200)
                        n = await pg.evaluate("document.querySelectorAll('#bloq-grupos li').length && document.querySelector('#bloq-grupos li .piezas').textContent")
                        if not n or 'vacío' in n: fallos.append(f'{clave}: el toque en 3D no añade ninguna pieza ({n})')
                        await pg.evaluate("() => document.querySelector('#modo-editor button[data-modo=\"2d\"]').click()")
                        await pg.click('#bloq-quitar')
                        await pg.click('#bloq-nuevo')
                    n2 = N * N
                    for i in (n2 - 1, n2 - 2):  # UFR y la wing de UF a su lado
                        await pg.locator(f'#vista-editor [data-i="{i}"]').click()
                    txt = await pg.inner_text('#bloq-grupos')
                    esperado = 'UFR + UF2' if N == 4 else 'UFR + UF3'
                    if esperado not in txt: fallos.append(f'{clave}: el bloque no tiene {esperado} ({txt})')
                    await pg.locator('#panel-bloqueos').screenshot(path=f'{OUT}/bloqueos-nxn-{nombre}-{cfg}-{tema}-{modo}-editar.jpg', quality=70, type='jpeg')
                    await pg.click('#bloq-aplicar')
                    await pg.wait_for_function("/estados distinguibles/.test(document.getElementById('bloq-analisis').textContent)", timeout=180000)
                    if modo3d:
                        await pg.evaluate("() => { for (const id of ['modo-previa', 'modo-editor']) { const b = document.querySelector('#' + id + ' button[data-modo=\"3d\"]'); if (b) b.click(); } }")
                    await esperar_scramble(pg)
                    d = await resolver_y_reproducir(pg, modo3d, fallos, clave + '/pareja')
                    resumen[clave + '/pareja'] = d and {k: d[k] for k in ('resumen', 'unidas')}
                    if modo3d and d and not d['unidas']: fallos.append(f'{clave}: en 3D no hay pegatinas unidas')
                    await pg.click('#r-inicio')
                    await pg.wait_for_timeout(400)
                    await pg.locator('#panel-resolver').screenshot(path=f'{OUT}/bloqueos-nxn-{nombre}-{cfg}-{tema}-{modo}-solucion.jpg', quality=70, type='jpeg')
                    # un ejemplo (la barra; en el 5x5 en 2D, los centros opuestos por el núcleo)
                    ejemplo = 'opuestos' if (N == 5 and not modo3d) else 'barra'
                    await pg.select_option('#bloq-config', f'ej:{ejemplo}')
                    await pg.wait_for_function("/estados distinguibles/.test(document.getElementById('bloq-analisis').textContent) && document.getElementById('bloq-resumen').textContent === '1 bloque'", timeout=180000)
                    await esperar_scramble(pg)
                    d = await resolver_y_reproducir(pg, modo3d, fallos, clave + '/' + ejemplo)
                    resumen[clave + '/' + ejemplo] = d and {k: d[k] for k in ('resumen', 'unidas')}
                    info = await pg.evaluate(INFO)
                    # (en móvil, si algo es más ancho que la pantalla, el viewport crece: se mira también su ancho)
                    if info['scroll'] or info['ancho'] > opts['viewport']['width'] + 1: fallos.append(f"{clave}: scroll horizontal (ancho {info['ancho']})")
                    if cfg == 'movil' or modo3d:
                        await pg.screenshot(path=f'{OUT}/bloqueos-nxn-{nombre}-{cfg}-{tema}-{modo}-pagina.jpg', quality=55, type='jpeg', full_page=True)
                    await pg.select_option('#bloq-config', 'vacia')
                    await ctx.close()

GEOM = """() => {
  const ids = ['panel-bloqueos', 'panel-resolver', 'panel-scramble'];
  const r = {};
  for (const id of ids) { const e = document.getElementById(id); const b = e.getBoundingClientRect(); r[id] = { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height), visible: !e.hidden, fijo: getComputedStyle(e).position }; }
  return {
    dom: [...document.querySelectorAll('.paneles section.panel')].filter((e) => !e.hidden).map((e) => e.id),
    r, paneles: Math.round(document.querySelector('.paneles').getBoundingClientRect().width),
    scroll: document.documentElement.scrollWidth > window.innerWidth + 1, ancho: window.innerWidth,
  };
}"""
CORTO = {'panel-bloqueos': 'bloques', 'panel-resolver': 'resolver', 'panel-scramble': 'scramble'}

async def orden_tabulacion(pg):
    """Panel de cada elemento que recibe el foco con Tab desde el título de la sección (sin repetir)."""
    await pg.evaluate("document.getElementById('t-seccion').focus()")
    vistos = []
    for _ in range(400):
        await pg.keyboard.press('Tab')
        d = await pg.evaluate("() => { const e = document.activeElement; const p = e && e.closest('section.panel'); const cs = getComputedStyle(e); return { p: p ? p.id : null, pie: !!(e && e.closest('.pie')), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== 'none' }; }")
        if d['p'] and (not vistos or vistos[-1][0] != d['p']): vistos.append((d['p'], d['outline']))
        if d['pie'] or (not d['p'] and vistos and len(vistos) >= 3): break
    return [CORTO[p] for p, _ in vistos], all(o for _, o in vistos)

async def comprobar_orden(b, errores, fallos, resumen):
    etiqueta = os.environ.get('ETIQUETA', 'despues')
    tamanos = [int(x) for x in os.environ.get('TAMANOS', '3,4,5').split(',')]
    for N in tamanos:
        nombre = f'{N}x{N}'
        for cfg, opts in CONFIGS:
            escritorio = cfg == 'escritorio'
            for tema in ('oscuro', 'claro'):
                for modo3d in (True, False):
                    modo = '3d' if modo3d else '2d'
                    clave = f'orden/{nombre}/{cfg}/{tema}/{modo}'
                    ctx = await b.new_context(**opts)
                    await ctx.add_init_script(f"try {{ localStorage.setItem('cubo-solver:tema', '{tema}'); }} catch (e) {{}}")
                    pg = await ctx.new_page()
                    pg.on('pageerror', lambda e, c=clave: errores.append(f'{c}: {e}'))
                    pg.on('console', lambda m, c=clave: errores.append(f'{c}: {m.text}') if m.type == 'error' else None)
                    await pg.goto(URL + ('' if N == 3 else f'?puzzle={nombre}'))
                    await esperar_scramble(pg)
                    await pg.wait_for_function(f"window.cuboSolver.estado().puzzle === '{'3x3' if N == 3 else 'vendado-' + nombre}'", timeout=60000)
                    await pg.evaluate(f"() => {{ for (const id of ['modo-previa', 'modo-editor']) {{ const b = document.querySelector('#' + id + ' button[data-modo=\"{modo}\"]'); if (b) b.click(); }} }}")
                    await pg.evaluate('window.scrollTo(0, 0)')
                    await pg.wait_for_timeout(300)
                    g = await pg.evaluate(GEOM)
                    r = {CORTO[k]: v for k, v in g['r'].items()}
                    dom = [CORTO[i] for i in g['dom']]
                    info = {'dom': dom}
                    if dom != ['bloques', 'resolver', 'scramble']: fallos.append(f'{clave}: orden en el DOM {dom}')
                    bl, rs, sc = r['bloques'], r['resolver'], r['scramble']
                    if escritorio:
                        misma = abs(bl['y'] - rs['y']) <= 2 and bl['x'] + bl['w'] <= rs['x']
                        debajo = sc['y'] >= max(bl['y'] + bl['h'], rs['y'] + rs['h']) - 1 and abs(sc['w'] - g['paneles']) <= 2
                        info['fila'] = misma; info['scramble_debajo'] = debajo
                        if not misma: fallos.append(f'{clave}: Tus bloques y Resolver no están en la misma fila ({bl}, {rs})')
                        if not debajo: fallos.append(f'{clave}: el Scramble no está debajo a todo el ancho ({sc})')
                    else:
                        col = bl['y'] < rs['y'] < sc['y'] and len({bl['x'], rs['x'], sc['x']}) == 1
                        info['columna'] = col
                        if not col: fallos.append(f'{clave}: no es una columna Tus bloques → Resolver → Scramble ({r})')
                        if any(v['fijo'] in ('sticky', 'fixed') for v in g['r'].values()): fallos.append(f'{clave}: algo fijo en móvil')
                    # orden de tabulación (con 3D y en el 3x3 basta una vez por dispositivo y tema)
                    if N == 3 and modo3d:
                        tab, foco = await orden_tabulacion(pg)
                        info['tab'] = tab
                        if tab[:3] != ['bloques', 'resolver', 'scramble']: fallos.append(f'{clave}: orden de tabulación {tab}')
                        if not foco: fallos.append(f'{clave}: foco sin contorno visible')
                        await pg.evaluate('window.scrollTo(0, 0)')
                    # crear un bloque tocando el cubo de al lado
                    await pg.click('#bloq-nuevo')
                    vista = '#vista3d-editor canvas' if modo3d else '#vista-editor'
                    if escritorio:
                        # hay una posición de scroll con la lista de bloques y el cubo enteros a la vez: se baja
                        # hasta ella y se toca desde ahí (sin más scroll)
                        a_la_vista = await pg.evaluate(f"""() => {{
                          const r = (s) => document.querySelector(s).getBoundingClientRect();
                          const a = r('#bloq-grupos'), v = r('{vista}');
                          const arriba = Math.min(a.top, v.top) + scrollY, abajo = Math.max(a.bottom, v.bottom) + scrollY;
                          if (abajo - arriba > innerHeight) return false;
                          window.scrollTo(0, arriba - 8);
                          const a2 = r('#bloq-grupos'), v2 = r('{vista}');
                          return a2.top >= 0 && v2.top >= 0 && a2.bottom <= innerHeight && v2.bottom <= innerHeight && Math.abs(a2.top - v2.top) < 400; }}""")
                        info['lista_y_cubo_a_la_vista'] = a_la_vista
                        if not a_la_vista: fallos.append(f'{clave}: al crear un bloque, el cubo y la lista no se ven a la vez')
                    if modo3d:
                        lienzo = pg.locator('#vista3d-editor canvas')
                        caja = await lienzo.bounding_box()
                        pos = {'x': caja['width'] / 2, 'y': caja['height'] / 2}
                        if opts.get('has_touch'): await lienzo.tap(position=pos)
                        else: await lienzo.click(position=pos)
                    else:
                        n2 = N * N
                        for i in (n2 - 1, n2 - 2):
                            await pg.locator(f'#vista-editor [data-i="{i}"]').click()
                    await pg.wait_for_timeout(250)
                    txt = await pg.evaluate("document.querySelector('#bloq-grupos li .piezas') ? document.querySelector('#bloq-grupos li .piezas').textContent : ''")
                    info['bloque'] = txt
                    if not txt or 'vacío' in txt: fallos.append(f'{clave}: tocar el cubo no añade piezas ({txt!r})')
                    if not modo3d and '+' not in txt: fallos.append(f'{clave}: el bloque no tiene dos piezas ({txt!r})')
                    if escritorio and N == 3 and modo3d or (escritorio and N > 3 and tema == 'oscuro' and modo3d):
                        await pg.screenshot(path=f'{OUT}/bandaged-orden-{etiqueta}-{cfg}-{tema}-{nombre}-editar.jpg', quality=70, type='jpeg')
                    if modo3d:
                        await pg.click('#bloq-quitar')
                    else:
                        await pg.click('#bloq-aplicar')
                        await pg.wait_for_function("/geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=180000)
                    # «Tus bloques» más alto que el cubo: un ejemplo con varios bloques y «Guardar…» abierto
                    if N == 3 and modo3d:
                        await pg.select_option('#bloq-config', 'ej:varios')
                        await pg.wait_for_function("/geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                        await pg.click('#bloq-nuevo')  # en edición: lista de bloques con botones
                        await pg.evaluate("() => { document.querySelector('.bloq-mas').open = true; window.scrollTo(0, 0); }")
                        await pg.wait_for_timeout(300)
                        g = await pg.evaluate(GEOM)
                        bl, rs, sc = (g['r'][k] for k in ('panel-bloqueos', 'panel-resolver', 'panel-scramble'))
                        info['alto_bloques_resolver'] = (bl['h'], rs['h'])
                        if escritorio and bl['h'] > rs['h'] + 100:
                            fondo = bl['y'] + bl['h'] - 900 + 20
                            await pg.evaluate(f'window.scrollTo(0, {fondo})')
                            await pg.wait_for_timeout(300)
                            v = await pg.evaluate(f"() => {{ const b = document.querySelector('{vista}').getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), innerHeight]; }}")
                            info['cubo_al_bajar'] = v
                            if not (v[0] >= 0 and v[1] <= v[2]): fallos.append(f'{clave}: al bajar por «Tus bloques» el cubo no se ve ({v})')
                            await pg.screenshot(path=f'{OUT}/bandaged-orden-{etiqueta}-{cfg}-{tema}-fijo.jpg', quality=70, type='jpeg')
                            await pg.evaluate(f"window.scrollTo(0, {sc['y'] - 300})")
                            await pg.wait_for_timeout(300)
                            tapa = await pg.evaluate("() => { const a = document.getElementById('panel-resolver').getBoundingClientRect(), s = document.getElementById('panel-scramble').getBoundingClientRect(); return a.bottom > s.top + 1; }")
                            if tapa: fallos.append(f'{clave}: el panel Resolver tapa el Scramble')
                        await pg.click('#bloq-aplicar')
                        await pg.wait_for_function("/geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                        await esperar_scramble(pg)
                        await pg.evaluate('window.scrollTo(0, 0)')
                        await pg.wait_for_timeout(500)
                        await pg.screenshot(path=f'{OUT}/bandaged-orden-{etiqueta}-{cfg}-{tema}.jpg', quality=60, type='jpeg', full_page=True)
                    g = await pg.evaluate(GEOM)
                    if g['scroll'] or g['ancho'] > opts['viewport']['width'] + 1: fallos.append(f"{clave}: scroll horizontal (ancho {g['ancho']})")
                    # WCA Puzzles: como antes (Scramble → Resolver; en escritorio, lado a lado)
                    if N == 3 and modo3d:
                        await pg.select_option('#bloq-config', 'vacia')
                        await pg.goto(URL.replace('#/bandaged', '#/wca/3x3'))
                        await esperar_scramble(pg)
                        await pg.evaluate('window.scrollTo(0, 0)')
                        g = await pg.evaluate(GEOM)
                        dom = [CORTO[i] for i in g['dom']]
                        sc, rs = g['r']['panel-scramble'], g['r']['panel-resolver']
                        info['wca'] = {'dom': dom, 'scramble': sc, 'resolver': rs}
                        if dom != ['scramble', 'resolver']: fallos.append(f'{clave}: WCA cambia de orden {dom}')
                        if escritorio and not (abs(sc['y'] - rs['y']) <= 2 and sc['x'] < rs['x']): fallos.append(f'{clave}: WCA ya no está lado a lado')
                        if not escritorio and not sc['y'] < rs['y']: fallos.append(f'{clave}: WCA en móvil no es Scramble → Resolver')
                        if g['scroll']: fallos.append(f'{clave}: WCA con scroll horizontal')
                        if tema == 'oscuro': await pg.screenshot(path=f'{OUT}/bandaged-orden-{etiqueta}-{cfg}-wca.jpg', quality=60, type='jpeg', full_page=True)
                    resumen[clave] = info
                    await ctx.close()

# Sesión «validador con muchas geometrías» (python3 scripts/comprobar-bloqueos.py geometrias): el 5x5 de
# 16 bloques del fallo (más de 400.000 geometrías), escritorio y móvil: abrir el enlace, esperar al análisis,
# cargar el scramble del fallo (antes: «Este estado no es posible» y «No se pudo comprobar la forma»),
# resolver y reproducir; generar un scramble nuevo, cargarlo, resolver y reproducir. Sin mensajes de
# error ni errores de consola. Capturas en docs/capturas/bandaged-geometrias-*.jpg.
BARRAS_5X5 = 'B.B12.B32.DB-B11.B21.B31.DB3-B13.B23.B33.DB1-BL.BL1.BL3.DBL-BR.BR1.BR3.DBR-DF.F.F12.F32-DF1.F11.F21.F31-DF3.F13.F23.F33-DFL.FL.FL1.FL3-DFR.FR.FR1.FR3-DL.L.L12.L32-DL1.L11.L21.L31-DL3.L13.L23.L33-DR.R.R12.R32-DR1.R13.R23.R33-DR3.R11.R21.R31'
SCRAMBLE_FALLO = "2R2 2B 2F' Fw' F Bw2 B2 R2 2B2 Bw' Fw F B L' B".split(' ')

async def comprobar_geometrias(b, errores, fallos, resumen):
    etiqueta = os.environ.get('ETIQUETA', 'despues')
    for cfg, opts in CONFIGS:
        clave = f'geometrias/{cfg}'
        ctx = await b.new_context(**opts)
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e, c=clave: errores.append(f'{c}: {e}'))
        pg.on('console', lambda m, c=clave: errores.append(f'{c}: {m.text}') if m.type == 'error' else None)
        await pg.goto(URL + '?puzzle=5x5&bloqueos=' + BARRAS_5X5)
        await pg.wait_for_function("window.cuboSolver && window.cuboSolver.estado().puzzle === 'vendado-5x5' && window.cuboSolver.estado().bloqueos === 16", timeout=60000)
        import time
        t0 = time.time()
        await pg.wait_for_function("/geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=600000)
        ms_analisis = round((time.time() - t0) * 1000)
        await esperar_scramble(pg)
        analisis = await pg.inner_text('#bloq-analisis')
        modo3d = cfg == 'escritorio'
        filas = {}
        for caso in ('fallo', 'nuevo'):
            if caso == 'fallo':
                await pg.evaluate('(m) => window.cuboSolver.mostrarScramble(m)', SCRAMBLE_FALLO)
            else:
                await pg.click('#nuevo')
                await pg.wait_for_timeout(200)
                await esperar_scramble(pg)
            longitud = await pg.inner_text('#longitud')
            t1 = time.time()
            d = await resolver_y_reproducir(pg, modo3d, fallos, f'{clave}/{caso}')
            texto = await pg.inner_text('#mensajes')
            if 'no es posible' in texto or 'No se pudo comprobar' in texto: fallos.append(f'{clave}/{caso}: {texto}')
            filas[caso] = {'scramble': longitud, 'solucion': d and d['resumen'], 'ms': round((time.time() - t1) * 1000), 'mensajes': texto}
            await pg.locator('#panel-resolver').screenshot(path=f'{OUT}/bandaged-geometrias-{etiqueta}-{cfg}-{caso}.jpg', quality=70, type='jpeg')
        info = await pg.evaluate(INFO)
        if info['scroll']: fallos.append(f'{clave}: scroll horizontal')
        await pg.screenshot(path=f'{OUT}/bandaged-geometrias-{etiqueta}-{cfg}-pagina.jpg', quality=55, type='jpeg', full_page=True)
        resumen[clave] = {'msAnalisis': ms_analisis, 'analisis': analisis, **filas}
        await ctx.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    errores, fallos, resumen = [], [], {}
    parte = sys.argv[1] if len(sys.argv) > 1 else 'todo'
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'),
                                    args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        if parte == 'geometrias':
            await comprobar_geometrias(b, errores, fallos, resumen)
        if parte in ('todo', 'nxn'):
            await comprobar_nxn(b, errores, fallos, resumen)
        if parte in ('todo', 'orden'):
            await comprobar_orden(b, errores, fallos, resumen)
        for cfg, opts in (CONFIGS if parte in ('todo', '3x3') else []):
            for modo3d in (True, False):
                clave = f"{cfg}/{'3d' if modo3d else '2d'}"
                ctx = await b.new_context(**opts)
                pg = await ctx.new_page()
                pg.on('pageerror', lambda e, c=clave: errores.append(f'{c}: {e}'))
                pg.on('console', lambda m, c=clave: errores.append(f'{c}: {m.text}') if m.type == 'error' else None)
                await pg.goto(URL)
                await esperar_scramble(pg)
                # (en Bandaged Cubes el 3x3 ya está elegido; desde la noche 13 hay un selector 3x3/4x4/5x5)
                assert await pg.evaluate("document.querySelector('#selector .chip[data-vendado=\"3x3\"]').getAttribute('aria-pressed') === 'true'"), 'el 3x3 elegido en el selector de Bandaged Cubes'
                modo = '3d' if modo3d else '2d'
                await pg.evaluate(f"() => {{ for (const id of ['modo-previa', 'modo-editor']) {{ const b = document.querySelector('#' + id + ' button[data-modo=\"{modo}\"]'); if (b) b.click(); }} }}")
                # 1) crear un bloque tocando piezas
                await pg.click('#bloq-nuevo')
                if modo3d:
                    # toque en el centro del lienzo 3D (la pieza que se ve delante) y en la del 2D para la segunda
                    lienzo = pg.locator('#vista3d-editor canvas')
                    caja = await lienzo.bounding_box()
                    pos = {'x': caja['width'] / 2, 'y': caja['height'] / 2}
                    if opts.get('has_touch'): await lienzo.tap(position=pos)
                    else: await lienzo.click(position=pos)
                    await pg.wait_for_timeout(200)
                    n = await pg.evaluate("document.querySelectorAll('#bloq-grupos li').length && document.querySelector('#bloq-grupos li .piezas').textContent")
                    if not n or 'vacío' in n: fallos.append(f'{clave}: el toque en 3D no añade ninguna pieza ({n})')
                    # el resto en 2D (más preciso)
                    await pg.evaluate("() => document.querySelector('#modo-editor button[data-modo=\"2d\"]').click()")
                    await pg.click('#bloq-quitar')
                    await pg.click('#bloq-nuevo')
                for i in (8, 7):  # UFR y UF
                    await pg.locator(f'#vista-editor [data-i="{i}"]').click()
                txt = await pg.inner_text('#bloq-grupos')
                if 'UFR + UF' not in txt: fallos.append(f'{clave}: el bloque no tiene UFR + UF ({txt})')
                await pg.locator('#panel-bloqueos').screenshot(path=f'{OUT}/bloqueos-{cfg}-{modo}-editar.jpg', quality=70, type='jpeg')
                await pg.click('#bloq-aplicar')
                await pg.wait_for_function("/24 geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                if modo3d:
                    await pg.evaluate("() => { for (const id of ['modo-previa', 'modo-editor']) { const b = document.querySelector('#' + id + ' button[data-modo=\"3d\"]'); if (b) b.click(); } }")
                await esperar_scramble(pg)
                d = await resolver_y_reproducir(pg, modo3d, fallos, clave + '/pareja')
                resumen[clave + '/pareja'] = d and {k: d[k] for k in ('resumen', 'fases', 'unidas')}
                # 2) varios bloques con la estrategia B forzada: la barra de fases y el paso dicen la fase
                await pg.select_option('#bloq-config', 'ej:varios')
                await pg.wait_for_function("/1\\.440 geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                await pg.select_option('#bloq-estrategia', 'B')
                await esperar_scramble(pg)
                await pg.click('#cargar')
                await pg.click('#resolver')
                await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=120000)
                fb = await pg.evaluate("() => ({ fases: [...document.querySelectorAll('#fases .fase')].map((b) => b.dataset.fase), resumen: document.getElementById('sol-resumen').textContent })")
                if 'estrategia B' not in fb['resumen'] or 'Permutación' not in fb['fases']: fallos.append(f'{clave}: B forzada sin fases ({fb})')
                await pg.click('#r-adelante')
                await pg.wait_for_function("document.getElementById('paso').textContent.startsWith('Paso 1/')")
                paso1 = await pg.inner_text('#paso')
                if 'Geometría' in fb['fases'] and 'Geometría' not in paso1: fallos.append(f'{clave}: el paso 1 no dice la fase ({paso1})')
                await pg.wait_for_timeout(500)
                await pg.locator('#panel-resolver').screenshot(path=f'{OUT}/bloqueos-{cfg}-{modo}-fases.jpg', quality=70, type='jpeg')
                resumen[clave + '/varios-B'] = fb
                await pg.select_option('#bloq-estrategia', '')
                # 3) ejemplo 1x2x2 (las pegatinas del bloque, unidas en 3D)
                await pg.select_option('#bloq-config', 'ej:1x2x2')
                await pg.wait_for_function("/4 geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                await esperar_scramble(pg)
                d = await resolver_y_reproducir(pg, modo3d, fallos, clave + '/1x2x2')
                resumen[clave + '/1x2x2'] = d and {k: d[k] for k in ('resumen', 'fases', 'unidas')}
                if modo3d and d and not d['unidas']: fallos.append(f'{clave}: en 3D no hay pegatinas unidas')
                await pg.click('#r-inicio')
                await pg.wait_for_timeout(400)
                await pg.locator('#panel-resolver').screenshot(path=f'{OUT}/bloqueos-{cfg}-{modo}-1x2x2.jpg', quality=70, type='jpeg')
                # 3) CAB (espacio pequeño: óptima por BFS) y una firma importada (Bicube)
                await pg.select_option('#bloq-config', 'ej:cab')
                await pg.wait_for_function("/15\\.704 geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                await esperar_scramble(pg)
                d = await resolver_y_reproducir(pg, modo3d, fallos, clave + '/cab')
                resumen[clave + '/cab'] = d and {k: d[k] for k in ('resumen', 'fases', 'unidas')}
                await pg.locator('#panel-scramble').screenshot(path=f'{OUT}/bloqueos-{cfg}-{modo}-cab.jpg', quality=70, type='jpeg')
                await pg.evaluate("() => { document.querySelector('.bloq-mas').open = true; }")
                await pg.fill('#bloq-firma', 'XYZ')
                await pg.click('#bloq-importar')
                await pg.wait_for_function("/hexadecimal/.test(document.getElementById('mensajes').textContent)")
                await pg.fill('#bloq-firma', 'E0400B43FC5A1')
                await pg.click('#bloq-importar')
                await pg.wait_for_function("/121 geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=120000)
                await esperar_scramble(pg)
                d = await resolver_y_reproducir(pg, modo3d, fallos, clave + '/bicube')
                resumen[clave + '/bicube'] = d and {k: d[k] for k in ('resumen', 'fases', 'unidas')}
                info = await pg.evaluate(INFO)
                if info['scroll'] or info['ancho'] > opts['viewport']['width'] + 1: fallos.append(f"{clave}: scroll horizontal (ancho {info['ancho']})")
                await pg.screenshot(path=f'{OUT}/bloqueos-{cfg}-{modo}-pagina.jpg', quality=60, type='jpeg', full_page=True)
                # volver al 3x3 normal para no dejar bloques guardados
                await pg.select_option('#bloq-config', 'vacia')
                await ctx.close()
        await b.close()
    print(json.dumps({'resumen': resumen, 'fallos': fallos, 'errores': errores}, ensure_ascii=False, indent=1))
    if fallos or errores: raise SystemExit(1)

asyncio.run(main())
