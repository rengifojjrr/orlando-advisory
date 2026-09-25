# Orlando Advisory — sitio web

Sitio estático multipágina hecho a partir del export de Google Stitch
(`stitch_orlando_real_estate_ux_prototype.zip`). HTML + CSS + JavaScript puro:
**sin frameworks y sin servidor**. Se ve igual que el diseño en escritorio
(comparado píxel a píxel con las pantallas originales a 1280 px) y está adaptado
a teléfonos y tablets (320 px en adelante).

- **Publicado (vista para el cliente):** https://rengifojjrr.github.io/orlando-advisory/
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

## ⚠️ Lo primero que debes cambiar: datos de contacto

Abre `assets/js/site.js` y rellena el bloque `SITIO` (primeras líneas):

```js
var SITIO = {
  nombre: 'María Pérez',              // reemplaza [NOMBRE_REALTOR] y los nombres de ejemplo
  inmobiliaria: 'Pérez Realty Group', // [NOMBRE_INMOBILIARIA]
  telefono: '+1 (407) 555-0100',      // [TELEFONO]
  email: 'hola@ejemplo.com',          // [EMAIL]
  whatsapp: '14075550100',            // solo dígitos con código de país
  biografia: '',                      // texto de "Sobre mí"
  formEndpoint: ''                    // opcional, ver abajo
};
```

Mientras un campo esté vacío, el sitio muestra el marcador del diseño
(`[TELEFONO]`, etc.). Al rellenarlo se actualiza en **todas** las páginas y los
teléfonos/correos/WhatsApp se vuelven enlaces que abren la llamada, el correo o el chat.

## Formularios

Contacto, agendar, estimación, inversión y mudanza validan los datos y llevan a
`gracias.html`, que muestra la confirmación que corresponde. Para que las
solicitudes **lleguen a un correo**, crea un formulario gratuito en
[Formspree](https://formspree.io) (o similar) y pega su URL en
`SITIO.formEndpoint`. Sin eso, el cliente puede reenviar la solicitud por
WhatsApp desde la página de confirmación.

## Elementos de demostración del diseño

Se mantuvieron porque están en el diseño; conviene quitarlos antes del
lanzamiento real: la franja "Vista de demostración", los botones "Simular vacío"
(catálogo) y "Simular tipología" (confirmación), las etiquetas "Ejemplo
ilustrativo" y el texto "Prototipo y diseño en Google Stitch" del pie.

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
