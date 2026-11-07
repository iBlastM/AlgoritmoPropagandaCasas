# Panel territorial · Metrix

Sitio estático (HTML, CSS y JS sin compilación) con los resultados del modelo de expansión de casas y de propaganda. Esta carpeta es el repositorio completo para GitHub Pages.

## Qué se publica y qué no

Se publica: secciones con su puntaje y factores, geometrías, vías de OpenStreetMap y análisis de factores.

**No se publica:** las coordenadas de las casas (domicilios de anfitriones). Viven en `casas.js`, que está en `.gitignore`. El sitio solo lo carga desde `localhost` o `file://`, así que en Pages las opciones de ubicación de casas no aparecen. Tampoco viajan nombres, teléfonos ni claves de elector. Las distancias a la casa más cercana van redondeadas a 0.25 km para que no se puedan triangular.

**Sí queda visible para cualquiera con el enlace:**
- qué secciones tienen casa y cuántas, y el ranking de secciones prioritarias;
- los pesos y el análisis de factores.

GitHub Pages es público aunque el repositorio sea privado (y con repositorio privado exige un plan de pago). `robots.txt` y `noindex` piden a los buscadores que no lo indexen, pero no impiden entrar a quien tenga la URL. Si esa información es estratégica, valida con el cliente antes de publicar.

## Publicar en GitHub Pages

1. Crea un repositorio vacío en GitHub (sin README ni .gitignore).
2. Desde esta carpeta:
   ```
   git remote add origin https://github.com/<usuario>/<repositorio>.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. Al cabo de uno o dos minutos queda en `https://<usuario>.github.io/<repositorio>/`.

Las rutas son relativas, así que funciona bajo `/<repositorio>/` sin cambios. La navegación usa `#casas`, `#propaganda` y `#factores`, por lo que no necesita configuración de servidor.

## Actualizar datos

1. En la raíz del proyecto: `python run.py --sin-red`. Regenera `datos.js`, `vias.js` y `casas.js` aquí.
2. Revisa el cambio y súbelo:
   ```
   git add datos.js vias.js
   git commit -m "Actualiza datos"
   git push
   ```

## Ver el sitio en local

Abre `index.html` con doble clic, o sirve la carpeta (`python -m http.server`). En local sí aparece la capa de ubicación de casas si existe `casas.js`.

## Dependencias externas

Se cargan por internet: Leaflet (unpkg.com), la tipografía Barlow (Google Fonts) y los mosaicos del mapa (OpenStreetMap). Sin conexión el panel abre, pero sin mapa base.

## Archivos

| Archivo | Qué es | Se sube |
|---|---|---|
| `index.html`, `css/`, `js/`, `assets/` | El sitio | Sí |
| `datos.js` | Resultados y análisis (generado) | Sí |
| `vias.js` | Vías principales de OpenStreetMap (generado) | Sí |
| `casas.js` | Coordenadas de las casas (generado) | **No** |
| `.nojekyll`, `robots.txt` | Configuración de Pages | Sí |
