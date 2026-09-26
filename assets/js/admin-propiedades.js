/* ==========================================================================
   Panel KKG — Propiedades: lista (filtros, búsqueda, cambio rápido de estado,
   eliminar) y editor completo. Las fotos se manejan en admin-fotos.js.
   ========================================================================== */
(function () {
  'use strict';

  var P = window.KKGPanel;
  var $ = P.$, $$ = P.$$, esc = KKG.esc;
  var TABLA = 'kkg_propiedades';

  var S = { lista: [], cargada: false, cargando: false, filtro: 'todas', busqueda: '' };
  var ed = null; // edición en curso

  var CHIP_ESTADO = {
    borrador: 'bg-surface-container-highest text-on-surface-variant',
    publicada: 'bg-[#e3efe6] text-[#1d5b3a]',
    bajo_contrato: 'bg-secondary-container text-on-secondary-container',
    vendida: 'bg-primary text-on-primary'
  };
  var FILTROS = [['todas', 'Todas'], ['borrador', 'Borradores'], ['publicada', 'En venta'], ['bajo_contrato', 'Bajo contrato'], ['vendida', 'Vendidas']];

  var CARACT_COMUNES = ['Piscina', 'Frente al lago', 'Vista al agua', 'Garaje', 'Patio cercado', 'Lanai / terraza cubierta',
    'Cocina renovada', 'Suite principal en planta baja', 'Oficina', 'Sin HOA', 'Comunidad cerrada', 'Casa club',
    'Cerca de escuelas', 'Techo nuevo', 'Aire acondicionado nuevo', 'Paneles solares', 'Apta para mascotas', 'Amueblada', 'Uso comercial'];

  function buscar(id) { for (var i = 0; i < S.lista.length; i++) if (S.lista[i].id === id) return S.lista[i]; return null; }
  function reemplazar(fila) {
    for (var i = 0; i < S.lista.length; i++) if (S.lista[i].id === fila.id) { S.lista[i] = fila; return; }
    S.lista.unshift(fila);
  }
  function ordenar() {
    S.lista.sort(function (a, b) {
      if (!!b.destacada !== !!a.destacada) return b.destacada ? 1 : -1;
      if ((a.orden || 0) !== (b.orden || 0)) return (a.orden || 0) - (b.orden || 0);
      return String(b.actualizado_en || '').localeCompare(String(a.actualizado_en || ''));
    });
  }

  /* ---------------------------------------------------------------- carga */
  function cargar() {
    if (S.cargando) return Promise.resolve();
    S.cargando = true;
    pintarEsqueleto();
    return P.sb.from(TABLA).select('*')
      .order('destacada', { ascending: false }).order('orden', { ascending: true }).order('actualizado_en', { ascending: false })
      .then(function (r) {
        if (r.error) throw r.error;
        S.lista = Array.isArray(r.data) ? r.data : [];
        S.cargada = true;
        P.ocultarAvisoError();
      })
      .catch(function (e) {
        P.avisoError('No se pudieron cargar las propiedades. ' + P.traducirError(e), function () { cargar(); });
      })
      .then(function () { S.cargando = false; pintarLista(); });
  }

  function pintarEsqueleto() {
    var lista = $('[data-prop-lista]');
    lista.setAttribute('aria-busy', 'true');
    var una = '<div aria-hidden="true" class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm animate-pulse"><div class="aspect-[4/3] bg-surface-container"></div><div class="p-space-md flex flex-col gap-space-sm"><div class="h-5 w-3/4 rounded bg-surface-container"></div><div class="h-4 w-1/3 rounded bg-surface-container"></div><div class="h-11 rounded-lg bg-surface-container-low"></div></div></div>';
    lista.innerHTML = una + una + una;
    $('[data-prop-vacio]').hidden = true;
    $('[data-prop-sin-resultados]').hidden = true;
    $('[data-prop-conteo]').textContent = 'Cargando…';
  }

  /* ---------------------------------------------------------------- lista */
  function coincide(p) {
    if (S.filtro !== 'todas' && p.estado !== S.filtro) return false;
    var q = P.normalizar(S.busqueda).trim();
    if (!q) return true;
    var texto = P.normalizar([p.titulo, p.ciudad, p.direccion, p.mls, p.codigo_postal, KKG.ZONAS[p.zona], KKG.TIPOS[p.tipo]].join(' '));
    return q.split(/\s+/).every(function (t) { return texto.indexOf(t) > -1; });
  }

  function pintarFiltros() {
    var cuentas = { todas: S.lista.length };
    S.lista.forEach(function (p) { cuentas[p.estado] = (cuentas[p.estado] || 0) + 1; });
    $('[data-prop-filtros]').innerHTML = FILTROS.map(function (f) {
      return '<button aria-pressed="' + (S.filtro === f[0]) + '" class="shrink-0 inline-flex items-center gap-space-xs h-10 px-space-md rounded-full border font-label-md text-label-md transition-colors border-outline-variant text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-high aria-pressed:bg-primary aria-pressed:text-on-primary aria-pressed:border-primary" data-filtro="' + f[0] + '" type="button">' +
        f[1] + ' <span class="tabular-nums opacity-70">' + (cuentas[f[0]] || 0) + '</span></button>';
    }).join('');
  }

  function opcionesEstado(actual) {
    return Object.keys(KKG.ESTADOS).map(function (k) {
      return '<option value="' + k + '"' + (k === actual ? ' selected' : '') + '>' + esc(KKG.ESTADOS[k]) + '</option>';
    }).join('');
  }

  function tarjeta(p) {
    var id = esc(p.id), titulo = esc(p.titulo || 'Sin título');
    var fotos = Array.isArray(p.fotos) ? p.fotos : [];
    var borrador = p.estado === 'borrador';
    var img = fotos[0] && fotos[0].path ? '<img alt="" class="absolute inset-0 w-full h-full object-cover" data-foto-lista="" decoding="async" loading="lazy" src="' + esc(KKG.urlFoto(fotos[0].path, 'mini')) + '"/>' : '';
    var ubic = [p.ciudad || (p.zona ? KKG.nombreZona(p.zona) : ''), KKG.TIPOS[p.tipo] || ''].filter(Boolean).map(esc).join(' · ');
    var ver = borrador
      ? '<button aria-label="Ver en la web: no disponible para borradores" class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg border border-outline-variant text-outline opacity-50 cursor-not-allowed" disabled="" title="Los borradores no se ven en la web. Cambia el estado a “En venta” para publicarla." type="button"><span aria-hidden="true" class="material-symbols-outlined text-xl">open_in_new</span></button>'
      : '<a aria-label="Ver «' + titulo + '» en la web (se abre en otra pestaña)" class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg border border-outline-variant text-primary hover:bg-surface-container-high transition-colors" href="' + esc(KKG.rutaPropiedad(p)) + '" rel="noopener" target="_blank" title="Ver en la web"><span aria-hidden="true" class="material-symbols-outlined text-xl">open_in_new</span></a>';
    return '<article class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm flex flex-col" data-prop-id="' + id + '">' +
      '<div class="relative aspect-[4/3] bg-surface-container">' +
        '<span aria-hidden="true" class="absolute inset-0 flex flex-col items-center justify-center gap-1 text-outline"><span class="material-symbols-outlined text-4xl">image</span><span class="font-body-sm text-body-sm">' + (fotos.length ? 'Foto no disponible' : 'Sin fotos') + '</span></span>' + img +
        '<span class="absolute top-2 left-2 inline-flex items-center h-7 px-2.5 rounded-full font-label-md text-[0.75rem] leading-none shadow-sm ' + (CHIP_ESTADO[p.estado] || CHIP_ESTADO.borrador) + '">' + esc(KKG.ESTADOS[p.estado] || p.estado) + '</span>' +
        (p.destacada ? '<span class="absolute top-2 right-2 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-surface-container-lowest/95 text-secondary font-label-md text-[0.75rem] leading-none shadow-sm"><span aria-hidden="true" class="material-symbols-outlined icono-lleno text-base">star</span>Destacada</span>' : '') +
        (fotos.length ? '<span class="absolute bottom-2 right-2 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-primary/80 text-on-primary font-label-md text-[0.75rem] leading-none"><span aria-hidden="true" class="material-symbols-outlined text-base">photo_library</span>' + fotos.length + '<span class="sr-only"> fotos</span></span>' : '') +
      '</div>' +
      '<div class="p-space-md flex flex-col gap-1 flex-1">' +
        '<h2 class="font-headline-sm text-headline-sm text-primary line-clamp-2 break-words">' + titulo + '</h2>' +
        '<p class="font-label-lg text-label-lg text-secondary">' + esc(KKG.precio(p.precio)) + '</p>' +
        (ubic ? '<p class="font-body-sm text-body-sm text-on-surface-variant">' + ubic + '</p>' : '') +
        (borrador ? '<p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 mt-1"><span aria-hidden="true" class="material-symbols-outlined text-base">visibility_off</span>Borrador: no se ve en la web</p>' : '') +
      '</div>' +
      '<div class="px-space-md pb-space-md flex flex-col gap-space-sm">' +
        '<div class="relative"><label class="sr-only" for="estado-' + id + '">Estado de «' + titulo + '»</label>' +
          '<select class="w-full h-11 pl-space-md pr-10 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:shadow-[0_0_0_2px_#7b5829] appearance-none cursor-pointer disabled:opacity-60 max-md:text-base" data-estado-rapido="' + id + '" id="estado-' + id + '">' + opcionesEstado(p.estado) + '</select>' +
          '<span aria-hidden="true" class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">expand_more</span></div>' +
        '<div class="flex items-center gap-space-xs">' +
          '<a class="flex-1 inline-flex items-center justify-center gap-space-xs h-11 px-space-md rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors" href="#propiedad/' + encodeURIComponent(p.id) + '"><span aria-hidden="true" class="material-symbols-outlined text-xl">edit</span>Editar<span class="sr-only"> «' + titulo + '»</span></a>' +
          ver +
          '<button aria-label="Eliminar «' + titulo + '»" class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg border border-outline-variant text-error hover:bg-error-container transition-colors" data-eliminar="' + id + '" title="Eliminar" type="button"><span aria-hidden="true" class="material-symbols-outlined text-xl">delete</span></button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function pintarLista() {
    var lista = $('[data-prop-lista]');
    lista.removeAttribute('aria-busy');
    pintarFiltros();
    var n = S.lista.length;
    var enWeb = S.lista.filter(function (p) { return p.estado !== 'borrador'; }).length;
    $('[data-prop-conteo]').textContent = !S.cargada ? 'No se pudieron cargar.' :
      n === 0 ? 'Aún no hay propiedades.' :
      n + (n === 1 ? ' propiedad' : ' propiedades') + ' · ' + enWeb + ' visible' + (enWeb === 1 ? '' : 's') + ' en la web';
    var visibles = S.lista.filter(coincide);
    lista.innerHTML = visibles.map(tarjeta).join('');
    $('[data-prop-vacio]').hidden = !(S.cargada && n === 0);
    $('[data-prop-sin-resultados]').hidden = !(n > 0 && visibles.length === 0);
    // Sin propiedades no tiene sentido mostrar filtros ni buscador.
    $('[data-prop-filtros]').parentNode.hidden = !S.cargada || n === 0;
  }

  /* ---------------------------------------------------------------- acciones de la lista */
  function cambiarEstado(select) {
    var id = select.getAttribute('data-estado-rapido');
    var p = buscar(id);
    if (!p) return;
    var anterior = p.estado, nuevo = select.value;
    if (nuevo === anterior) return;
    select.disabled = true;
    P.sb.from(TABLA).update({ estado: nuevo }).eq('id', id).select().single().then(function (r) {
      if (r.error) throw r.error;
      reemplazar(r.data);
      pintarLista();
      P.mensaje(nuevo === 'borrador' ? 'Guardada como borrador: ya no se ve en la web.' : 'Estado actualizado: ' + KKG.ESTADOS[nuevo] + '.');
      var s = document.getElementById('estado-' + id);
      if (s) s.focus();
    }).catch(function (e) {
      select.value = anterior;
      select.disabled = false;
      P.mensaje('No se pudo cambiar el estado. ' + P.traducirError(e), 'error');
    });
  }

  function eliminar(id) {
    var p = buscar(id);
    if (!p) return;
    var fotos = (Array.isArray(p.fotos) ? p.fotos : []).map(function (f) { return f.path; }).filter(Boolean);
    P.confirmar({
      titulo: '¿Eliminar «' + (p.titulo || 'esta propiedad') + '»?',
      texto: 'Se borrarán la propiedad' + (fotos.length === 1 ? ' y su foto' : fotos.length ? ' y sus ' + fotos.length + ' fotos' : '') + '. Esta acción no se puede deshacer.' +
        (p.estado !== 'borrador' ? ' Si solo quieres quitarla de la web, cambia su estado a “Borrador” o “Vendida”.' : ''),
      si: 'Eliminar', no: 'Cancelar', peligro: true
    }).then(function (ok) {
      if (!ok) return;
      var tarjetaEl = $('[data-prop-id="' + CSS.escape(id) + '"]');
      if (tarjetaEl) tarjetaEl.classList.add('opacity-50', 'pointer-events-none');
      P.Fotos.borrarDelDeposito(fotos).then(function () {
        return P.sb.from(TABLA).delete().eq('id', id);
      }).then(function (r) {
        if (r && r.error) throw r.error;
        S.lista = S.lista.filter(function (x) { return x.id !== id; });
        pintarLista();
        P.mensaje('Propiedad eliminada.');
        var h = $('#titulo-propiedades'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }).catch(function (e) {
        if (tarjetaEl) tarjetaEl.classList.remove('opacity-50', 'pointer-events-none');
        P.mensaje('No se pudo eliminar. ' + P.traducirError(e), 'error');
      });
    });
  }

  function iniciarLista() {
    var vista = $('[data-vista="propiedades"]');
    vista.addEventListener('click', function (e) {
      var f = e.target.closest('[data-filtro]');
      if (f) { S.filtro = f.getAttribute('data-filtro'); pintarLista(); var b = $('[data-filtro="' + S.filtro + '"]'); if (b) b.focus(); return; }
      var d = e.target.closest('[data-eliminar]');
      if (d) { eliminar(d.getAttribute('data-eliminar')); }
    });
    vista.addEventListener('change', function (e) {
      if (e.target.matches('[data-estado-rapido]')) cambiarEstado(e.target);
    });
    var t = null;
    $('#prop-buscar').addEventListener('input', function (e) {
      clearTimeout(t);
      var v = e.target.value;
      t = setTimeout(function () { S.busqueda = v; pintarLista(); }, 150);
    });
    // Si la foto de portada no carga, queda visible el aviso "Foto no disponible".
    document.addEventListener('error', function (e) {
      var img = e.target;
      if (img && img.tagName === 'IMG' && img.hasAttribute('data-foto-lista')) img.hidden = true;
    }, true);
  }

  P.vista('propiedades', {
    mostrar: function () {
      if (!S.cargada && !S.cargando) cargar(); else if (!S.cargando) pintarLista();
    }
  });
  P.propiedades = { recargar: cargar, lista: function () { return S.lista; } };

  /* ---------------------------------------------------------------- editor: campos */
  // [id del campo, columna, clase de dato, etiqueta, límites]
  var CAMPOS = [
    ['p-titulo', 'titulo', 'texto', 'Título', { min: 3, max: 140 }],
    ['p-tipo', 'tipo', 'opcion', 'Tipo de propiedad'],
    ['p-estado', 'estado', 'opcion', 'Estado'],
    ['p-precio', 'precio', 'dinero', 'Precio'],
    ['p-direccion', 'direccion', 'texto', 'Dirección', { max: 200 }],
    ['p-ciudad', 'ciudad', 'texto', 'Ciudad', { max: 80 }],
    ['p-zona', 'zona', 'opcion', 'Zona'],
    ['p-condado', 'condado', 'opcion', 'Condado'],
    ['p-cp', 'codigo_postal', 'cp', 'Código postal'],
    ['p-habitaciones', 'habitaciones', 'entero', 'Habitaciones', { min: 0, max: 99 }],
    ['p-banos', 'banos', 'decimal', 'Baños', { min: 0, max: 99 }],
    ['p-superficie', 'superficie_sqft', 'entero', 'Superficie', { min: 0, max: 10000000 }],
    ['p-terreno', 'terreno_sqft', 'entero', 'Terreno', { min: 0, max: 100000000 }],
    ['p-anio', 'anio_construccion', 'entero', 'Año de construcción', { min: 1800, max: 2100 }],
    ['p-estacionamientos', 'estacionamientos', 'entero', 'Estacionamientos', { min: 0, max: 999 }],
    ['p-hoa', 'hoa_mensual', 'dinero', 'HOA mensual'],
    ['p-cdd', 'cdd_anual', 'dinero', 'CDD anual'],
    ['p-impuestos', 'impuestos_anuales', 'dinero', 'Impuestos anuales'],
    ['p-mls', 'mls', 'texto', 'MLS #', { max: 40 }],
    ['p-descripcion', 'descripcion', 'largo', 'Descripción', { max: 8000 }],
    ['p-constructora', 'constructora', 'texto', 'Constructora', { max: 120 }],
    ['p-entrega', 'entrega_estimada', 'texto', 'Entrega estimada', { max: 60 }],
    ['p-video', 'video_url', 'url', 'Video'],
    ['p-tour', 'tour_virtual_url', 'url', 'Recorrido virtual']
  ];
  var CON_FORMATO = { 'p-precio': 1, 'p-superficie': 1, 'p-terreno': 1, 'p-hoa': 1, 'p-cdd': 1, 'p-impuestos': 1 };

  function llenarOpciones() {
    var tipo = $('#p-tipo'), estado = $('#p-estado'), zona = $('#p-zona');
    if (tipo.options.length) return;
    tipo.innerHTML = Object.keys(KKG.TIPOS).map(function (k) { return '<option value="' + k + '">' + esc(KKG.TIPOS[k]) + '</option>'; }).join('');
    estado.innerHTML = opcionesEstado('borrador');
    var zonas = Object.keys(KKG.ZONAS).filter(function (k) { return k !== 'otra-zona'; })
      .sort(function (a, b) { return KKG.ZONAS[a].localeCompare(KKG.ZONAS[b], 'es'); });
    zona.innerHTML = '<option value="">Sin indicar</option>' + zonas.map(function (k) { return '<option value="' + k + '">' + esc(KKG.ZONAS[k]) + '</option>'; }).join('') +
      '<option value="otra-zona">Otra zona de Florida Central</option>';
  }

  /* Si el valor guardado no está entre las opciones (p. ej. un condado escrito antes), se agrega. */
  function asegurarOpcion(select, valor) {
    if (valor == null || valor === '') return;
    for (var i = 0; i < select.options.length; i++) if (select.options[i].value === valor) return;
    var o = document.createElement('option'); o.value = valor; o.textContent = valor;
    select.appendChild(o);
  }

  function llenarFormulario(p) {
    p = p || {};
    CAMPOS.forEach(function (c) {
      var el = document.getElementById(c[0]), v = p[c[1]];
      if (c[2] === 'opcion') {
        asegurarOpcion(el, v);
        el.value = v == null ? (c[1] === 'tipo' ? 'casa' : c[1] === 'estado' ? 'borrador' : '') : v;
      } else if (CON_FORMATO[c[0]]) el.value = v == null ? '' : P.formatoNumero(v);
      else el.value = v == null ? '' : String(v);
    });
    $('#p-destacada').checked = !!p.destacada;
    $('#p-nueva').checked = !!p.nueva_construccion;
    $('[data-nueva-campos]').hidden = !p.nueva_construccion;
    $('#p-caract-nueva').value = '';
    P.actualizarContador($('#p-descripcion'));
  }

  function leerNumeroCampo(el) {
    if (el.validity && el.validity.badInput) return NaN;
    return P.leerNumero(el.value);
  }

  /* Lee y valida el formulario (mismas reglas que la base de datos). */
  function leerFormulario() {
    var datos = {}, errores = [];
    function error(c, msg) { errores.push({ id: c[0], msg: msg, etiqueta: c[3] }); }
    CAMPOS.forEach(function (c) {
      var el = document.getElementById(c[0]), lim = c[4] || {}, v;
      switch (c[2]) {
        case 'texto':
        case 'largo':
          v = el.value.trim();
          if (c[1] === 'titulo' && v.length < lim.min) error(c, v ? 'Escribe un título un poco más largo (mínimo 3 caracteres).' : 'Escribe un título para la propiedad.');
          else if (lim.max && v.length > lim.max) error(c, 'Máximo ' + P.formatoNumero(lim.max) + ' caracteres (llevas ' + P.formatoNumero(v.length) + ').');
          datos[c[1]] = c[2] === 'largo' ? el.value.replace(/\s+$/, '') : (v || null);
          break;
        case 'opcion':
          v = el.value;
          if (c[1] === 'tipo' && !KKG.TIPOS[v]) error(c, 'Elige el tipo de propiedad.');
          if (c[1] === 'estado' && !KKG.ESTADOS[v]) error(c, 'Elige el estado.');
          if (c[1] === 'zona' && v && !/^[a-z0-9-]{0,60}$/.test(v)) error(c, 'Elige una zona de la lista.');
          if (c[1] === 'condado' && v.length > 60) error(c, 'Máximo 60 caracteres.');
          datos[c[1]] = v || null;
          break;
        case 'dinero':
          v = leerNumeroCampo(el);
          if (isNaN(v)) error(c, 'Escribe solo números, por ejemplo 1,240,000.');
          else if (v != null && v > 1e12) error(c, 'Ese número es demasiado grande.');
          datos[c[1]] = isNaN(v) ? null : v;
          break;
        case 'entero':
        case 'decimal':
          v = leerNumeroCampo(el);
          if (isNaN(v)) error(c, 'Escribe solo números.');
          else if (v != null && c[2] === 'entero' && !Number.isInteger(v)) error(c, 'Escribe un número entero, sin decimales.');
          else if (v != null && c[2] === 'decimal' && Math.abs(Math.round(v * 10) - v * 10) > 1e-9) error(c, 'Usa como máximo un decimal (por ejemplo 2.5).');
          else if (v != null && (v < lim.min || v > lim.max)) error(c, c[1] === 'anio_construccion' ? 'Escribe un año entre 1800 y 2100.' : 'Debe estar entre ' + P.formatoNumero(lim.min) + ' y ' + P.formatoNumero(lim.max) + '.');
          datos[c[1]] = isNaN(v) ? null : v;
          break;
        case 'cp':
          v = el.value.trim();
          if (v && !/^[0-9]{5}(-[0-9]{4})?$/.test(v)) error(c, 'Escribe 5 números (por ejemplo 32779) o el formato 32779-1234.');
          datos[c[1]] = v || null;
          break;
        case 'url':
          v = el.value.trim();
          if (v && /^http:\/\//i.test(v)) error(c, 'El enlace debe empezar por https:// (con “s”).');
          else if (v && !/^https:\/\/[^\s<>"']+$/i.test(v)) error(c, 'Pega el enlace completo; debe empezar por https://');
          datos[c[1]] = v || null;
          break;
      }
    });
    datos.destacada = $('#p-destacada').checked;
    datos.nueva_construccion = $('#p-nueva').checked;
    if (!datos.nueva_construccion) {
      datos.constructora = null; datos.entrega_estimada = null;
      errores = errores.filter(function (e) { return e.id !== 'p-constructora' && e.id !== 'p-entrega'; });
    }
    datos.caracteristicas = ed ? ed.caract.slice(0, 40) : [];
    if (ed && ed.caract.length > 40) errores.push({ id: 'p-caract-nueva', msg: 'Máximo 40 características. Quita ' + (ed.caract.length - 40) + '.', etiqueta: 'Características' });
    datos.fotos = ed ? P.Fotos.paraGuardar(ed) : [];
    if (datos.fotos.length > 40) errores.push({ id: 'p-fotos', msg: 'Máximo 40 fotos por propiedad.', etiqueta: 'Fotos' });
    return { datos: datos, errores: errores };
  }

  /* Estado "crudo" del formulario para detectar cambios sin guardar. */
  function instantanea() {
    var o = {};
    CAMPOS.forEach(function (c) { o[c[0]] = document.getElementById(c[0]).value; });
    o.destacada = $('#p-destacada').checked;
    o.nueva = $('#p-nueva').checked;
    o.caract = ed ? ed.caract.join('|') : '';
    o.fotos = ed ? ed.fotos.map(function (f) { return (f.path || f.clave) + ':' + (f.alt || '') + ':' + f.estado; }).join('|') : '';
    return JSON.stringify(o);
  }

  /* ---------------------------------------------------------------- editor: características */
  function tieneCaract(nombre) {
    var n = P.normalizar(nombre);
    return ed.caract.some(function (c) { return P.normalizar(c) === n; });
  }
  function pintarCaract() {
    if (!ed) return;
    $('[data-caract-comunes]').innerHTML = CARACT_COMUNES.map(function (c) {
      return '<button aria-pressed="' + tieneCaract(c) + '" class="group inline-flex items-center gap-1 min-h-[40px] px-space-md rounded-full border font-label-md text-label-md transition-colors border-outline-variant text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-high aria-pressed:bg-primary aria-pressed:text-on-primary aria-pressed:border-primary" data-caract="' + esc(c) + '" type="button">' +
        '<span aria-hidden="true" class="material-symbols-outlined text-base hidden group-aria-pressed:inline">check</span>' + esc(c) + '</button>';
    }).join('');
    var comunes = CARACT_COMUNES.map(P.normalizar);
    var propias = ed.caract.filter(function (c) { return comunes.indexOf(P.normalizar(c)) === -1; });
    $('[data-caract-propias]').innerHTML = propias.map(function (c) {
      return '<span class="inline-flex items-center gap-1 max-w-full min-h-[40px] pl-space-md pr-1 py-1 rounded-full bg-primary text-on-primary font-label-md text-label-md"><span class="min-w-0 break-words">' + esc(c) + '</span>' +
        '<button aria-label="Quitar «' + esc(c) + '»" class="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-primary-container transition-colors" data-quitar-caract="' + esc(c) + '" type="button"><span aria-hidden="true" class="material-symbols-outlined text-lg">close</span></button></span>';
    }).join('');
    $('[data-caract-propias]').hidden = !propias.length;
    $('[data-caract-conteo]').textContent = ed.caract.length + ' / 40';
  }
  function alternarCaract(nombre) {
    var n = P.normalizar(nombre);
    if (tieneCaract(nombre)) ed.caract = ed.caract.filter(function (c) { return P.normalizar(c) !== n; });
    else ed.caract.push(nombre);
    pintarCaract();
    alCambiar();
  }
  function agregarCaractPropia() {
    var campo = $('#p-caract-nueva');
    var v = campo.value.replace(/\s+/g, ' ').trim();
    P.errorCampo('p-caract-nueva', '');
    if (!v) { campo.focus(); return; }
    if (v.length > 60) { P.errorCampo('p-caract-nueva', 'Máximo 60 caracteres.'); return; }
    if (ed.caract.length >= 40) { P.errorCampo('p-caract-nueva', 'Ya tienes 40 características, que es el máximo.'); return; }
    if (tieneCaract(v)) { P.errorCampo('p-caract-nueva', 'Esa característica ya está marcada.'); return; }
    ed.caract.push(v);
    campo.value = '';
    pintarCaract();
    alCambiar();
    campo.focus();
  }

  /* ---------------------------------------------------------------- editor: ciclo de vida */
  function textoCambios() {
    var nota = $('[data-editor-prop-cambios]');
    if (!ed || !nota) return;
    var pend = P.Fotos.pendientes(ed);
    nota.textContent = pend ? 'Subiendo ' + pend + (pend === 1 ? ' foto…' : ' fotos…') :
      sucio() ? 'Tienes cambios sin guardar.' : ed.esNueva ? '' : 'Todo está guardado.';
  }
  function alCambiar() {
    if (!ed) return;
    textoCambios();
    $('[data-guardar="publicar"]').hidden = $('#p-estado').value !== 'borrador';
  }
  function sucio() {
    if (!ed) return false;
    return P.Fotos.pendientes(ed) > 0 || instantanea() !== ed.instantanea;
  }

  function prepararEdicion(p) {
    var form = $('#form-propiedad');
    form.classList.remove('opacity-50', 'pointer-events-none');
    form.removeAttribute('aria-busy');
    ed = {
      id: p ? p.id : P.uuid(),
      esNueva: !p,
      original: p || null,
      slug: p ? p.slug : '',
      fotos: [],
      caract: p && Array.isArray(p.caracteristicas) ? p.caracteristicas.slice() : [],
      borrarAlGuardar: [],
      subidasSesion: [],
      cerrado: false,
      guardando: false
    };
    llenarFormulario(p);
    P.limpiarErrores(form, $('[data-editor-prop-resumen]'));
    P.Fotos.montar(ed, p && Array.isArray(p.fotos) ? p.fotos : [], function () { alCambiar(); });
    pintarCaract();
    $('#titulo-editor-prop').textContent = p ? 'Editar propiedad' : 'Nueva propiedad';
    ed.instantanea = instantanea();
    alCambiar();
    bloquearGuardado(false);
  }

  function abrirEditor(param) {
    llenarOpciones();
    if (param === 'nueva') return prepararEdicion(null);
    var p = buscar(param);
    if (p) return prepararEdicion(p);
    var form = $('#form-propiedad');
    form.classList.add('opacity-50', 'pointer-events-none');
    form.setAttribute('aria-busy', 'true');
    ed = null;
    P.sb.from(TABLA).select('*').eq('id', param).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      if (!r.data) { P.mensaje('No se encontró esa propiedad. Puede que se haya eliminado.', 'error'); P.ir('#propiedades'); return; }
      reemplazar(r.data);
      prepararEdicion(r.data);
    }).catch(function (e) {
      P.mensaje('No se pudo abrir la propiedad. ' + P.traducirError(e), 'error');
      P.ir('#propiedades');
    });
  }

  /* Al salir del editor: se borran del depósito las fotos subidas en esta sesión
     que no quedaron guardadas en la propiedad (p. ej. al cancelar una propiedad nueva). */
  function salirEditor() {
    if (!ed) return;
    var e = ed;
    ed = null;
    e.cerrado = true;
    P.Fotos.desmontar(e);
    if (e.guardando) e.limpiarAlTerminar = true; else limpiarSesion(e);
  }
  function limpiarSesion(e) {
    var guardadas = {};
    ((e.original && e.original.fotos) || []).forEach(function (f) { guardadas[f.path] = 1; });
    var huerfanas = e.subidasSesion.filter(function (path) { return !guardadas[path]; });
    if (huerfanas.length) P.Fotos.borrarDelDeposito(huerfanas).catch(function () {});
    e.subidasSesion = [];
  }

  function bloquearGuardado(si) {
    $$('[data-guardar]').forEach(function (b) { b.disabled = si; if (si) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy'); });
  }

  function slugDe(titulo) {
    var base = P.normalizar(titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
    return (base || 'propiedad') + '-' + P.idAleatorio(4);
  }

  /* ---------------------------------------------------------------- editor: guardar */
  function guardar(publicar) {
    if (!ed || ed.guardando) return;
    var e = ed;
    var form = $('#form-propiedad'), resumen = $('[data-editor-prop-resumen]');
    var pend = P.Fotos.pendientes(e);
    if (pend) { P.mensaje('Espera a que terminen de subir las fotos (' + pend + ' en proceso).', 'error'); return; }
    if (navigator.onLine === false) { P.mensaje('Estás sin conexión. Conéctate a internet para guardar.', 'error'); return; }
    if (publicar) { $('#p-estado').value = 'publicada'; alCambiar(); }
    var r = leerFormulario();
    if (r.errores.length) { P.mostrarErrores(form, r.errores, resumen); return; }
    P.limpiarErrores(form, resumen);
    var datos = r.datos;
    var conError = P.Fotos.conError(e);
    var eraVisible = !!(e.original && e.original.estado !== 'borrador');
    if (!e.slug) e.slug = slugDe(datos.titulo);
    e.guardando = true;
    bloquearGuardado(true);
    textoCambios();
    $('[data-editor-prop-cambios]').textContent = 'Guardando…';

    function intentar(reintento) {
      datos.slug = e.slug;
      var q = e.esNueva
        ? P.sb.from(TABLA).insert(Object.assign({ id: e.id }, datos)).select().single()
        : P.sb.from(TABLA).update(datos).eq('id', e.id).select().single();
      return q.then(function (res) {
        var err = res.error;
        if (err && err.code === '23505' && !reintento && /slug/i.test(String(err.message || '') + String(err.details || ''))) {
          e.slug = slugDe(datos.titulo);
          return intentar(true);
        }
        if (err) throw err;
        return res.data;
      });
    }

    intentar(false).then(function (fila) {
      e.esNueva = false;
      e.original = fila;
      e.slug = fila.slug;
      reemplazar(fila);
      ordenar();
      var enFila = {};
      (fila.fotos || []).forEach(function (f) { enFila[f.path] = 1; });
      e.subidasSesion = e.subidasSesion.filter(function (path) { return !enFila[path]; });
      if (e.borrarAlGuardar.length) {
        var quitar = e.borrarAlGuardar.filter(function (path) { return !enFila[path]; });
        e.borrarAlGuardar = [];
        if (quitar.length) P.Fotos.borrarDelDeposito(quitar).catch(function () {});
      }
      e.guardando = false;
      if (e.limpiarAlTerminar) { limpiarSesion(e); return; }
      if (ed !== e) return;
      bloquearGuardado(false);
      $('#titulo-editor-prop').textContent = 'Editar propiedad';
      P.reemplazarRuta('#propiedad/' + encodeURIComponent(fila.id));
      ed.instantanea = instantanea();
      alCambiar();
      var visible = fila.estado !== 'borrador';
      if (publicar) { P.mensaje('Publicada. Ya se ve en la web.'); P.ir('#propiedades'); return; }
      P.mensaje(!eraVisible && visible ? 'Guardado y publicado: ya se ve en la web.' : conError ? 'Guardado. Las fotos con error no se guardaron.' : 'Guardado.');
    }).catch(function (err) {
      e.guardando = false;
      if (e.limpiarAlTerminar) { limpiarSesion(e); P.mensaje('No se pudo guardar. ' + P.traducirError(err), 'error'); return; }
      bloquearGuardado(false);
      textoCambios();
      P.mensaje('No se pudo guardar. ' + P.traducirError(err), 'error');
    });
  }

  /* ---------------------------------------------------------------- editor: eventos */
  function iniciarEditor() {
    var form = $('#form-propiedad');
    var ultimoBoton = null;
    $$('[data-guardar]', form).forEach(function (b) {
      b.addEventListener('click', function () { ultimoBoton = b.getAttribute('data-guardar'); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var quien = (e.submitter && e.submitter.getAttribute('data-guardar')) || ultimoBoton || 'guardar';
      ultimoBoton = null;
      guardar(quien === 'publicar');
    });
    form.addEventListener('input', function (e) {
      if (e.target.id === 'p-descripcion') P.actualizarContador(e.target);
      if (e.target.getAttribute('aria-invalid') === 'true') P.errorCampo(e.target.id, '');
      alCambiar();
    });
    form.addEventListener('change', function (e) {
      if (e.target.id === 'p-nueva') $('[data-nueva-campos]').hidden = !e.target.checked;
      alCambiar();
    });
    form.addEventListener('focusout', function (e) {
      var el = e.target;
      if (!CON_FORMATO[el.id]) return;
      var n = P.leerNumero(el.value);
      if (n != null && !isNaN(n)) { el.value = P.formatoNumero(n); alCambiar(); }
    });
    form.addEventListener('click', function (e) {
      var c = e.target.closest('[data-caract]');
      if (c) { alternarCaract(c.getAttribute('data-caract')); var b = $('[data-caract="' + CSS.escape(c.getAttribute('data-caract')) + '"]'); if (b) b.focus(); return; }
      var q = e.target.closest('[data-quitar-caract]');
      if (q) { alternarCaract(q.getAttribute('data-quitar-caract')); $('#p-caract-nueva').focus(); return; }
      var a = e.target.closest('[data-accion]');
      if (!a) return;
      var accion = a.getAttribute('data-accion');
      if (accion === 'agregar-caract') agregarCaractPropia();
      else if (accion === 'cancelar-propiedad') location.hash = '#propiedades';
    });
    $('#p-caract-nueva').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); agregarCaractPropia(); }
    });
  }

  P.vista('editor-propiedad', { mostrar: abrirEditor, sucio: sucio, salir: salirEditor });

  var anterior = P.alCerrarSesion;
  P.alCerrarSesion = function () {
    if (anterior) anterior();
    salirEditor();
    S.lista = []; S.cargada = false; S.filtro = 'todas'; S.busqueda = '';
    var b = $('#prop-buscar'); if (b) b.value = '';
  };

  iniciarLista();
  iniciarEditor();
})();
