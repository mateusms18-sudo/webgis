const dimensions = {
  'Demografia': ['População total', 'População rural', 'Índice de envelhecimento (65+ por 100 pessoas de 0–14 anos)'],
  'Socioeconômico': ['Rendimento domiciliar per capita médio (R$)', 'Moradores até ½ SM per capita ou sem rendimento', 'Taxa de alfabetização (15 anos ou mais)', 'Ensino médio completo ou superior (18+), %'],
  'Agropecuário': ['Estabelecimentos da agricultura familiar', 'Área dos estabelecimentos familiares (ha)', 'Pessoal ocupado na agricultura familiar'],
  'Produção': ['Valor da produção agrícola (R$ mil)', 'Valor da produção de produtos de origem animal (R$ mil)'],
  'Desenvolvimento': ['Valor adicionado bruto agropecuário (R$ mil)', 'Participação agropecuária no VAB municipal (%)']
};
const indicatorDescriptions = {
  'População total': 'Número de residentes no município no Censo Demográfico de 2022. É uma contagem censitária, não uma estimativa anual.',
  'População rural': 'Residentes em domicílios classificados pelo IBGE em situação rural. O dado descreve residência, não ocupação profissional.',
  'Índice de envelhecimento (65+ por 100 pessoas de 0–14 anos)': 'Razão entre a população de 65 anos ou mais e a população de 0 a 14 anos, multiplicada por 100. Valores acima de 100 indicam mais pessoas idosas do que jovens nessa comparação.',
  'Rendimento domiciliar per capita médio (R$)': 'Média mensal nominal do rendimento domiciliar por pessoa, em reais de 2022. Inclui moradores sem rendimento e não representa o salário médio de quem trabalha.',
  'Moradores até ½ SM per capita ou sem rendimento': 'Número de moradores em domicílios com rendimento per capita de até meio salário mínimo ou sem rendimento. É uma aproximação de vulnerabilidade de renda, não uma taxa oficial de pobreza.',
  'Taxa de alfabetização (15 anos ou mais)': 'Percentual de pessoas de 15 anos ou mais alfabetizadas no Censo 2022. A taxa municipal não é somável; uma taxa regional exige ponderação pela população dessa faixa etária.',
  'Ensino médio completo ou superior (18+), %': 'Percentual da população de 18 anos ou mais nas categorias “médio completo e superior incompleto” e “superior completo”, somadas. Provém dos resultados da amostra do Censo 2022.',
  'Estabelecimentos da agricultura familiar': 'Número de estabelecimentos agropecuários classificados como agricultura familiar pelo Censo Agropecuário 2017.',
  'Área dos estabelecimentos familiares (ha)': 'Soma, em hectares, das áreas dos estabelecimentos classificados como agricultura familiar no Censo Agropecuário 2017.',
  'Pessoal ocupado na agricultura familiar': 'Pessoas ocupadas nos estabelecimentos de agricultura familiar recenseados em 2017. Não corresponde ao número de famílias.',
  'Valor da produção agrícola (R$ mil)': 'Valor monetário da produção agrícola municipal no ano indicado pela PAM, expresso em mil reais correntes. Não mede o volume físico produzido.',
  'Valor da produção de produtos de origem animal (R$ mil)': 'Valor monetário dos produtos de origem animal registrados pela PPM, em mil reais correntes. Não representa o valor total da produção de todos os rebanhos.',
  'Valor adicionado bruto agropecuário (R$ mil)': 'Valor adicionado pela atividade agropecuária à economia municipal, em mil reais correntes. É um componente do PIB municipal, não o PIB total.',
  'Participação agropecuária no VAB municipal (%)': 'Parcela percentual do valor adicionado bruto municipal atribuída à agropecuária. Indica a participação do setor na economia local.'
};
const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const municipality = document.getElementById('municipality');
const theme = document.getElementById('theme');
const indicator = document.getElementById('indicator');
const year = document.getElementById('year');
const fairMunicipality = document.getElementById('fair-municipality');
const fairActive = document.getElementById('fair-active');
const fairPeriodicity = document.getElementById('fair-periodicity');
const fairSearch = document.getElementById('fair-search');
const knownNames = new Map();
let boundaryLayer, fairBoundaryLayer, fairMarkers;
let records = [], fairs = [];
let sourceLabel = 'Não informada';

Object.keys(dimensions).forEach((name) => theme.add(new Option(name, name)));

function splitDelimited(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === delimiter && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('O CSV não contém registros.');
  const headers = rows.shift().map((item) => normalize(item).replace(/[^a-z0-9]/g, ''));
  const col = (...keys) => headers.findIndex((header) => keys.includes(header));
  return { delimiter, rows, col };
}

function parseIndicatorValue(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return NaN;
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    return comma > dot
      ? Number(value.replace(/\./g, '').replace(',', '.'))
      : Number(value.replace(/,/g, ''));
  }
  return comma >= 0 ? Number(value.replace(',', '.')) : Number(value);
}

function formatIndicatorValue(value, unit) {
  if (/^mil reais/i.test(unit || '')) {
    return (value * 1000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }
  return `${value.toLocaleString('pt-BR')}${unit ? ` ${unit}` : ''}`;
}

function parseIndicatorCSV(text) {
  const { delimiter, rows, col } = splitDelimited(text);
  const c = { code: col('codigoibge', 'codigodomunicipio', 'codibge'), city: col('municipio', 'cidade', 'nomedomunicipio'), dim: col('dimensao', 'tema', 'categoria'), ind: col('indicador', 'variavel'), yr: col('ano', 'anodereferencia'), val: col('valor', 'observacao'), source: col('fonte', 'source'), unit: col('unidade', 'unit') };
  if (c.ind < 0 || c.yr < 0 || c.val < 0 || (c.code < 0 && c.city < 0)) throw new Error('Inclua municipio (ou codigo_ibge), indicador, ano e valor.');
  const parsed = rows.map((cells) => {
    const code = c.code >= 0 ? cells[c.code]?.replace(/\D/g, '') : [...knownNames].find(([, name]) => normalize(name) === normalize(cells[c.city]))?.[0];
    const raw = cells[c.val]?.trim();
    const value = parseIndicatorValue(raw);
    return { codigo: code, indicador: cells[c.ind]?.trim(), indicadorKey: normalize(cells[c.ind]), ano: cells[c.yr]?.trim(), valor: value, fonte: c.source >= 0 ? cells[c.source]?.trim() : '', unidade: c.unit >= 0 ? cells[c.unit]?.trim() : '' };
  }).filter((r) => r.codigo && knownNames.has(r.codigo) && r.indicador && r.ano && Number.isFinite(r.valor));
  if (!parsed.length) throw new Error('Nenhuma linha válida corresponde aos municípios do COREDE e aos campos obrigatórios.');
  return parsed;
}

function parseFairCSV(text) {
  const { rows, col } = splitDelimited(text);
  const c = {
    name: col('nomefeira'), city: col('municipio'), address: col('enderecolocal'), lon: col('coordxlong', 'longitude'), lat: col('coordylat', 'latitude'), active: col('ativa'), farmers: col('nagricultores'), periodicity: col('periodicidade'), schedule: col('diashorarios'), products: col('produtospredominantes'), impact: col('impactodesenvolvimentorural'), source: col('fonteinformacao'), informant: col('nomeinformante'), collected: col('datacoleta')
  };
  if ([c.name, c.city, c.lon, c.lat].some((i) => i < 0)) throw new Error('O cadastro deve conter Nome_Feira, Municipio, Coord_X_Long e Coord_Y_Lat.');
  const parsed = rows.map((cells) => {
    const val = (index) => index < 0 ? '' : (cells[index] || '').trim();
    const lon = Number(val(c.lon).replace(',', '.'));
    const lat = Number(val(c.lat).replace(',', '.'));
    return {
      nome: val(c.name), municipio: val(c.city), endereco: val(c.address), longitude: lon, latitude: lat,
      ativa: normalize(val(c.active)), agricultores: val(c.farmers), periodicidade: val(c.periodicity), horarios: val(c.schedule),
      produtos: val(c.products), impacto: val(c.impact), fonte: val(c.source), informante: val(c.informant), data: val(c.collected)
    };
  }).filter((f) => f.nome && f.municipio && Number.isFinite(f.longitude) && Number.isFinite(f.latitude) && Math.abs(f.longitude) <= 180 && Math.abs(f.latitude) <= 90 && [...knownNames.values()].some((name) => normalize(name) === normalize(f.municipio)));
  if (!parsed.length) throw new Error('Nenhuma linha válida. Confira coordenadas em graus decimais e municípios do COREDE Centro-Sul.');
  return parsed;
}

function escapeHtml(value) {
  return String(value || 'Não informado').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function fillIndicators() {
  indicator.replaceChildren(...dimensions[theme.value].map((name) => new Option(name, name)));
  refreshYears();
  updateIndicators();
}

function refreshYears(preferredYear) {
  if (!records.length) return;
  const previous = preferredYear || year.value;
  const years = [...new Set(records.filter((row) => row.indicadorKey === normalize(indicator.value)).map((row) => row.ano))].sort((a, b) => Number(b) - Number(a));
  year.replaceChildren(...years.map((value) => new Option(value, value)));
  year.value = years.includes(previous) ? previous : (years[0] || '');
}

function selectedYearRows() {
  if (year.value === 'all') return [];
  return records.filter((row) => row.indicadorKey === normalize(indicator.value) && row.ano === year.value && (municipality.value === 'all' || row.codigo === municipality.value));
}

function updateIndicators() {
  if (!boundaryLayer) return;
  const rows = selectedYearRows();
  const values = new Map(rows.map((row) => [row.codigo, row]));
  const municipalityRows = [...values.values()];
  const numeric = municipalityRows.map((row) => row.valor).filter(Number.isFinite);
  const min = Math.min(...numeric), max = Math.max(...numeric);
  boundaryLayer.setStyle((feature) => {
    const id = String(feature.properties.codigo_ibge), hasValue = values.has(id), value = values.get(id)?.valor;
    let fill = '#1c303c';
    if (hasValue && max !== min) { const ratio = (value - min) / (max - min); fill = `rgb(${Math.round(28 + 53 * ratio)},${Math.round(91 + 119 * ratio)},${Math.round(105 + 61 * ratio)})`; }
    else if (hasValue) fill = '#53d2ad';
    return { color: municipality.value === id ? '#f0c66b' : '#91b5b2', weight: municipality.value === id ? 2.2 : 1, opacity: 1, fillColor: fill, fillOpacity: 1 };
  });
  const selectedName = municipality.value === 'all' ? 'Todos os municípios' : knownNames.get(municipality.value);
  document.getElementById('map-title').textContent = municipality.value === 'all' ? 'Municípios do COREDE Centro-Sul' : selectedName;
  document.getElementById('selection-caption').textContent = municipality.value === 'all' ? '17 unidades territoriais · limites municipais do IBGE' : `Município selecionado · código IBGE ${municipality.value}`;
  document.getElementById('map-count').textContent = municipality.value === 'all' ? '17 municípios' : '1 de 17 municípios';
  document.getElementById('record-indicator').textContent = indicator.value;
  const sources = [...new Set(rows.map((row) => row.fonte).filter(Boolean))];
  document.getElementById('record-source').textContent = rows.length ? sources.join('; ') || sourceLabel : 'Não informada';
  document.getElementById('record-year').textContent = year.value === 'all' ? '—' : year.value;
  document.getElementById('indicator-description').textContent = indicatorDescriptions[indicator.value] || 'A definição deste indicador depende da base CSV carregada. Consulte a fonte e a unidade apresentadas acima.';
  const record = municipalityRows.find((row) => row.codigo === municipality.value);
  const recordDetail = !records.length
    ? 'Aguardando carregamento de uma base estatística.'
    : year.value === 'all'
      ? 'Selecione um ano de referência para mapear os valores.'
      : municipality.value === 'all'
        ? municipalityRows.length
          ? municipalityRows[0].unidade === '%'
            ? normalize(indicator.value).includes('taxa de alfabetizacao')
              ? 'A taxa municipal não pode ser somada; o cálculo regional exige ponderação pelos moradores de 15 anos ou mais.'
              : 'Percentuais municipais não podem ser somados; o valor regional exige ponderação pelo denominador correspondente.'
            : /por pessoa|per capita/i.test(municipalityRows[0].unidade)
              ? 'Rendimentos per capita não podem ser somados; o valor regional exige ponderação pelo número de moradores incluídos no cálculo.'
              : `${formatIndicatorValue(numeric.reduce((sum, value) => sum + value, 0), municipalityRows[0].unidade)} · soma de ${municipalityRows.length} municípios.`
          : 'Sem registro para esta seleção.'
        : record
          ? formatIndicatorValue(record.valor, record.unidade)
          : 'Sem registro para esta seleção.';
  document.getElementById('record-detail').textContent = recordDetail;
  const label = document.getElementById('legend-label'), swatch = document.querySelector('#indicators-section .legend-swatch');
  if (numeric.length) { label.textContent = `${formatIndicatorValue(min, municipalityRows[0]?.unidade)} – ${formatIndicatorValue(max, municipalityRows[0]?.unidade)}`; swatch.classList.add('active'); document.getElementById('map-note').hidden = true; }
  else { label.textContent = 'Sem valores associados ao indicador'; swatch.classList.remove('active'); document.getElementById('map-note').hidden = false; document.getElementById('map-note').textContent = !records.length ? 'Carregue uma base estatística para visualizar a distribuição municipal.' : 'Não há registros para esta combinação de filtros.'; }
}

function filteredFairs() {
  const query = normalize(fairSearch.value);
  return fairs.filter((fair) => (fairMunicipality.value === 'all' || normalize(fair.municipio) === normalize(knownNames.get(fairMunicipality.value))) && (fairActive.value === 'all' || fair.ativa === fairActive.value) && (fairPeriodicity.value === 'all' || normalize(fair.periodicidade) === normalize(fairPeriodicity.value)) && (!query || normalize(`${fair.nome} ${fair.produtos} ${fair.endereco}`).includes(query)));
}

function fairPopup(fair) {
  const item = (label, value) => `<div class="popup-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`;
  return `<div class="fair-popup"><strong class="popup-title">${escapeHtml(fair.nome)}</strong><span class="popup-municipality">${escapeHtml(fair.municipio)}</span>${item('Endereço', fair.endereco)}${item('Situação', fair.ativa === 'sim' ? 'Ativa' : fair.ativa === 'nao' ? 'Inativa' : fair.ativa)}${item('Agricultores/famílias', fair.agricultores)}${item('Periodicidade', fair.periodicidade)}${item('Dias e horários', fair.horarios)}${item('Produtos', fair.produtos)}${item('Desenvolvimento rural', fair.impacto)}${item('Fonte', fair.fonte)}${item('Informante', fair.informante)}${item('Data da coleta', fair.data)}<div class="popup-coordinates">${fair.longitude.toFixed(5)}, ${fair.latitude.toFixed(5)}</div></div>`;
}

function renderFairs() {
  if (!fairMarkers || !fairBoundaryLayer) return;
  const visible = filteredFairs();
  fairMarkers.clearLayers();
  fairBoundaryLayer.setStyle((feature) => ({ color: fairMunicipality.value === String(feature.properties.codigo_ibge) ? '#f0c66b' : '#82aaa8', weight: fairMunicipality.value === String(feature.properties.codigo_ibge) ? 2.3 : 1, fillColor: '#16303a', fillOpacity: .22 }));
  visible.forEach((fair) => {
    const marker = L.circleMarker([fair.latitude, fair.longitude], { radius: 7, color: '#10212a', weight: 2, fillColor: fair.ativa === 'nao' ? '#f09279' : '#f0c66b', fillOpacity: 1 });
    marker.bindPopup(fairPopup(fair), { maxWidth: 300 }).addTo(fairMarkers);
  });
  document.getElementById('fair-count').textContent = `${visible.length} ${visible.length === 1 ? 'feira' : 'feiras'}`;
  document.getElementById('fair-table-count').textContent = `${visible.length} ${visible.length === 1 ? 'registro' : 'registros'}`;
  document.getElementById('fair-map-caption').textContent = fairMunicipality.value === 'all' ? `${knownNames.size} municípios · limites do IBGE` : `${knownNames.get(fairMunicipality.value)} · município selecionado`;
  document.getElementById('fair-map-note').hidden = visible.length > 0;
  if (!visible.length) document.getElementById('fair-map-note').textContent = fairs.length ? 'Nenhuma feira corresponde aos filtros selecionados.' : 'Carregue o cadastro das feiras para localizar os pontos no território.';
  const tbody = document.getElementById('fair-table-body');
  if (!visible.length) { tbody.innerHTML = `<tr><td colspan="5" class="empty-row">${fairs.length ? 'Nenhum registro corresponde aos filtros.' : 'O cadastro está vazio. Importe o modelo preenchido com dados verificados.'}</td></tr>`; return; }
  tbody.innerHTML = visible.map((fair, index) => `<tr data-fair-index="${index}"><td><strong>${escapeHtml(fair.nome)}</strong><small>${escapeHtml(fair.endereco)}</small></td><td>${escapeHtml(fair.municipio)}</td><td><span class="state-tag ${fair.ativa === 'sim' ? 'active' : ''}">${fair.ativa === 'sim' ? 'Ativa' : fair.ativa === 'nao' ? 'Inativa' : escapeHtml(fair.ativa)}</span></td><td>${escapeHtml(fair.periodicidade)}</td><td>${escapeHtml(fair.produtos)}</td></tr>`).join('');
  tbody.querySelectorAll('tr[data-fair-index]').forEach((tr) => tr.addEventListener('click', () => { const fair = visible[Number(tr.dataset.fairIndex)]; fairMap.setView([fair.latitude, fair.longitude], 13); fairMarkers.eachLayer((marker) => { if (marker.getLatLng().lat === fair.latitude && marker.getLatLng().lng === fair.longitude) marker.openPopup(); }); }));
}

async function loadBoundaries() {
  try {
    let response = await fetch('/api/municipios');
    if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) {
      response = await fetch('data/municipios_corede_centro_sul.geojson');
    }
    if (!response.ok) throw new Error('Falha ao carregar a malha municipal.');
    const geojson = await response.json();
    geojson.features.forEach((feature) => { const id = String(feature.properties.codigo_ibge), name = feature.properties.municipio; knownNames.set(id, name); municipality.add(new Option(name, id)); fairMunicipality.add(new Option(name, id)); });
    boundaryLayer = L.geoJSON(geojson, { style: { color: '#91b5b2', weight: 1, fillColor: '#1c303c', fillOpacity: 1 } }).addTo(map);
    fairBoundaryLayer = L.geoJSON(geojson, { style: { color: '#82aaa8', weight: 1, fillColor: '#16303a', fillOpacity: .22 }, onEachFeature: (feature, layer) => layer.on('click', () => { fairMunicipality.value = String(feature.properties.codigo_ibge); renderFairs(); }) }).addTo(fairMap);
    boundaryLayer.eachLayer((layer) => layer.bindTooltip(layer.feature.properties.municipio, { sticky: true, className: 'municipality-tooltip' }));
    fairBoundaryLayer.eachLayer((layer) => layer.bindTooltip(layer.feature.properties.municipio, { sticky: true, className: 'municipality-tooltip' }));
    map.fitBounds(boundaryLayer.getBounds(), { padding: [22, 22] });
    fairMap.fitBounds(fairBoundaryLayer.getBounds(), { padding: [22, 22] });
    updateIndicators(); renderFairs();
    await loadOfficialIndicators();
  } catch (error) { document.getElementById('fair-map-note').textContent = `Não foi possível abrir o recorte municipal: ${error.message}`; }
}

async function loadOfficialIndicators() {
  try {
    const apiResponse = await fetch('/api/indicadores').catch(() => null);
    const apiIsJson = apiResponse?.ok && (apiResponse.headers.get('content-type') || '').includes('application/json');
    let servedByPython = false;
    if (apiIsJson) {
      const payload = await apiResponse.json();
      if (Array.isArray(payload.registros) && payload.registros.length) {
        records = payload.registros.map((row) => ({ ...row, indicadorKey: normalize(row.indicador), valor: Number(row.valor) }));
        sourceLabel = payload.fonte || 'IBGE · Sistema SIDRA';
        servedByPython = true;
      }
    }
    if (!servedByPython) {
      const response = await fetch('data/indicadores_sidra.csv');
      if (!response.ok) return;
      records = parseIndicatorCSV(await response.text());
      sourceLabel = 'IBGE · Sistema SIDRA';
    }
    document.getElementById('load-status').textContent = 'Dados oficiais · ' + records.length + ' registros · ' + (servedByPython ? 'servidos pelo Python.' : 'arquivo local do SIDRA.');
    refreshYears();
    updateIndicators();
  } catch (error) { document.getElementById('load-status').textContent = `Base SIDRA indisponível: ${error.message}`; }
}

theme.addEventListener('change', fillIndicators);
indicator.addEventListener('change', () => { refreshYears(); updateIndicators(); });
year.addEventListener('change', updateIndicators);
municipality.addEventListener('change', updateIndicators);
fairMunicipality.addEventListener('change', renderFairs);
fairActive.addEventListener('change', renderFairs);
fairPeriodicity.addEventListener('change', renderFairs);
fairSearch.addEventListener('input', renderFairs);

document.getElementById('dataset-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    records = parseIndicatorCSV(await file.text());
    sourceLabel = [...new Set(records.map((row) => row.fonte).filter(Boolean))].join('; ') || 'Fonte não indicada no arquivo';
    const years = [...new Set(records.map((row) => row.ano))].sort((a, b) => Number(b) - Number(a));
    for (const [dimension, names] of Object.entries(dimensions)) { const found = [...new Set(records.map((row) => row.indicador))].find((candidate) => names.some((name) => normalize(name) === normalize(candidate))); if (found) { theme.value = dimension; fillIndicators(); indicator.value = found; break; } }
    refreshYears(years[0]);
    document.getElementById('load-status').textContent = `${records.length} registros carregados · ${file.name}`; updateIndicators();
  } catch (error) { document.getElementById('load-status').textContent = error.message; }
  finally { event.target.value = ''; }
});

document.getElementById('fair-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try { fairs = parseFairCSV(await file.text()); document.getElementById('fair-load-status').textContent = `${fairs.length} feiras carregadas · ${file.name}`; renderFairs(); }
  catch (error) { document.getElementById('fair-load-status').textContent = error.message; }
  finally { event.target.value = ''; }
});

document.querySelectorAll('.section-tab').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.section-tab').forEach((tab) => tab.classList.toggle('active', tab === button));
  document.querySelectorAll('.section-view').forEach((section) => { section.hidden = section.id !== button.dataset.section; });
  if (button.dataset.section === 'indicators-section') { map.invalidateSize({ pan: false }); if (boundaryLayer) map.fitBounds(boundaryLayer.getBounds(), { padding: [22, 22] }); }
  else { fairMap.invalidateSize({ pan: false }); if (fairBoundaryLayer) fairMap.fitBounds(fairBoundaryLayer.getBounds(), { padding: [22, 22] }); }
}));
document.getElementById('reset-map').addEventListener('click', () => boundaryLayer && map.fitBounds(boundaryLayer.getBounds(), { padding: [22, 22] }));
document.getElementById('fair-reset-map').addEventListener('click', () => fairBoundaryLayer && fairMap.fitBounds(fairBoundaryLayer.getBounds(), { padding: [22, 22] }));

function createMap(id, withTiles = true) {
  const instance = L.map(id, { zoomControl: false, scrollWheelZoom: true, attributionControl: false });
  if (withTiles) L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(instance);
  L.control.zoom({ position: 'bottomright' }).addTo(instance);
  return instance;
}
const map = createMap('map');
const fairMap = createMap('fair-map');
fairMarkers = L.featureGroup().addTo(fairMap);
fillIndicators();
loadBoundaries();
