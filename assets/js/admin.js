/* ==========================================================================
   Kingdom Key Group — Panel de Tahis (admin.html)
   --------------------------------------------------------------------------
   Núcleo del panel: cliente de Supabase, inicio de sesión, navegación por
   pestañas (#propiedades, #propiedad/<id>, #testimonios, #testimonio/<id>,
   #cuenta), avisos, diálogos y utilidades compartidas.
   Módulos: admin-propiedades.js, admin-fotos.js, admin-testimonios.js
   Seguridad: todo texto que viene de la base de datos se pinta con
   textContent o KKG.esc(). La cuenta la crea quien administra el sitio en
   Supabase (este panel nunca registra usuarios ni envía correos).
   ========================================================================== */
(function () {
  'use strict';

  var P = window.KKGPanel = window.KKGPanel || {};
  var $ = P.$ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  var $$ = P.$$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };
  P.estado = { usuario: null };
  P.sb = null;

  /* ---------------------------------------------------------------- utilidades */
  P.icono = function (nombre, clases) {
    var s = document.createElement('span');
    s.className = 'material-symbols-outlined ' + (clases || '');
    s.setAttribute('aria-hidden', 'true');
    s.textContent = nombre;
    return s;
  };

  P.normalizar = function (t) {
    return String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  };

  /* "1,240,000" / "$1,240,000.50" -> número; '' -> null; texto inválido -> NaN */
  P.leerNumero = function (txt) {
    var s = String(txt == null ? '' : txt).trim().replace(/[$\s]/g, '').replace(/,/g, '');
    if (s === '') return null;
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  };
  P.formatoNumero = function (n) {
    if (n == null || n === '' || isNaN(n)) return '';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  P.idAleatorio = function (largo) {
    var abc = 'abcdefghijklmnopqrstuvwxyz0123456789', out = '';
    var bytes = new Uint8Array(largo || 12);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    for (var i = 0; i < bytes.length; i++) out += abc[bytes[i] % abc.length];
    return out;
  };
  P.uuid = function () {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    var b = new Uint8Array(16); window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  P.fechaCorta = function (iso) {
    if (!iso) return '';
    var d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  /* ---------------------------------------------------------------- errores */
  P.esErrorDeRed = function (e) {
    if (!navigator.onLine) return true;
    var m = String((e && (e.message || e.error_description || e)) || '');
    return (e && (e.name === 'AuthRetryableFetchError' || e.name === 'TypeError' || e.status === 0)) ||
      /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(m);
  };

  P.traducirError = function (e) {
    if (!e) return 'Algo salió mal. Inténtalo de nuevo.';
    if (P.esErrorDeRed(e)) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
    var codigo = String(e.code || ''), msg = String(e.message || e.error || ''), st = Number(e.status || e.statusCode || 0);
    if (/jwt expired|invalid jwt|session.*(missing|expired)/i.test(msg) || codigo === 'PGRST301') return 'Tu sesión expiró. Cierra sesión y vuelve a entrar.';
    if (codigo === '42501' || st === 401 || st === 403 || /row-level security|permission denied|unauthorized/i.test(msg)) return 'No tienes permiso para hacer esto. Cierra sesión y vuelve a entrar.';
    if (codigo === '23514') return 'Algún dato no tiene el formato permitido. Revisa los campos e inténtalo de nuevo.';
    if (codigo === '23505') return 'Ya existe un registro igual. Cambia el título e inténtalo de nuevo.';
    if (st === 413 || /payload too large|maximum allowed size|too large/i.test(msg)) return 'La foto pesa demasiado (máximo 8 MB).';
    if (st === 429 || /rate limit/i.test(msg)) return 'Demasiados intentos seguidos. Espera un par de minutos.';
    if (st >= 500) return 'El servidor no respondió bien. Espera un momento e inténtalo de nuevo.';
    return 'Algo salió mal' + (msg ? ' (' + msg.slice(0, 160) + ')' : '') + '. Inténtalo de nuevo.';
  };

  /* Aviso rojo bajo la barra superior, con botón Reintentar opcional. */
  var reintentarAviso = null;
  P.avisoError = function (texto, reintentar) {
    var caja = $('#aviso-error');
    if (!caja) return;
    $('[data-aviso-texto]', caja).textContent = texto;
    reintentarAviso = reintentar || null;
    $('[data-accion="reintentar"]', caja).hidden = !reintentar;
    caja.hidden = false;
  };
  P.ocultarAvisoError = function () { var c = $('#aviso-error'); if (c) c.hidden = true; reintentarAviso = null; };

  /* ---------------------------------------------------------------- mensajes breves */
  P.mensaje = function (texto, tipo) {
    var caja = $('#mensajes');
    if (!caja) return;
    var error = tipo === 'error';
    var d = document.createElement('div');
    d.className = 'pointer-events-auto flex items-start gap-space-sm w-full px-space-md py-space-sm rounded-lg shadow-[0_12px_32px_-4px_rgba(24,60,72,0.25)] font-label-md text-label-md transition-opacity duration-300 ' +
      (error ? 'bg-error text-on-error' : 'bg-primary text-on-primary');
    if (error) d.setAttribute('role', 'alert');
    d.appendChild(P.icono(error ? 'error' : 'check_circle', 'text-xl shrink-0'));
    var t = document.createElement('span');
    t.className = 'pt-0.5';
    t.textContent = texto;
    d.appendChild(t);
    caja.appendChild(d);
    while (caja.children.length > 3) caja.removeChild(caja.firstChild);
    setTimeout(function () {
      d.classList.add('opacity-0');
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 320);
    }, error ? 7000 : 3500);
  };

  /* ---------------------------------------------------------------- diálogo de confirmación */
  P.confirmar = function (o) {
    o = o || {};
    var dlg = $('#dialogo');
    if (!dlg || typeof dlg.showModal !== 'function') {
      return Promise.resolve(window.confirm((o.titulo || '') + (o.texto ? '\n\n' + o.texto : '')));
    }
    $('#dialogo-titulo').textContent = o.titulo || '¿Continuar?';
    $('#dialogo-texto').textContent = o.texto || '';
    $('#dialogo-texto').hidden = !o.texto;
    var si = $('[data-dialogo-si]', dlg), no = $('[data-dialogo-no]', dlg);
    si.textContent = o.si || 'Aceptar';
    no.textContent = o.no || 'Cancelar';
    si.setAttribute('data-tono', o.peligro ? 'peligro' : 'normal');
    return new Promise(function (resolver) {
      dlg.returnValue = '';
      function alCerrar() { dlg.removeEventListener('close', alCerrar); resolver(dlg.returnValue === 'si'); }
      dlg.addEventListener('close', alCerrar);
      dlg.showModal();
      (o.peligro ? no : si).focus();
    });
  };

  /* ---------------------------------------------------------------- formularios */
  P.errorCampo = function (id, msg) {
    var campo = document.getElementById(id), p = document.getElementById(id + '-error');
    if (p) { p.textContent = msg || ''; p.hidden = !msg; }
    if (!campo) return;
    if (msg) campo.setAttribute('aria-invalid', 'true'); else campo.removeAttribute('aria-invalid');
    var ids = [];
    if (document.getElementById(id + '-ayuda')) ids.push(id + '-ayuda');
    if (msg && p) ids.push(id + '-error');
    if (ids.length) campo.setAttribute('aria-describedby', ids.join(' ')); else campo.removeAttribute('aria-describedby');
  };
  P.limpiarErrores = function (form, resumen) {
    $$('[data-error-de]', form).forEach(function (p) { P.errorCampo(p.getAttribute('data-error-de'), ''); });
    if (resumen) resumen.hidden = true;
  };
  /* errores: [{ id, msg, etiqueta }] */
  P.mostrarErrores = function (form, errores, resumen) {
    P.limpiarErrores(form, resumen);
    errores.forEach(function (e) { P.errorCampo(e.id, e.msg); });
    if (!errores.length) return;
    if (resumen) {
      resumen.textContent = '';
      resumen.appendChild(P.icono('error', 'text-xl shrink-0'));
      var t = document.createElement('span');
      var nombres = errores.map(function (e) { return e.etiqueta; }).filter(Boolean);
      t.textContent = errores.length === 1 ? 'Revisa este campo: ' + (nombres[0] || '') + '.' : 'Revisa los ' + errores.length + ' campos marcados en rojo: ' + nombres.join(', ') + '.';
      resumen.appendChild(t);
      resumen.hidden = false;
    }
    var primero = document.getElementById(errores[0].id);
    if (primero) {
      primero.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(function () { try { primero.focus({ preventScroll: true }); } catch (x) { primero.focus(); } }, 250);
    }
  };

  P.actualizarContador = function (campo) {
    var c = $('[data-contador-de="' + campo.id + '"]');
    if (!c) return;
    var max = Number(campo.getAttribute('maxlength')) || 0;
    var n = campo.value.length;
    c.textContent = P.formatoNumero(n) + ' / ' + P.formatoNumero(max);
    c.classList.toggle('text-error', max && n > max * 0.95);
  };

  function iniciarVerClave() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-ver-clave]');
      if (!b) return;
      var campo = document.getElementById(b.getAttribute('data-ver-clave'));
      if (!campo) return;
      var ver = campo.type === 'password';
      campo.type = ver ? 'text' : 'password';
      b.setAttribute('aria-pressed', ver ? 'true' : 'false');
      b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
      var ic = b.querySelector('.material-symbols-outlined');
      if (ic) ic.textContent = ver ? 'visibility_off' : 'visibility';
    });
  }

  /* ---------------------------------------------------------------- navegación
     Cada vista se registra con P.vista(nombre, { mostrar(param), sucio(), salir() }).
     Si la vista actual tiene cambios sin guardar, se pide confirmación antes de salir. */
  var vistas = {};
  var actual = null;
  var saltarGuardia = false;
  P.vista = function (nombre, def) { vistas[nombre] = def; };

  function parsear(hash) {
    var partes = String(hash || '').replace(/^#\/?/, '').split('/');
    var param = partes[1] ? decodeURIComponent(partes[1]) : '';
    switch (partes[0]) {
      case 'propiedad': return { vista: 'editor-propiedad', pestana: 'propiedades', param: param || 'nueva' };
      case 'testimonio': return { vista: 'editor-testimonio', pestana: 'testimonios', param: param || 'nuevo' };
      case 'testimonios': return { vista: 'testimonios', pestana: 'testimonios', param: '' };
      case 'cuenta': return { vista: 'cuenta', pestana: 'cuenta', param: '' };
      default: return { vista: 'propiedades', pestana: 'propiedades', param: '' };
    }
  }

  function vistaSucia() {
    var def = actual && vistas[actual.vista];
    return !!(def && def.sucio && def.sucio());
  }
  P.vistaSucia = vistaSucia;

  /* Pregunta si se pueden descartar los cambios. Resuelve true si se puede salir. */
  P.confirmarSalida = function () {
    if (!vistaSucia()) return Promise.resolve(true);
    return P.confirmar({
      titulo: 'Tienes cambios sin guardar',
      texto: 'Si sales ahora, se perderán los cambios de este formulario.',
      si: 'Salir sin guardar', no: 'Seguir editando', peligro: true
    });
  };

  P.ir = function (hash) {
    saltarGuardia = true;
    if (location.hash === hash) { saltarGuardia = false; aplicarRuta(); }
    else location.hash = hash;
  };
  /* Cambia la dirección sin volver a pintar la vista (p. ej. tras guardar una propiedad nueva). */
  P.reemplazarRuta = function (hash) {
    history.replaceState(null, '', hash);
    if (actual) { actual.hash = hash; actual.param = parsear(hash).param; }
  };

  function alCambiarHash() {
    if (!P.estado.usuario) return;
    var nuevo = location.hash || '#propiedades';
    if (actual && nuevo === actual.hash) return;
    if (!saltarGuardia && vistaSucia()) {
      var destino = nuevo;
      history.pushState(null, '', actual.hash);
      P.confirmarSalida().then(function (ok) { if (ok) P.ir(destino); });
      return;
    }
    saltarGuardia = false;
    aplicarRuta();
  }

  function aplicarRuta(inicial) {
    var hash = location.hash || '#propiedades';
    var r = parsear(hash);
    if (actual && (actual.vista !== r.vista || actual.param !== r.param)) {
      var anterior = vistas[actual.vista];
      if (anterior && anterior.salir) anterior.salir();
    }
    actual = { vista: r.vista, param: r.param, hash: hash };
    $$('[data-vista]').forEach(function (s) { s.hidden = s.getAttribute('data-vista') !== r.vista; });
    $$('[data-pestana]').forEach(function (a) {
      if (a.getAttribute('data-pestana') === r.pestana) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    var def = vistas[r.vista];
    if (def && def.mostrar) def.mostrar(r.param);
    if (!inicial) {
      var h1 = $('[data-vista="' + r.vista + '"] h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); try { h1.focus({ preventScroll: true }); } catch (x) { h1.focus(); } }
    }
  }

  window.addEventListener('hashchange', alCambiarHash);
  window.addEventListener('beforeunload', function (e) {
    if (P.estado.usuario && vistaSucia()) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------------------------------------------------------------- sesión */
  function pantalla(cual) {
    $('#pantalla-cargando').hidden = cual !== 'cargando';
    $('#pantalla-login').hidden = cual !== 'login';
    $('#app').hidden = cual !== 'app';
  }

  function errorLogin(texto) {
    var p = $('#login-error');
    p.textContent = '';
    if (texto) { p.appendChild(P.icono('error', 'text-xl shrink-0')); var s = document.createElement('span'); s.textContent = texto; p.appendChild(s); }
    p.hidden = !texto;
  }

  function mostrarLogin(texto) {
    P.estado.usuario = null;
    actual = null;
    pantalla('login');
    errorLogin(texto || '');
    var b = $('#login-boton'); b.disabled = false; b.removeAttribute('aria-busy');
    var clave = $('#login-clave'); clave.value = '';
    var email = $('#login-email');
    setTimeout(function () { (email.value ? clave : email).focus(); }, 30);
  }

  function traducirLogin(e) {
    var codigo = String(e.code || ''), msg = String(e.message || '');
    if (P.esErrorDeRed(e)) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
    if (codigo === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
    if (codigo === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'Esta cuenta todavía no tiene el correo confirmado. Pide a quien administra tu sitio web que la active.';
    if (codigo === 'user_banned') return 'Esta cuenta está desactivada. Pide ayuda a quien administra tu sitio web.';
    if (e.status === 429 || /rate limit|too many/i.test(msg)) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.';
    return P.traducirError(e);
  }

  function entrar(usuario) {
    P.estado.usuario = usuario;
    var email = usuario && usuario.email || '';
    $$('[data-usuario-email]').forEach(function (el) { el.textContent = email; el.setAttribute('title', email); });
    $$('[data-usuario-email-campo]').forEach(function (el) { el.value = email; });
    pantalla('app');
    P.ocultarAvisoError();
    actualizarConexion();
    aplicarRuta(true);
  }

  /* Comprueba que la cuenta sea administradora del panel (función kkg_es_admin). */
  function verificar(usuario, alIniciar) {
    return P.sb.rpc('kkg_es_admin').then(function (r) {
      if (r.error) throw r.error;
      if (r.data !== true) {
        return P.sb.auth.signOut({ scope: 'local' }).catch(function () {}).then(function () {
          mostrarLogin('Esta cuenta no tiene acceso al panel.');
        });
      }
      entrar(usuario);
    }).catch(function (e) {
      if (alIniciar && P.esErrorDeRed(e)) return sinConexionAlIniciar(usuario);
      mostrarLogin(P.traducirError(e));
    });
  }

  function sinConexionAlIniciar(usuario) {
    pantalla('cargando');
    var caja = $('#pantalla-cargando');
    var p = $('p', caja);
    p.textContent = '';
    p.appendChild(P.icono('wifi_off', 'text-secondary'));
    p.appendChild(document.createTextNode('No hay conexión con el servidor. Revisa tu internet.'));
    var b = $('[data-reintentar-inicio]', caja);
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-reintentar-inicio', '');
      b.className = 'inline-flex items-center justify-center gap-space-xs h-12 px-space-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md rounded-lg transition-all';
      b.appendChild(P.icono('refresh', 'text-xl'));
      b.appendChild(document.createTextNode('Reintentar'));
      caja.appendChild(b);
    }
    b.onclick = function () {
      p.textContent = 'Abriendo el panel…';
      verificar(usuario, true);
    };
  }

  function iniciarLogin() {
    var form = $('#form-login');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#login-email'), clave = $('#login-clave');
      email.removeAttribute('aria-invalid'); clave.removeAttribute('aria-invalid');
      var correo = email.value.trim();
      if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { email.setAttribute('aria-invalid', 'true'); errorLogin('Escribe tu correo electrónico completo.'); email.focus(); return; }
      if (!clave.value) { clave.setAttribute('aria-invalid', 'true'); errorLogin('Escribe tu contraseña.'); clave.focus(); return; }
      if (!P.sb) { errorLogin('No se pudo cargar el panel. Revisa tu conexión y recarga la página.'); return; }
      errorLogin('');
      var b = $('#login-boton');
      b.disabled = true; b.setAttribute('aria-busy', 'true');
      $('span', b).textContent = 'Entrando…';
      P.sb.auth.signInWithPassword({ email: correo, password: clave.value }).then(function (r) {
        if (r.error) throw r.error;
        return verificar(r.data.user, false);
      }).catch(function (err) {
        errorLogin(traducirLogin(err));
        clave.setAttribute('aria-invalid', 'true');
        clave.focus(); clave.select();
      }).then(function () {
        b.disabled = false; b.removeAttribute('aria-busy');
        $('span', b).textContent = 'Entrar';
      });
    });
  }

  P.salir = function () {
    return P.confirmarSalida().then(function (ok) {
      if (!ok) return;
      var def = actual && vistas[actual.vista];
      if (def && def.salir) def.salir();
      P.estado.usuario = null;
      return P.sb.auth.signOut().then(function (r) {
        if (r && r.error) return P.sb.auth.signOut({ scope: 'local' });
      }).catch(function () {
        return P.sb.auth.signOut({ scope: 'local' }).catch(function () {});
      }).then(function () {
        if (P.alCerrarSesion) P.alCerrarSesion();
        history.replaceState(null, '', location.pathname + location.search);
        mostrarLogin('');
        P.mensaje('Cerraste sesión.');
      });
    });
  };

  /* ---------------------------------------------------------------- mi cuenta */
  P.vista('cuenta', { mostrar: function () {} });

  function iniciarCuenta() {
    var form = $('#form-clave');
    var estado = $('[data-clave-estado]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nueva = $('#c-nueva'), conf = $('#c-confirmar');
      var errores = [];
      if (nueva.value.length < 8) errores.push({ id: 'c-nueva', msg: 'Usa al menos 8 caracteres.', etiqueta: 'Nueva contraseña' });
      else if (conf.value !== nueva.value) errores.push({ id: 'c-confirmar', msg: 'Las dos contraseñas no coinciden.', etiqueta: 'Repite la nueva contraseña' });
      P.mostrarErrores(form, errores);
      estado.textContent = '';
      if (errores.length) return;
      var b = $('[type="submit"]', form);
      b.disabled = true; estado.textContent = 'Guardando…';
      P.sb.auth.updateUser({ password: nueva.value }).then(function (r) {
        if (r.error) throw r.error;
        nueva.value = ''; conf.value = '';
        estado.textContent = 'Listo: tu contraseña se actualizó.';
        P.mensaje('Contraseña actualizada.');
      }).catch(function (err) {
        var c = String(err.code || ''), m = String(err.message || '');
        var texto = c === 'same_password' || /different from the old/i.test(m) ? 'La nueva contraseña debe ser distinta de la actual.' :
          c === 'weak_password' || /weak|at least/i.test(m) ? 'Esa contraseña es muy débil. Usa al menos 8 caracteres y combina letras y números.' :
          c === 'reauthentication_needed' ? 'Por seguridad, cierra sesión, vuelve a entrar e inténtalo otra vez.' : P.traducirError(err);
        estado.textContent = '';
        P.mostrarErrores(form, [{ id: 'c-nueva', msg: texto, etiqueta: 'Nueva contraseña' }]);
      }).then(function () { b.disabled = false; });
    });
  }

  /* ---------------------------------------------------------------- conexión */
  function actualizarConexion() {
    var aviso = $('#aviso-sin-conexion');
    if (aviso) aviso.hidden = navigator.onLine !== false;
  }

  /* ---------------------------------------------------------------- arranque */
  function iniciar() {
    iniciarVerClave();
    iniciarLogin();
    iniciarCuenta();
    window.addEventListener('online', actualizarConexion);
    window.addEventListener('offline', actualizarConexion);
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-accion]');
      if (!b) return;
      var accion = b.getAttribute('data-accion');
      if (accion === 'salir') { e.preventDefault(); P.salir(); }
      else if (accion === 'reintentar') { e.preventDefault(); var f = reintentarAviso; P.ocultarAvisoError(); if (f) f(); }
    });

    if (!window.supabase || !window.supabase.createClient || !window.KKG) {
      mostrarLogin('No se pudo cargar el panel. Revisa tu conexión a internet y recarga la página.');
      return;
    }
    P.sb = window.supabase.createClient(KKG.CONFIG.url, KKG.CONFIG.key, {
      auth: { storageKey: 'kkg-panel-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    P.sb.auth.onAuthStateChange(function (evento) {
      // Sin llamadas a Supabase aquí dentro (recomendación de supabase-js).
      if (evento === 'SIGNED_OUT' && P.estado.usuario) {
        setTimeout(function () {
          if (P.alCerrarSesion) P.alCerrarSesion();
          mostrarLogin('Tu sesión se cerró. Vuelve a entrar para continuar.');
        }, 0);
      }
    });
    P.sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (s && s.user) return verificar(s.user, true);
      mostrarLogin('');
    }).catch(function () { mostrarLogin(''); });
  }

  // Los módulos (admin-*.js, con defer) se registran antes de DOMContentLoaded.
  if (document.readyState === 'complete') iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
