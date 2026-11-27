# Comprobación en Chromium real de «Colocar piezas» (noche 14; Python + Playwright + Chrome).
#   npm run build && python scripts/comprobar-colocar.py [rapido]
# (CHROME=ruta del ejecutable; por defecto el Chrome instalado. PUZZLES=wca3,band3,wca4,band4; PUZZLES=resto;
#  PUZZLES=cuboids: 3x3x1, 3x3x2 y 2x2x3 en las 8 combinaciones.)
#
# Para cada puzzle (WCA 3x3, Bandaged 3x3 con una pareja, WCA 4x4 y Bandaged 4x4 con varios bloques) ×
# escritorio 1280 / móvil 390 (táctil) × oscuro / claro × 2D / 3D:
#   - el estado de un scramble de la app (Cargar, leer, Resetear) es el «cubo físico» que se introduce;
#   - «Colocar piezas» abre el editor en pantalla completa (document.fullscreenElement y la capa ocupa la
#     ventana entera), vacío salvo las piezas fijas, con la bandeja;
#   - se coloca todo con toques reales: 2D, en las pegatinas de la red; 3D, un toque real en el modelo
#     (tiene que elegir un hueco) y el resto con la misma función que usa el modelo 3D al tocar; la
#     lista de piezas del hueco, Girar, Siguiente posición y los bloques de la bandeja, con clics reales;
#   - validación en vivo: «Estado válido»; «Aplicar y salir» sale de la pantalla completa;
#   - Resolver y reproducir hasta «Resuelto»;
#   - objetivos táctiles ≥ 44 px, sin scroll horizontal, foco visible, y sin errores de consola.
# Capturas en docs/capturas/editor-piezas-*.jpg.
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'file:///' + os.path.join(RAIZ, 'dist/index.html').replace('\\', '/').lstrip('/')
OUT = os.path.join(RAIZ, 'docs/capturas')
CHROME = os.environ.get('CHROME') or next((c for c in [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'] if os.path.exists(c)), None)
DISPOSITIVOS = [
    ('escritorio', dict(viewport={'width': 1280, 'height': 860})),
    ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)),
]
VARIOS_4X4 = None  # se lee de la app (ejemplo «varios» del 4x4)
PUZZLES = {
    'wca3': ('#/wca/3x3', 'WCA 3x3'),
    'band3': ('#/bandaged?bloqueos=UFR.UF', 'Bandaged 3x3 (pareja)'),
    'wca4': ('#/wca/4x4', 'WCA 4x4'),
    'band4': ('#/bandaged?puzzle=4x4&bloqueos=UFR.UF2-DBL.DB1.DB2.DBR-F11.UF1', 'Bandaged 4x4 (varios)'),
    # el resto de puzzles (PUZZLES=resto): una combinación por dispositivo
    'wca2': ('#/wca/2x2', 'WCA 2x2'),
    'wca5': ('#/wca/5x5', 'WCA 5x5'),
    'pyraminx': ('#/wca/pyraminx', 'Pyraminx'),
    'skewb': ('#/wca/skewb', 'Skewb'),
    'megaminx': ('#/wca/megaminx', 'Megaminx'),
    'fto': ('#/wca/fto', 'FTO'),
    'band5': ('#/bandaged?puzzle=5x5&bloqueos=UFR.UF3', 'Bandaged 5x5 (pareja)'),
    # Cuboids (noche 15): PUZZLES=cuboids, las 8 combinaciones de cada uno
    'cub331': ('#/cuboids/3x3x1', '3x3x1 Floppy'),
    'cub332': ('#/cuboids/3x3x2', '3x3x2 Domino'),
    'cub223': ('#/cuboids/2x2x3', '2x2x3 Tower'),
    # Shape Mods (noche 16): PUZZLES=shapemods, las 8 combinaciones de cada uno (estado como marcas)
    'mirror': ('#/shapemods/mirror', 'Mirror Blocks'),
    'ghost': ('#/shapemods/ghost', 'Ghost Cube'),
}
SHAPEMODS = ['mirror', 'ghost']
REPETIDOS = [0]  # toques 2D que cayeron en otro hueco y se repitieron (ver tocar_pegatina)
CUBOIDS = ['cub331', 'cub332', 'cub223']
RESTO = ['wca2', 'wca5', 'pyraminx', 'skewb', 'megaminx', 'fto', 'band5']

# Coloca el objetivo: devuelve los pasos que la página tiene que hacer (lo decide el modelo del editor)
PLAN = """(objetivo) => {
  const ed = window.cuboSolver.colocar();
  const M = ed.modelo;
  const color = new Map();
  for (const pz of M.piezas) pz.valores.forEach((v, j) => color.set(v, pz.colores[j]));
  const quiero = objetivo.map((v) => (v < 0 ? -1 : color.get(v)));
  const bloques = M.bloques.map((bq) => ({ id: bq.id, ci: bq.colocaciones.findIndex((c) => c.tuplas.every((t, j) => t.every((i, k) => objetivo[i] === M.piezas[bq.piezas[j]].valores[k]))), hueco: 0 }));
  bloques.forEach((b) => { b.hueco = M.pegatinasHueco(M.bloques[b.id].colocaciones[b.ci].huecos[0])[0]; });
  const huecos = M.piezas.map((_, h) => ({ h, peg: M.pegatinasHueco(h), quiero: M.pegatinasHueco(h).map((i) => quiero[i]) }));
  return { bloques, huecos, grupos: M.grupos.map((g) => g.colores.slice().sort((a, b) => a - b).join()) };
}"""
VER = """(h) => { const ed = window.cuboSolver.colocar(); const S = ed.sesion; const c = S.colores(); const col = S.colocada(h);
  return { colores: ed.modelo.pegatinasHueco(h).map((i) => c[i]), colocada: !!col, bloque: col ? col.bloque : -1 }; }"""


async def pulsar(pg, sel, tactil):
    loc = pg.locator(sel).first
    if tactil:
        await loc.tap()
    else:
        await loc.click()


async def colocar(pg, objetivo, modo, tactil, fallos, clave, capturar):
    plan = await pg.evaluate(PLAN, objetivo)
    toques = 0
    async def tocar_pegatina(i):
        nonlocal toques
        toques += 1
        if modo == '2d':
            # (shape mods: el dibujo 2D tiene varias caras por hueco, unas detrás de otras: se toca una que se vea
            # de cualquier pegatina de ese hueco; si no se ve ninguna, el evento va al polígono)
            await pg.wait_for_timeout(150)  # (la vista se repinta al acabar la validación: el punto, después)
            r = await pg.evaluate('''(i) => { const M = window.cuboSolver.colocar().modelo; const h = M.huecoDePegatina[i];
              const els = M.pegatinasHueco(h).flatMap((j) => [...document.querySelectorAll(`#colocar-2d [data-i="${j}"]`)]);
              for (const el of els) { const r = el.getBoundingClientRect();
                for (const [fx, fy] of [[0.5, 0.5], [0.35, 0.5], [0.65, 0.5], [0.5, 0.35], [0.5, 0.65]]) {
                  const de = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
                  if (de && M.huecoDePegatina[+de.getAttribute('data-i')] === h && de.closest('#colocar-2d')) return { x: r.left + r.width * fx, y: r.top + r.height * fy }; } }
              return null; }''', i)
            if r:
                if tactil: await pg.touchscreen.tap(r['x'], r['y'])
                else: await pg.mouse.click(r['x'], r['y'])
                # si el toque cayó en otro hueco (shape mods en 2D: caras diminutas, o una pieza mal puesta que
                # sobresale sobre el hueco de al lado), se repite con la función de la interfaz y se cuenta
                otro = await pg.evaluate('''(i) => { const ed = window.cuboSolver.colocar(); const h = ed.modelo.huecoDePegatina[i]; const s = ed.seleccion();
                  if (s && s.tipo === 'hueco' && s.h === h) return false; ed.tocar(i); return true; }''', i)
                if otro: REPETIDOS[0] += 1
            else:
                await pg.evaluate('''(i) => document.querySelector(`#colocar-2d [data-i="${i}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }))''', i)
        else:
            # la misma función que llama el modelo 3D al tocar una pegatina
            await pg.evaluate('(i) => window.cuboSolver.colocar().tocar(i)', i)
    async def boton(sel):
        nonlocal toques
        toques += 1
        await pulsar(pg, sel, tactil)
    for b in plan['bloques']:
        await boton(f'#colocar-bandeja [data-bloque="{b["id"]}"]')
        await tocar_pegatina(b['hueco'])
        for _ in range(230):
            ci = await pg.evaluate('(b) => window.cuboSolver.colocar().sesion.colocacionBloque(b)', b['id'])
            if ci == b['ci']: break
            girar = await pg.evaluate("() => { const g = document.getElementById('colocar-girar'); return !!g && !g.disabled; }")
            n = await pg.evaluate('(b) => window.cuboSolver.colocar().sesion.posicionesBloque(b)', b['id'])
            await boton('#colocar-siguiente' if (not girar or _ > 24) else '#colocar-girar')
        else:
            fallos.append(f'{clave}: el bloque {b["id"]} no llega a su posición')
    mitad = len(plan['huecos']) // 2
    for k, hu in enumerate(plan['huecos']):
        if k == mitad and capturar: await capturar('medio')
        v = await pg.evaluate(VER, hu['h'])
        if v['colocada'] and (v['bloque'] >= 0 or v['colores'] == hu['quiero']): continue
        await tocar_pegatina(hu['peg'][0])
        v = await pg.evaluate(VER, hu['h'])
        if not v['colocada']:
            clave_c = ','.join(str(x) for x in sorted(hu['quiero']))
            idx = await pg.evaluate("""(clave) => { const ed = window.cuboSolver.colocar();
              const b = [...document.querySelectorAll('#colocar-contexto .pieza-boton')].find((x) => ed.modelo.grupos[+x.dataset.grupo].colores.slice().sort((a, b2) => a - b2).join() === clave);
              return b ? b.dataset.grupo : null; }""", clave_c)
            if idx is None:
                fallos.append(f'{clave}: hueco {hu["h"]}: la pieza no está en la lista'); return toques
            await boton(f'#colocar-contexto .pieza-boton[data-grupo="{idx}"]')
        for _ in range(12):
            v = await pg.evaluate(VER, hu['h'])
            if v['colores'] == hu['quiero']: break
            await boton('#colocar-girar')
        else:
            fallos.append(f'{clave}: hueco {hu["h"]} no llega a su orientación')
    return toques


async def comprobar(b, puzzle, dispositivo, opts, tema, modo, errores, fallos, resumen, capturas_todas):
    clave = f'{puzzle}/{dispositivo}/{tema}/{modo}'
    url, nombre = PUZZLES[puzzle]
    ctx = await b.new_context(**opts)
    # (la app guarda 'claro' / 'oscuro'; hasta la noche 15 aquí se guardaba 'light' / 'dark' y salía siempre oscuro)
    guardado = 'claro' if tema == 'light' else 'oscuro'
    await ctx.add_init_script(f"""try {{ localStorage.setItem('cubo-solver:tema', '{guardado}');
      localStorage.setItem('cubo-solver:modo3d', JSON.stringify({{ previa: '{modo}', edicion: '{modo}', solucion: '{modo}' }})); }} catch (e) {{}}""")
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e, c=clave: errores.append(f'{c}: {e}'))
    pg.on('console', lambda m, c=clave: errores.append(f'{c}: {m.text}') if m.type == 'error' else None)
    tactil = bool(opts.get('has_touch'))
    t0 = time.time()
    await pg.goto(BASE + url)
    await pg.wait_for_function("window.cuboSolver && document.getElementById('scramble').textContent.length > 0 && !document.getElementById('scramble').classList.contains('generando') && !document.getElementById('cargar').disabled", timeout=300000)
    if puzzle.startswith('band'):
        await pg.wait_for_function("/geometrías/.test(document.getElementById('bloq-analisis').textContent)", timeout=300000)
    await pulsar(pg, '#cargar', tactil)
    objetivo = await pg.evaluate('window.cuboSolver.estadoColocar()')
    await pulsar(pg, '#resetear', tactil)
    await pulsar(pg, '#colocar-piezas', tactil)
    await pg.wait_for_selector('#colocar')
    await pg.wait_for_timeout(300)
    info = await pg.evaluate("""() => { const r = document.getElementById('colocar').getBoundingClientRect();
      return { fs: document.fullscreenElement && document.fullscreenElement.id, ancho: r.width, alto: r.height, vw: window.innerWidth, vh: window.innerHeight,
        scroll: document.documentElement.scrollWidth > window.innerWidth + 1, tema: document.documentElement.dataset.theme,
        m3d: !document.getElementById('colocar-3d').hidden, faltan: document.getElementById('colocar-faltan').textContent }; }""")
    if info['tema'] != tema: fallos.append(f'{clave}: tema {info["tema"]} en vez de {tema}')
    if info['fs'] != 'colocar': fallos.append(f'{clave}: no está en pantalla completa ({info["fs"]})')
    if abs(info['ancho'] - info['vw']) > 1 or abs(info['alto'] - info['vh']) > 1: fallos.append(f'{clave}: la capa no ocupa la ventana ({info})')
    if info['scroll']: fallos.append(f'{clave}: scroll horizontal')
    if (modo == '3d') != info['m3d']: fallos.append(f'{clave}: modo {modo} pero 3D={info["m3d"]}')
    # objetivos táctiles
    pequenos = await pg.evaluate("""() => [...document.querySelectorAll('#colocar button')].filter((b) => !b.closest('[hidden]') && b.offsetParent)
      .map((b) => { const r = b.getBoundingClientRect(); return [b.id || b.dataset.grupo || b.dataset.bloque || b.textContent.trim(), Math.round(r.width), Math.round(r.height)]; })
      .filter(([, w, h]) => w < 44 || h < 44)""")
    if pequenos: fallos.append(f'{clave}: botones de menos de 44 px: {pequenos[:5]}')
    # foco visible con el teclado (escritorio)
    if not tactil:
        await pg.keyboard.press('Tab')
        foco = await pg.evaluate("() => { const e = document.activeElement; const s = getComputedStyle(e); return { dentro: !!e.closest('#colocar'), outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, id: e.id || e.textContent.trim().slice(0, 20) }; }")
        if not foco['dentro'] or not foco['outline']: fallos.append(f'{clave}: foco no visible o fuera del editor ({foco})')
    # un toque real en el modelo 3D: tiene que elegir un hueco
    if modo == '3d':
        lienzo = pg.locator('#colocar-3d canvas')
        caja = await lienzo.bounding_box()
        pos = {'x': caja['width'] * 0.47, 'y': caja['height'] * 0.38}
        if tactil: await lienzo.tap(position=pos)
        else: await lienzo.click(position=pos)
        await pg.wait_for_timeout(250)
        sel = await pg.evaluate("() => window.cuboSolver.colocar().seleccion()")
        if not sel or sel.get('tipo') != 'hueco': fallos.append(f'{clave}: el toque en el 3D no elige un hueco ({sel})')
        # dejarlo como estaba: si se colocó una pieza, Quitar; si solo se eligió el hueco, otro toque lo deselecciona
        colocada = await pg.evaluate("() => { const ed = window.cuboSolver.colocar(); const s = ed.seleccion(); const b = document.getElementById('colocar-quitar'); return !!(s && s.tipo === 'hueco' && ed.sesion.colocada(s.h) && b && !b.disabled && ed.sesion.puedeDeshacer()); }")
        if colocada:
            await pulsar(pg, '#colocar-deshacer', tactil)
        if tactil: await lienzo.tap(position=pos)
        else: await lienzo.click(position=pos)
        await pg.wait_for_timeout(250)
        tras = await pg.evaluate("() => window.cuboSolver.colocar().seleccion()")
        if tras: fallos.append(f'{clave}: otro toque en el mismo hueco no lo deselecciona (antes {sel}, después {tras}, deshecho {colocada})')
    async def capturar(fase):
        if fase == 'medio' or capturas_todas:
            await pg.screenshot(path=f'{OUT}/editor-piezas-{puzzle}-{dispositivo}-{tema}-{modo}-{fase}.jpg', quality=70, type='jpeg')
    await capturar('vacio')
    toques = await colocar(pg, objetivo, modo, tactil, fallos, clave, capturar)
    await pg.wait_for_function("document.getElementById('colocar-mensaje').dataset.resultado", timeout=300000)
    res = await pg.evaluate("() => ({ r: document.getElementById('colocar-mensaje').dataset.resultado, t: document.getElementById('colocar-mensaje').textContent, aplicar: !document.getElementById('colocar-aplicar').disabled, scroll: document.documentElement.scrollWidth > window.innerWidth + 1 })")
    await capturar('completo')
    if res['r'] != 'valido' or not res['aplicar']: fallos.append(f'{clave}: al terminar {res}')
    if res['scroll']: fallos.append(f'{clave}: scroll horizontal al terminar')
    await pulsar(pg, '#colocar-aplicar', tactil)
    await pg.wait_for_timeout(300)
    fuera = await pg.evaluate("() => ({ abierto: !!document.getElementById('colocar'), fs: !!document.fullscreenElement, msg: document.getElementById('mensajes').textContent })")
    if fuera['abierto'] or fuera['fs']: fallos.append(f'{clave}: no sale de la pantalla completa ({fuera})')
    # Resolver y reproducir hasta el final
    await pulsar(pg, '#resolver', tactil)
    await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('#mensajes .mensaje.error')", timeout=300000)
    err = await pg.evaluate("() => { const e = document.querySelector('#mensajes .mensaje.error'); return e && document.getElementById('mensajes').textContent; }")
    if err: fallos.append(f'{clave}: al resolver: {err}')
    else:
        await pulsar(pg, '#r-fin', tactil)
        await pg.wait_for_function("/Resuelto/.test(document.getElementById('paso').textContent)", timeout=60000)
        if not await pg.evaluate('window.cuboSolver.resuelto()'): fallos.append(f'{clave}: la solución no deja el puzzle resuelto')
        if capturas_todas:
            await pg.screenshot(path=f'{OUT}/editor-piezas-{puzzle}-{dispositivo}-{tema}-{modo}-resuelto.jpg', quality=70, type='jpeg')
    n = await pg.evaluate("document.querySelectorAll('#movs li').length")
    resumen[clave] = {'toques': toques, 'giros': n, 's': round(time.time() - t0, 1), 'toquesRepetidos': REPETIDOS[0]}
    REPETIDOS[0] = 0
    print(clave, resumen[clave], flush=True)
    await ctx.close()


async def main():
    os.makedirs(OUT, exist_ok=True)
    errores, fallos, resumen = [], [], {}
    rapido = len(sys.argv) > 1 and sys.argv[1] == 'rapido'
    lista = os.environ.get('PUZZLES', 'wca3,band3,wca4,band4').split(',')
    if lista == ['resto']: lista = RESTO
    if lista == ['cuboids']: lista = CUBOIDS
    if lista == ['shapemods']: lista = SHAPEMODS
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for puzzle in lista:
            for dispositivo, opts in DISPOSITIVOS:
                for tema in ('dark', 'light'):
                    for modo in ('2d', '3d'):
                        # los 4x4: una combinación por dispositivo (tardan más) salvo que se pidan todas
                        if puzzle not in ('wca3', 'band3', *CUBOIDS) and not os.environ.get('TODAS') and (tema, modo) not in (('dark', '3d'), ('light', '2d')):
                            continue
                        if rapido and (tema, modo) != ('dark', '2d'): continue
                        todas = (dispositivo, tema, modo) in (('escritorio', 'dark', '3d'), ('movil', 'light', '2d'))
                        try:
                            await comprobar(b, puzzle, dispositivo, opts, tema, modo, errores, fallos, resumen, todas)
                        except Exception as e:
                            fallos.append(f'{puzzle}/{dispositivo}/{tema}/{modo}: excepción {e}')
                            print('EXCEPCIÓN', puzzle, dispositivo, tema, modo, e, flush=True)
        await b.close()
    print(json.dumps(resumen, indent=1, ensure_ascii=False))
    print('errores de consola:', errores or 'ninguno')
    print('fallos:', fallos or 'ninguno')
    sys.exit(1 if errores or fallos else 0)

asyncio.run(main())
