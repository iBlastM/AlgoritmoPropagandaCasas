/* Panel territorial: vistas de Casas, Propaganda y Factores.
   Los datos vienen de datos.js (generado por run.py); aquí no hay cifras de resultados escritas a mano. */
(function () {
  'use strict';

  const D = window.DATOS;
  const S = D.secciones;
  const FIDS = D.factores.map(f => f.id);
  const FLAB = Object.fromEntries(D.factores.map(f => [f.id, f.label]));
  const FIX = Object.fromEntries(FIDS.map((id, i) => [id, i]));
  const SHORT = { voto_duro: 'voto duro', ultima_eleccion: 'última elec.', densidad: 'densidad', tamano: 'tamaño',
    fuerza_pan: '% PAN', participacion: 'particip.', tendencia: 'tendencia', exposicion_vial: 'exp. vial', competitividad: 'cerrada' };

  const fmt = new Intl.NumberFormat('es-MX');
  const fmt1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const titulo = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ── Tema ────────────────────────────────────────────────────── */
  function aplicarTema(t) {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('db-theme', t);
    $('#theme-toggle').setAttribute('aria-label', t === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    document.dispatchEvent(new Event('tema'));
  }
  $('#theme-toggle').addEventListener('click', () =>
    aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#theme-toggle').setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');

  const f = new Date(D.meta.generado + 'T12:00:00');
  $('#generado').textContent = 'Datos al ' + f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

  /* ── Coordenadas de las casas ────────────────────────────────────
     Son domicilios de anfitriones. Solo se cargan en local (localhost o file://). En GitHub Pages
     casas.js no existe y las opciones de ubicación de casas no aparecen. */
  const LOCAL = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
  let CASAS = [];
  function cargarCasasLocales(listo) {
    if (!LOCAL) return listo();
    const s = document.createElement('script');
    s.src = 'casas.js';
    s.onload = () => { CASAS = window.CASAS || []; listo(); };
    s.onerror = () => listo();
    document.body.appendChild(s);
  }

  /* ── Cálculo de puntajes ─────────────────────────────────────── */
  function quantil(arr, p) {
    if (!arr.length) return 0;
    const a = [...arr].sort((x, y) => x - y);
    return a[Math.min(a.length - 1, Math.floor(p * a.length))];
  }

  function calcular(v) {
    const ids = v.cfg.factores;
    const total = ids.reduce((a, id) => a + v.pesos[id], 0) || 1;
    v.total = total;
    v.scores = S.map(s => {
      let t = 0;
      for (const id of ids) t += s.f[FIX[id]] * v.pesos[id];
      return 100 * t / total;
    });
    v.libre = S.map(s => v.cfg.libre(s, v));
    const vals = v.scores.filter((_, i) => v.libre[i]);
    v.q = { q25: quantil(vals, 0.25), q50: quantil(vals, 0.5), p75: quantil(vals, 0.75), p90: quantil(vals, 0.9) };
    v.orden = S.map((_, i) => i).filter(i => v.libre[i]).sort((a, b) => v.scores[b] - v.scores[a]);
  }

  function prioridad(v, i) {
    if (v.cfg.cubierta && S[i].c > 0) return 'Cubierta';
    if (!v.libre[i]) return 'Cerca de casa';
    const s = v.scores[i];
    if (s >= v.q.p90) return '1-Alta';
    if (s >= v.q.p75) return '2-Media';
    return '3-Baja';
  }

  function colorRampa(v, i) {
    const s = v.scores[i], q = v.q;
    const k = s >= q.p90 ? 4 : s >= q.p75 ? 3 : s >= q.q50 ? 2 : s >= q.q25 ? 1 : 0;
    return css('--ramp-' + k);
  }

  /* ── Vista de mapa (Casas y Propaganda) ──────────────────────── */
  const VISTAS = {};

  function crearVista(cfg) {
    const v = {
      cfg, root: $('#panel-' + cfg.id), iniciada: false, sel: null,
      pesos: Object.fromEntries(cfg.factores.map(id => [id, Math.round((D.perfiles[cfg.perfil].pesos[id] || 0) * 100)])),
      radio: cfg.perfil === 'expansion' ? D.perfiles.expansion.radio : 0, verCub: true, verCasas: false, verVias: true, verSec: true,
    };
    VISTAS[cfg.id] = v;
    return v;
  }

  const cfgCasas = {
    id: 'casas', perfil: 'expansion', cubierta: true,
    factores: ['voto_duro', 'fuerza_pan', 'ultima_eleccion', 'densidad', 'tamano', 'participacion', 'tendencia'],
    libre: (s, v) => s.c === 0 && s.km >= v.radio,
    lead: 'Mapa de calor inverso. Resalta las secciones sin casa donde abrir una nueva tiene más rendimiento esperado. Las secciones con casa se muestran en azul y no compiten por el ranking.',
  };
  const cfgProp = {
    id: 'propaganda', perfil: 'propaganda', cubierta: false,
    factores: ['exposicion_vial', 'competitividad', 'tamano', 'densidad', 'participacion', 'fuerza_pan', 'voto_duro'],
    libre: () => true,
    lead: 'Primera versión, sin validar. La exposición vial sale de la jerarquía de vías de OpenStreetMap (autopista, troncal, primaria, secundaria), no de aforos medidos. Sirve para priorizar zonas, no para estimar impactos.',
  };

  function construirLateral(v) {
    const c = v.cfg;
    const sliders = c.factores.map(id => `
      <div class="peso" data-id="${id}">
        <label for="${c.id}-w-${id}">${titulo(FLAB[id])}</label>
        <output id="${c.id}-o-${id}"></output>
        <input id="${c.id}-w-${id}" type="range" min="0" max="50" step="1" value="${v.pesos[id]}">
      </div>`).join('');

    let capas;
    if (c.perfil === 'expansion') {
      capas = `
        <h2 class="section-title">Zona sin presencia</h2>
        <div class="peso">
          <label for="${c.id}-radio">Descartar secciones a menos de X km de una casa</label>
          <output id="${c.id}-radio-o"></output>
          <input id="${c.id}-radio" type="range" min="0" max="5" step="0.25" value="${v.radio}">
        </div>
        <label class="opcion"><input type="checkbox" id="${c.id}-cub" checked> Mostrar secciones con casa</label>
        ${CASAS.length ? `<label class="opcion"><input type="checkbox" id="${c.id}-casas"> Mostrar ubicación de las casas</label>` : ''}
        <p class="hint">${D.meta.casas_sin_ubicar} de ${D.meta.casas} casas no se pudieron ubicar; su sección puede aparecer como libre.</p>`;
    } else {
      capas = `
        <h2 class="section-title">Capas</h2>
        <label class="opcion"><input type="checkbox" id="${c.id}-vias" checked> Vías principales</label>
        <label class="opcion"><input type="checkbox" id="${c.id}-sec" checked> Color por sección</label>
        ${CASAS.length ? `<label class="opcion"><input type="checkbox" id="${c.id}-casas"> Ubicación de las casas</label>` : ''}`;
    }

    const corredores = c.perfil === 'propaganda' ? `
      <h2 class="section-title">Corredores con más km en prioridad alta</h2>
      <ol class="lista corredores">${D.corredores.slice(0, 8).map(r => `
        <li><span class="nom">${esc(r.nombre)}<small>${r.clase} · ${fmt1.format(r.km_alta)} de ${fmt1.format(r.km)} km en prioridad alta</small></span>
        <span class="pts">${fmt1.format(r.puntaje_medio)}</span></li>`).join('')}</ol>
      <p class="hint">Con los pesos por defecto. Excluye autopistas y calles terciarias.</p>` : '';

    v.root.innerHTML = `
      <div class="toolbar"><p class="stats" id="${c.id}-stats" aria-live="polite"></p></div>
      <div class="workspace">
        <aside class="side" aria-label="Controles">
          <p class="lead">${c.lead}</p>
          <h2 class="section-title">Pesos de los factores</h2>
          ${sliders}
          <p class="hint">Los pesos se normalizan a 100%.</p>
          <div class="btns">
            <button class="btn" type="button" id="${c.id}-reset">Restaurar pesos</button>
            <button class="btn" type="button" id="${c.id}-csv">Descargar ranking (CSV)</button>
          </div>
          ${capas}
          <h2 class="section-title">Mejores 15 secciones</h2>
          <ol class="lista" id="${c.id}-top"></ol>
          ${corredores}
          <div id="${c.id}-detalle"></div>
        </aside>
        <div class="map-wrap"><div class="map" id="${c.id}-map" role="application" aria-label="Mapa de secciones"></div></div>
      </div>
      <div class="bloque">
        <h2 class="section-title">Resumen por municipio</h2>
        <div class="tabla-scroll"><table class="datos" id="${c.id}-tabla"></table></div>
      </div>`;
  }

  function iniciarVista(v) {
    const c = v.cfg;
    construirLateral(v);
    mostrarDetalle(v, null);

    // Controles
    c.factores.forEach(id => {
      const inp = $('#' + c.id + '-w-' + id);
      inp.addEventListener('input', () => { v.pesos[id] = +inp.value; refrescar(v); });
    });
    $('#' + c.id + '-reset').addEventListener('click', () => {
      c.factores.forEach(id => {
        v.pesos[id] = Math.round((D.perfiles[c.perfil].pesos[id] || 0) * 100);
        $('#' + c.id + '-w-' + id).value = v.pesos[id];
      });
      refrescar(v);
    });
    $('#' + c.id + '-csv').addEventListener('click', () => descargarCSV(v));
    const radio = $('#' + c.id + '-radio');
    if (radio) radio.addEventListener('input', () => { v.radio = +radio.value; refrescar(v); });
    const cub = $('#' + c.id + '-cub');
    if (cub) cub.addEventListener('change', () => { v.verCub = cub.checked; restilar(v); });
    const sec = $('#' + c.id + '-sec');
    if (sec) sec.addEventListener('change', () => { v.verSec = sec.checked; restilar(v); });
    const chkCasas = $('#' + c.id + '-casas');
    if (chkCasas) chkCasas.addEventListener('change', e => {
      v.verCasas = e.target.checked;
      e.target.checked ? v.capaCasas.addTo(v.map) : v.map.removeLayer(v.capaCasas);
    });
    const vias = $('#' + c.id + '-vias');
    if (vias) vias.addEventListener('change', e => {
      v.verVias = e.target.checked;
      if (v.capaVias) e.target.checked ? v.capaVias.addTo(v.map) : v.map.removeLayer(v.capaVias);
    });

    // Mapa
    v.map = L.map(c.id + '-map', { preferCanvas: true, zoomSnap: 0.5 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© colaboradores de OpenStreetMap', maxZoom: 19 }).addTo(v.map);
    v.capas = [];
    v.geo = L.geoJSON({ type: 'FeatureCollection', features: D.geo.map((g, i) => ({ type: 'Feature', properties: { i }, geometry: g })) }, {
      style: () => ({ weight: 0.4 }),
      onEachFeature: (ft, layer) => {
        const i = ft.properties.i;
        v.capas[i] = layer;
        layer.bindTooltip(() => tooltip(v, i), { sticky: true, className: 'tip', direction: 'top', opacity: 1 });
        layer.on('click', () => seleccionar(v, i));
      },
    }).addTo(v.map);
    v.map.fitBounds(v.geo.getBounds());

    v.capaCasas = L.layerGroup();
    CASAS.forEach(k => L.circleMarker([k.lat, k.lon], { radius: 5, weight: 1.5, color: css('--bg-card'), fillOpacity: 1,
      fillColor: k.seg === 'malo' ? css('--bad') : k.seg === 'bueno' ? css('--accent-1') : '#8a94a0' })
      .bindTooltip('Casa ' + k.id + ' · seguimiento: ' + k.seg.replace('_', ' '), { className: 'tip' }).addTo(v.capaCasas));
    v.casasMarkers = v.capaCasas.getLayers();

    const leyenda = L.control({ position: 'bottomright' });
    leyenda.onAdd = () => { const d = L.DomUtil.create('div', 'leyenda'); v.leyendaEl = d; L.DomEvent.disableClickPropagation(d); return d; };
    leyenda.addTo(v.map);

    if (c.perfil === 'propaganda') cargarVias(v);

    document.addEventListener('tema', () => {
      restilar(v);
      v.casasMarkers.forEach((m, k) => m.setStyle({ color: css('--bg-card') }));
      if (v.capaVias) estilarVias(v);
    });
    v.iniciada = true;
    refrescar(v);
  }

  /* Vías (solo propaganda): se cargan al entrar a la pestaña */
  function cargarVias(v) {
    const pintar = () => {
      v.map.createPane('vias').style.zIndex = 450;
      v.map.getPane('vias').style.pointerEvents = 'none';
      const canvas = L.canvas({ pane: 'vias', padding: 0.3 });
      v.capaVias = L.layerGroup();
      v.viasLineas = window.VIAS.map(g => {
        const l = L.polyline(g.g, { renderer: canvas, interactive: false, lineJoin: 'round', lineCap: 'round' });
        l._clase = g.c;
        return l.addTo(v.capaVias);
      });
      estilarVias(v);
      if (v.verVias) v.capaVias.addTo(v.map);
    };
    if (window.VIAS) return pintar();
    const s = document.createElement('script');
    s.src = 'vias.js';
    s.onload = pintar;
    s.onerror = () => { $('#' + v.cfg.id + '-vias').disabled = true; };
    document.body.appendChild(s);
  }

  function estilarVias(v) {
    const dark = document.documentElement.dataset.theme === 'dark';
    const est = {
      0: { color: css('--via-troncal'), weight: 1.4, opacity: 0.75, dashArray: '5 4' },
      1: { color: css('--via-troncal'), weight: 2.4, opacity: 0.95 },
      2: { color: css('--via-troncal'), weight: 2, opacity: 0.9 },
      3: { color: css('--via-sec'), weight: 1.3, opacity: dark ? 0.85 : 0.8 },
    };
    v.viasLineas.forEach(l => l.setStyle(est[l._clase]));
  }

  /* Estilo, tooltip, selección */
  function estilo(v, i) {
    const s = S[i];
    const sel = v.sel === i;
    const borde = sel ? { color: css('--accent-1'), weight: 3 } : null;
    let st;
    if (v.cfg.cubierta && s.c > 0) {
      st = v.verCub ? { fillColor: css('--cubierta'), fillOpacity: 0.55, color: css('--cubierta'), weight: 1.2 } : { fillOpacity: 0, weight: 0, stroke: false };
    } else if (!v.libre[i]) {
      st = { fillColor: css('--cerca'), fillOpacity: 0.6, color: css('--map-edge'), weight: 0.4 };
    } else if (v.cfg.perfil === 'propaganda' && !v.verSec) {
      st = { fillOpacity: 0, color: css('--map-edge'), weight: 0.3 };
    } else {
      st = { fillColor: colorRampa(v, i), fillOpacity: 0.8, color: css('--map-edge'), weight: 0.35, stroke: true };
    }
    return borde ? { ...st, ...borde, stroke: true } : st;
  }

  function restilar(v) {
    if (!v.iniciada) return;
    S.forEach((_, i) => v.capas[i].setStyle(estilo(v, i)));
    if (v.sel !== null) v.capas[v.sel].bringToFront();
    leyenda(v);
  }

  function leyenda(v) {
    const sw = (k, t) => `<i style="background:${css('--ramp-' + k)}"></i>${t}`;
    let h = `<b>${v.cfg.perfil === 'expansion' ? 'SECCIONES SIN CASA' : 'PUNTAJE DE LA SECCIÓN'}</b>` +
      [sw(4, 'Prioridad alta (10% superior)'), sw(3, 'Media (siguiente 15%)'), sw(2, 'Intermedia'), sw(1, 'Baja'), sw(0, 'Muy baja')].join('<br>');
    if (v.cfg.perfil === 'expansion') {
      h += `<br><i style="background:${css('--cubierta')}"></i>Con casa<br><i style="background:${css('--cerca')}"></i>Cerca de una casa (según radio)`;
    } else {
      h += `<br><b style="margin-top:4px">VÍAS</b><i class="linea" style="border-color:${css('--via-troncal')}"></i>Troncal y primaria<br>` +
        `<i class="linea" style="border-color:${css('--via-sec')}"></i>Secundaria`;
    }
    v.leyendaEl.innerHTML = h;
  }

  function tooltip(v, i) {
    const s = S[i], p = prioridad(v, i);
    const filas = [['Prioridad', p], ['Puntaje', fmt1.format(v.scores[i])], ['Lista nominal', fmt.format(s.ln)]];
    if (v.cfg.perfil === 'propaganda') filas.push(['Vías principales', fmt1.format(s.kv) + ' km']);
    else filas.push(['Casas', s.c]);
    return `<strong>Sección ${s.s}</strong> · ${esc(s.m)}<table>${filas.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
  }

  function seleccionar(v, i) {
    const previo = v.sel;
    v.sel = i;
    if (previo !== null) v.capas[previo].setStyle(estilo(v, previo));
    v.capas[i].setStyle(estilo(v, i));
    v.capas[i].bringToFront();
    mostrarDetalle(v, i);
  }

  function badge(p) {
    const cls = p === '1-Alta' ? 'alta' : p === '2-Media' ? '' : p === 'Cubierta' ? 'warn' : 'mute';
    const txt = { '1-Alta': 'Prioridad alta', '2-Media': 'Prioridad media', '3-Baja': 'Prioridad baja', Cubierta: 'Con casa', 'Cerca de casa': 'Cerca de casa' }[p];
    return `<span class="badge ${cls}">${txt}</span>`;
  }

  function mostrarDetalle(v, i) {
    const box = $('#' + v.cfg.id + '-detalle');
    if (i === null) { box.innerHTML = '<p class="vacio">Haz clic en una sección del mapa para ver por qué obtiene su puntaje.</p>'; return; }
    const s = S[i], ids = v.cfg.factores;
    const filas = ids.filter(id => v.pesos[id] > 0).map(id => {
      const val = s.f[FIX[id]], share = v.pesos[id] / v.total;
      return { id, val, pts: val * share * 100, share };
    }).sort((a, b) => b.pts - a.pts);
    const datos = v.cfg.perfil === 'expansion'
      ? [['Lista nominal', fmt.format(s.ln)], ['Electores por km²', fmt.format(s.d)], ['Ciclos ganados PAN', s.cg + ' de 3'], ['% voto PAN', s.pp + '%'],
         ['Casas en la sección', s.c + (s.cd ? ` (${s.cd} débiles)` : '')], ['Km a casa más cercana', fmt1.format(s.km)],
         ['Estabilidad del ranking', s.ee !== null && s.c === 0 ? s.ee + '%' : '—']]
      : [['Lista nominal', fmt.format(s.ln)], ['Km de vías principales', fmt1.format(s.kv)], ['Km troncal y primaria', fmt1.format(s.kp)],
         ['Margen PAN 2024', s.mg === null ? '—' : (s.mg > 0 ? '+' : '') + fmt1.format(s.mg) + ' pts'], ['% voto PAN', s.pp + '%'],
         ['Casas en la sección', s.c], ['Estabilidad del ranking', s.ep !== null ? s.ep + '%' : '—']];
    box.innerHTML = `
      <div class="detalle">
        <h3>Sección ${s.s}</h3>
        <div class="sub">${esc(s.m)} · Distrito local ${s.dl}</div>
        <div class="score"><b>${fmt1.format(v.scores[i])}</b> ${badge(prioridad(v, i))}</div>
        <ul>${filas.map(r => `
          <li><span>${titulo(FLAB[r.id])}</span><span>+${fmt1.format(r.pts)}</span>
          <div class="barra" title="Nivel del factor: ${Math.round(r.val * 100)}%"><i style="width:${Math.round(r.val * 100)}%"></i></div></li>`).join('')}</ul>
        <p class="hint">La barra es qué tan favorable es la sección en ese factor. El número son los puntos que aporta.</p>
        <div class="datos">${datos.map(d => `<span>${d[0]}</span><b>${d[1]}</b>`).join('')}</div>
      </div>`;
  }

  /* Refresco general */
  function refrescar(v) {
    calcular(v);
    const c = v.cfg;
    c.factores.forEach(id => {
      const o = $('#' + c.id + '-o-' + id), fila = o.closest('.peso');
      o.textContent = v.pesos[id] > 0 ? Math.round(v.pesos[id] / v.total * 100) + '%' : 'apagado';
      fila.classList.toggle('off', v.pesos[id] === 0);
    });
    const ro = $('#' + c.id + '-radio-o');
    if (ro) ro.textContent = v.radio + ' km';
    restilar(v);
    estadisticas(v);
    listaTop(v);
    tabla(v);
    if (v.sel !== null) mostrarDetalle(v, v.sel);
  }

  function estadisticas(v) {
    const alta = v.orden.filter(i => prioridad(v, i) === '1-Alta');
    const ln = alta.reduce((a, i) => a + S[i].ln, 0);
    const b = n => `<b>${fmt.format(n)}</b>`;
    let h;
    if (v.cfg.perfil === 'expansion') {
      h = `<span>${b(v.orden.length)}secciones sin casa</span><span>${b(alta.length)}prioridad alta</span>` +
        `<span>${b(ln)}electores en prioridad alta</span><span>${b(S.filter(s => s.c > 0).length)}secciones con casa</span>`;
    } else {
      const km = alta.reduce((a, i) => a + S[i].kv, 0);
      h = `<span>${b(S.length)}secciones</span><span>${b(alta.length)}prioridad alta</span>` +
        `<span>${b(Math.round(km))}km de vías principales en prioridad alta</span><span>${b(ln)}electores en prioridad alta</span>`;
    }
    $('#' + v.cfg.id + '-stats').innerHTML = h;
  }

  function listaTop(v) {
    const ol = $('#' + v.cfg.id + '-top');
    ol.innerHTML = v.orden.slice(0, 15).map((i, k) => {
      const s = S[i];
      return `<li tabindex="0" data-i="${i}"><span class="pos">${k + 1}</span>
        <span class="nom">Sección ${s.s}<small>${esc(s.m)} · ${fmt.format(s.ln)} electores</small></span>
        <span class="pts">${fmt1.format(v.scores[i])}</span></li>`;
    }).join('');
    $$('li', ol).forEach(li => {
      const ir = () => { const i = +li.dataset.i; v.map.fitBounds(v.capas[i].getBounds(), { maxZoom: 15, padding: [40, 40] }); seleccionar(v, i); };
      li.addEventListener('click', ir);
      li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } });
    });
  }

  function tabla(v) {
    const g = {};
    S.forEach((s, i) => {
      const m = g[s.m] || (g[s.m] = { m: s.m, n: 0, ln: 0, cub: 0, alta: 0, lnAlta: 0, kmAlta: 0, mejor: -1 });
      m.n++; m.ln += s.ln;
      if (s.c > 0) m.cub++;
      if (v.libre[i]) m.mejor = Math.max(m.mejor, v.scores[i]);
      if (prioridad(v, i) === '1-Alta') { m.alta++; m.lnAlta += s.ln; m.kmAlta += s.kv; }
    });
    const filas = Object.values(g).sort((a, b) => b.alta - a.alta || b.mejor - a.mejor);
    const exp = v.cfg.perfil === 'expansion';
    const cab = exp
      ? ['Municipio', 'Secciones', 'Lista nominal', 'Con casa', 'Prioridad alta', 'Electores en prioridad alta', 'Mejor puntaje']
      : ['Municipio', 'Secciones', 'Lista nominal', 'Prioridad alta', 'Km de vías en prioridad alta', 'Electores en prioridad alta', 'Mejor puntaje'];
    $('#' + v.cfg.id + '-tabla').innerHTML =
      `<thead><tr>${cab.map((t, k) => `<th scope="col" class="${k ? 'n' : ''}">${t}</th>`).join('')}</tr></thead><tbody>` +
      filas.map(m => `<tr><td>${esc(m.m)}</td><td class="n">${fmt.format(m.n)}</td><td class="n">${fmt.format(m.ln)}</td>` +
        (exp ? `<td class="n">${m.cub}</td>` : '') + `<td class="n">${m.alta}</td>` +
        (exp ? '' : `<td class="n">${fmt.format(Math.round(m.kmAlta))}</td>`) +
        `<td class="n">${fmt.format(m.lnAlta)}</td><td class="n">${m.mejor < 0 ? '—' : fmt1.format(m.mejor)}</td></tr>`).join('') + '</tbody>';
  }

  function descargarCSV(v) {
    const filas = [['ranking', 'seccion', 'municipio', 'puntaje', 'prioridad', 'lista_nominal']];
    v.orden.forEach((i, k) => filas.push([k + 1, S[i].s, '"' + S[i].m + '"', v.scores[i].toFixed(1), prioridad(v, i), S[i].ln]));
    const pesos = '# pesos: ' + v.cfg.factores.map(id => id + '=' + Math.round(v.pesos[id] / v.total * 100) + '%').join(' ');
    const blob = new Blob(['\ufeff' + pesos + '\n' + filas.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ranking_' + v.cfg.id + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ── Vista de factores ───────────────────────────────────────── */
  const AN = D.analisis;
  let perfilFactores = 'expansion';
  let factoresIniciada = false;

  function bar(valor, max, texto, alt) {
    const w = Math.max(0, Math.min(100, valor / max * 100));
    return `<div class="metrica"><div class="pista ${alt ? 'alt' : ''}"><i style="width:${w}%"></i></div><span>${texto}</span></div>`;
  }
  const na = t => `<div class="metrica na"><span>${t}</span></div>`;

  const VEREDICTO = { Decisivo: 'alta', Aporta: '', Compartido: 'warn', Marginal: 'mute', Apagado: 'mute' };

  function renderFactores() {
    const root = $('#panel-factores');
    const A = AN[perfilFactores];
    const nombrePerfil = perfilFactores === 'expansion' ? 'expansión de casas' : 'propaganda';
    const filas = [...A.factores].sort((a, b) => (b.impacto ?? -1) - (a.impacto ?? -1) || b.peso - a.peso);
    const maxPeso = Math.max(...A.factores.map(f => Math.max(f.peso, f.contribucion)), 1);

    const tablaFactores = `
      <table class="datos">
        <thead><tr><th scope="col">Factor</th><th scope="col">Peso asignado</th><th scope="col">Peso efectivo</th>
          <th scope="col">Información única</th><th scope="col">Impacto si se quita</th><th scope="col">Lectura</th></tr></thead>
        <tbody>${filas.map(f => {
          const activo = f.peso > 0;
          return `<tr>
            <td><span class="factor-nom">${titulo(f.etiqueta)}</span><span class="razon">${esc(f.razon)}</span></td>
            <td>${activo ? bar(f.peso, maxPeso, f.peso.toFixed(0) + '%') : na('no se usa')}</td>
            <td>${activo ? bar(Math.max(f.contribucion, 0), maxPeso, f.contribucion.toFixed(0) + '%') : na('—')}</td>
            <td>${f.unicidad === null ? na('—') : bar(f.unicidad * 100, 100, Math.round(f.unicidad * 100) + '%', true)}</td>
            <td>${f.impacto === null ? na('—') : bar(f.impacto, 100, Math.round(f.impacto) + '%')}</td>
            <td><span class="badge ${VEREDICTO[f.veredicto]}">${f.veredicto}</span></td></tr>`;
        }).join('')}</tbody></table>
      <details class="leer"><summary>Cómo leer esta tabla</summary>
        <dl>
          <dt>Peso asignado</dt><dd>Lo que se le dio al factor al diseñar el perfil.</dd>
          <dt>Peso efectivo</dt><dd>Qué parte de la variación del puntaje se debe al factor. Puede ser mayor que el asignado si el factor se mueve junto con otros, o menor si se compensa con ellos.</dd>
          <dt>Información única</dt><dd>Qué parte del factor no se puede reconstruir con los demás. Cerca de 100%: nadie más dice lo mismo. Cerca de 0%: es redundante.</dd>
          <dt>Impacto si se quita</dt><dd>Se quita el factor, se reparten sus puntos entre los demás y se compara el 10% superior de secciones. El porcentaje es cuántas secciones del top cambian.</dd>
        </dl></details>`;

    const tablaGrupos = `
      <table class="datos">
        <thead><tr><th scope="col">Dimensión</th><th scope="col">Factores que la forman</th><th scope="col">Peso asignado</th>
          <th scope="col">Peso efectivo</th><th scope="col">Impacto si se quita la dimensión</th></tr></thead>
        <tbody>${A.grupos.map(g => `<tr><td class="factor-nom">${esc(g.grupo)}</td>
          <td class="sub">${g.miembros.map(esc).join(', ')}</td>
          <td>${bar(g.peso, 100, g.peso.toFixed(0) + '%')}</td><td>${bar(Math.max(g.contribucion, 0), 100, g.contribucion.toFixed(0) + '%')}</td>
          <td>${g.impacto === null ? na('—') : bar(g.impacto, 100, Math.round(g.impacto) + '%')}</td></tr>`).join('')}</tbody></table>`;

    // Predicción (siempre sobre factores electorales de expansión)
    const pred = AN.expansion.factores.filter(f => f.prediccion_ganar !== null)
      .sort((a, b) => b.prediccion_ganar - a.prediccion_ganar);
    const barP = v => {
      const w = Math.min(100, Math.abs(v) * 100);
      return `<div class="metrica"><div class="pista"><i style="width:${w}%;${v < 0 ? 'background:var(--bad)' : ''}"></i></div><span>${v.toFixed(2)}</span></div>`;
    };
    const predHtml = `<div class="pred">${pred.map(f => `
      <span class="factor-nom">${titulo(f.etiqueta)}</span>
      <div class="dobles">
        <div class="metrica"><span class="tag" style="text-align:left">PAN ganó</span>${barP(f.prediccion_ganar).replace('class="metrica"', 'class="metrica" style="flex:1"')}</div>
        <div class="metrica"><span class="tag" style="text-align:left">Votos PAN</span>${barP(f.prediccion_votos).replace('class="metrica"', 'class="metrica" style="flex:1"')}</div>
      </div>`).join('')}</div>`;

    // Matriz de correlación
    const C = AN.correlaciones, M = C[perfilFactores];
    const dark = document.documentElement.dataset.theme === 'dark';
    const celdas = [`<div></div>`, ...C.ids.map(id => `<div class="h">${SHORT[id]}</div>`)];
    C.ids.forEach((idr, r) => {
      celdas.push(`<div class="r">${SHORT[idr]}</div>`);
      C.ids.forEach((idc, c) => {
        const x = M[r][c], a = r === c ? 0 : Math.min(0.92, Math.abs(x) * 0.95);
        const rgb = x >= 0 ? '123,193,29' : '242,169,0';
        const oscuro = a > 0.5;
        celdas.push(`<div class="c" style="background:rgba(${rgb},${a});${oscuro ? 'color:#060606;font-weight:600' : ''}" title="${esc(C.etiquetas[r])} y ${esc(C.etiquetas[c])}: ${x.toFixed(2)}">${r === c ? '' : x.toFixed(2)}</div>`);
      });
    });
    const matriz = `<div class="matriz" style="grid-template-columns: 5.5rem repeat(${C.ids.length}, minmax(44px, 1fr))">${celdas.join('')}</div>`;

    const m = D.meta;
    const calidad = [
      `<b>${m.casas}</b> casas en el registro: <b>${m.casas_gps}</b> ubicadas por GPS, <b>${m.casas_excel}</b> por la sección capturada y <b>${m.casas_sin_ubicar}</b> sin ubicar. En <b>${m.casas_discrepancia}</b> la sección capturada no coincide con el GPS y se usó el GPS.`,
      `<b>${m.sin_historial_completo}</b> de ${m.secciones} secciones se crearon después de 2018. Su voto duro tiene menos respaldo y se acerca a la media estatal.`,
      `Las coaliciones se suman por municipio o distrito, no con el primer lugar crudo de los archivos. Detalle en <b>salida/auditoria_bloques.csv</b>.`,
      `Densidad es lista nominal por km² de la sección; los archivos no traen censo.`,
      `La exposición vial usa <b>${fmt.format(m.km_vias)}</b> km de vías de OpenStreetMap y mide jerarquía, no tránsito.`,
      `El análisis es por sección electoral. No hay capa de colonias en los datos.`,
    ];

    root.innerHTML = `
      <div class="cabecera">
        <div>
          <h2>Qué factores aportan más información</h2>
          <p>Cada factor se mide por cuánto cambia el resultado si se quita, cuánta información repite de otros y, en los electorales, qué tanto anticipó 2024 con datos hasta 2021.</p>
        </div>
        <div class="segmented" role="group" aria-label="Perfil">
          <button type="button" data-p="expansion" aria-pressed="${perfilFactores === 'expansion'}">Expansión de casas</button>
          <button type="button" data-p="propaganda" aria-pressed="${perfilFactores === 'propaganda'}">Propaganda</button>
        </div>
      </div>
      <div class="pagina">
        <section><h2 class="section-title">Hallazgos</h2>
          <div class="hallazgos">${AN.hallazgos.map(h => `<article><h3>${esc(h.titulo)}</h3><p>${esc(h.texto)}</p></article>`).join('')}</div></section>
        <section><h2 class="section-title">Aporte de cada factor · ${nombrePerfil}</h2>
          <div class="tabla-scroll">${tablaFactores}</div></section>
        <section><h2 class="section-title">Por dimensión · ${nombrePerfil}</h2>
          <div class="tabla-scroll">${tablaGrupos}</div>
          <p class="nota">Quitar un factor por separado subestima a los que se repiten: los otros lo compensan. Quitar la dimensión completa muestra cuánto pesa realmente.</p></section>
        <div class="cols-2">
          <section><h2 class="section-title">Qué tanto anticipó 2024</h2>${predHtml}
            <p class="nota">Correlación (Spearman) entre el factor calculado con datos hasta 2021 y lo que pasó en 2024, sobre ${AN.backtest.n} secciones con historial completo.
            El puntaje completo alcanza ${AN.backtest.rho_puntaje_ganar.toFixed(2)} con "PAN ganó": el ${Math.round(AN.backtest.top_gana * 100)}% de las secciones mejor puntuadas ganó el PAN en 2024, contra ${Math.round(AN.backtest.resto_gana * 100)}% en el resto.
            Solo aplica a factores electorales.</p></section>
          <section><h2 class="section-title">Qué factores se repiten</h2>${matriz}
            <p class="nota">Correlación entre factores en las 953 secciones. Verde: se mueven juntos. Ámbar: se mueven en sentido contrario. Dos factores muy verdes entre sí dicen casi lo mismo.</p></section>
        </div>
        <section><h2 class="section-title">Calidad de los datos y límites</h2>
          <ul class="calidad">${calidad.map(t => `<li>${t}</li>`).join('')}</ul></section>
      </div>`;

    $$('.segmented button', root).forEach(b => b.addEventListener('click', () => { perfilFactores = b.dataset.p; renderFactores(); }));
    factoresIniciada = true;
  }

  /* ── Navegación por pestañas ─────────────────────────────────── */
  const TABS = ['casas', 'propaganda', 'factores'];
  const vCasas = crearVista(cfgCasas);
  const vProp = crearVista(cfgProp);

  function mostrarTab(id, enfocar) {
    if (!TABS.includes(id)) id = 'casas';
    TABS.forEach(t => {
      const activo = t === id;
      const tab = $('#tab-' + t);
      tab.setAttribute('aria-selected', activo);
      tab.tabIndex = activo ? 0 : -1;
      $('#panel-' + t).hidden = !activo;
    });
    if (enfocar) $('#tab-' + id).focus();
    const v = VISTAS[id];
    if (v) {
      if (!v.iniciada) iniciarVista(v);
      else setTimeout(() => { v.map.invalidateSize(); }, 0);
    } else if (!factoresIniciada) renderFactores();
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    window.scrollTo({ top: 0 });
  }

  $$('.tab').forEach(t => t.addEventListener('click', () => mostrarTab(t.id.replace('tab-', ''))));
  $('.tabs').addEventListener('keydown', e => {
    const i = TABS.findIndex(t => $('#tab-' + t).getAttribute('aria-selected') === 'true');
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    if (n !== null) { e.preventDefault(); mostrarTab(TABS[n], true); }
  });
  window.addEventListener('hashchange', () => mostrarTab(location.hash.slice(1)));
  document.addEventListener('tema', () => { if (factoresIniciada && !$('#panel-factores').hidden) renderFactores(); });

  cargarCasasLocales(() => mostrarTab(location.hash.slice(1) || 'casas'));
})();
