# Kingdom Key Group — sitio web de Tahis Alvarez, Realtor®

Sitio estático multipágina para **Tahis Alvarez, Realtor® — Kingdom Key Group LLC**
(licencia SL3495047, miembro de ORRA), hecho a partir del export de Google Stitch
(`stitch_orlando_real_estate_ux_prototype.zip`). HTML + CSS + JavaScript puro:
**sin frameworks y sin servidor**, adaptado a teléfonos y tablets (320 px en adelante).
La maquetación es la del diseño de Stitch; la paleta se pasó a tonos cálidos (marfil,
azul marino y dorado del logotipo) a pedido de la clienta.

- **Publicado (vista para la clienta):** https://rengifojjrr.github.io/orlando-advisory/
- **Repositorio:** https://github.com/rengifojjrr/orlando-advisory

## Páginas

| Archivo | Pantalla |
|---|---|
| `index.html` | Inicio |
| `propiedades.html` | Catálogo con filtros (acepta `?zona=lake-nona`) |
| `propiedad-demo-p01/02/03.html` | Fichas de propiedad (galería, visor, pestañas) |
| `comprar.html` | Comprar casa (cuestionario de 4 pasos) |
| `nuevas-construcciones.html` · `comunidad-demo-c01/c02.html` | Nuevas construcciones y detalle de comunidad |
| `mudarse-a-orlando.html` · `checklist-mudanza-orlando.html` | Relocalización y checklist interactiva |
| `invertir.html` | Inversión |
| `vender.html` · `solicitar-estimacion.html` | Vender y asistente de estimación en 3 pasos |
| `zonas.html` · `zona-lake-nona/winter-park/winter-garden/windermere.html` | Explorador de zonas (comparador) y fichas de zona |
| `sobre-mi.html` · `testimonios.html` · `recursos.html` · `preguntas-frecuentes.html` | Marca y contenidos |
| `contacto.html` · `agendar.html` · `gracias.html` | Formularios y confirmación |
| `legal.html` (privacidad/términos) · `404.html` | Legal y página de error |

Las páginas P02, P03, C02 y las zonas Winter Park, Winter Garden y Windermere no
venían en el diseño (solo estaban enlazadas); se crearon con la misma plantilla
que sus hermanas de Stitch y textos de ejemplo.

## Datos de contacto (ya configurados)

Están en un solo lugar, el bloque `SITIO` al inicio de `assets/js/site.js`, y se
aplican en todas las páginas (nombre, compañía, teléfono, correo y WhatsApp):

```js
var SITIO = {
  nombre: 'Tahis Alvarez',
  inmobiliaria: 'Kingdom Key Group LLC',
  telefono: '+1 (786) 177-1828',
  email: 'alvareztahis39realtor@gmail.com',
  whatsapp: '17861771828',              // solo dígitos, para el enlace wa.me
  whatsappVisible: '+1 (786) 177-1828',
  formEndpoint: ''                      // ver "Formularios"
};
```

## Pendiente de la clienta

- **Foto profesional de Tahis:** todas las fotos de la asesora usan un único archivo,
  `assets/img/asesora.webp` (hoy es un retrato provisional con la corona del logo).
  Basta con reemplazar ese archivo (formato vertical, ~1200×1500) por su foto.
- **Testimonios reales** (hoy están marcados como "Testimonio de ejemplo").
- **Propiedades reales** (las fichas P01–P03 y las comunidades C01–C02 son ejemplos
  ilustrativos) o un buscador MLS/IDX.
- Idiomas de atención, redes sociales y dominio www.KingdomKeyGroup.com.

## Formularios

Contacto, agendar, estimación, inversión y mudanza validan los datos y llevan a
`gracias.html`. Como aún no hay un servicio que reciba los formularios, esa página
le pide al visitante enviar su solicitud **por WhatsApp o por correo con un clic**
(el mensaje ya va redactado con sus datos). Para recibirlas además automáticamente
en el correo, crea un formulario gratuito en [Formspree](https://formspree.io) y
pega su URL en `SITIO.formEndpoint`.

## Logotipo e imágenes de marca

`assets/img/logo-corona.png` (corona para el encabezado), `logo-kingdom-key-group.png`
(logotipo completo, pie de página), `favicon.png`, `apple-touch-icon.png`,
`og-kingdom-key-group.jpg` (vista previa al compartir por WhatsApp/redes; su URL
absoluta está en cada página: si cambia el dominio, actualizar `og:image`).

## Verlo en local

Doble clic en `index.html`, o con servidor:

```bash
python3 "/Users/jr/Desktop/claude/pagina web/orlando_src/build/servidor.py"
```

y abre http://localhost:8090

## Si editas el HTML (importante)

El CSS está **compilado** (Tailwind v3 con la configuración exacta de Stitch),
así que si agregas clases nuevas hay que recompilar. Desde `orlando_src/build/`:

```bash
python3 finalizar.py
```

Eso recompila `assets/css/estilos.css` (requiere Node y `npm i tailwindcss@3`
en esa carpeta) y descarga solo los íconos que se usan (~50 KB en vez de 4 MB).
El encabezado, el menú móvil y el pie son iguales en todas las páginas: se editan
en `orlando_src/build/build.py` y se copian a todas con `python3 sync.py`.
`python3 enlaces.py` revisa que no haya enlaces rotos.

Para publicar los cambios: `git add -A && git commit -m "..." && git push`
dentro de esta carpeta (GitHub Pages se actualiza en ~1 minuto).
