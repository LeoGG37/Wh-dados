// Service worker de las herramientas Aeldari.
//
// ESTRATEGIA: primero la red, la caché como respaldo.
//
// La versión anterior hacía lo contrario (caché primero) y daba un problema
// serio: una vez guardada una herramienta, el navegador servía esa copia para
// siempre. Subías una corrección a GitHub, abrías la herramienta en el iPad y
// seguías viendo la versión vieja sin ninguna señal de que algo iba mal.
//
// Ahora, con conexión siempre ves lo último y la caché se actualiza sola. Sin
// conexión tiras de lo último que se guardó.

// Subir este número obliga a tirar la caché anterior. Hay que hacerlo SIEMPRE
// que se añada o se borre una herramienta, y también cuando se corrija una que
// ya está en la lista: si no, los dispositivos que ya la tengan guardada pueden
// seguir sirviendo la copia vieja sin avisar.
//
// v9  → los lanzadores se movieron a su subcarpeta (las rutas viejas de la raíz
//       seguían guardadas).
// v10 → limpieza del 03/11/2026: se borraron cuatro herramientas de la lista.
// v11 → correcciones de reglas del v6 del 04/11/2026 (el 6 al herir, el daño
//       guardado en el historial y los golpes sostenidos X).
// v12 → el panel de arma nueva del v6 pierde la pregunta de quién la lleva y
//       el contador de miniaturas (04/11/2026).
// v13 → el cajón del v6 sale por la derecha y el historial se va a su propia
//       pantalla (04/11/2026).
// v14 → los atributos del arma pasan a una fila de desplegables (04/11/2026).
// v15 → el v6 entiende NdM+K, así que hay daño D3+1, D6+1, D6+2 y D6+3
//       (04/11/2026). Antes «D6+1» se resolvía en silencio como daño 1.
// v16 → pie nuevo en la pantalla de resultado del v6: «Nueva tirada», ⇄ y
//       «Repetir» en vez del antiguo «Editar» (04/11/2026).
// v17 → habilidades de arma en el v6: las 6 fijas en el arma y las 8
//       situacionales en «Reglas especiales» (04/11/2026).
// v18 → el panel del atacante del v6 se queda solo con lo de la tirada: fuera
//       el perfil del arma, y modF/modFP/modD en su lugar (04/11/2026).
// v19 → «Según el momento» plegado y el panel conserva el scroll al repintar
//       (04/11/2026).
// v20 → el panel del defensor, igual que el del atacante: fuera el perfil, el
//       «no hay dolor» pasa a la unidad y hay modR/modSalv (04/11/2026).
// v21 → «Deshacer» para el aplicar bajas del v6, que era la única acción que
//       escribía en el ejército sin vuelta atrás (04/11/2026).
// v22 → «Levantar N miniaturas» en la pantalla del ejército, para empezar
//       otra partida (04/11/2026).
// v23 → el v6 deja de leer `w40k_sync` al arrancar (un mensaje huérfano del
//       rastreador le cambiaba el atacante) y se borra código muerto.
// v24 → «⧉ Duplicar» en la ficha de la unidad del v6 (07/11/2026).
// v25 → pantalla de copia de seguridad del v6: descargar, copiar y restaurar
//       los ejércitos, que hasta ahora vivían sin ninguna copia (07/11/2026).
const CACHE = 'w40k-aeldari-v25';

const ARCHIVOS = [
  './', './index.html',
  './datos_unidades.js',
  './fichas_unidades.html',
  './chuleta_destacamentos.html',
  // Los lanzadores viven en su propia subcarpeta desde el 30/10/2026.
  // El espacio del nombre se codifica solo al construir la petición.
  // Solo se precachea el v6, que es el que enlaza el índice. El v2, el v3,
  // el v4 y el v5 se quedan en la carpeta como referencia, sin PWA offline.
  './Lanzador de dados/lanzador_dados_v6.html',
];

// Se guarda archivo a archivo en vez de con addAll: así, si uno todavía no
// está subido, el service worker se instala igual en lugar de fallar entero.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(ARCHIVOS.map(f => c.add(f))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // Solo lecturas de este mismo sitio. Lo demás pasa de largo sin tocarse.
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      // Solo se guarda lo que de verdad existe: así un 404 no acaba
      // enmascarado por una copia en caché.
      if (res && res.ok) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // Sin conexión: lo último que se guardó.
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      // Si se pedía una página y no está, se abre el índice.
      if (req.mode === 'navigate') {
        const inicio = await caches.match('./index.html') || await caches.match('./');
        if (inicio) return inicio;
      }
      throw err;
    }
  })());
});
