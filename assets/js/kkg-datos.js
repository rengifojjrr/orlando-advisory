/* ==========================================================================
   Kingdom Key Group — datos publicados desde el panel de Tahis (Supabase)
   --------------------------------------------------------------------------
   Lectura pública (sin iniciar sesión) de propiedades y testimonios.
   Si no hay conexión o todavía no hay nada publicado, las funciones devuelven
   [] / null y cada página sigue mostrando sus ejemplos ilustrativos.

   Fotos: cada foto se guarda en el depósito "kkg-fotos" en dos tamaños:
     <path>-1600.jpg  (galería / portada grande)
     <path>-800.jpg   (tarjetas y miniaturas)
   y en la propiedad se guarda sólo { path, alt } en el arreglo "fotos".
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    url: 'https://vajbsfgojtunamhrzrpf.supabase.co',
    // Clave publicable (pública por diseño; los permisos los controla la base de datos)
    key: 'sb_publishable_Xljd7Ep1GxBXSPp5F4A1hg_Qg-iESzl',
    bucket: 'kkg-fotos',
    tiempoMaximo: 6000
  };

  var TIPOS = {
    casa: 'Casa unifamiliar', townhome: 'Townhome', condominio: 'Condominio',
    multifamiliar: 'Multifamiliar', terreno: 'Terreno', comercial: 'Propiedad comercial'
  };
  var ESTADOS = {
    borrador: 'Borrador', publicada: 'En venta', bajo_contrato: 'Bajo contrato', vendida: 'Vendida'
  };
  var CATEGORIAS = {
    compra: 'Compra', venta: 'Venta', inversion: 'Inversión', mudanza: 'Mudanza',
    'primera-vivienda': 'Primera vivienda', 'nueva-construccion': 'Nueva construcción', comercial: 'Comercial'
  };
  var ZONAS = {
    orlando: 'Orlando', 'lake-nona': 'Lake Nona', 'winter-park': 'Winter Park', 'winter-garden': 'Winter Garden',
    windermere: 'Windermere', apopka: 'Apopka', 'altamonte-springs': 'Altamonte Springs', longwood: 'Longwood',
    'mount-dora': 'Mount Dora', eustis: 'Eustis', leesburg: 'Leesburg', clermont: 'Clermont',
    kissimmee: 'Kissimmee', sanford: 'Sanford', 'dr-phillips': 'Dr. Phillips', ocoee: 'Ocoee', 'otra-zona': 'Florida Central'
  };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function precio(n) {
    if (n == null || n === '' || isNaN(n)) return 'Consultar precio';
    return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  function numero(n, dec) {
    if (n == null || n === '' || isNaN(n)) return '';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: dec || 0 });
  }
  function urlFoto(path, tamano) {
    if (!path) return '';
    if (/^https?:\/\//.test(path)) return path;
    var sufijo = tamano === 'mini' ? '-800.jpg' : '-1600.jpg';
    return CONFIG.url + '/storage/v1/object/public/' + CONFIG.bucket + '/' + String(path).split('/').map(encodeURIComponent).join('/') + sufijo;
  }
  function portada(p, tamano) {
    var f = p && Array.isArray(p.fotos) && p.fotos[0];
    return f ? urlFoto(f.path, tamano || 'mini') : 'assets/img/sin-foto.webp';
  }
  function rutaPropiedad(p) { return 'propiedad.html?id=' + encodeURIComponent(p.slug); }
  function nombreZona(slug, ciudad) { return ZONAS[slug] || ciudad || 'Florida Central'; }
  function ubicacion(p) {
    var partes = [];
    if (p.ciudad) partes.push(p.ciudad); else if (p.zona) partes.push(nombreZona(p.zona));
    partes.push('FL');
    return partes.join(', ');
  }

  var cache = {};
  function consulta(ruta) {
    if (cache[ruta]) return cache[ruta];
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, CONFIG.tiempoMaximo) : null;
    var pr = fetch(CONFIG.url + '/rest/v1/' + ruta, {
      headers: { apikey: CONFIG.key, Accept: 'application/json' },
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (e) {
      if (window.console) console.warn('[KKG] No se pudieron leer los datos publicados:', e.message || e);
      delete cache[ruta];
      return null;
    }).finally(function () { if (t) clearTimeout(t); });
    cache[ruta] = pr;
    return pr;
  }

  /* Propiedades visibles al público (no borradores).
     opciones: { limite, destacadas: true (primero las destacadas), soloDisponibles: true (oculta vendidas) } */
  function propiedades(opciones) {
    opciones = opciones || {};
    var q = 'kkg_propiedades?select=*&estado=' + (opciones.soloDisponibles ? 'in.(publicada,bajo_contrato)' : 'neq.borrador') +
      '&order=destacada.desc,orden.asc,publicado_en.desc.nullslast';
    if (opciones.limite) q += '&limit=' + Number(opciones.limite);
    return consulta(q).then(function (d) { return Array.isArray(d) ? d : []; });
  }
  function propiedad(slug) {
    if (!slug) return Promise.resolve(null);
    return consulta('kkg_propiedades?select=*&estado=neq.borrador&slug=eq.' + encodeURIComponent(slug) + '&limit=1')
      .then(function (d) { return Array.isArray(d) && d[0] ? d[0] : null; });
  }
  function testimonios(opciones) {
    opciones = opciones || {};
    var q = 'kkg_testimonios?select=*&publicado=eq.true&order=orden.asc,fecha.desc.nullslast,creado_en.desc';
    if (opciones.limite) q += '&limit=' + Number(opciones.limite);
    return consulta(q).then(function (d) { return Array.isArray(d) ? d : []; });
  }

  window.KKG = {
    CONFIG: CONFIG, TIPOS: TIPOS, ESTADOS: ESTADOS, CATEGORIAS: CATEGORIAS, ZONAS: ZONAS,
    esc: esc, precio: precio, numero: numero, urlFoto: urlFoto, portada: portada,
    rutaPropiedad: rutaPropiedad, nombreZona: nombreZona, ubicacion: ubicacion,
    propiedades: propiedades, propiedad: propiedad, testimonios: testimonios
  };
})();
