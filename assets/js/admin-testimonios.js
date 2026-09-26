/* ==========================================================================
   Panel KKG — Testimonios: lista y editor.
   Regla (también la exige la base de datos): solo se puede publicar un
   testimonio si el cliente autorizó su publicación. En cuanto hay al menos
   uno publicado, la web deja de mostrar los testimonios de ejemplo.
   ========================================================================== */
(function () {
  'use strict';

  var P = window.KKGPanel;
  var $ = P.$, $$ = P.$$, esc = KKG.esc;
  var TABLA = 'kkg_testimonios';
  var S = { lista: [], cargada: false, cargando: false };
  var ed = null;

  function buscar(id) { for (var i = 0; i < S.lista.length; i++) if (S.lista[i].id === id) return S.lista[i]; return null; }
  function reemplazar(fila) {
    for (var i = 0; i < S.lista.length; i++) if (S.lista[i].id === fila.id) { S.lista[i] = fila; return; }
    S.lista.push(fila);
  }
  function ordenar() {
    S.lista.sort(function (a, b) {
      if ((a.orden || 0) !== (b.orden || 0)) return (a.orden || 0) - (b.orden || 0);
      return String(b.fecha || b.creado_en || '').localeCompare(String(a.fecha || a.creado_en || ''));
    });
  }

  /* ---------------------------------------------------------------- lista */
  function cargar() {
    if (S.cargando) return Promise.resolve();
    S.cargando = true;
    var lista = $('[data-testi-lista]');
    lista.setAttribute('aria-busy', 'true');
    var una = '<div aria-hidden="true" class="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-sm animate-pulse"><div class="h-5 w-1/2 rounded bg-surface-container"></div><div class="h-4 w-full rounded bg-surface-container-low"></div><div class="h-4 w-5/6 rounded bg-surface-container-low"></div></div>';
    lista.innerHTML = una + una;
    $('[data-testi-vacio]').hidden = true;
    $('[data-testi-conteo]').textContent = 'Cargando…';
    return P.sb.from(TABLA).select('*').order('orden', { ascending: true }).order('fecha', { ascending: false, nullsFirst: false })
      .then(function (r) {
        if (r.error) throw r.error;
        S.lista = Array.isArray(r.data) ? r.data : [];
        S.cargada = true;
        P.ocultarAvisoError();
      })
      .catch(function (e) {
        P.avisoError('No se pudieron cargar los testimonios. ' + P.traducirError(e), function () { cargar(); });
      })
      .then(function () { S.cargando = false; pintarLista(); });
  }

  function estrellas(n) {
    if (!n) return '';
    var h = '<p aria-label="' + n + ' de 5 estrellas" class="flex text-secondary" role="img">';
    for (var i = 1; i <= 5; i++) h += '<span aria-hidden="true" class="material-symbols-outlined text-lg ' + (i <= n ? 'icono-lleno' : 'text-outline-variant') + '">star</span>';
    return h + '</p>';
  }

  function tarjeta(t) {
    var id = esc(t.id), nombre = esc(t.nombre);
    var sub = [t.detalle, t.zona].filter(Boolean).map(esc).join(' · ');
    var meta = [KKG.CATEGORIAS[t.categoria] || '', P.fechaCorta(t.fecha)].filter(Boolean).map(esc).join(' · ');
    var chip = t.publicado
      ? '<span class="shrink-0 inline-flex items-center h-7 px-2.5 rounded-full bg-[#e3efe6] text-[#1d5b3a] font-label-md text-[0.75rem] leading-none">Publicado</span>'
      : '<span class="shrink-0 inline-flex items-center h-7 px-2.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-md text-[0.75rem] leading-none">No publicado</span>';
    var permiso = t.autorizado
      ? '<span class="inline-flex items-center gap-1 text-[#1d5b3a]"><span aria-hidden="true" class="material-symbols-outlined text-base">check_circle</span>Con permiso del cliente</span>'
      : '<span class="inline-flex items-center gap-1 text-on-secondary-container"><span aria-hidden="true" class="material-symbols-outlined text-base">warning</span>Falta el permiso del cliente</span>';
    var publicar = t.publicado
      ? '<button class="flex-1 inline-flex items-center justify-center gap-space-xs h-11 px-space-sm rounded-lg border border-outline-variant text-primary hover:bg-surface-container-high font-label-md text-label-md transition-colors disabled:opacity-50" data-publicar="' + id + '" data-valor="false" type="button"><span aria-hidden="true" class="material-symbols-outlined text-xl">visibility_off</span>Ocultar<span class="sr-only"> el testimonio de ' + nombre + '</span></button>'
      : '<button class="flex-1 inline-flex items-center justify-center gap-space-xs h-11 px-space-sm rounded-lg border border-outline-variant text-primary hover:bg-surface-container-high font-label-md text-label-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed" data-publicar="' + id + '" data-valor="true"' + (t.autorizado ? '' : ' disabled="" title="Primero marca que el cliente autorizó la publicación."') + ' type="button"><span aria-hidden="true" class="material-symbols-outlined text-xl">visibility</span>Publicar<span class="sr-only"> el testimonio de ' + nombre + '</span></button>';
    return '<article class="bg-surface-container-lowest rounded-xl shadow-sm p-space-md sm:p-space-lg flex flex-col gap-space-sm" data-testi-id="' + id + '">' +
      '<div class="flex items-start justify-between gap-space-sm">' +
        '<div class="min-w-0"><h2 class="font-headline-sm text-headline-sm text-primary break-words">' + nombre + '</h2>' +
        (sub ? '<p class="font-body-sm text-body-sm text-on-surface-variant break-words">' + sub + '</p>' : '') + '</div>' + chip +
      '</div>' +
      estrellas(t.calificacion) +
      '<p class="font-body-md text-body-md text-on-surface whitespace-pre-line break-words line-clamp-4">' + esc(t.texto) + '</p>' +
      '<p class="font-body-sm text-body-sm text-on-surface-variant flex flex-wrap gap-x-space-md gap-y-1">' + (meta ? '<span>' + meta + '</span>' : '') + permiso + '</p>' +
      '<div class="flex items-center gap-space-xs pt-space-xs mt-auto">' +
        '<a class="flex-1 inline-flex items-center justify-center gap-space-xs h-11 px-space-sm rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors" href="#testimonio/' + encodeURIComponent(t.id) + '"><span aria-hidden="true" class="material-symbols-outlined text-xl">edit</span>Editar<span class="sr-only"> el testimonio de ' + nombre + '</span></a>' +
        publicar +
        '<button aria-label="Eliminar el testimonio de ' + nombre + '" class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg border border-outline-variant text-error hover:bg-error-container transition-colors" data-eliminar-testi="' + id + '" title="Eliminar" type="button"><span aria-hidden="true" class="material-symbols-outlined text-xl">delete</span></button>' +
      '</div>' +
    '</article>';
  }

  function pintarLista() {
    var lista = $('[data-testi-lista]');
    lista.removeAttribute('aria-busy');
    var n = S.lista.length;
    var pub = S.lista.filter(function (t) { return t.publicado; }).length;
    $('[data-testi-conteo]').textContent = !S.cargada ? 'No se pudieron cargar.' :
      n === 0 ? 'Aún no hay testimonios. La web muestra ejemplos.' :
      n + (n === 1 ? ' testimonio' : ' testimonios') + ' · ' + pub + (pub === 1 ? ' publicado' : ' publicados') + (pub ? '' : ' (la web sigue mostrando ejemplos)');
    lista.innerHTML = S.lista.map(tarjeta).join('');
    $('[data-testi-vacio]').hidden = !(S.cargada && n === 0);
  }

  function cambiarPublicado(boton) {
    var id = boton.getAttribute('data-publicar'), valor = boton.getAttribute('data-valor') === 'true';
    var t = buscar(id);
    if (!t) return;
    if (valor && !t.autorizado) { P.mensaje('Primero marca que el cliente autorizó publicar su testimonio.', 'error'); return; }
    boton.disabled = true;
    P.sb.from(TABLA).update({ publicado: valor }).eq('id', id).select().single().then(function (r) {
      if (r.error) throw r.error;
      reemplazar(r.data);
      pintarLista();
      P.mensaje(valor ? 'Publicado. Ya se ve en la web.' : 'Testimonio oculto de la web.');
      var b = $('[data-publicar="' + CSS.escape(id) + '"]'); if (b) b.focus();
    }).catch(function (e) {
      boton.disabled = false;
      P.mensaje('No se pudo cambiar. ' + P.traducirError(e), 'error');
    });
  }

  function eliminar(id) {
    var t = buscar(id);
    if (!t) return;
    P.confirmar({
      titulo: '¿Eliminar el testimonio de ' + t.nombre + '?',
      texto: 'Esta acción no se puede deshacer.' + (t.publicado ? ' Si solo quieres quitarlo de la web, usa “Ocultar”.' : ''),
      si: 'Eliminar', no: 'Cancelar', peligro: true
    }).then(function (ok) {
      if (!ok) return;
      P.sb.from(TABLA).delete().eq('id', id).then(function (r) {
        if (r.error) throw r.error;
        S.lista = S.lista.filter(function (x) { return x.id !== id; });
        pintarLista();
        P.mensaje('Testimonio eliminado.');
        var h = $('#titulo-testimonios'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }).catch(function (e) { P.mensaje('No se pudo eliminar. ' + P.traducirError(e), 'error'); });
    });
  }

  /* ---------------------------------------------------------------- editor */
  function pintarCalificacion(valor) {
    var caja = $('[data-calificacion]');
    if (!caja.children.length) {
      var h = '';
      for (var i = 1; i <= 5; i++) {
        h += '<label class="relative inline-flex items-center justify-center w-11 h-11 rounded-lg cursor-pointer hover:bg-surface-container-high has-[:focus-visible]:shadow-[0_0_0_2px_#7b5829]">' +
          '<input class="sr-only" name="calificacion" type="radio" value="' + i + '"/>' +
          '<span aria-hidden="true" class="material-symbols-outlined text-3xl text-outline-variant" data-estrella="' + i + '">star</span>' +
          '<span class="sr-only">' + i + (i === 1 ? ' estrella' : ' estrellas') + '</span></label>';
      }
      h += '<label class="inline-flex items-center h-11 px-space-md rounded-full border border-outline-variant font-label-md text-label-md text-on-surface-variant cursor-pointer hover:bg-surface-container-high has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:checked]:border-primary has-[:focus-visible]:shadow-[0_0_0_2px_#7b5829]">' +
        '<input class="sr-only" name="calificacion" type="radio" value=""/>Sin calificación</label>';
      caja.innerHTML = h;
    }
    var v = Number(valor) || 0;
    $$('input[name="calificacion"]', caja).forEach(function (r) { r.checked = String(r.value) === (v ? String(v) : ''); });
    $$('[data-estrella]', caja).forEach(function (s) {
      var lleno = Number(s.getAttribute('data-estrella')) <= v;
      s.className = 'material-symbols-outlined text-3xl ' + (lleno ? 'text-secondary icono-lleno' : 'text-outline-variant');
    });
  }
  function calificacionActual() {
    var r = $('input[name="calificacion"]:checked', $('#form-testimonio'));
    return r && r.value ? Number(r.value) : null;
  }

  function sincronizarPublicado() {
    var aut = $('#t-autorizado'), pub = $('#t-publicado');
    if (!aut.checked) pub.checked = false;
    pub.disabled = !aut.checked;
    $('[data-publicado-ayuda]').textContent = aut.checked ? 'Actívalo para mostrarlo en la web.' : 'Primero marca la autorización del cliente.';
  }

  function llenarOpciones() {
    var sel = $('#t-categoria');
    if (sel.options.length) return;
    sel.innerHTML = Object.keys(KKG.CATEGORIAS).map(function (k) { return '<option value="' + k + '">' + esc(KKG.CATEGORIAS[k]) + '</option>'; }).join('');
  }

  function instantanea() {
    return JSON.stringify(['t-nombre', 't-detalle', 't-zona', 't-categoria', 't-texto', 't-fecha', 't-orden'].map(function (id) { return document.getElementById(id).value; })
      .concat([calificacionActual(), $('#t-autorizado').checked, $('#t-publicado').checked]));
  }
  function sucio() { return !!ed && !ed.guardando && instantanea() !== ed.instantanea; }
  function textoCambios() {
    var n = $('[data-editor-testi-cambios]');
    if (n && ed) n.textContent = sucio() ? 'Tienes cambios sin guardar.' : ed.esNuevo ? '' : 'Todo está guardado.';
  }

  function prepararEdicion(t) {
    var form = $('#form-testimonio');
    form.classList.remove('opacity-50', 'pointer-events-none');
    ed = { id: t ? t.id : null, esNuevo: !t, original: t || null, guardando: false };
    $('#t-nombre').value = t ? t.nombre || '' : '';
    $('#t-detalle').value = t ? t.detalle || '' : '';
    $('#t-zona').value = t ? t.zona || '' : '';
    $('#t-categoria').value = t && KKG.CATEGORIAS[t.categoria] ? t.categoria : 'compra';
    $('#t-texto').value = t ? t.texto || '' : '';
    $('#t-fecha').value = t && t.fecha ? String(t.fecha).slice(0, 10) : '';
    $('#t-orden').value = t && t.orden != null ? String(t.orden) : '0';
    $('#t-autorizado').checked = !!(t && t.autorizado);
    $('#t-publicado').checked = !!(t && t.publicado);
    pintarCalificacion(t ? t.calificacion : null);
    sincronizarPublicado();
    P.actualizarContador($('#t-texto'));
    P.limpiarErrores(form, $('[data-editor-testi-resumen]'));
    $('#titulo-editor-testi').textContent = t ? 'Editar testimonio' : 'Nuevo testimonio';
    ed.instantanea = instantanea();
    textoCambios();
    $('[data-guardar-testi]').disabled = false;
  }

  function abrirEditor(param) {
    llenarOpciones();
    if (param === 'nuevo') return prepararEdicion(null);
    var t = buscar(param);
    if (t) return prepararEdicion(t);
    ed = null;
    $('#form-testimonio').classList.add('opacity-50', 'pointer-events-none');
    P.sb.from(TABLA).select('*').eq('id', param).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      if (!r.data) { P.mensaje('No se encontró ese testimonio.', 'error'); P.ir('#testimonios'); return; }
      reemplazar(r.data);
      prepararEdicion(r.data);
    }).catch(function (e) { P.mensaje('No se pudo abrir el testimonio. ' + P.traducirError(e), 'error'); P.ir('#testimonios'); });
  }

  function leer() {
    var errores = [], d = {};
    function err(id, msg, etiqueta) { errores.push({ id: id, msg: msg, etiqueta: etiqueta }); }
    d.nombre = $('#t-nombre').value.replace(/\s+/g, ' ').trim();
    if (d.nombre.length < 2) err('t-nombre', 'Escribe el nombre del cliente (mínimo 2 caracteres).', 'Nombre');
    else if (d.nombre.length > 80) err('t-nombre', 'Máximo 80 caracteres.', 'Nombre');
    d.detalle = $('#t-detalle').value.trim() || null;
    if (d.detalle && d.detalle.length > 120) err('t-detalle', 'Máximo 120 caracteres.', 'Detalle');
    d.zona = $('#t-zona').value.trim() || null;
    if (d.zona && d.zona.length > 80) err('t-zona', 'Máximo 80 caracteres.', 'Zona');
    d.categoria = $('#t-categoria').value;
    if (!KKG.CATEGORIAS[d.categoria]) err('t-categoria', 'Elige una categoría.', 'Categoría');
    d.texto = $('#t-texto').value.trim();
    if (d.texto.length < 10) err('t-texto', d.texto ? 'La reseña es muy corta (mínimo 10 caracteres).' : 'Escribe la reseña del cliente.', 'Reseña');
    else if (d.texto.length > 1500) err('t-texto', 'Máximo 1,500 caracteres.', 'Reseña');
    d.calificacion = calificacionActual();
    var f = $('#t-fecha');
    d.fecha = f.value || null;
    if (f.validity && f.validity.badInput) err('t-fecha', 'Escribe una fecha válida.', 'Fecha');
    else if (d.fecha && (d.fecha < '2000-01-01' || d.fecha > '2100-12-31')) err('t-fecha', 'Escribe una fecha válida.', 'Fecha');
    var o = $('#t-orden');
    var orden = o.validity && o.validity.badInput ? NaN : (o.value.trim() === '' ? 0 : Number(o.value));
    if (!Number.isInteger(orden) || Math.abs(orden) > 9999) err('t-orden', 'Escribe un número entero (por ejemplo 0, 1, 2…).', 'Orden');
    d.orden = Number.isInteger(orden) ? orden : 0;
    d.autorizado = $('#t-autorizado').checked;
    d.publicado = d.autorizado && $('#t-publicado').checked;
    return { datos: d, errores: errores };
  }

  function guardar() {
    if (!ed || ed.guardando) return;
    var e = ed, form = $('#form-testimonio'), resumen = $('[data-editor-testi-resumen]');
    if (navigator.onLine === false) { P.mensaje('Estás sin conexión. Conéctate a internet para guardar.', 'error'); return; }
    var r = leer();
    if (r.errores.length) { P.mostrarErrores(form, r.errores, resumen); return; }
    P.limpiarErrores(form, resumen);
    e.guardando = true;
    var b = $('[data-guardar-testi]'); b.disabled = true;
    $('[data-editor-testi-cambios]').textContent = 'Guardando…';
    var q = e.esNuevo ? P.sb.from(TABLA).insert(r.datos).select().single()
      : P.sb.from(TABLA).update(r.datos).eq('id', e.id).select().single();
    q.then(function (res) {
      if (res.error) throw res.error;
      reemplazar(res.data);
      ordenar();
      e.guardando = false;
      if (ed === e) ed.instantanea = instantanea();
      P.mensaje(res.data.publicado ? 'Testimonio guardado y publicado en la web.' : 'Testimonio guardado (no publicado).');
      P.ir('#testimonios');
    }).catch(function (err) {
      e.guardando = false;
      b.disabled = false;
      textoCambios();
      P.mensaje('No se pudo guardar. ' + P.traducirError(err), 'error');
    });
  }

  function iniciarEditor() {
    var form = $('#form-testimonio');
    form.addEventListener('submit', function (e) { e.preventDefault(); guardar(); });
    form.addEventListener('input', function (e) {
      if (e.target.id === 't-texto') P.actualizarContador(e.target);
      if (e.target.getAttribute('aria-invalid') === 'true') P.errorCampo(e.target.id, '');
      textoCambios();
    });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'calificacion') pintarCalificacion(calificacionActual());
      if (e.target.id === 't-autorizado') sincronizarPublicado();
      textoCambios();
    });
    form.addEventListener('click', function (e) {
      var a = e.target.closest('[data-accion="cancelar-testimonio"]');
      if (a) location.hash = '#testimonios';
    });
  }

  function iniciarLista() {
    var vista = $('[data-vista="testimonios"]');
    vista.addEventListener('click', function (e) {
      var p = e.target.closest('[data-publicar]');
      if (p && !p.disabled) { cambiarPublicado(p); return; }
      var d = e.target.closest('[data-eliminar-testi]');
      if (d) eliminar(d.getAttribute('data-eliminar-testi'));
    });
  }

  P.vista('testimonios', {
    mostrar: function () { if (!S.cargada && !S.cargando) cargar(); else if (!S.cargando) pintarLista(); }
  });
  P.vista('editor-testimonio', {
    mostrar: abrirEditor,
    sucio: sucio,
    salir: function () { ed = null; }
  });

  var anterior = P.alCerrarSesion;
  P.alCerrarSesion = function () {
    if (anterior) anterior();
    ed = null;
    S.lista = []; S.cargada = false;
  };

  iniciarLista();
  iniciarEditor();
})();
