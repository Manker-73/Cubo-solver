// Tema de la página: oscuro por defecto (aunque el sistema esté en claro) y claro con el
// botón de la cabecera. La elección se guarda en el navegador (localStorage, dentro de
// try/catch: si no se puede, el tema dura lo que dure la página). Los colores están en
// estilos.css (:root y :root[data-theme="light"]); los de las pegatinas no cambian.

export const CLAVE_TEMA = 'cubo-solver:tema';
const META = { oscuro: '#0f1218', claro: '#f4f6fa' };

export function crearTema({ boton, texto, raiz = () => document.documentElement } = {}) {
  let actual = 'oscuro';

  function pintar() {
    const r = raiz();
    r.dataset.theme = actual === 'claro' ? 'light' : 'dark';
    const otro = actual === 'claro' ? 'oscuro' : 'claro';
    const b = boton && boton();
    if (b) {
      b.setAttribute('aria-label', `Cambiar a modo ${otro}`);
      b.title = `Cambiar a modo ${otro}`;
      b.dataset.tema = actual;
    }
    const t = texto && texto();
    if (t) t.textContent = `Modo ${otro}`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', META[actual]);
  }

  function fijar(t, { guardar = true } = {}) {
    actual = t === 'claro' ? 'claro' : 'oscuro';
    if (guardar) try { localStorage.setItem(CLAVE_TEMA, actual); } catch { /* sin almacenamiento: solo esta sesión */ }
    pintar();
    if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new window.Event('cambio-tema'));
  }

  return {
    iniciar() {
      let guardado = null;
      try { guardado = localStorage.getItem(CLAVE_TEMA); } catch { /* sin almacenamiento */ }
      actual = guardado === 'claro' ? 'claro' : 'oscuro';
      pintar();
      const b = boton && boton();
      if (b) b.addEventListener('click', () => fijar(actual === 'claro' ? 'oscuro' : 'claro'));
    },
    fijar,
    actual: () => actual,
  };
}
