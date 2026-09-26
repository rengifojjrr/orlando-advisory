/* ==========================================================================
   Kingdom Key Group — Tahis Alvarez, Realtor® — lógica compartida del sitio
   --------------------------------------------------------------------------
   1) DATOS DE CONTACTO: se editan aquí y se actualizan en todas las páginas
      (elementos con data-dato="..." y enlaces con data-enlace="...").
   2) Rutas: traduce los data-path del diseño de Stitch a archivos .html.
   3) Menú móvil, formularios (-> gracias.html) y enlaces de contacto.
   ========================================================================== */
var SITIO = {
  nombre: 'Tahis Alvarez',
  inmobiliaria: 'Kingdom Key Group LLC',
  telefono: '+1 (786) 177-1828',
  email: 'alvareztahis39realtor@gmail.com',
  whatsapp: '17861771828',   // solo dígitos con código de país (para el enlace wa.me)
  whatsappVisible: '+1 (786) 177-1828',  // cómo se muestra el número de WhatsApp
  biografia: '',             // opcional: reemplaza el texto marcado con data-dato="biografia"
  // Opcional: URL de un servicio de formularios (Formspree, Getform, etc.) para
  // recibir las solicitudes también por correo. Si se deja vacío, la página de
  // confirmación ofrece enviarlas por WhatsApp o correo con un clic.
  formEndpoint: ''
};

(function () {
  'use strict';

  var RUTAS = {
    '': 'index.html',
    'inicio': 'index.html',
    'propiedades': 'propiedades.html',
    'propiedades/demo-p01': 'propiedad-demo-p01.html',
    'propiedades/demo-p02': 'propiedad-demo-p02.html',
    'propiedades/demo-p03': 'propiedad-demo-p03.html',
    'comprar': 'comprar.html',
    'nuevas-construcciones': 'nuevas-construcciones.html',
    'nuevas-construcciones/demo-c01': 'comunidad-demo-c01.html',
    'nuevas-construcciones/demo-c02': 'comunidad-demo-c02.html',
    'mudarse-a-orlando': 'mudarse-a-orlando.html',
    'invertir': 'invertir.html',
    'vender': 'vender.html',
    'zonas': 'zonas.html',
    'zonas/lake-nona': 'zona-lake-nona.html',
    'zonas/winter-park': 'zona-winter-park.html',
    'zonas/winter-garden': 'zona-winter-garden.html',
    'zonas/windermere': 'zona-windermere.html',
    'sobre-mi': 'sobre-mi.html',
    'recursos': 'recursos.html',
    'recursos/checklist-mudanza-orlando': 'checklist-mudanza-orlando.html',
    'recursos/preparar-compra': 'comprar.html',
    'recursos/preparar-venta': 'vender.html',
    'preguntas-frecuentes': 'preguntas-frecuentes.html',
    'testimonios': 'testimonios.html',
    'contacto': 'contacto.html',
    'agendar': 'agendar.html',
    'agendar-asesoria': 'agendar.html',
    'solicitar-estimacion': 'solicitar-estimacion.html',
    'gracias': 'gracias.html',
    'privacidad': 'legal.html#privacidad',
    'terminos': 'legal.html#terminos',
    'legal': 'legal.html',
    '404': '404.html'
  };

  /* Convierte un data-path de Stitch ("contacto?interes=compra") en href real. */
  function ruta(path) {
    path = String(path == null ? '' : path).trim().replace(/^#?\/?/, '');
    var hash = '', query = '';
    var h = path.indexOf('#'); if (h > -1) { hash = path.slice(h); path = path.slice(0, h); }
    var q = path.indexOf('?'); if (q > -1) { query = path.slice(q); path = path.slice(0, q); }
    path = path.replace(/\/+$/, '');
    var destino = RUTAS.hasOwnProperty(path) ? RUTAS[path] : (/\.html$/.test(path) ? path : '404.html');
    var dh = destino.indexOf('#');
    if (dh > -1) { if (!hash) hash = destino.slice(dh); destino = destino.slice(0, dh); }
    return destino + query + hash;
  }

  function ir(path) { window.location.href = ruta(path); }

  /* Parámetros de la URL actual (?interes=compra&origen=...). */
  function params() {
    var out = {};
    new URLSearchParams(window.location.search).forEach(function (v, k) { out[k] = v; });
    return out;
  }

  function lleno(v) { return typeof v === 'string' && v.trim() !== ''; }
  function soloDigitos(v) { return String(v || '').replace(/[^\d]/g, ''); }

  function enlaceWhatsApp(mensaje) {
    var num = soloDigitos(SITIO.whatsapp);
    var base = num ? 'https://wa.me/' + num : 'https://wa.me/';
    return mensaje ? base + '?text=' + encodeURIComponent(mensaje) : base;
  }

  /* mailto: con asunto y cuerpo (el correo es el segundo canal preferido). */
  function enlaceCorreo(asunto, cuerpo) {
    var q = [];
    if (asunto) q.push('subject=' + encodeURIComponent(asunto));
    if (cuerpo) q.push('body=' + encodeURIComponent(cuerpo));
    return 'mailto:' + String(SITIO.email || '').trim() + (q.length ? '?' + q.join('&') : '');
  }

  /* ---- Datos de contacto: [data-dato] y [data-enlace] ------------------- */
  function aplicarDatos(raiz) {
    raiz = raiz || document;
    raiz.querySelectorAll('[data-dato]').forEach(function (el) {
      var k = el.getAttribute('data-dato');
      var v = (k === 'whatsapp' && lleno(SITIO.whatsappVisible)) ? SITIO.whatsappVisible : SITIO[k];
      if (lleno(v)) el.textContent = v;
    });
    raiz.querySelectorAll('[data-enlace]').forEach(function (el) {
      var tipo = el.getAttribute('data-enlace');
      if (tipo === 'telefono' && lleno(SITIO.telefono)) el.setAttribute('href', 'tel:' + SITIO.telefono.replace(/[^\d+]/g, ''));
      else if (tipo === 'email' && lleno(SITIO.email)) el.setAttribute('href', 'mailto:' + SITIO.email.trim());
      else if (tipo === 'whatsapp' && lleno(SITIO.whatsapp)) {
        el.setAttribute('href', enlaceWhatsApp(el.getAttribute('data-mensaje') || 'Hola, me gustaría recibir asesoría inmobiliaria en Orlando.'));
        el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener');
      }
    });
  }

  /* ---- Rutas: todo elemento con data-path recibe su href real ----------- */
  function sincronizarRutas(raiz) {
    (raiz || document).querySelectorAll('[data-path]').forEach(function (el) {
      if (el.tagName === 'A') el.setAttribute('href', ruta(el.getAttribute('data-path')));
    });
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-path]');
    if (!el || el.tagName === 'A' || el.tagName === 'FORM') return;
    if (el.tagName === 'BUTTON' && el.type === 'submit' && el.form) return;
    e.preventDefault();
    ir(el.getAttribute('data-path'));
  });

  /* ---- Menú móvil -------------------------------------------------------- */
  function iniciarMenu() {
    var menu = document.getElementById('menu-movil');
    if (!menu) return;
    var panel = menu.querySelector('[data-menu-panel]');
    var fondo = menu.querySelector('[data-menu-fondo]');
    var abridores = document.querySelectorAll('[data-menu-abrir]');
    var ultimoFoco = null, cierre = null;

    function abrir() {
      clearTimeout(cierre);
      ultimoFoco = document.activeElement;
      menu.classList.remove('invisible');
      menu.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('menu-abierto');
      abridores.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      requestAnimationFrame(function () {
        fondo.classList.remove('opacity-0');
        panel.classList.remove('translate-x-full');
      });
      var btn = menu.querySelector('[data-menu-cerrar]:not([data-menu-fondo])');
      if (btn) setTimeout(function () { btn.focus(); }, 60);
    }
    function cerrar() {
      fondo.classList.add('opacity-0');
      panel.classList.add('translate-x-full');
      menu.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('menu-abierto');
      abridores.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      cierre = setTimeout(function () { menu.classList.add('invisible'); }, 300);
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }
    abridores.forEach(function (b) { b.addEventListener('click', abrir); });
    menu.querySelectorAll('[data-menu-cerrar]').forEach(function (b) { b.addEventListener('click', cerrar); });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { if (!a.hasAttribute('target')) cerrar(); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.getAttribute('aria-hidden') === 'false') cerrar(); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1280 && menu.getAttribute('aria-hidden') === 'false') cerrar(); });
  }

  /* ---- Formularios --------------------------------------------------------
     OA.enviar(form, tipo, extra): valida, envía (si hay formEndpoint), guarda
     un resumen para gracias.html y redirige a gracias.html?tipo=<tipo>.
     tipo: consulta | valoracion | asesoria | visita | guia                  */
  function datosDe(form) {
    var d = {};
    if (!form) return d;
    new FormData(form).forEach(function (v, k) {
      if (typeof v !== 'string') return;
      d[k] = d[k] ? d[k] + ', ' + v : v;
    });
    return d;
  }

  function enviar(form, tipo, extra) {
    if (form && typeof form.reportValidity === 'function' && !form.reportValidity()) return false;
    var datos = Object.assign({}, params(), datosDe(form), extra || {});
    var registro = { tipo: tipo || 'consulta', datos: datos, fecha: new Date().toISOString(), pagina: location.pathname.split('/').pop() || 'index.html' };
    try { sessionStorage.setItem('oa_solicitud', JSON.stringify(registro)); } catch (e) {}
    var destino = ruta('gracias?tipo=' + encodeURIComponent(registro.tipo));
    var boton = form && form.querySelector('[type="submit"]');
    if (boton) { boton.disabled = true; boton.setAttribute('aria-busy', 'true'); }
    if (lleno(SITIO.formEndpoint)) {
      var fd = new FormData();
      Object.keys(datos).forEach(function (k) { fd.append(k, datos[k]); });
      fd.append('_tipo', registro.tipo);
      fetch(SITIO.formEndpoint, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } })
        .catch(function () {})
        .then(function () { window.location.href = destino; });
    } else {
      window.location.href = destino;
    }
    return false;
  }

  function ultimaSolicitud() {
    try { return JSON.parse(sessionStorage.getItem('oa_solicitud') || 'null'); } catch (e) { return null; }
  }

  /* Rellena campos de un formulario con los parámetros de la URL
     (?interes=compra&zona=lake-nona ...). mapa: { parametro: 'name-del-campo' } */
  function precargar(form, mapa) {
    if (!form) return;
    var p = params();
    Object.keys(mapa || {}).forEach(function (k) {
      if (!p[k]) return;
      var campo = form.elements[mapa[k]];
      if (!campo) return;
      if (campo.length && !campo.tagName) {
        Array.prototype.forEach.call(campo, function (c) { if (c.value === p[k]) c.checked = true; });
      } else if (campo.tagName === 'SELECT') {
        Array.prototype.forEach.call(campo.options, function (o) { if (o.value === p[k] || o.text === p[k]) campo.value = o.value; });
      } else {
        campo.value = p[k];
      }
    });
  }

  window.OA = {
    SITIO: SITIO, ruta: ruta, ir: ir, params: params, enviar: enviar,
    ultimaSolicitud: ultimaSolicitud, precargar: precargar,
    enlaceWhatsApp: enlaceWhatsApp, enlaceCorreo: enlaceCorreo, aplicarDatos: aplicarDatos,
    envioAutomatico: function () { return lleno(SITIO.formEndpoint); }
  };

  function iniciar() {
    document.querySelectorAll('[data-anio]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
    sincronizarRutas();
    aplicarDatos();
    iniciarMenu();
    if ('MutationObserver' in window) {
      new MutationObserver(function (ms) {
        ms.forEach(function (m) {
          if (m.type === 'attributes' && m.target.tagName === 'A') m.target.setAttribute('href', ruta(m.target.getAttribute('data-path')));
          if (m.type === 'childList') m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { sincronizarRutas(n); if (n.matches && n.matches('a[data-path]')) n.setAttribute('href', ruta(n.getAttribute('data-path'))); aplicarDatos(n); } });
        });
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-path'] });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
