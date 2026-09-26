/* ==========================================================================
   Panel KKG — Fotos de una propiedad
   - Reduce cada foto en el navegador (1600 px y 800 px de lado mayor, JPEG 0.82,
     respetando la orientación del teléfono) y sube ambas al depósito "kkg-fotos":
       <idPropiedad>/<idAleatorio>-1600.jpg  y  -800.jpg
   - En la propiedad se guarda solo { path: "<idPropiedad>/<idAleatorio>", alt }.
   - Las fotos se procesan de una en una para no agotar la memoria del teléfono.
   - Quitar una foto ya guardada: se borra del depósito al guardar la propiedad.
     Quitar una foto subida en esta sesión (aún no guardada): se borra enseguida.
   ========================================================================== */
(function () {
  'use strict';

  var P = window.KKGPanel;
  var $ = P.$, esc = KKG.esc;
  var MAX_FOTOS = 40;
  var LADO_GRANDE = 1600, LADO_MINI = 800, CALIDAD = 0.82;
  var ESTADO_TXT = { en_cola: 'En espera…', procesando: 'Preparando…', subiendo: 'Subiendo…' };
  var montado = null; // { ed, alCambiar }

  function deposito() { return P.sb.storage.from(KKG.CONFIG.bucket); }
  function nada() {}

  /* Borra del depósito los dos tamaños de cada foto. bases: ["<id>/<aleatorio>", ...] */
  function borrarDelDeposito(bases) {
    var rutas = [];
    (bases || []).forEach(function (b) { if (b) rutas.push(b + '-1600.jpg', b + '-800.jpg'); });
    if (!rutas.length) return Promise.resolve();
    var lotes = [];
    for (var i = 0; i < rutas.length; i += 900) lotes.push(rutas.slice(i, i + 900));
    return Promise.all(lotes.map(function (l) {
      return deposito().remove(l).then(function (r) { if (r && r.error) throw r.error; });
    }));
  }

  /* ---------------------------------------------------------------- reducir la foto */
  function errorLectura() { var e = new Error('No se pudo leer la imagen'); e.decodificar = true; return e; }

  function decodificar(archivo) {
    function conImagen() {
      return new Promise(function (ok, mal) {
        var url = URL.createObjectURL(archivo), img = new Image();
        img.onload = function () {
          if (!img.naturalWidth) { URL.revokeObjectURL(url); mal(errorLectura()); return; }
          ok({ fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, liberar: function () { URL.revokeObjectURL(url); } });
        };
        img.onerror = function () { URL.revokeObjectURL(url); mal(errorLectura()); };
        img.src = url;
      });
    }
    if (typeof window.createImageBitmap === 'function') {
      var prometido;
      try { prometido = window.createImageBitmap(archivo, { imageOrientation: 'from-image' }); } catch (e) { return conImagen(); }
      return prometido.then(function (bmp) {
        return { fuente: bmp, ancho: bmp.width, alto: bmp.height, liberar: function () { if (bmp.close) bmp.close(); } };
      }, conImagen);
    }
    return conImagen();
  }

  function lienzo(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* Reduce por pasos (a la mitad cada vez) para que el resultado se vea nítido. */
  function escalar(fuente, ancho, alto, lado) {
    var f = Math.min(1, lado / Math.max(ancho, alto));
    var w = Math.max(1, Math.round(ancho * f)), h = Math.max(1, Math.round(alto * f));
    var src = fuente, sw = ancho, sh = alto;
    while (sw / 2 >= w && sh / 2 >= h) {
      var paso = lienzo(Math.round(sw / 2), Math.round(sh / 2));
      var cp = paso.getContext('2d');
      cp.imageSmoothingEnabled = true; cp.imageSmoothingQuality = 'high';
      cp.drawImage(src, 0, 0, paso.width, paso.height);
      src = paso; sw = paso.width; sh = paso.height;
    }
    var c = lienzo(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    return c;
  }

  function aJpeg(c) {
    return new Promise(function (ok, mal) {
      c.toBlob(function (b) { if (b) ok(b); else mal(new Error('No se pudo preparar la foto')); }, 'image/jpeg', CALIDAD);
    });
  }

  function reducir(archivo) {
    return decodificar(archivo).then(function (d) {
      var grande, mini;
      try {
        grande = escalar(d.fuente, d.ancho, d.alto, LADO_GRANDE);
        mini = escalar(grande, grande.width, grande.height, LADO_MINI);
      } finally { d.liberar(); }
      return Promise.all([aJpeg(grande), aJpeg(mini)]).then(function (b) {
        grande.width = grande.height = 0; mini.width = mini.height = 0;
        return { grande: b[0], mini: b[1] };
      });
    });
  }

  function mensajeLectura(item) {
    var nombre = item.nombre || 'la foto';
    if (/\.hei[cf]$/i.test(nombre) || /hei[cf]/i.test(item.tipo || '')) {
      return 'No se pudo leer «' + nombre + '». Convierte la foto a JPG o súbela desde el teléfono.';
    }
    return 'No se pudo leer «' + nombre + '». Prueba con otra foto en formato JPG o PNG.';
  }

  /* ---------------------------------------------------------------- cola de subida */
  function ocupado(f) { return f.estado === 'en_cola' || f.estado === 'procesando' || f.estado === 'subiendo'; }

  function procesar(ed, item) {
    if (item.quitada || ed.cerrado) return Promise.resolve();
    item.estado = 'procesando'; item.mensaje = '';
    refrescar(ed);
    return reducir(item.archivo).then(function (r) {
      if (item.quitada || ed.cerrado) return;
      if (item.vista) URL.revokeObjectURL(item.vista);
      item.vista = URL.createObjectURL(r.mini);
      item.estado = 'subiendo';
      refrescar(ed);
      var base = ed.id + '/' + P.idAleatorio(16);
      var opciones = { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' };
      return Promise.all([
        deposito().upload(base + '-1600.jpg', r.grande, opciones),
        deposito().upload(base + '-800.jpg', r.mini, opciones)
      ]).then(function (res) {
        var err = (res[0] && res[0].error) || (res[1] && res[1].error);
        if (err) { borrarDelDeposito([base]).catch(nada); throw err; }
        if (ed.cerrado || item.quitada) { borrarDelDeposito([base]).catch(nada); return; }
        ed.subidasSesion.push(base);
        item.path = base;
        item.estado = 'listo';
        item.archivo = null;
      });
    }).catch(function (e) {
      item.estado = 'error';
      item.lectura = !!(e && e.decodificar);
      item.mensaje = item.lectura ? mensajeLectura(item) : 'No se pudo subir. ' + P.traducirError(e);
    }).then(function () {
      if (ed.cerrado) return;
      refrescar(ed);
      if (!ed.fotos.some(ocupado)) anunciar('Fotos listas. Recuerda tocar “Guardar”.');
    });
  }

  function encolar(ed, item) {
    ed.cola = (ed.cola || Promise.resolve()).then(function () { return procesar(ed, item); });
  }

  /* ---------------------------------------------------------------- agregar archivos */
  function agregar(archivos) {
    if (!montado) return;
    var ed = montado.ed;
    var lista = Array.prototype.slice.call(archivos || []);
    if (!lista.length) return;
    var avisos = [], imagenes = [];
    lista.forEach(function (a) {
      var esImagen = /^image\//.test(a.type || '') || /\.(jpe?g|png|webp|gif|hei[cf]|avif|bmp|tiff?)$/i.test(a.name || '');
      if (esImagen) imagenes.push(a); else avisos.push('«' + (a.name || 'archivo') + '» no es una imagen y no se agregó.');
    });
    var libres = MAX_FOTOS - ed.fotos.filter(function (f) { return f.estado !== 'error'; }).length;
    if (imagenes.length > libres) {
      avisos.push('Cada propiedad admite hasta 40 fotos. ' + (imagenes.length - Math.max(0, libres)) + (imagenes.length - libres === 1 ? ' foto no se agregó.' : ' fotos no se agregaron.'));
      imagenes = imagenes.slice(0, Math.max(0, libres));
    }
    imagenes.forEach(function (a) {
      var item = { clave: P.idAleatorio(8), path: '', alt: '', estado: 'en_cola', archivo: a, nombre: a.name || 'foto', tipo: a.type || '' };
      ed.fotos.push(item);
      encolar(ed, item);
    });
    mostrarAvisos(avisos);
    if (imagenes.length) anunciar(imagenes.length === 1 ? 'Subiendo 1 foto…' : 'Subiendo ' + imagenes.length + ' fotos…');
    refrescar(ed);
  }

  function mostrarAvisos(avisos) {
    var caja = $('[data-fotos-avisos]');
    caja.textContent = '';
    avisos.forEach(function (t) {
      var p = document.createElement('p');
      p.setAttribute('data-aviso-foto', '');
      p.className = 'rounded-lg bg-secondary-fixed/60 text-on-secondary-fixed font-body-sm text-body-sm px-space-md py-space-sm flex items-start gap-space-sm';
      p.appendChild(P.icono('warning', 'text-lg shrink-0 text-secondary'));
      var s = document.createElement('span'); s.textContent = t; p.appendChild(s);
      caja.appendChild(p);
    });
  }

  function anunciar(texto) {
    var s = $('[data-fotos-anuncio]');
    if (s) s.textContent = texto;
  }

  /* ---------------------------------------------------------------- pintar */
  var BOTON = 'shrink-0 inline-flex items-center justify-center gap-1 min-w-[44px] h-10 px-space-xs rounded-md text-primary font-label-md text-label-md hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors';
  var BOTON_QUITAR = 'shrink-0 ml-auto inline-flex items-center justify-center min-w-[44px] h-10 rounded-md text-error hover:bg-error-container disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors';

  function boton(rol, icono, etiqueta, deshabilitado, clases, textoVisible) {
    return '<button aria-label="' + esc(etiqueta) + '" class="' + (clases || BOTON) + '" data-rol="' + rol + '"' + (deshabilitado ? ' disabled=""' : '') + ' title="' + esc(etiqueta) + '" type="button"><span aria-hidden="true" class="material-symbols-outlined text-xl">' + icono + '</span>' +
      (textoVisible ? '<span aria-hidden="true" class="pr-space-xs">' + textoVisible + '</span>' : '') + '</button>';
  }

  function itemHTML(f, i, total) {
    var n = i + 1, trabajando = ocupado(f);
    var src = f.vista || (f.path ? KKG.urlFoto(f.path, 'mini') : '');
    var cuerpo;
    if (f.estado === 'error') {
      cuerpo = '<p class="font-body-sm text-body-sm text-error break-words">' + esc(f.mensaje || 'No se pudo subir esta foto.') + '</p>';
    } else {
      cuerpo = '<label class="sr-only" for="alt-' + f.clave + '">Descripción de la foto ' + n + ' (opcional)</label>' +
        '<input class="w-full h-10 px-space-sm rounded-md bg-surface-container-lowest text-on-surface font-body-sm text-body-sm placeholder:text-outline/70 focus:outline-none focus:shadow-[0_0_0_2px_#7b5829] max-md:text-base" data-rol="alt" id="alt-' + f.clave + '" maxlength="200" placeholder="Descripción (opcional)" type="text" value="' + esc(f.alt || '') + '"/>';
    }
    var botones = f.estado === 'error'
      ? (f.archivo && !f.lectura ? boton('reintentar', 'refresh', 'Volver a intentar la foto ' + n, false) : '') +
        boton('quitar', 'delete', 'Quitar la foto ' + n, false, BOTON_QUITAR)
      : boton('subir', 'arrow_upward', 'Mover la foto ' + n + ' antes', i === 0) +
        boton('bajar', 'arrow_downward', 'Mover la foto ' + n + ' después', i === total - 1) +
        boton('portada', 'star', 'Hacer portada la foto ' + n, i === 0 || f.estado !== 'listo', null, 'Portada') +
        boton('quitar', 'delete', 'Eliminar la foto ' + n, trabajando && f.estado !== 'en_cola', BOTON_QUITAR);
    return '<li class="flex flex-col gap-space-xs p-space-xs rounded-lg bg-surface-container-low" data-foto="' + f.clave + '">' +
      '<div class="flex gap-space-sm">' +
      '<div class="relative w-24 h-20 sm:w-28 sm:h-24 shrink-0 rounded-md overflow-hidden bg-surface-container">' +
        '<span aria-hidden="true" class="absolute inset-0 flex items-center justify-center text-outline"><span class="material-symbols-outlined text-3xl">image</span></span>' +
        (src ? '<img alt="" class="absolute inset-0 w-full h-full object-cover" data-foto-mini="" src="' + esc(src) + '"/>' : '') +
        (i === 0 && f.estado !== 'error' ? '<span class="absolute top-1 left-1 inline-flex items-center gap-0.5 h-6 px-2 rounded-full bg-secondary text-on-secondary font-label-md text-[0.6875rem] leading-none shadow-sm"><span aria-hidden="true" class="material-symbols-outlined icono-lleno text-sm">star</span>Portada</span>' : '') +
        (trabajando ? '<span class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-primary/60 text-on-primary font-label-md text-[0.75rem]"><span aria-hidden="true" class="material-symbols-outlined animate-spin text-2xl">progress_activity</span>' + ESTADO_TXT[f.estado] + '</span>' : '') +
        (f.estado === 'error' ? '<span aria-hidden="true" class="absolute inset-0 flex items-center justify-center bg-error-container/90 text-on-error-container"><span class="material-symbols-outlined text-3xl">error</span></span>' : '') +
      '</div>' +
      '<div class="flex-1 min-w-0 flex flex-col gap-space-xs">' +
        '<p class="font-label-md text-label-md text-primary truncate">Foto ' + n + (i === 0 && f.estado !== 'error' ? ' · portada' : '') + (trabajando ? '<span class="sr-only"> (' + ESTADO_TXT[f.estado] + ')</span>' : '') + '</p>' +
        cuerpo +
      '</div>' +
      '</div>' +
      '<div class="flex items-center gap-1">' + botones + '</div>' +
    '</li>';
  }

  function pintar() {
    if (!montado) return;
    var ed = montado.ed;
    var ul = $('[data-fotos-lista]');
    // Conserva el foco (p. ej. si está escribiendo una descripción mientras otra foto se sube).
    var act = document.activeElement, clave = null, rol = null, ini = null, fin = null;
    if (act && ul.contains(act)) {
      var li = act.closest('[data-foto]');
      clave = li && li.getAttribute('data-foto');
      rol = act.getAttribute('data-rol');
      if (act.tagName === 'INPUT') { ini = act.selectionStart; fin = act.selectionEnd; }
    }
    ul.innerHTML = ed.fotos.map(function (f, i) { return itemHTML(f, i, ed.fotos.length); }).join('');
    ul.hidden = !ed.fotos.length;
    var validas = ed.fotos.filter(function (f) { return f.estado !== 'error'; }).length;
    $('[data-fotos-conteo]').textContent = validas + ' / ' + MAX_FOTOS;
    var zona = $('[data-fotos-zona]'), input = $('#p-fotos');
    var lleno = validas >= MAX_FOTOS;
    input.disabled = lleno;
    zona.classList.toggle('opacity-50', lleno);
    zona.classList.toggle('pointer-events-none', lleno);
    if (clave) enfocar(clave, rol, ini, fin);
  }

  function enfocar(clave, rol, ini, fin) {
    var li = $('[data-fotos-lista] [data-foto="' + clave + '"]');
    if (!li) return;
    var el = rol && li.querySelector('[data-rol="' + rol + '"]');
    if (!el || el.disabled) el = li.querySelector('button:not([disabled]), input');
    if (!el) return;
    el.focus();
    if (ini != null && el.tagName === 'INPUT') { try { el.setSelectionRange(ini, fin); } catch (x) { /* nada */ } }
  }

  function refrescar(ed) {
    if (!montado || montado.ed !== ed) return;
    pintar();
    if (montado.alCambiar) montado.alCambiar();
  }

  /* ---------------------------------------------------------------- acciones */
  function indice(ed, clave) {
    for (var i = 0; i < ed.fotos.length; i++) if (ed.fotos[i].clave === clave) return i;
    return -1;
  }
  function estaGuardada(ed, path) {
    return !!(path && ed.original && (ed.original.fotos || []).some(function (f) { return f.path === path; }));
  }

  function mover(ed, clave, destino) {
    var i = indice(ed, clave);
    if (i < 0 || destino < 0 || destino >= ed.fotos.length || destino === i) return;
    var item = ed.fotos.splice(i, 1)[0];
    ed.fotos.splice(destino, 0, item);
  }

  function quitar(ed, clave) {
    var i = indice(ed, clave);
    if (i < 0) return;
    var f = ed.fotos[i];
    if (f.estado === 'procesando' || f.estado === 'subiendo') return;
    f.quitada = true;
    ed.fotos.splice(i, 1);
    if (f.vista) URL.revokeObjectURL(f.vista);
    if (f.estado === 'listo' && f.path) {
      if (estaGuardada(ed, f.path)) {
        ed.borrarAlGuardar.push(f.path);
        anunciar('Foto quitada. Se borrará definitivamente al guardar.');
      } else {
        ed.subidasSesion = ed.subidasSesion.filter(function (p) { return p !== f.path; });
        borrarDelDeposito([f.path]).catch(nada);
        anunciar('Foto eliminada.');
      }
    }
    var siguiente = ed.fotos[Math.min(i, ed.fotos.length - 1)];
    refrescar(ed);
    if (siguiente) enfocar(siguiente.clave, 'quitar');
    else $('#p-fotos').focus();
  }

  function iniciarEventos() {
    var ul = $('[data-fotos-lista]');
    ul.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-rol]');
      if (!b || !montado || b.disabled) return;
      var ed = montado.ed;
      var clave = b.closest('[data-foto]').getAttribute('data-foto');
      var rol = b.getAttribute('data-rol');
      var i = indice(ed, clave);
      if (rol === 'subir') { mover(ed, clave, i - 1); refrescar(ed); enfocar(clave, 'subir'); }
      else if (rol === 'bajar') { mover(ed, clave, i + 1); refrescar(ed); enfocar(clave, 'bajar'); }
      else if (rol === 'portada') { mover(ed, clave, 0); refrescar(ed); enfocar(clave, 'bajar'); anunciar('Esta foto ahora es la portada.'); }
      else if (rol === 'quitar') quitar(ed, clave);
      else if (rol === 'reintentar') {
        var f = ed.fotos[i];
        if (f && f.archivo) { f.estado = 'en_cola'; f.mensaje = ''; encolar(ed, f); refrescar(ed); }
      }
    });
    ul.addEventListener('input', function (e) {
      if (!montado || e.target.getAttribute('data-rol') !== 'alt') return;
      var ed = montado.ed;
      var f = ed.fotos[indice(ed, e.target.closest('[data-foto]').getAttribute('data-foto'))];
      if (f) { f.alt = e.target.value; if (montado.alCambiar) montado.alCambiar(); }
    });
    // Si una miniatura no carga, queda visible el ícono de imagen.
    ul.addEventListener('error', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-foto-mini')) e.target.hidden = true;
    }, true);

    var input = $('#p-fotos');
    input.addEventListener('change', function () {
      agregar(input.files);
      input.value = '';
    });

    // Arrastrar y soltar (computadora)
    var zona = $('[data-fotos-zona]');
    var seccion = $('#seccion-fotos');
    function conArchivos(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') > -1; }
    ['dragenter', 'dragover'].forEach(function (tipo) {
      seccion.addEventListener(tipo, function (e) {
        if (!conArchivos(e) || !montado) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        zona.setAttribute('data-arrastrando', 'true');
      });
    });
    seccion.addEventListener('dragleave', function (e) {
      if (!seccion.contains(e.relatedTarget)) zona.removeAttribute('data-arrastrando');
    });
    seccion.addEventListener('drop', function (e) {
      if (!conArchivos(e)) return;
      e.preventDefault();
      zona.removeAttribute('data-arrastrando');
      agregar(e.dataTransfer.files);
    });
    // Evita que el navegador abra la foto si se suelta fuera de la zona.
    window.addEventListener('dragover', function (e) { if (montado && conArchivos(e)) e.preventDefault(); });
    window.addEventListener('drop', function (e) { if (montado && conArchivos(e)) e.preventDefault(); });
  }

  /* ---------------------------------------------------------------- API para el editor */
  P.Fotos = {
    montar: function (ed, guardadas, alCambiar) {
      ed.fotos = (guardadas || []).filter(function (f) { return f && f.path; }).map(function (f) {
        return { clave: P.idAleatorio(8), path: f.path, alt: f.alt || '', estado: 'listo' };
      });
      ed.cola = Promise.resolve();
      montado = { ed: ed, alCambiar: alCambiar };
      $('#p-fotos').value = '';
      $('[data-fotos-avisos]').textContent = '';
      $('[data-fotos-anuncio]').textContent = '';
      P.errorCampo('p-fotos', '');
      pintar();
    },
    desmontar: function (ed) {
      (ed.fotos || []).forEach(function (f) { if (f.vista && !ocupado(f)) { URL.revokeObjectURL(f.vista); f.vista = null; } });
      if (montado && montado.ed === ed) montado = null;
    },
    pendientes: function (ed) { return (ed.fotos || []).filter(ocupado).length; },
    conError: function (ed) { return (ed.fotos || []).some(function (f) { return f.estado === 'error'; }); },
    paraGuardar: function (ed) {
      return (ed.fotos || []).filter(function (f) { return f.estado === 'listo' && f.path; })
        .map(function (f) { return { path: f.path, alt: String(f.alt || '').trim().slice(0, 200) }; });
    },
    borrarDelDeposito: borrarDelDeposito,
    agregar: agregar
  };

  iniciarEventos();
})();
