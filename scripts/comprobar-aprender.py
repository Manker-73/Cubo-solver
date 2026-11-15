# Comprobación en Chromium real del modo aprender (opcional; Python + Playwright + Chrome).
#   npm run build && python3 scripts/comprobar-aprender.py
# Escritorio (1280 px, claro) y móvil (390 px, oscuro, táctil): en el 3x3 (principiantes y CFOP)
# el 2x2 (principiantes y Ortega), el 4x4 y el 5x5 (CFOP), el Pyraminx, el Skewb y el Square-1, carga el scramble, elige el método, resuelve y recorre la
# solución en 3D: en cada paso (al momento, mientras se anima el giro) comprueba que la explicación es la del bloque actual y que las
# piezas resaltadas en la vista 3D son las del bloque. Después la reproduce entera a ×8 y, en 2D,
# comprueba el resaltado del dibujo. Sin errores en consola ni scroll horizontal.
# Capturas en docs/capturas/aprender-*.jpg.
import asyncio, json, os
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(RAIZ, 'dist/index.html')
OUT = os.path.join(RAIZ, 'docs/capturas')
CONFIGS = [
    ('escritorio', dict(viewport={'width': 1280, 'height': 900}, color_scheme='light')),
    ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme='dark')),
]
CASOS = [('3x3', 'principiantes'), ('3x3', 'cfop'), ('2x2', 'principiantes'), ('2x2', 'ortega'), ('4x4', 'cfop'),
         ('5x5', 'cfop'), ('Pyraminx', 'principiantes'), ('Skewb', 'principiantes'), ('Square-1', 'principiantes')]
SIN_RESALTE = {'Square-1'}  # su estado no es una lista de pegatinas: no se resaltan piezas

ESTADO = """() => {
  const v = window.cuboSolver.vista3D('editor');
  const exp = document.getElementById('explicacion');
  const act = exp.querySelector('li.actual');
  return {
    paso: document.getElementById('paso').textContent,
    resaltadas: v && v.escena.resaltado ? v.escena.resaltado.indices.length : 0,
    etapa: exp.querySelector('h3') ? exp.querySelector('h3').textContent : '',
    actual: act ? act.textContent : null,
    resumen: document.getElementById('sol-resumen').textContent,
    scroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
}"""

async def main():
    os.makedirs(OUT, exist_ok=True)
    errores, resumen = [], {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'),
                                    args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for cfg, opts in CONFIGS:
            ctx = await b.new_context(**opts)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, c=cfg: errores.append(f'{c}: {e}'))
            pg.on('console', lambda m, c=cfg: errores.append(f'{c}: {m.text}') if m.type == 'error' else None)
            await pg.goto(URL)
            await pg.wait_for_function("document.getElementById('scramble').textContent.length > 0 && !document.getElementById('scramble').classList.contains('generando')")
            for puzzle, metodo in CASOS:
                clave = f'{cfg}/{puzzle}/{metodo}'
                await pg.locator('#selector .chip', has_text=puzzle).first.click()
                await pg.wait_for_function("!document.getElementById('scramble').classList.contains('generando') && !document.getElementById('cargar').disabled")
                await pg.select_option('#sel-metodo', metodo)
                await pg.click('#cargar')
                # solución en 3D
                await pg.evaluate("() => { const b = document.querySelector('#modo-editor button[data-modo=\"3d\"]'); if (b) b.click(); }")
                await pg.click('#resolver')
                await pg.wait_for_function("!document.getElementById('solucion').hidden || document.querySelector('.mensaje.error')", timeout=60000)
                n = await pg.evaluate("document.querySelectorAll('#movs li').length")
                fallos, con = [], 0
                # paso a paso (sin esperar a que acabe cada animación: el resaltado debe estar siempre)
                for i in range(n):
                    await pg.click('#r-adelante')
                    await pg.wait_for_function(f"(t => t.includes('Paso {i + 1}/') || t.includes('Resuelto'))(document.getElementById('paso').textContent)")
                    d = await pg.evaluate(ESTADO)
                    if d['scroll']: fallos.append(f'scroll horizontal en el paso {i + 1}')
                    if d['resaltadas'] > 0: con += 1
                    if i == n // 3:
                        await pg.wait_for_timeout(600)
                        await pg.locator('#panel-resolver').screenshot(path=f'{OUT}/aprender-{cfg}-{puzzle}-{metodo}.jpg', quality=70, type='jpeg')
                d = await pg.evaluate(ESTADO)
                if 'Resuelto' not in d['paso']: fallos.append('no llega a "Resuelto"')
                # de nuevo, entera a ×8
                await pg.click('#r-inicio')
                while (await pg.inner_text('#r-velocidad')) != '×8':
                    await pg.click('#r-velocidad')
                await pg.click('#r-play')
                await pg.wait_for_function("document.getElementById('paso').textContent.includes('Resuelto')", timeout=120000)
                # 2D: el dibujo resalta las piezas del paso
                await pg.click('#r-inicio')
                await pg.evaluate("() => document.querySelector('#modo-editor button[data-modo=\"2d\"]').click()")
                await pg.click('#r-adelante'); await pg.click('#r-adelante')
                en2d = await pg.evaluate("document.querySelectorAll('#vista-editor polygon.resaltada').length")
                await pg.evaluate("() => document.querySelector('#modo-editor button[data-modo=\"3d\"]').click()")
                while (await pg.inner_text('#r-velocidad')) != '×1':
                    await pg.click('#r-velocidad')
                resumen[clave] = {'pasos': n, 'pasosConResalte3D': con, 'resaltadas2D': en2d, 'resumen': d['resumen'], 'fallos': fallos}
                print(clave, json.dumps(resumen[clave], ensure_ascii=False))
            await ctx.close()
        await b.close()
    resumen['erroresConsola'] = errores
    with open(os.path.join(OUT, 'aprender.json'), 'w') as f:
        json.dump(resumen, f, ensure_ascii=False, indent=2)
    print('errores de consola:', errores)

asyncio.run(main())
