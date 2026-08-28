/* =============================================================================
   app.js - Visualizador local do minimapa do Tibia.
   Junta os PNGs de 256x256 do minimapa num mapa continuo navegavel.
   A pasta dos tiles vem de data/mapdata.js (campo pastaTiles).
   Sem dependencias externas: funciona offline, direto do disco.
   ========================================================================== */
(function () {
  'use strict';

  /* ============================================================== dados === */
  var D = window.MAPA_DADOS;
  var MARCAS_JOGO = window.MAPA_MARCADORES || [];

  if (!D) {
    document.body.innerHTML =
      '<div style="padding:40px;font:14px sans-serif;color:#e8e0d2">' +
      '<h2 style="color:#d8a94a">data/mapdata.js nao foi carregado</h2>' +
      '<p>Rode <code>python tools/gerar_dados.py</code> na pasta do projeto e recarregue.</p></div>';
    return;
  }

  var SETOR = D.setor;                 // 256
  var LIM = D.limites;                 // {minX,maxX,minY,maxY}
  var PASTA = D.pastaTiles;            // ex.: "minimap-without-markers/minimap"
  var Z_TERREO = 7;                    // andar 0 do Tibia
  var NIVEIS = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16];
  var NIVEL_PADRAO = 3;                // = 1 px por sqm
  var CHAVE_POIS = 'tibia-map-poi:pois:v1';
  var CHAVE_PREFS = 'tibia-map-poi:prefs:v1';
  var CHAVE_PROGRESSO = 'tibia-map-poi:progresso:v1';

  // Indice de existencia dos tiles: tipo -> z -> Set("sx_sy")
  var INDICE = { color: {}, waypoint: {} };
  ['color', 'waypoint'].forEach(function (tipo) {
    var porZ = D.tiles[tipo] || {};
    for (var z = 0; z <= 15; z++) {
      INDICE[tipo][z] = new Set(porZ[z] || []);
    }
  });

  /* ============================================================= estado === */
  var E = {
    centroX: (LIM.minX + LIM.maxX) / 2,
    centroY: (LIM.minY + LIM.maxY) / 2,
    nivel: NIVEL_PADRAO,
    z: Z_TERREO,
    camada: 'color',        // 'color' | 'waypoint'
    verMarcadores: true,
    verPois: true,
    verGrade: false,
    verExiva: false,
    verAreas: false,        // contornos + nomes das areas da Cyclopedia
    ocultarFeitos: false,   // esconde de vez o que ja foi conferido
    ocultarSetas: true,     // setas de escada/buraco nao entram no checklist
    destaque: null,         // {x,y,z,ate}
    selecao: null,          // regiao destacada no mapa {tipo, area, subs[]}
    selecionado: null,      // marcador/poi selecionado na lista
    mouse: null             // {x,y} em coordenadas do mundo
  };

  function escala() { return NIVEIS[E.nivel]; }

  // Como a lista de areas e ordenada. Declarado aqui porque carregarPrefs()
  // roda bem antes do bloco da lista, e um `var` la embaixo apagaria o valor.
  var ordemAreas = 'facil';

  /* ======================================================== referencias === */
  var $ = function (s) { return document.querySelector(s); };
  var tela = $('#tela');
  var ctx = tela.getContext('2d', { alpha: false });
  var palco = $('#palco');
  var popup = $('#popup');
  var dpr = 1, larg = 0, alt = 0;

  /* ========================================================= conversoes === */
  function paraTelaX(x) { return (x - E.centroX) * escala() + larg / 2; }
  function paraTelaY(y) { return (y - E.centroY) * escala() + alt / 2; }
  function paraMundoX(px) { return (px - larg / 2) / escala() + E.centroX; }
  function paraMundoY(py) { return (py - alt / 2) / escala() + E.centroY; }

  function nomeAndar(z) {
    var d = Z_TERREO - z;
    return d === 0 ? '0' : (d > 0 ? '+' + d : String(d));
  }
  function rotuloAndar(z) {
    var d = Z_TERREO - z;
    if (d === 0) return 'terreo';
    return d > 0 ? d + ' acima do terreo' : (-d) + ' abaixo do terreo';
  }

  /* ====================================================== cache de tiles === */
  var cacheTiles = new Map();   // chave -> {img, ok, usoEm}
  var pendentes = 0;
  var LIMITE_CACHE = 520;

  function caminhoTile(tipo, sx, sy, z) {
    var pref = tipo === 'color' ? 'Minimap_Color_' : 'Minimap_WaypointCost_';
    return PASTA + '/' + pref + sx + '_' + sy + '_' + z + '.png';
  }

  function pegarTile(tipo, sx, sy, z) {
    var chave = tipo + '|' + z + '|' + sx + '_' + sy;
    var it = cacheTiles.get(chave);
    if (it) { it.usoEm = performance.now(); return it; }

    if (!INDICE[tipo][z].has(sx + '_' + sy)) return null;

    it = { img: new Image(), ok: false, usoEm: performance.now() };
    it.img.decoding = 'async';
    it.img.onload = function () { it.ok = true; pendentes--; atualizarCarregando(); sujar(); };
    it.img.onerror = function () { it.ok = false; it.falhou = true; pendentes--; atualizarCarregando(); };
    it.img.src = caminhoTile(tipo, sx, sy, z);
    pendentes++;
    atualizarCarregando();
    cacheTiles.set(chave, it);

    if (cacheTiles.size > LIMITE_CACHE) limparCache();
    return it;
  }

  function limparCache() {
    var itens = Array.from(cacheTiles.entries())
      .filter(function (e) { return e[1].ok; })
      .sort(function (a, b) { return a[1].usoEm - b[1].usoEm; });
    var remover = cacheTiles.size - Math.floor(LIMITE_CACHE * 0.75);
    for (var i = 0; i < remover && i < itens.length; i++) cacheTiles.delete(itens[i][0]);
  }

  /** Aviso curto no topo do mapa, para confirmar acoes sem abrir dialogo. */
  var timerAviso = null;
  function avisar(txt) {
    var el = $('#aviso');
    el.textContent = txt;
    el.classList.add('on');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(function () { el.classList.remove('on'); }, 2200);
  }

  var avisoCarregando = $('#carregando');
  function atualizarCarregando() {
    avisoCarregando.classList.toggle('on', pendentes > 0);
    if (pendentes > 0) avisoCarregando.textContent = 'carregando ' + pendentes + ' tile(s)...';
  }

  /* ========================================================= marcadores === */
  // Marcadores do jogo: [x, y, z, icone, texto]
  var marcasPorZ = {};
  for (var z0 = 0; z0 <= 15; z0++) marcasPorZ[z0] = [];
  MARCAS_JOGO.forEach(function (m) { (marcasPorZ[m[2]] || []).push(m); });

  /* =========================================== areas da Cyclopedia ===
     Uma subarea e uma regiao nomeada do jogo ("Thais City", "Green Claw
     Swamp"), agrupada numa area-mae ("Thais", "Venore"). Os poligonos sao
     2D: uma subarea vale para os 16 andares.
     Cada marcador ja vem com o indice da sua subarea em m[5] (-1 = nenhuma).
  ================================================================== */
  var AREAS = window.MAPA_AREAS || { areas: [], subareas: [] };
  var SUB = AREAS.subareas;
  var TEM_AREAS = SUB.length > 0;

  var subPorId = {};
  SUB.forEach(function (s, i) { s.idx = i; subPorId[s.id] = s; });

  // Grade grossa de 512 sqm para achar a subarea de um ponto sem varrer as 192.
  var gradeSub = {};
  SUB.forEach(function (s, i) {
    var b = s.bbox;
    for (var gx = b[0] >> 9; gx <= b[2] >> 9; gx++) {
      for (var gy = b[1] >> 9; gy <= b[3] >> 9; gy++) {
        (gradeSub[gx + ',' + gy] || (gradeSub[gx + ',' + gy] = [])).push(i);
      }
    }
  });

  function pontoNoPoligono(x, y, s) {
    var b = s.bbox;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
    var dentro = false;
    for (var r = 0; r < s.rings.length; r++) {
      var anel = s.rings[r], n = anel.length, j = n - 1;
      for (var i = 0; i < n; i++) {
        var xi = anel[i][0], yi = anel[i][1], xj = anel[j][0], yj = anel[j][1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
        j = i;
      }
    }
    return dentro;
  }

  /** Indice da subarea que contem (x,y), ou -1. */
  function subareaEm(x, y) {
    var lista = gradeSub[(x >> 9) + ',' + (y >> 9)];
    if (!lista) return -1;
    for (var i = 0; i < lista.length; i++) {
      if (pontoNoPoligono(x, y, SUB[lista[i]])) return lista[i];
    }
    return -1;
  }

  function nomeSub(i) { return i >= 0 && SUB[i] ? SUB[i].subarea : 'Fora das áreas'; }
  function nomeCompleto(i) {
    return i >= 0 && SUB[i] ? SUB[i].area + ' › ' + SUB[i].subarea : 'Fora das áreas';
  }

  /* --------------------------------------------------------- progresso --- */
  // Grava no localStorage a cada mudanca.
  var PROG = { subareas: new Set(), marcas: new Set() };

  function chaveMarca(x, y, z) { return x + ':' + y + ':' + z; }
  function subFeita(i) { return i >= 0 && !!SUB[i] && PROG.subareas.has(SUB[i].id); }

  /** Conferido = clicado individualmente OU a subarea inteira foi concluida. */
  function marcaFeita(x, y, z, sub) {
    if (subFeita(sub === undefined ? subareaEm(x, y) : sub)) return true;
    return PROG.marcas.has(chaveMarca(x, y, z));
  }

  function definirSub(i, feito) {
    if (i < 0 || !SUB[i]) return;
    if (feito) PROG.subareas.add(SUB[i].id); else PROG.subareas.delete(SUB[i].id);
  }

  function alternarSub(i) {
    if (i < 0 || !SUB[i]) return false;
    definirSub(i, !subFeita(i));
    salvarProgresso();
    return subFeita(i);
  }

  function alternarMarca(x, y, z) {
    var k = chaveMarca(x, y, z);
    if (PROG.marcas.has(k)) PROG.marcas.delete(k); else PROG.marcas.add(k);
    salvarProgresso();
    return PROG.marcas.has(k);
  }

  var timerProg = null;
  function salvarProgresso(imediato) {
    clearTimeout(timerProg);
    timerProg = null;
    var gravar = function () {
      timerProg = null;          // sem isso o beforeunload regrava sempre
      try {
        localStorage.setItem(CHAVE_PROGRESSO, JSON.stringify({
          v: 2,
          subareas: Array.from(PROG.subareas),
          marcas: Array.from(PROG.marcas)
        }));
      } catch (e) {
        alert('Nao consegui salvar o progresso: ' + e.message);
      }
    };
    if (imediato) gravar(); else timerProg = setTimeout(gravar, 200);
    invalidarContagem();
    atualizarResumo();
  }

  function carregarProgresso() {
    var p;
    try { p = JSON.parse(localStorage.getItem(CHAVE_PROGRESSO) || '{}'); }
    catch (e) { return; }
    PROG.marcas = new Set(p.marcas || []);
    PROG.subareas = new Set(p.subareas || []);
    // v1 marcava quadrantes de 256 ("7|33024_32256"). Como as subareas agora sao
    // outras, converte cada quadrante concluido em marcadores conferidos - assim
    // nada do que ja foi feito se perde.
    if (p.setores && p.setores.length) {
      var quadrantes = new Set(p.setores);
      MARCAS_JOGO.forEach(function (m) {
        if (quadrantes.has(m[2] + '|' + (m[0] & ~255) + '_' + (m[1] & ~255))) {
          PROG.marcas.add(chaveMarca(m[0], m[1], m[2]));
        }
      });
      salvarProgresso(true);
    }
  }

  /* ------------------------------------------ contagens por subarea --- */
  // As setas (14..19) sao escadas, buracos e cordas - sinalizacao de caminho,
  // nao ponto para conferir. Por padrao ficam fora do mapa e da contagem.
  var ICONES_SETA = [14, 15, 16, 17, 18, 19];
  function ehSeta(icone) { return icone >= 14 && icone <= 19; }
  function contavel(m) { return !(E.ocultarSetas && ehSeta(m[3])); }

  /* ------------------------------------------ dados da Measuring Tibia --- */
  var Q = window.MAPA_QUEST || { areas: {}, subareasCertas: {}, subareasDuvidosas: {},
                                 recompensas: [], titulos: [], marcos: [],
                                 foraDaQuest: [], notasSubarea: {} };
  var FORA_DA_QUEST = new Set(Q.foraDaQuest || []);

  function infoArea(nome) { return (Q.areas && Q.areas[nome]) || {}; }
  function contaParaQuest(nome) { return !FORA_DA_QUEST.has(nome) && nome !== 'Fora das áreas'; }

  /** 'certa'   -> as duas wikis confirmam que e descobrivel
      'duvidosa'-> so uma das duas lista (aparece com "?")
      'fora'    -> nenhuma lista: nao conta para a quest             */
  function classeSub(area, sub) {
    var c = Q.subareasCertas && Q.subareasCertas[area];
    if (c && c.indexOf(sub) >= 0) return 'certa';
    var d = Q.subareasDuvidosas && Q.subareasDuvidosas[area];
    if (d && d[sub]) return 'duvidosa';
    return 'fora';
  }
  /** Na duvida, conta: melhor sobrar trabalho do que achar que acabou. */
  function contaNaArea(area, sub) { return classeSub(area, sub) !== 'fora'; }

  /* ------------------------------------------------------- selecao ---
     A regiao destacada no mapa. Vale nos dois sentidos: clicar na lista
     seleciona no mapa, clicar no mapa seleciona na lista.
     { tipo: 'area'|'sub', area: 'Thais', subs: [indices] }                */
  function subsDaArea(nome) {
    var r = [];
    SUB.forEach(function (s, i) { if (s.area === nome) r.push(i); });
    return r;
  }

  function caixaDe(indices) {
    var b = null;
    indices.forEach(function (i) {
      var q = SUB[i].bbox;
      if (!b) b = q.slice();
      else {
        b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]);
        b[2] = Math.max(b[2], q[2]); b[3] = Math.max(b[3], q[3]);
      }
    });
    return b;
  }

  function selecionarSub(i, enquadrar) {
    if (i < 0 || !SUB[i]) return;
    E.selecao = { tipo: 'sub', area: SUB[i].area, subs: [i] };
    if (enquadrar) enquadrarSelecao();
    sincronizarBotoes();
    listarSubareas();
    sujar();
  }

  function selecionarArea(nome, enquadrar) {
    var subs = subsDaArea(nome);
    if (!subs.length) return;
    E.selecao = { tipo: 'area', area: nome, subs: subs };
    if (enquadrar) enquadrarSelecao();
    sincronizarBotoes();
    sujar();
  }

  function limparSelecao() {
    E.selecao = null;
    sincronizarBotoes();
    listarSubareas();
    sujar();
  }

  /** Enquadra a selecao inteira na tela, no andar em que ela tem marcador. */
  function enquadrarSelecao() {
    if (!E.selecao) return;
    var b = caixaDe(E.selecao.subs);
    if (!b) return;
    var mascara = 0;
    E.selecao.subs.forEach(function (i) { mascara |= andaresSub[i]; });
    var z = E.z;
    if (mascara && !(mascara & (1 << z))) {
      for (var k = 0; k <= 15; k++) if (mascara & (1 << k)) { z = k; break; }
    }
    var cabe = Math.min(larg / Math.max(1, b[2] - b[0]),
                        alt / Math.max(1, b[3] - b[1])) * 0.82;
    var nivel = 0;
    for (var n = NIVEIS.length - 1; n >= 0; n--) if (NIVEIS[n] <= cabe) { nivel = n; break; }
    irPara(Math.round((b[0] + b[2]) / 2), Math.round((b[1] + b[3]) / 2), z, nivel, false);
  }

  /** Rola a lista lateral ate a subarea selecionada e abre a cidade dela. */
  function revelarSelecaoNaLista() {
    if (!E.selecao) return;
    trocarAba('subareas');
    gruposAbertos[E.selecao.area] = true;
    listarSubareas();
    var el = $('#lista-subareas .sub-item.selecionada') ||
             $('#lista-subareas .grupo.selecionada');
    if (el) el.scrollIntoView({ block: 'center' });
  }

  /** Bonus de speed dentro de uma area concluida, pelo total de areas feitas.
      A CipSoft so publicou os extremos (100 e 195); isto e interpolacao. */
  function speedEstimado(n) {
    var s = Q.speed;
    if (!s || !n) return 0;
    var tot = Q.totalAreas || 20;
    if (n >= tot) return s.max;
    return Math.round(s.min + (s.max - s.min) * (n - 1) / (tot - 1));
  }

  var SEM_AREA = SUB.length;
  var contaSub = new Int32Array(SUB.length + 1);   // ultimo slot = "fora das areas"
  var andaresSub = new Int32Array(SUB.length + 1); // bitmask dos andares com marcador
  var GRUPOS = [];
  var TOTAL_COM_MARCA = 0, TOTAL_MARCAS = 0;

  function recalcularContagens() {
    contaSub.fill(0);
    andaresSub.fill(0);
    TOTAL_MARCAS = 0;
    MARCAS_JOGO.forEach(function (m) {
      if (!contavel(m)) return;
      var i = m[5] >= 0 ? m[5] : SEM_AREA;
      contaSub[i]++;
      andaresSub[i] |= (1 << m[2]);
      TOTAL_MARCAS++;
    });

    // Agrupamento area-mae -> subareas, so as que tem marcador.
    var porArea = {};
    SUB.forEach(function (s, i) {
      if (!contaSub[i]) return;
      (porArea[s.area] || (porArea[s.area] = [])).push(i);
    });
    GRUPOS = Object.keys(porArea).map(function (nome) {
      var subs = porArea[nome].sort(function (a, b) {
        return SUB[a].subarea.localeCompare(SUB[b].subarea);
      });
      var inf = infoArea(nome);
      return {
        nome: nome, subs: subs,
        // quantas subareas a area tem no jogo, mesmo as sem marcador nenhum
        subsNoJogo: SUB.filter(function (s) { return s.area === nome; }).length,
        ordem: inf.ordem || 90,
        achievement: inf.achievement || null,
        nota: inf.nota || '',
        naQuest: contaParaQuest(nome),
        total: subs.reduce(function (t, i) { return t + contaSub[i]; }, 0)
      };
    });
    if (contaSub[SEM_AREA]) {
      GRUPOS.push({ nome: 'Fora das áreas', subs: [SEM_AREA], solta: true, ordem: 100,
                    naQuest: false, nota: 'Marcadores que não caíram em nenhuma área.',
                    total: contaSub[SEM_AREA] });
    }
    TOTAL_COM_MARCA = GRUPOS.reduce(function (t, g) { return t + g.subs.length; }, 0);
    invalidarContagem();
  }

  /** Uma area conta como 100% quando todas as subareas dela estao conferidas. */
  /** Subareas da area que realmente valem para a quest. */
  function subsQueContam(g) {
    if (!g.naQuest) return g.subs;
    return g.subs.filter(function (i) { return contaNaArea(g.nome, nomeSub(i)); });
  }

  /* A unidade de progresso e a SUBAREA, nao o marcador: cada subarea fecha com
     7 Points of Interest, venham eles de um pool de 5 ou de 140 bandeiras. Por
     isso a porcentagem da area conta subareas concluidas, igual ao jogo faz. */
  function subsFeitasNaArea(g) {
    var n = 0;
    subsQueContam(g).forEach(function (i) { if (subFeita(i)) n++; });
    return n;
  }

  function areaCompleta(g) {
    var subs = subsQueContam(g);
    return subs.length > 0 && subsFeitasNaArea(g) === subs.length;
  }

  function pctArea(g) {
    var tot = subsQueContam(g).length;
    return tot ? Math.round(100 * subsFeitasNaArea(g) / tot) : 0;
  }

  /** Quantas areas da quest ja estao 100%. */
  function areasConcluidas() {
    var n = 0;
    GRUPOS.forEach(function (g) { if (g.naQuest && areaCompleta(g)) n++; });
    return n;
  }

  /** Quantos marcadores desta subarea ja foram conferidos. */
  var feitasCache = null;
  function invalidarContagem() { feitasCache = null; }
  function feitasPorSub() {
    if (feitasCache) return feitasCache;
    var v = new Int32Array(SUB.length + 1);
    MARCAS_JOGO.forEach(function (m) {
      if (!contavel(m)) return;
      var i = m[5] >= 0 ? m[5] : SEM_AREA;
      if (subFeita(m[5]) || PROG.marcas.has(chaveMarca(m[0], m[1], m[2]))) v[i]++;
    });
    feitasCache = v;
    return v;
  }

  // as preferencias decidem se as setas contam, entao vem antes das contagens
  carregarPrefs();
  recalcularContagens();
  carregarProgresso();

  // Grava o que estiver pendente se a aba for fechada no meio de um clique.
  window.addEventListener('beforeunload', function () {
    if (timerProg) { clearTimeout(timerProg); salvarProgresso(true); }
  });

  // POIs do usuario, salvos no navegador
  var pois = carregarPois();
  var poisPorZ = {};

  function carregarPois() {
    try {
      var bruto = localStorage.getItem(CHAVE_POIS);
      var lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) { return []; }
  }
  function salvarPois() {
    // _sub e cache em memoria, nao vai para o disco
    try { localStorage.setItem(CHAVE_POIS, JSON.stringify(pois, semCache)); }
    catch (e) { alert('Nao consegui salvar os POIs no navegador: ' + e.message); }
    reindexarPois();
  }
  function semCache(k, v) { return k === '_sub' ? undefined : v; }

  /** POIs nao vem com subarea pronta; calcula uma vez e guarda no proprio POI. */
  function subDoPoi(p) {
    if (p._sub === undefined) p._sub = subareaEm(p.x, p.y);
    return p._sub;
  }

  function reindexarPois() {
    poisPorZ = {};
    for (var i = 0; i <= 15; i++) poisPorZ[i] = [];
    pois.forEach(function (p) {
      p._sub = subareaEm(p.x, p.y);
      if (poisPorZ[p.z]) poisPorZ[p.z].push(p);
    });
  }
  reindexarPois();

  /* ============================================================ desenho === */
  var sujo = true;
  function sujar() { sujo = true; }

  /* --------------------------------------------------- barra elastica ---
     A barra do topo tem item demais para caber em qualquer largura. Em vez de
     chutar breakpoints, ela mede a si mesma e vai escondendo o que menos faz
     falta ate caber. Assim continua certa quando um botao novo entrar.
  ===================================================================== */
  var PASSOS_BARRA = 7;
  var barraEl = $('#barra');
  function ajustarBarra() {
    // a barra estica junto com o conteudo, entao o limite real e a viewport:
    // scrollWidth aqui e a largura que ela PRECISA, nao a que ela tem.
    var cabe = document.documentElement.clientWidth;
    for (var n = 0; n <= PASSOS_BARRA; n++) {
      barraEl.className = '';
      for (var i = 1; i <= n; i++) barraEl.classList.add('encolher-' + i);
      if (barraEl.scrollWidth <= cabe) return n;
    }
    return PASSOS_BARRA;
  }

  function redimensionar() {
    ajustarBarra();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = palco.getBoundingClientRect();
    larg = Math.max(1, Math.round(r.width));
    alt = Math.max(1, Math.round(r.height));
    tela.width = Math.round(larg * dpr);
    tela.height = Math.round(alt * dpr);
    sujar();
  }

  // Path2D em coordenadas do mundo, criado uma vez por subarea.
  var caminhoSub = [];
  function caminhoDe(i) {
    if (caminhoSub[i]) return caminhoSub[i];
    var p = new Path2D(), anel, j, k;
    for (j = 0; j < SUB[i].rings.length; j++) {
      anel = SUB[i].rings[j];
      p.moveTo(anel[0][0], anel[0][1]);
      for (k = 1; k < anel.length; k++) p.lineTo(anel[k][0], anel[k][1]);
      p.closePath();
    }
    caminhoSub[i] = p;
    return p;
  }

  /** Aplica a transformacao mundo->tela, para desenhar poligonos em sqm. */
  function transformarParaMundo() {
    var s = escala();
    ctx.setTransform(dpr * s, 0, 0, dpr * s,
                     dpr * (larg / 2 - E.centroX * s),
                     dpr * (alt / 2 - E.centroY * s));
  }

  function visivelNaTela(b, x0, x1, y0, y1) {
    return !(b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1);
  }

  /** Subarea concluida fica cinza e escura, recortada no proprio contorno. */
  function apagarSubareasFeitas(x0, x1, y0, y1) {
    if (!PROG.subareas.size) return;
    ctx.save();
    transformarParaMundo();
    PROG.subareas.forEach(function (id) {
      var s = subPorId[id];
      if (!s || !visivelNaTela(s.bbox, x0, x1, y0, y1)) return;
      var b = s.bbox;
      ctx.save();
      ctx.clip(caminhoDe(s.idx), 'evenodd');
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = '#808080';                    // saturacao zero => tira a cor
      ctx.fillRect(b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(10,9,8,.45)';           // e escurece um pouco
      ctx.fillRect(b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1);
      ctx.restore();
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.restore();
  }

  /** A regiao selecionada: escurece tudo em volta e acende o contorno dela. */
  function desenharSelecao(x0, x1, y0, y1) {
    var sel = E.selecao;
    if (!sel || !sel.subs.length) return;
    var s = escala();

    var visiveis = sel.subs.filter(function (i) {
      return visivelNaTela(SUB[i].bbox, x0, x1, y0, y1);
    });

    // 1) veu escuro por fora, recortando a selecao (so quando da para ver)
    if (visiveis.length) {
      ctx.save();
      transformarParaMundo();
      var fora = new Path2D();
      fora.rect(x0 - 4096, y0 - 4096, (x1 - x0) + 8192, (y1 - y0) + 8192);
      visiveis.forEach(function (i) { fora.addPath(caminhoDe(i)); });
      ctx.fillStyle = 'rgba(6,5,4,.55)';
      ctx.fill(fora, 'evenodd');          // evenodd = buraco onde esta a selecao
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.restore();
    }

    // 2) contorno aceso
    ctx.save();
    transformarParaMundo();
    visiveis.forEach(function (i) {
      ctx.lineWidth = 3.5 / s;
      ctx.strokeStyle = 'rgba(10,9,8,.85)';
      ctx.stroke(caminhoDe(i));
      ctx.lineWidth = 1.8 / s;
      ctx.strokeStyle = subFeita(i) ? '#7fd680' : '#ffe08a';
      ctx.stroke(caminhoDe(i));
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.restore();

    // 3) etiqueta com o nome, no centro do que esta visivel
    var b = caixaDe(sel.subs);
    if (!b) return;
    var px = paraTelaX((b[0] + b[2]) / 2);
    var py = paraTelaY(b[1]) - 12;
    if (py < 18) py = Math.min(alt - 10, paraTelaY(b[3]) + 20);
    var txt = sel.tipo === 'area'
      ? sel.area + '  ·  ' + sel.subs.length + ' subáreas'
      : SUB[sel.subs[0]].area + ' › ' + SUB[sel.subs[0]].subarea;

    ctx.save();
    ctx.font = '600 13px "Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var w = ctx.measureText(txt).width + 18;
    var lx = Math.min(Math.max(w / 2 + 4, px), larg - w / 2 - 4);
    ctx.fillStyle = 'rgba(18,16,13,.94)';
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(lx - w / 2, py - 11, w, 22, 6);
    else ctx.rect(lx - w / 2, py - 11, w, 22);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(txt, lx, py);
    ctx.restore();
  }

  /** Overlay das areas: contorno de cada subarea + o nome no centro. */
  function desenharContornos(x0, x1, y0, y1) {
    var s = escala(), visiveis = [];
    for (var i = 0; i < SUB.length; i++) {
      if (visivelNaTela(SUB[i].bbox, x0, x1, y0, y1)) visiveis.push(i);
    }
    if (!visiveis.length) return;

    ctx.save();
    transformarParaMundo();
    ctx.lineWidth = 1.4 / s;
    for (var v = 0; v < visiveis.length; v++) {
      var i2 = visiveis[v];
      ctx.strokeStyle = subFeita(i2) ? 'rgba(111,156,111,.85)' : 'rgba(216,169,74,.75)';
      ctx.stroke(caminhoDe(i2));
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.restore();

    if (s < 0.2) return;                       // longe demais, so os contornos
    ctx.save();
    ctx.font = '600 12px "Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var w = 0; w < visiveis.length; w++) {
      var sub = SUB[visiveis[w]];
      var px = paraTelaX(sub.center[0]), py = paraTelaY(sub.center[1]);
      if (px < 4 || py < 4 || px > larg - 4 || py > alt - 4) continue;
      var feito = subFeita(sub.idx);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,9,8,.9)';
      ctx.strokeText(sub.subarea, px, py);
      ctx.fillStyle = feito ? '#6f9c6f' : '#f4ead6';
      ctx.fillText(sub.subarea, px, py);
    }
    ctx.restore();
  }

  function desenhar() {
    var s = escala();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0908';
    ctx.fillRect(0, 0, larg, alt);

    /* --- tiles --- */
    var x0 = paraMundoX(0), x1 = paraMundoX(larg);
    var y0 = paraMundoY(0), y1 = paraMundoY(alt);
    var sx0 = Math.floor(x0 / SETOR) * SETOR, sx1 = Math.floor(x1 / SETOR) * SETOR;
    var sy0 = Math.floor(y0 / SETOR) * SETOR, sy1 = Math.floor(y1 / SETOR) * SETOR;

    ctx.imageSmoothingEnabled = s < 1;
    ctx.imageSmoothingQuality = 'high';

    for (var sy = sy0; sy <= sy1; sy += SETOR) {
      for (var sx = sx0; sx <= sx1; sx += SETOR) {
        var t = pegarTile(E.camada, sx, sy, E.z);
        if (!t || !t.ok) continue;
        // arredondar as bordas evita costuras de 1px entre tiles vizinhos
        var dx = Math.round(paraTelaX(sx));
        var dy = Math.round(paraTelaY(sy));
        var dw = Math.round(paraTelaX(sx + SETOR)) - dx;
        var dh = Math.round(paraTelaY(sy + SETOR)) - dy;
        ctx.drawImage(t.img, dx, dy, dw, dh);
      }
    }
    ctx.imageSmoothingEnabled = false;

    apagarSubareasFeitas(x0, x1, y0, y1);
    desenharSelecao(x0, x1, y0, y1);
    if (E.verAreas) desenharContornos(x0, x1, y0, y1);
    if (E.verGrade) desenharGrade(sx0, sx1, sy0, sy1);
    if (E.verExiva) desenharExiva();
    desenharMarcadores();
    desenharDestaque();
    desenharCaixaSelecao();
    desenharBarraEscala();
  }

  function desenharGrade(sx0, sx1, sy0, sy1) {
    var s = escala();
    ctx.save();
    ctx.strokeStyle = 'rgba(216,169,74,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var sx = sx0; sx <= sx1 + SETOR; sx += SETOR) {
      var px = Math.round(paraTelaX(sx)) + 0.5;
      ctx.moveTo(px, 0); ctx.lineTo(px, alt);
    }
    for (var sy = sy0; sy <= sy1 + SETOR; sy += SETOR) {
      var py = Math.round(paraTelaY(sy)) + 0.5;
      ctx.moveTo(0, py); ctx.lineTo(larg, py);
    }
    ctx.stroke();

    if (s >= 0.25) {
      ctx.font = '11px Consolas,monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (var y = sy0; y <= sy1; y += SETOR) {
        for (var x = sx0; x <= sx1; x += SETOR) {
          var tx = paraTelaX(x) + 4, ty = paraTelaY(y) + 3;
          var etq = x + '_' + y;
          var existe = INDICE[E.camada][E.z].has(etq);
          ctx.fillStyle = 'rgba(0,0,0,.65)';
          ctx.fillRect(tx - 2, ty - 1, ctx.measureText(etq).width + 6, 14);
          ctx.fillStyle = existe ? '#f0c96e' : '#7a7062';
          ctx.fillText(etq, tx, ty);
        }
      }
    }
    ctx.restore();
  }

  function desenharExiva() {
    // Faixas de alcance do exiva medidas a partir do centro da tela.
    var cx = larg / 2, cy = alt / 2, s = escala();
    var faixas = [
      [4, 'rgba(95,191,96,.9)', 'ao seu lado'],
      [100, 'rgba(216,169,74,.9)', 'esta a'],
      [274, 'rgba(208,90,74,.9)', 'longe']
    ];
    ctx.save();
    ctx.setLineDash([6, 4]);
    faixas.forEach(function (f) {
      var r = f[0] * s;
      if (r < 6 || r > Math.max(larg, alt) * 3) return;
      ctx.strokeStyle = f[1];
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      ctx.setLineDash([]);
      ctx.font = '10px Consolas,monospace';
      ctx.fillStyle = f[1];
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(f[2] + ' (' + f[0] + ')', cx - r + 4, cy - r - 3);
      ctx.setLineDash([6, 4]);
    });
    // linhas diagonais das 8 direcoes
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(232,224,210,.28)';
    ctx.lineWidth = 1;
    var d = Math.max(larg, alt);
    ctx.beginPath();
    ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d);
    ctx.moveTo(cx - d, cy + d); ctx.lineTo(cx + d, cy - d);
    ctx.moveTo(cx, cy - d); ctx.lineTo(cx, cy + d);
    ctx.moveTo(cx - d, cy); ctx.lineTo(cx + d, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    // cruz central
    ctx.strokeStyle = '#f0c96e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy);
    ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9);
    ctx.stroke();
    ctx.restore();
  }

  function ladoIcone() {
    var s = escala();
    if (s >= 2) return 20;
    if (s >= 1) return 17;
    return 14;
  }

  function desenharMarcadores() {
    var s = escala();
    var lado = ladoIcone();
    var meio = lado / 2;
    var pontinho = s < 0.5;   // muito longe: so um ponto, senao vira sopa de icones

    function visivel(x, y) {
      var px = paraTelaX(x), py = paraTelaY(y);
      if (px < -30 || py < -30 || px > larg + 30 || py > alt + 30) return null;
      return [px, py];
    }

    if (E.verMarcadores) {
      var lista = marcasPorZ[E.z] || [];
      for (var i = 0; i < lista.length; i++) {
        var m = lista[i];
        if (!contavel(m)) continue;                 // setas de escada/buraco
        // subarea concluida: some com as bandeiras dela de vez
        if (subFeita(m[5])) continue;
        var off = PROG.marcas.has(chaveMarca(m[0], m[1], E.z));
        if (off && E.ocultarFeitos) continue;
        var p = visivel(m[0] + 0.5, m[1] + 0.5);
        if (!p) continue;

        ctx.globalAlpha = off ? 0.4 : 1;
        if (pontinho) {
          ctx.fillStyle = off ? window.Icones.CINZA : window.Icones.cor(m[3]);
          ctx.fillRect(Math.round(p[0]) - 1, Math.round(p[1]) - 1, 3, 3);
        } else {
          ctx.drawImage(window.Icones.obter(m[3], lado, off), p[0] - meio, p[1] - meio, lado, lado);
          if (m[4] && s >= 4 && !off) rotulo(m[4], p[0], p[1] - meio - 3);
        }
        ctx.globalAlpha = 1;
      }
    }

    if (E.verPois) {
      var lp = poisPorZ[E.z] || [];
      for (var j = 0; j < lp.length; j++) {
        var q = lp[j];
        if (subFeita(subDoPoi(q))) continue;
        var qoff = PROG.marcas.has(chaveMarca(q.x, q.y, E.z));
        if (qoff && E.ocultarFeitos) continue;
        var pp = visivel(q.x + 0.5, q.y + 0.5);
        if (!pp) continue;

        ctx.globalAlpha = qoff ? 0.4 : 1;
        // anel dourado marca "POI meu" e o diferencia dos marcadores do jogo
        ctx.save();
        ctx.beginPath();
        ctx.arc(pp[0], pp[1], meio + 3, 0, 6.29);
        ctx.strokeStyle = qoff ? window.Icones.CINZA : '#f0c96e';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        if (pontinho) {
          ctx.fillStyle = qoff ? window.Icones.CINZA : window.Icones.cor(q.icone);
          ctx.fillRect(Math.round(pp[0]) - 2, Math.round(pp[1]) - 2, 5, 5);
        } else {
          ctx.drawImage(window.Icones.obter(q.icone, lado, qoff), pp[0] - meio, pp[1] - meio, lado, lado);
          if (q.titulo && s >= 1 && !qoff) rotulo(q.titulo, pp[0], pp[1] - meio - 3);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function rotulo(txt, cx, base) {
    txt = txt.length > 34 ? txt.slice(0, 33) + '…' : txt;
    ctx.font = '11px "Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    var w = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(18,16,13,.82)';
    ctx.fillRect(cx - w / 2 - 4, base - 14, w + 8, 15);
    ctx.fillStyle = '#f0c96e';
    ctx.fillText(txt, cx, base);
  }

  /** Retangulo de selecao, com a conta do que sera afetado. */
  function desenharCaixaSelecao() {
    var r = retanguloSelecao();
    if (!r) return;
    var tirar = selecao.tirar;
    var x = paraTelaX(r.x0), y = paraTelaY(r.y0);
    var w = paraTelaX(r.x1 + 1) - x, h = paraTelaY(r.y1 + 1) - y;
    var cor = tirar ? '#d05a4a' : '#f0c96e';

    ctx.save();
    ctx.fillStyle = tirar ? 'rgba(208,90,74,.16)' : 'rgba(240,201,110,.16)';
    ctx.fillRect(x, y, w, h);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = cor;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    ctx.setLineDash([]);

    var n = contarNoRetangulo(r, !tirar);
    var etq = (tirar ? '−' : '+') + n + (n === 1 ? ' bandeira' : ' bandeiras') +
              '   ' + (r.x1 - r.x0 + 1) + '×' + (r.y1 - r.y0 + 1) + ' sqm';
    ctx.font = '600 12px "Segoe UI",sans-serif';
    var lw = ctx.measureText(etq).width + 14;
    var lx = Math.min(Math.max(4, x + w / 2 - lw / 2), larg - lw - 4);
    var ly = Math.max(4, Math.min(y, y + h) - 24);
    ctx.fillStyle = 'rgba(18,16,13,.92)';
    ctx.strokeStyle = cor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(lx, ly, lw, 20, 5); else ctx.rect(lx, ly, lw, 20);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = cor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(etq, lx + lw / 2, ly + 10);
    ctx.restore();
  }

  function desenharDestaque() {
    var d = E.destaque;
    if (!d || d.z !== E.z) return;
    var px = paraTelaX(d.x + 0.5), py = paraTelaY(d.y + 0.5);
    var t = (performance.now() - d.desde) / 1000;
    var raio = 10 + (Math.sin(t * 4) + 1) * 6;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(px, py, raio, 0, 6.29); ctx.stroke();
    ctx.strokeStyle = '#d8a94a';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, raio + 3, 0, 6.29); ctx.stroke();
    ctx.restore();
  }

  var escalaTxt = $('#escala .txt'), escalaBarra = $('#escala .barra-escala'), escalaAnt = null;
  function desenharBarraEscala() {
    var s = escala();
    if (escalaAnt === s) return;          // so muda quando o zoom muda
    escalaAnt = s;
    var sqm = Math.max(1, Math.pow(2, Math.round(Math.log2(110 / s))));
    escalaTxt.textContent = sqm + ' sqm';
    escalaBarra.style.width = (sqm * s) + 'px';
  }

  function laco() {
    // rede de seguranca: se o palco mudou de tamanho sem disparar evento
    // (aba oculta, painel recolhido, DPI trocado), reajusta aqui.
    var r = palco.getBoundingClientRect();
    if (Math.round(r.width) !== larg || Math.round(r.height) !== alt) redimensionar();

    if (E.destaque) {
      if (performance.now() - E.destaque.desde > 6000) E.destaque = null;
      sujo = true;
    }
    if (sujo) { sujo = false; desenhar(); }
    requestAnimationFrame(laco);
  }

  /* =========================================================== navegacao === */
  function limitarCentro() {
    var margem = 400;
    E.centroX = Math.min(LIM.maxX + margem, Math.max(LIM.minX - margem, E.centroX));
    E.centroY = Math.min(LIM.maxY + margem, Math.max(LIM.minY - margem, E.centroY));
  }

  function irPara(x, y, z, nivel, destacar) {
    var zAntes = E.z;
    E.centroX = x + 0.5;
    E.centroY = y + 0.5;
    if (typeof z === 'number') E.z = Math.min(15, Math.max(0, z));
    if (typeof nivel === 'number') E.nivel = Math.min(NIVEIS.length - 1, Math.max(0, nivel));
    if (destacar) E.destaque = { x: x, y: y, z: E.z, desde: performance.now() };
    limitarCentro();
    montarAndares();
    if (E.z !== zAntes) { listarMarcadores(); listarPois(); listarSubareas(); }
    atualizarHash();
    sujar();
  }

  function zoomPara(novoNivel, ancoraX, ancoraY) {
    novoNivel = Math.min(NIVEIS.length - 1, Math.max(0, novoNivel));
    if (novoNivel === E.nivel) return;
    if (ancoraX == null) { E.nivel = novoNivel; }
    else {
      // mantem o ponto sob o cursor parado durante o zoom
      var mx = paraMundoX(ancoraX), my = paraMundoY(ancoraY);
      E.nivel = novoNivel;
      E.centroX = mx - (ancoraX - larg / 2) / escala();
      E.centroY = my - (ancoraY - alt / 2) / escala();
    }
    limitarCentro();
    atualizarDicaZoom();
    atualizarHash();
    sujar();
  }

  function trocarAndar(z) {
    z = Math.min(15, Math.max(0, z));
    if (z === E.z) return;
    E.z = z;
    montarAndares();
    listarMarcadores();
    listarPois();
    listarSubareas();
    atualizarHash();
    sujar();
  }

  function atualizarDicaZoom() {
    $('#dica-zoom').textContent = 'zoom ' + escala() + 'x  ·  andar ' + nomeAndar(E.z) + ' (z=' + E.z + ')';
  }

  /* ================================================ interacao com o mouse ===
     Botao esquerdo arrasta o mapa. Botao direito arrasta a caixa de selecao;
     se for clique seco, sem arrastar, abre o formulario de POI.
  ========================================================================= */
  var arrastando = false, arrastou = false, ax = 0, ay = 0, acx = 0, acy = 0;
  var selecao = null;              // {x0,y0,x1,y1} em sqm, enquanto arrasta
  var selecionou = false;          // avisa o contextmenu que houve caixa

  function retanguloSelecao() {
    if (!selecao) return null;
    return {
      x0: Math.min(selecao.x0, selecao.x1), x1: Math.max(selecao.x0, selecao.x1),
      y0: Math.min(selecao.y0, selecao.y1), y1: Math.max(selecao.y0, selecao.y1)
    };
  }

  /** Roda `fn` em cada marcador/POI desenhado dentro do retangulo. */
  function noRetangulo(r, fn) {
    if (!r) return 0;
    var n = 0;
    (marcasPorZ[E.z] || []).forEach(function (m) {
      if (!contavel(m) || subFeita(m[5])) return;
      if (m[0] < r.x0 || m[0] > r.x1 || m[1] < r.y0 || m[1] > r.y1) return;
      var feito = PROG.marcas.has(chaveMarca(m[0], m[1], m[2]));
      if (E.ocultarFeitos && feito) return;          // nao esta na tela
      fn(m[0], m[1], m[2], feito); n++;
    });
    if (E.verPois) (poisPorZ[E.z] || []).forEach(function (p) {
      if (subFeita(subDoPoi(p))) return;
      if (p.x < r.x0 || p.x > r.x1 || p.y < r.y0 || p.y > r.y1) return;
      var feito = PROG.marcas.has(chaveMarca(p.x, p.y, p.z));
      if (E.ocultarFeitos && feito) return;
      fn(p.x, p.y, p.z, feito); n++;
    });
    return n;
  }

  function contarNoRetangulo(r, soPendentes) {
    var n = 0;
    noRetangulo(r, function (x, y, z, feito) {
      if (!soPendentes || !feito) n++;
    });
    return n;
  }

  tela.addEventListener('mousedown', function (ev) {
    if (ev.button !== 0 && ev.button !== 2) return;
    arrastou = false;
    // se o mouseup anterior caiu fora da tela, o contextmenu nao veio limpar
    selecionou = false;
    ax = ev.clientX; ay = ev.clientY;

    if (ev.button === 2) {                            // direito: caixa de selecao
      var r = tela.getBoundingClientRect();
      var wx = Math.floor(paraMundoX(ev.clientX - r.left));
      var wy = Math.floor(paraMundoY(ev.clientY - r.top));
      selecao = { x0: wx, y0: wy, x1: wx, y1: wy, tirar: ev.shiftKey };
      popup.classList.remove('aberto');
      sujar();
      return;
    }

    arrastando = true;                                // esquerdo: move o mapa
    acx = E.centroX; acy = E.centroY;
    tela.classList.add('arrastando');
  });

  window.addEventListener('mousemove', function (ev) {
    var r = tela.getBoundingClientRect();
    var px = ev.clientX - r.left, py = ev.clientY - r.top;

    if (selecao) {
      selecao.x1 = Math.floor(paraMundoX(px));
      selecao.y1 = Math.floor(paraMundoY(py));
      if (Math.abs(ev.clientX - ax) + Math.abs(ev.clientY - ay) > 3) arrastou = true;
      sujar();
    } else if (arrastando) {
      var dx = (ev.clientX - ax) / escala();
      var dy = (ev.clientY - ay) / escala();
      if (Math.abs(ev.clientX - ax) + Math.abs(ev.clientY - ay) > 3) arrastou = true;
      E.centroX = acx - dx;
      E.centroY = acy - dy;
      limitarCentro();
      sujar();
    }

    if (px >= 0 && py >= 0 && px <= larg && py <= alt) {
      E.mouse = { x: Math.floor(paraMundoX(px)), y: Math.floor(paraMundoY(py)) };
      atualizarCoord();
      if (!selecao) mostrarPopup(px, py);
    } else if (E.mouse) {
      E.mouse = null; atualizarCoord(); popup.classList.remove('aberto');
    }
  });

  window.addEventListener('mouseup', function () {
    if (selecao) {
      aplicarSelecao();
      return;
    }
    if (arrastando) {
      arrastando = false;
      tela.classList.remove('arrastando');
      atualizarHash();
    }
  });

  function aplicarSelecao() {
    var r = retanguloSelecao();
    var tirar = selecao.tirar;
    selecao = null;

    // clique seco no direito: nao e caixa, e o contextmenu abre o POI
    if (!arrastou) { selecionou = false; sujar(); return; }
    selecionou = true;

    var n = 0;
    noRetangulo(r, function (x, y, z, feito) {
      if (tirar === !!feito) {                        // so mexe em quem muda
        if (feito) PROG.marcas.delete(chaveMarca(x, y, z));
        else PROG.marcas.add(chaveMarca(x, y, z));
        n++;
      }
    });

    if (n) {
      salvarProgresso();
      listarMarcadores(); listarPois(); listarSubareas();
      avisar((tirar ? 'Desmarcados ' : 'Conferidos ') + n +
             (n === 1 ? ' marcador' : ' marcadores'));
    } else {
      avisar(tirar ? 'Nada marcado nessa área' : 'Nenhum marcador novo nessa área');
    }
    sujar();
  }

  tela.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var r = tela.getBoundingClientRect();
    zoomPara(E.nivel + (ev.deltaY < 0 ? 1 : -1), ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });

  tela.addEventListener('dblclick', function (ev) {
    var r = tela.getBoundingClientRect();
    zoomPara(E.nivel + 1, ev.clientX - r.left, ev.clientY - r.top);
  });

  tela.addEventListener('contextmenu', function (ev) {
    ev.preventDefault();
    // vem logo depois do mouseup: se houve caixa, o menu nao e para abrir POI
    if (selecionou) { selecionou = false; return; }
    var r = tela.getBoundingClientRect();
    var x = Math.floor(paraMundoX(ev.clientX - r.left));
    var y = Math.floor(paraMundoY(ev.clientY - r.top));
    abrirFormularioPoi({ x: x, y: y, z: E.z });
  });

  function atualizarCoord() {
    var el = $('#coord');
    if (!E.mouse) {
      el.innerHTML = 'x <b>' + Math.floor(E.centroX) + '</b>  y <b>' + Math.floor(E.centroY) +
                     '</b>  z <b>' + E.z + '</b>';
    } else {
      el.innerHTML = 'x <b>' + E.mouse.x + '</b>  y <b>' + E.mouse.y + '</b>  z <b>' + E.z + '</b>';
    }
  }

  /* ------------------------------------------------- popup sobre o mouse --- */
  function acharNoPonto(px, py) {
    var raio = Math.max(9, ladoIcone() / 2 + 2);
    var achado = null, melhor = 1e9;

    function testar(x, y, obj) {
      var dx = paraTelaX(x + 0.5) - px, dy = paraTelaY(y + 0.5) - py;
      var d = dx * dx + dy * dy;
      if (d <= raio * raio && d < melhor) { melhor = d; achado = obj; }
    }
    // so acerta o que esta realmente desenhado na tela
    function desenhado(x, y, sub) {
      if (subFeita(sub)) return false;
      return !(E.ocultarFeitos && PROG.marcas.has(chaveMarca(x, y, E.z)));
    }
    if (E.verPois) (poisPorZ[E.z] || []).forEach(function (p) {
      if (desenhado(p.x, p.y, subDoPoi(p))) testar(p.x, p.y, { tipo: 'poi', dado: p });
    });
    if (E.verMarcadores) (marcasPorZ[E.z] || []).forEach(function (m) {
      if (contavel(m) && desenhado(m[0], m[1], m[5])) testar(m[0], m[1], { tipo: 'jogo', dado: m });
    });
    return achado;
  }

  function mostrarPopup(px, py) {
    if (arrastando) { popup.classList.remove('aberto'); tela.classList.remove('sobre-item'); return; }
    var alvo = acharNoPonto(px, py);
    if (!alvo) { popup.classList.remove('aberto'); tela.classList.remove('sobre-item'); return; }

    tela.classList.add('sobre-item');
    var t, s, txt, cx, cy, cz, sub;
    if (alvo.tipo === 'poi') {
      t = alvo.dado.titulo || 'POI sem nome';
      cx = alvo.dado.x; cy = alvo.dado.y; cz = alvo.dado.z;
      sub = subDoPoi(alvo.dado);
      s = cx + ', ' + cy + ', ' + cz + '  ·  meu POI';
      txt = alvo.dado.texto || '';
    } else {
      t = alvo.dado[4] || window.Icones.nome(alvo.dado[3]);
      cx = alvo.dado[0]; cy = alvo.dado[1]; cz = alvo.dado[2];
      sub = alvo.dado[5];
      s = cx + ', ' + cy + ', ' + cz + '  ·  ' + window.Icones.nome(alvo.dado[3]);
      txt = '';
    }
    var feito = PROG.marcas.has(chaveMarca(cx, cy, cz));
    popup.innerHTML = '<div class="p-tit"></div><div class="p-area"></div>' +
                      '<div class="p-sub"></div>' +
                      (txt ? '<div class="p-txt"></div>' : '') +
                      '<div class="p-acao"></div>';
    popup.querySelector('.p-tit').textContent = (feito ? '✓ ' : '') + t;
    popup.querySelector('.p-area').textContent = nomeCompleto(sub);
    popup.querySelector('.p-sub').textContent = s;
    if (txt) popup.querySelector('.p-txt').textContent = txt;
    popup.querySelector('.p-acao').textContent =
      feito ? 'clique para desmarcar' : 'clique para marcar como conferido';
    popup.classList.toggle('feito', feito);
    popup.classList.add('aberto');

    var pw = popup.offsetWidth, ph = popup.offsetHeight;
    var lx = px + 16, ly = py + 16;
    if (lx + pw > larg - 8) lx = px - pw - 14;
    if (ly + ph > alt - 8) ly = py - ph - 14;
    popup.style.left = Math.max(6, lx) + 'px';
    popup.style.top = Math.max(6, ly) + 'px';
  }

  tela.addEventListener('click', function (ev) {
    if (arrastou) return;
    var r = tela.getBoundingClientRect();
    var px = ev.clientX - r.left, py = ev.clientY - r.top;

    // Shift + clique: conclui / reabre a subarea inteira daquele ponto.
    if (ev.shiftKey) {
      var i = subareaEm(Math.floor(paraMundoX(px)), Math.floor(paraMundoY(py)));
      if (i < 0) { avisar('Aqui não tem nenhuma área da Cyclopedia.'); return; }
      alternarSub(i);
      avisar((subFeita(i) ? 'Concluída: ' : 'Reaberta: ') + nomeCompleto(i));
      listarSubareas(); listarMarcadores(); listarPois();
      sujar();
      return;
    }

    var alvo = acharNoPonto(px, py);

    // Clique no mapa longe de bandeira: seleciona a regiao dali.
    if (!alvo) {
      var iSel = subareaEm(Math.floor(paraMundoX(px)), Math.floor(paraMundoY(py)));
      if (iSel < 0) {
        if (E.selecao) { limparSelecao(); avisar('Seleção limpa'); }
        return;
      }
      selecionarSub(iSel, false);
      revelarSelecaoNaLista();
      avisar(nomeCompleto(iSel));
      return;
    }

    // Ctrl/Alt + clique: apenas revela na lista, sem conferir.
    if (ev.ctrlKey || ev.altKey) {
      if (alvo.tipo === 'poi') {
        trocarAba('pois');
        E.selecionado = alvo.dado.id;
        listarPois();
      } else {
        trocarAba('marcadores');
        E.selecionado = chaveMarca(alvo.dado[0], alvo.dado[1], alvo.dado[2]);
        listarMarcadores();
      }
      var el = $('#lateral .item.selecionado');
      if (el) el.scrollIntoView({ block: 'nearest' });
      return;
    }

    // Clique simples: risca/desrisca o marcador.
    if (alvo.tipo === 'poi') alternarMarca(alvo.dado.x, alvo.dado.y, alvo.dado.z);
    else alternarMarca(alvo.dado[0], alvo.dado[1], alvo.dado[2]);
    listarMarcadores(); listarPois(); listarSubareas();
    mostrarPopup(px, py);
    sujar();
  });

  /* ============================================================ teclado === */
  window.addEventListener('keydown', function (ev) {
    var alvo = ev.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT')) {
      if (ev.key === 'Escape') alvo.blur();
      return;
    }
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;

    if (ev.key === 'Escape' && !selecao && E.selecao) {
      limparSelecao(); avisar('Seleção limpa'); ev.preventDefault();
      return;
    }
    if (ev.key === 'Escape' && selecao) {     // cancela a caixa em andamento
      selecao = null;
      selecionou = true;                      // e segura o menu do botao direito
      sujar(); ev.preventDefault();
      return;
    }

    var passo = 120 / escala();
    var k = ev.key;

    switch (k) {
      case 'ArrowUp':    E.centroY -= passo; break;
      case 'ArrowDown':  E.centroY += passo; break;
      case 'ArrowLeft':  E.centroX -= passo; break;
      case 'ArrowRight': E.centroX += passo; break;
      default: return tratarTeclaLetra(ev, k);
    }
    ev.preventDefault();
    limitarCentro();
    atualizarHash();
    sujar();
  });

  function tratarTeclaLetra(ev, k) {
    var b = k.toLowerCase();
    switch (b) {
      case 'k': trocarAndar(E.z - 1); break;                    // sobe um andar
      case 'j': trocarAndar(E.z + 1); break;                    // desce um andar
      case 'l': trocarAndar(Z_TERREO); break;                   // volta ao terreo
      case 'g': alternar('verGrade'); break;
      case 'm': alternar('verMarcadores'); break;
      case 'e': alternar('verExiva'); break;
      case 'p': trocarCamada(); break;
      case 'o': alternar('verPois'); break;
      case 'x': alternar('ocultarFeitos'); listarMarcadores(); listarPois(); break;
      case 'a': alternar('verAreas'); break;
      case 'v': {                                   // conclui a subarea do centro
        var iv = subareaEm(Math.floor(E.centroX), Math.floor(E.centroY));
        if (iv < 0) { avisar('Aqui não tem nenhuma área da Cyclopedia.'); break; }
        alternarSub(iv);
        avisar((subFeita(iv) ? 'Concluída: ' : 'Reaberta: ') + nomeCompleto(iv));
        listarSubareas(); listarMarcadores(); listarPois();
        sujar();
        break;
      }
      case 'b': document.body.classList.toggle('sem-lateral'); redimensionar(); break;
      case 'f': alternarTelaCheia(); break;
      case 'c':
        if (E.destaque) irPara(E.destaque.x, E.destaque.y, E.destaque.z, null, true);
        break;
      case '=': case '+': zoomPara(E.nivel + 1); break;
      case '-': case '_': zoomPara(E.nivel - 1); break;
      case '?': case 'h': abrirAjuda(true); break;
      case 'y': abrirCompartilhar(true); break;
      case 'escape': abrirAjuda(false); abrirCompartilhar(false); break;
      default: return;
    }
    ev.preventDefault();
  }

  function alternar(campo) {
    E[campo] = !E[campo];
    sincronizarBotoes();
    salvarPrefs();
    sujar();
  }
  function trocarCamada() {
    E.camada = E.camada === 'color' ? 'waypoint' : 'color';
    sincronizarBotoes();
    salvarPrefs();
    sujar();
  }
  function alternarTelaCheia() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function () {});
  }

  /* ============================================================ andares === */
  function montarAndares() {
    var box = $('#andares');
    if (!box.dataset.pronto) {
      var html = '<div class="cab">andar</div>';
      for (var z = 0; z <= 15; z++) {
        html += '<button class="andar" data-z="' + z + '" title="z=' + z + ' — ' + rotuloAndar(z) + '">' +
                '<span class="pt"></span><span class="n">' + nomeAndar(z) + '</span>' +
                '<span class="z">z' + z + '</span></button>';
      }
      box.innerHTML = html;
      box.dataset.pronto = '1';
      box.addEventListener('click', function (ev) {
        var b = ev.target.closest('.andar');
        if (b) trocarAndar(+b.dataset.z);
      });
      // roda do mouse em cima da lista sobe/desce de andar
      box.addEventListener('wheel', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        trocarAndar(E.z + (ev.deltaY < 0 ? -1 : 1));   // pra cima = subir
      }, { passive: false });
    }
    box.querySelectorAll('.andar').forEach(function (b) {
      var z = +b.dataset.z;
      var ativo = z === E.z;
      b.classList.toggle('ativo', ativo);
      b.classList.toggle('vazio', INDICE[E.camada][z].size === 0);
      // em janela baixa a lista rola; mantem o andar atual a vista
      if (ativo && box.scrollHeight > box.clientHeight) {
        b.scrollIntoView({ block: 'nearest' });
      }
    });
    atualizarDicaZoom();
    atualizarCoord();
  }

  /* ============================================================== abas === */
  function trocarAba(nome) {
    document.querySelectorAll('#abas button').forEach(function (b) {
      b.classList.toggle('ativo', b.dataset.aba === nome);
    });
    document.querySelectorAll('.painel').forEach(function (p) {
      p.classList.toggle('ativo', p.dataset.aba === nome);
    });
  }
  $('#abas').addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (b) trocarAba(b.dataset.aba);
  });

  /* ================================================= lista de marcadores === */
  var filtroTexto = '', filtroIcone = '', apenasAndar = true, apenasComTexto = false;
  var esconderConferidos = false;

  function itemHtml(icone, titulo, sub, chave, acoes, feito) {
    var div = document.createElement('div');
    div.className = 'item' + (E.selecionado === chave ? ' selecionado' : '') +
                    (feito ? ' feito' : '');
    div.dataset.chave = chave;
    var img = document.createElement('img');
    img.src = window.Icones.url(icone, 18, feito);
    img.width = img.height = 18;
    img.alt = '';
    div.appendChild(img);
    var txt = document.createElement('div');
    txt.className = 'txt';
    var t = document.createElement('div'); t.className = 'titulo'; t.textContent = titulo;
    var s = document.createElement('div'); s.className = 'sub'; s.textContent = sub;
    txt.appendChild(t); txt.appendChild(s);
    div.appendChild(txt);
    if (acoes) div.appendChild(acoes);
    return div;
  }

  function listarMarcadores() {
    var base = apenasAndar ? (marcasPorZ[E.z] || []) : MARCAS_JOGO;
    var q = filtroTexto.toLowerCase();
    var res = base.filter(function (m) {
      if (!contavel(m)) return false;
      if (filtroIcone !== '' && m[3] !== +filtroIcone) return false;
      if (apenasComTexto && !m[4]) return false;
      if (esconderConferidos && marcaFeita(m[0], m[1], m[2])) return false;
      if (!q) return true;
      return (m[4] || '').toLowerCase().indexOf(q) >= 0 ||
             window.Icones.nome(m[3]).toLowerCase().indexOf(q) >= 0 ||
             (m[0] + ',' + m[1]).indexOf(q) >= 0 ||
             nomeCompleto(m[5]).toLowerCase().indexOf(q) >= 0;
    });

    var box = $('#lista-marcadores');
    box.innerHTML = '';
    if (!res.length) {
      box.innerHTML = '<div class="vazio-msg">' +
        (esconderConferidos && base.length
          ? 'Tudo conferido neste filtro. 🎉'
          : 'Nenhum marcador com esses filtros.') + '</div>';
    } else {
      var frag = document.createDocumentFragment();
      res.slice(0, 800).forEach(function (m) {
        var chave = chaveMarca(m[0], m[1], m[2]);
        var feito = marcaFeita(m[0], m[1], m[2]);

        var acoes = document.createElement('div');
        acoes.className = 'acoes';
        var bOk = document.createElement('button');
        bOk.textContent = feito ? '↺' : '✓';
        bOk.title = feito ? 'Desmarcar' : 'Marcar como conferido';
        acoes.appendChild(bOk);

        var el = itemHtml(m[3], m[4] || window.Icones.nome(m[3]),
                          nomeCompleto(m[5]) + ' · ' + m[0] + ', ' + m[1] + ' · z' + m[2],
                          chave, acoes, feito);

        el.addEventListener('click', function () {
          E.selecionado = chave;
          irPara(m[0], m[1], m[2], Math.max(E.nivel, 4), true);
          listarMarcadores();
        });
        bOk.addEventListener('click', function (ev) {
          ev.stopPropagation();
          alternarMarca(m[0], m[1], m[2]);
          listarMarcadores(); listarSubareas();
          sujar();
        });
        frag.appendChild(el);
      });
      box.appendChild(frag);
      if (res.length > 800) {
        var aviso = document.createElement('div');
        aviso.className = 'vazio-msg';
        aviso.textContent = 'Mostrando 800 de ' + res.length + '. Refine a busca.';
        box.appendChild(aviso);
      }
    }
    $('#conta-marcadores').textContent = res.length + ' de ' + TOTAL_MARCAS;
    atualizarResumo();
  }

  /* ================================================= lista de subareas === */
  var subAndarAtual = false, subEsconderFeitas = false, subBusca = '';
  var gruposAbertos = {};                 // nome da area -> aberto?

  /** As ordens de lista. 'facil' e um palpite (veja data/quest.js); as outras
      saem todas dos dados, entao nao tem chute nenhum. */
  /** Subareas que o rastreador consegue acompanhar (as que tem marcador). */
  function quantasSubs(g) { return subsQueContam(g).length; }
  function subsRestantes(g) { return quantasSubs(g) - subsFeitasNaArea(g); }

  /** Quantas subareas a area TEM na quest, mesmo as sem marcador nenhum aqui.
      E este numero que mede o tamanho do trabalho: 7 pontos por subarea. */
  function subsDaQuest(g) {
    if (!g.naQuest) return quantasSubs(g);
    var c = (Q.subareasCertas && Q.subareasCertas[g.nome] || []).length;
    var d = Object.keys(Q.subareasDuvidosas && Q.subareasDuvidosas[g.nome] || {}).length;
    return (c + d) || quantasSubs(g);
  }

  var ORDENS = {
    // O tamanho do trabalho de uma area e o numero de SUBAREAS (7 pontos cada).
    facil:      function (a, b) { return subsDaQuest(a) - subsDaQuest(b) || a.ordem - b.ordem; },
    dificil:    function (a, b) { return subsDaQuest(b) - subsDaQuest(a) || b.ordem - a.ordem; },
    acesso:     function (a, b) { return a.ordem - b.ordem || a.nome.localeCompare(b.nome); },
    nome:       function (a, b) { return a.nome.localeCompare(b.nome); },
    faltaPouco: function (a, b) { return pctArea(b) - pctArea(a) || subsDaQuest(a) - subsDaQuest(b); },
    restante:   function (a, b) { return subsRestantes(a) - subsRestantes(b) || a.ordem - b.ordem; },
    marcadores: function (a, b) { return a.total - b.total || a.ordem - b.ordem; }
  };

  function gruposOrdenados() {
    if (!ORDENS[ordemAreas]) ordemAreas = 'facil';
    var cmp = ORDENS[ordemAreas];
    return GRUPOS.slice().sort(function (a, b) {
      // "Fora das áreas" e Dawnport sempre por ultimo, em qualquer ordem
      if (a.naQuest !== b.naQuest) return a.naQuest ? -1 : 1;
      return cmp(a, b);
    });
  }

  function pctBarra(feitas, total, marcos) {
    var b = document.createElement('div');
    b.className = 'barra-prog';
    var i = document.createElement('i');
    i.style.width = (total ? Math.round(100 * feitas / total) : 0) + '%';
    b.appendChild(i);
    // riscos de 30% e 70%, que liberam recursos no Cyclopedia Map
    if (marcos) {
      (Q.marcos || []).forEach(function (mk) {
        if (mk.pct >= 100) return;
        var r = document.createElement('u');
        r.style.left = mk.pct + '%';
        r.className = marcos.indexOf(mk.pct) >= 0 ? 'batido' : '';
        r.title = mk.pct + '% — ' + mk.o_que;
        b.appendChild(r);
      });
    }
    return b;
  }

  /** Quais marcos (30/70/100) esta porcentagem ja passou. */
  function marcosDe(pct) {
    return (Q.marcos || []).filter(function (m) { return pct >= m.pct; })
                           .map(function (m) { return m.pct; });
  }

  /** "andar 0" / "andares +2 a -5 (7)" - a partir da mascara de bits. */
  function andaresTexto(mascara) {
    var lista = [];
    for (var z = 0; z <= 15; z++) if (mascara & (1 << z)) lista.push(nomeAndar(z));
    if (!lista.length) return 'sem marcador';
    if (lista.length === 1) return 'andar ' + lista[0];
    return 'andares ' + lista[0] + ' a ' + lista[lista.length - 1] +
           ' (' + lista.length + ')';
  }

  function listarSubareas() {
    var box = $('#lista-subareas');
    box.innerHTML = '';

    if (!TEM_AREAS) {
      box.innerHTML = '<div class="vazio-msg">As áreas da Cyclopedia não foram baixadas.' +
        '<br><br>Rode <b>python tools/baixar_areas.py</b> e depois ' +
        '<b>python tools/gerar_dados.py</b>.</div>';
      atualizarResumo();
      return;
    }

    var feitas = feitasPorSub();
    var q = subBusca.toLowerCase();
    var bitAndar = 1 << E.z;
    var frag = document.createDocumentFragment();
    var mostrou = 0;

    gruposOrdenados().forEach(function (g) {
      // quais subareas do grupo passam nos filtros
      var subs = g.subs.filter(function (i) {
        if (subAndarAtual && !(andaresSub[i] & bitAndar)) return false;
        if (subEsconderFeitas && contaSub[i] && feitas[i] >= contaSub[i]) return false;
        if (!q) return true;
        return nomeSub(i).toLowerCase().indexOf(q) >= 0 ||
               g.nome.toLowerCase().indexOf(q) >= 0;
      });
      if (!subs.length) return;
      mostrou += subs.length;

      var valem = g.naQuest
        ? subs.filter(function (i) { return contaNaArea(g.nome, nomeSub(i)); })
        : subs;
      // progresso da area = SUBAREAS concluidas, igual ao jogo conta
      var total = valem.length;
      var pronto = valem.filter(function (i) { return subFeita(i); }).length;
      var todasFeitas = subs.every(function (i) { return subFeita(i); });
      // a busca abre os grupos sozinha; fora dela vale o que o usuario abriu
      var aberto = q ? true : !!gruposAbertos[g.nome];

      /* ---- cabecalho da area (cidade) ---- */
      var selArea = E.selecao && E.selecao.area === g.nome;
      var cab = document.createElement('div');
      cab.className = 'grupo' + (total && pronto >= total ? ' completo' : '') +
                      (aberto ? ' aberto' : '') +
                      (selArea && E.selecao.tipo === 'area' ? ' selecionada' : '');

      var seta = document.createElement('span');
      seta.className = 'seta';
      seta.textContent = aberto ? '▾' : '▸';
      cab.appendChild(seta);

      var cx = document.createElement('input');
      cx.type = 'checkbox';
      cx.checked = todasFeitas;
      cx.title = todasFeitas ? 'Reabrir toda a área' : 'Concluir toda a área';
      cx.addEventListener('click', function (ev) {
        ev.stopPropagation();
        subs.forEach(function (i) { definirSub(i, cx.checked); });
        salvarProgresso();
        listarSubareas(); listarMarcadores(); listarPois();
        sujar();
      });
      cab.appendChild(cx);

      var nome = document.createElement('div');
      nome.className = 'txt';
      var t = document.createElement('div');
      t.className = 'titulo';
      t.textContent = g.nome;
      if (g.achievement) {
        var tro = document.createElement('span');
        tro.className = 'troféu';
        tro.textContent = '🏆';
        tro.title = 'Achievement em 100%: ' + g.achievement;
        t.appendChild(tro);
      }
      if (!g.naQuest) {
        var forinha = document.createElement('span');
        forinha.className = 'etiq-fora';
        forinha.textContent = 'fora da quest';
        forinha.title = g.nota || 'Não conta para a Measuring Tibia Quest.';
        t.appendChild(forinha);
      }
      var s = document.createElement('div');
      s.className = 'sub';
      // o rastreador so enxerga subarea onde voce tem marcador; se o jogo tem
      // mais, avisa - senao "100%" aqui daria a impressao errada
      var naQuestTotal = subsDaQuest(g);
      var semMarca = naQuestTotal - total;
      s.textContent = naQuestTotal + (naQuestTotal === 1 ? ' subárea' : ' subáreas') +
                      ' · ' + (naQuestTotal * (Q.poiPorSubarea || 7)) + ' pontos' +
                      (semMarca > 0 ? ' · ' + semMarca + ' sem bandeira aqui' : '') +
                      (g.nota ? ' · ' + g.nota : '');
      s.title = naQuestTotal + ' subáreas × ' + (Q.poiPorSubarea || 7) +
        ' Points of Interest = ' + (naQuestTotal * (Q.poiPorSubarea || 7)) +
        ' pontos para achar nesta área.' +
        (semMarca > 0
          ? '\n\n' + semMarca + ' delas não têm nenhuma bandeira no seu arquivo, então o '
            + 'contador só acompanha ' + total + '.'
          : '') + (g.nota ? '\n\n' + g.nota : '');
      if (semMarca > 0) {
        var pc = document.createElement('span');
        pc.className = 'etiq-parcial';
        pc.textContent = '−' + semMarca;
        pc.title = s.title;
        t.appendChild(pc);
      }
      nome.appendChild(t); nome.appendChild(s);
      nome.appendChild(pctBarra(pronto, total, g.naQuest ? marcosDe(pctArea(g)) : null));
      cab.appendChild(nome);

      var cont = document.createElement('div');
      cont.className = 'contagem' + (total && pronto >= total ? ' completo' : '');
      cont.textContent = pronto + '/' + total;
      cont.title = pronto + ' de ' + total + ' subáreas concluídas';
      cab.appendChild(cont);

      cab.addEventListener('click', function () {
        gruposAbertos[g.nome] = !aberto;
        selecionarArea(g.nome, true);
        listarSubareas();
      });
      frag.appendChild(cab);

      if (!aberto) return;

      /* ---- subareas da area ---- */
      subs.forEach(function (i) {
        var feito = subFeita(i);
        var tot = contaSub[i], pr = feitas[i];

        var li = document.createElement('div');
        li.className = 'sub-item' + (feito ? ' feita' : '') +
          (E.selecao && E.selecao.tipo === 'sub' && E.selecao.subs[0] === i
             ? ' selecionada' : '');

        var c2 = document.createElement('input');
        c2.type = 'checkbox';
        c2.checked = feito;
        c2.title = feito ? 'Reabrir esta subárea' : 'Marcar como concluída';
        c2.addEventListener('click', function (ev) {
          ev.stopPropagation();
          definirSub(i, c2.checked);
          salvarProgresso();
          listarSubareas(); listarMarcadores(); listarPois();
          sujar();
        });
        li.appendChild(c2);

        var txt = document.createElement('div');
        txt.className = 'txt';
        var t2 = document.createElement('div');
        t2.className = 'titulo';
        t2.textContent = nomeSub(i);
        var cls = g.naQuest ? classeSub(g.nome, nomeSub(i)) : 'fora';
        if (cls === 'duvidosa') {
          var dv = document.createElement('span');
          dv.className = 'etiq-duvida';
          dv.textContent = '?';
          var qual = Q.subareasDuvidosas[g.nome][nomeSub(i)];
          dv.title = 'Só a wiki ' + (qual === 'EN' ? 'em inglês' : 'em português') +
                     ' lista esta subárea como descobrível. Na dúvida ela conta.';
          t2.appendChild(dv);
        } else if (cls === 'fora') {
          var fr = document.createElement('span');
          fr.className = 'etiq-fora';
          fr.textContent = 'não conta';
          fr.title = 'Nenhuma das duas wikis lista esta subárea como descobrível — ' +
                     'ela fica de fora da conta da área.';
          t2.appendChild(fr);
          li.classList.add('nao-conta');
        }
        var nota = Q.notasSubarea && Q.notasSubarea[nomeSub(i)];
        if (nota) {
          var av = document.createElement('span');
          av.className = 'etiq-aviso';
          av.textContent = '!';
          av.title = nota;
          t2.appendChild(av);
        }
        var s2 = document.createElement('div');
        s2.className = 'sub';
        s2.textContent = andaresTexto(andaresSub[i]);
        txt.appendChild(t2); txt.appendChild(s2);
        if (tot) txt.appendChild(pctBarra(pr, tot));
        li.appendChild(txt);

        var c3 = document.createElement('div');
        c3.className = 'contagem' + (feito ? ' completo' : '');
        c3.textContent = feito ? '✓' : pr + '/' + tot;
        c3.title = feito
          ? 'Subárea concluída'
          : 'Você já passou por ' + pr + ' das ' + tot + ' bandeiras daqui. ' +
            'Bastam ' + (Q.poiPorSubarea || 7) + ' Points of Interest para fechar — ' +
            'as bandeiras são o pool de onde eles são sorteados.';
        li.appendChild(c3);

        li.addEventListener('click', function () { selecionarSub(i, true); });
        frag.appendChild(li);
      });
    });

    if (!mostrou) {
      box.innerHTML = '<div class="vazio-msg">' +
        (subEsconderFeitas ? 'Tudo conferido nestes filtros. 🎉'
                           : 'Nenhuma subárea com esses filtros.') + '</div>';
    } else {
      box.appendChild(frag);
    }
    atualizarResumo();
  }

  /* ------------------------------------------------------ recompensas --- */
  function atualizarRecompensas() {
    var caixa = $('#recompensas');
    if (!caixa || !TEM_AREAS) return;
    var feitas = feitasPorSub();
    var totalQuest = GRUPOS.filter(function (g) { return g.naQuest; }).length;
    var prontas = 0;
    GRUPOS.forEach(function (g) { if (g.naQuest && areaCompleta(g, feitas)) prontas++; });

    var alvo = (Q.recompensas || []).reduce(function (t, r) {
      return t || (prontas < r.areas ? r.areas : 0);
    }, 0) || totalQuest;
    var subsFeitas = 0, subsTotal = 0, subsNaQuest = 0;
    GRUPOS.forEach(function (g) {
      if (!g.naQuest) return;
      subsTotal += quantasSubs(g);          // o que da para acompanhar aqui
      subsNaQuest += subsDaQuest(g);        // o que a quest tem de verdade
      subsFeitas += subsFeitasNaArea(g);
    });

    var html = '<div class="rec-topo">' +
      '<span class="rec-num">' + prontas + '<i>/' + totalQuest + '</i></span>' +
      '<span class="rec-txt">área' + (prontas === 1 ? '' : 's') + ' 100% concluída' +
      (prontas === 1 ? '' : 's') + '<br><small title="' +
      (subsNaQuest - subsTotal) + ' subárea(s) da quest não têm bandeira no seu ' +
      'arquivo, então o contador acompanha ' + subsTotal + ' de ' + subsNaQuest + '.">' +
      subsFeitas + '/' + subsTotal + ' subáreas · ' +
      (subsFeitas * (Q.poiPorSubarea || 7)) + ' de ' +
      (subsTotal * (Q.poiPorSubarea || 7)) + ' pontos</small></span></div>' +
      '<div class="barra-prog grande"><i style="width:' +
      (totalQuest ? Math.round(100 * prontas / totalQuest) : 0) + '%"></i></div>' +
      '<ul class="rec-lista"></ul>';
    caixa.innerHTML = html;

    var ul = caixa.querySelector('.rec-lista');
    (Q.recompensas || []).forEach(function (r) {
      var ok = prontas >= r.areas;
      var li = document.createElement('li');
      li.className = ok ? 'ok' : (r.areas === alvo ? 'proxima' : '');
      li.title = r.onde ? 'Pegue com o ' + r.onde : '';
      li.innerHTML = '<span class="marca">' + (ok ? '✓' : r.areas) + '</span>' +
                     '<span class="oq"></span><span class="falta"></span>';
      li.querySelector('.oq').textContent = r.o_que + (r.extra ? ' · ' + r.extra : '');
      li.querySelector('.falta').textContent = ok ? 'liberado'
        : 'faltam ' + (r.areas - prontas);
      ul.appendChild(li);
    });

    // titulos por porcentagem de areas
    (Q.titulos || []).forEach(function (t) {
      var precisa = Math.ceil(totalQuest * t.pct / 100);
      var ok = prontas >= precisa;
      var li = document.createElement('li');
      li.className = ok ? 'ok' : '';
      li.title = 'Título de personagem, com ' + t.pct + '% das áreas.';
      li.innerHTML = '<span class="marca">' + (ok ? '✓' : precisa) + '</span>' +
                     '<span class="oq"></span><span class="falta"></span>';
      li.querySelector('.oq').textContent = 'Título ' + t.nome;
      li.querySelector('.falta').textContent = ok ? 'liberado' : 'faltam ' + (precisa - prontas);
      ul.appendChild(li);
    });

    // bonus de speed
    if (Q.speed) {
      var v = speedEstimado(prontas);
      var passo = (Q.speed.max - Q.speed.min) / ((Q.totalAreas || 20) - 1);
      var li2 = document.createElement('li');
      li2.className = 'bonus' + (prontas ? ' ativo' : '');
      li2.innerHTML = '<span class="marca">⚡</span><span class="oq"></span>' +
                      '<span class="falta"></span>';
      li2.querySelector('.oq').textContent = prontas
        ? 'Speed dentro de área concluída'
        : 'Speed (a partir da 1ª área)';
      li2.querySelector('.falta').textContent = prontas
        ? '~' + v : Q.speed.min + '–' + Q.speed.max;
      li2.title =
        'O bônus vale SÓ enquanto você está dentro de uma área que já concluiu, e ' +
        'cresce com o total de áreas concluídas — não é por cidade.\n\n' +
        'A CipSoft só publicou os extremos: ' + Q.speed.min + ' com 1 área e ' +
        Q.speed.max + ' com ' + (Q.totalAreas || 20) + '. O valor exato aparece no ' +
        Q.speed.ondeVerOExato + '.';
      ul.appendChild(li2);

      // a conta na cara do gol, senao o "~" nao explica nada
      var li2b = document.createElement('li');
      li2b.className = 'formula';
      li2b.innerHTML = '<span class="marca"></span><span class="oq"></span>';
      li2b.querySelector('.oq').textContent = prontas
        ? 'estimativa: ' + Q.speed.min + ' + ' + passo + ' × (' + prontas + ' − 1) = ' + v
        : 'estimativa: ' + Q.speed.min + ' + ' + passo + ' × (áreas − 1)';
      li2b.title = 'Interpolação linear entre os dois extremos confirmados. ' +
                   'Não é número oficial — a CipSoft não publicou a curva.';
      ul.appendChild(li2b);
    }

    if (Q.achievementsTotal) {
      var li3 = document.createElement('li');
      li3.className = 'nota-rec';
      li3.innerHTML = '<span class="marca">🏅</span><span class="oq"></span>' +
                      '<span class="falta"></span>';
      li3.querySelector('.oq').textContent = 'Achievements da quest';
      li3.querySelector('.falta').textContent =
        Q.achievementsTotal.quantos + ' · ' + Q.achievementsTotal.pontos + ' pts';
      li3.title = 'Um por área concluída, mais os de marco.';
      ul.appendChild(li3);
    }
  }

  function atualizarResumo() {
    if (!TEM_AREAS) return;
    atualizarRecompensas();
    var feitas = feitasPorSub();
    var marcasFeitas = 0, total = 0;
    GRUPOS.forEach(function (g) {
      g.subs.forEach(function (i) {
        total += contaSub[i];
        marcasFeitas += feitas[i];
      });
    });
    var pct = total ? Math.round(100 * marcasFeitas / total) : 0;

    // o progresso da quest e por subarea; marcador e so o pool de sorteio
    var sf = 0, st = 0;
    GRUPOS.forEach(function (g) {
      if (!g.naQuest) return;
      st += quantasSubs(g);
      sf += subsFeitasNaArea(g);
    });
    var pctSub = st ? Math.round(100 * sf / st) : 0;

    var el = $('#resumo-progresso');
    if (el) {
      el.textContent = sf + '/' + st + ' subáreas · ' +
                       marcasFeitas + '/' + total + ' bandeiras vistas';
    }
    var topo = $('#progresso-topo');
    if (topo) {
      topo.textContent = pctSub + '%';
      topo.title = sf + ' de ' + st + ' subáreas concluídas (' +
                   (sf * (Q.poiPorSubarea || 7)) + ' de ' +
                   (st * (Q.poiPorSubarea || 7)) + ' Points of Interest).\n' +
                   marcasFeitas + ' de ' + total + ' bandeiras já visitadas.';
      topo.style.setProperty('--pct', pctSub + '%');
    }
  }


  /* ======================================================= lista de POIs === */
  function listarPois() {
    var q = $('#busca-poi').value.trim().toLowerCase();
    var res = pois.filter(function (p) {
      if (!q) return true;
      return (p.titulo || '').toLowerCase().indexOf(q) >= 0 ||
             (p.texto || '').toLowerCase().indexOf(q) >= 0 ||
             (p.x + ',' + p.y).indexOf(q) >= 0;
    }).sort(function (a, b) { return a.z - b.z || a.y - b.y || a.x - b.x; });

    var box = $('#lista-pois');
    box.innerHTML = '';
    if (!pois.length) {
      box.innerHTML = '<div class="vazio-msg">Nenhum POI seu ainda.<br><br>' +
        'Clique com o <b>botao direito</b> no mapa para criar um aqui.</div>';
    } else if (!res.length) {
      box.innerHTML = '<div class="vazio-msg">Nenhum POI bate com a busca.</div>';
    } else {
      var frag = document.createDocumentFragment();
      res.forEach(function (p) {
        var feito = marcaFeita(p.x, p.y, p.z);
        var acoes = document.createElement('div');
        acoes.className = 'acoes';
        var bOk = document.createElement('button');
        bOk.textContent = feito ? '↺' : '✓';
        bOk.title = feito ? 'Desmarcar' : 'Marcar como conferido';
        var bEd = document.createElement('button'); bEd.textContent = '✎'; bEd.title = 'Editar POI';
        var bEx = document.createElement('button'); bEx.textContent = '✕'; bEx.title = 'Excluir POI';
        acoes.appendChild(bOk); acoes.appendChild(bEd); acoes.appendChild(bEx);

        var el = itemHtml(p.icone, p.titulo || 'POI sem nome',
                          nomeCompleto(subDoPoi(p)) + ' · ' + p.x + ', ' + p.y +
                          ' · z' + p.z, p.id, acoes, feito);
        el.addEventListener('click', function () {
          E.selecionado = p.id;
          irPara(p.x, p.y, p.z, Math.max(E.nivel, 4), true);
          listarPois();
        });
        bOk.addEventListener('click', function (ev) {
          ev.stopPropagation();
          alternarMarca(p.x, p.y, p.z);
          listarPois(); listarSubareas();
          sujar();
        });
        bEd.addEventListener('click', function (ev) { ev.stopPropagation(); abrirFormularioPoi(p); });
        bEx.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (!confirm('Excluir o POI "' + (p.titulo || 'sem nome') + '"?')) return;
          pois = pois.filter(function (o) { return o.id !== p.id; });
          salvarPois(); listarPois(); sujar();
        });
        frag.appendChild(el);
      });
      box.appendChild(frag);
    }
    $('#conta-pois').textContent = pois.length + ' POI(s)';
  }

  /* ------------------------------------------------------ formulario POI --- */
  var editando = null;

  function abrirFormularioPoi(base) {
    trocarAba('pois');
    editando = base && base.id ? base : null;
    $('#poi-x').value = base.x;
    $('#poi-y').value = base.y;
    $('#poi-z').value = base.z;
    $('#poi-titulo').value = base.titulo || '';
    $('#poi-texto').value = base.texto || '';
    $('#poi-icone').value = base.icone != null ? base.icone : 3;
    $('#form-poi').style.display = 'flex';
    $('#btn-salvar-poi').textContent = editando ? 'Salvar alteracoes' : 'Criar POI';
    $('#poi-titulo').focus();
  }
  function fecharFormularioPoi() {
    $('#form-poi').style.display = 'none';
    editando = null;
  }

  $('#btn-salvar-poi').addEventListener('click', function () {
    var x = parseInt($('#poi-x').value, 10);
    var y = parseInt($('#poi-y').value, 10);
    var z = parseInt($('#poi-z').value, 10);
    if (isNaN(x) || isNaN(y) || isNaN(z)) { alert('Coordenadas invalidas.'); return; }
    var dados = {
      x: x, y: y, z: Math.min(15, Math.max(0, z)),
      icone: parseInt($('#poi-icone').value, 10) || 0,
      titulo: $('#poi-titulo').value.trim(),
      texto: $('#poi-texto').value.trim()
    };
    if (editando) {
      Object.assign(editando, dados);
    } else {
      dados.id = 'poi' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      pois.push(dados);
    }
    salvarPois();
    fecharFormularioPoi();
    listarPois();
    sujar();
  });
  $('#btn-cancelar-poi').addEventListener('click', fecharFormularioPoi);
  $('#btn-novo-poi').addEventListener('click', function () {
    abrirFormularioPoi({ x: Math.round(E.centroX), y: Math.round(E.centroY), z: E.z });
  });

  /* -------------------------------------------------- exportar / importar --- */
  function exportarTudo() {
    if (!pois.length && !PROG.subareas.size && !PROG.marcas.size) {
      alert('Nao ha nada para exportar ainda.');
      return;
    }
    var blob = new Blob([JSON.stringify({
      versao: 3,
      pois: pois,
      progresso: {
        subareas: Array.from(PROG.subareas),
        marcas: Array.from(PROG.marcas)
      }
    }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tibia-map-poi-backup.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  $('#btn-exportar').addEventListener('click', exportarTudo);
  $('#btn-exportar-sub').addEventListener('click', exportarTudo);

  $('#arq-importar').addEventListener('change', function (ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var obj = JSON.parse(fr.result);
        var lista = Array.isArray(obj) ? obj : obj.pois;
        if (!Array.isArray(lista)) throw new Error('formato desconhecido');
        var existentes = new Set(pois.map(function (p) { return p.x + ':' + p.y + ':' + p.z; }));
        var novos = 0;
        lista.forEach(function (p) {
          var ch = p.x + ':' + p.y + ':' + p.z;
          if (existentes.has(ch)) return;
          existentes.add(ch);
          pois.push({
            id: p.id || 'poi' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            x: +p.x, y: +p.y, z: +p.z,
            icone: +p.icone || 0,
            titulo: String(p.titulo || ''),
            texto: String(p.texto || '')
          });
          novos++;
        });
        var resumo = novos + ' POI(s) importado(s). ' + (lista.length - novos) + ' ja existiam.';

        // backups a partir da versao 2 trazem o progresso junto
        if (obj.progresso) {
          (obj.progresso.subareas || []).forEach(function (k) { PROG.subareas.add(k); });
          (obj.progresso.marcas || []).forEach(function (k) { PROG.marcas.add(k); });
          // v2 concluia quadrantes de 256; converte em marcadores conferidos
          if (obj.progresso.setores && obj.progresso.setores.length) {
            var quad = new Set(obj.progresso.setores);
            MARCAS_JOGO.forEach(function (m) {
              if (quad.has(m[2] + '|' + (m[0] & ~255) + '_' + (m[1] & ~255))) {
                PROG.marcas.add(chaveMarca(m[0], m[1], m[2]));
              }
            });
          }
          salvarProgresso(true);
          resumo += '\nProgresso: ' + PROG.subareas.size + ' subarea(s) concluida(s), ' +
                    PROG.marcas.size + ' marcador(es) conferido(s).';
        }

        salvarPois(); listarPois(); listarMarcadores(); listarSubareas(); sujar();
        alert(resumo);
      } catch (e) {
        alert('Arquivo invalido: ' + e.message);
      }
      ev.target.value = '';
    };
    fr.readAsText(f);
  });

  $('#btn-limpar-prog').addEventListener('click', function () {
    if (!confirm('Apagar TODO o progresso?\n\n' +
                 PROG.subareas.size + ' subárea(s) concluída(s) e ' +
                 PROG.marcas.size + ' marcador(es) conferido(s) serão zerados.\n' +
                 'Os seus POIs continuam.')) return;
    PROG.subareas.clear();
    PROG.marcas.clear();
    salvarProgresso(true);
    listarSubareas(); listarMarcadores(); listarPois();
    sujar();
  });

  $('#btn-importar-jogo').addEventListener('click', function () {
    var alvo = marcasPorZ[E.z] || [];
    if (!alvo.length) { alert('Este andar nao tem marcadores do jogo.'); return; }
    if (!confirm('Copiar os ' + alvo.length + ' marcadores do jogo no andar z=' + E.z +
                 ' para os seus POIs?')) return;
    var existentes = new Set(pois.map(function (p) { return p.x + ':' + p.y + ':' + p.z; }));
    var n = 0;
    alvo.forEach(function (m) {
      var ch = m[0] + ':' + m[1] + ':' + m[2];
      if (existentes.has(ch)) return;
      existentes.add(ch);
      pois.push({
        id: 'poi' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + n,
        x: m[0], y: m[1], z: m[2], icone: m[3],
        titulo: m[4] || window.Icones.nome(m[3]), texto: ''
      });
      n++;
    });
    salvarPois(); listarPois(); sujar();
    alert(n + ' marcador(es) copiado(s).');
  });

  /* ============================================================== busca === */
  var RE_COORD = /(-?\d{3,6})\s*[,;\s]\s*(-?\d{3,6})(?:\s*[,;\s]\s*(\d{1,2}))?/;

  $('#ir-para').addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    var m = RE_COORD.exec(ev.target.value);
    if (!m) { alert('Formato esperado: x, y  ou  x, y, z\nEx.: 32369, 32241, 7'); return; }
    var z = m[3] != null ? +m[3] : E.z;
    irPara(+m[1], +m[2], z, Math.max(E.nivel, 4), true);
    listarMarcadores(); listarPois();
    ev.target.blur();
  });

  $('#busca-marcador').addEventListener('input', function (ev) {
    filtroTexto = ev.target.value.trim();
    listarMarcadores();
  });
  $('#filtro-icone').addEventListener('change', function (ev) {
    filtroIcone = ev.target.value;
    listarMarcadores();
  });
  $('#so-andar').addEventListener('change', function (ev) {
    apenasAndar = ev.target.checked;
    listarMarcadores();
  });
  $('#so-texto').addEventListener('change', function (ev) {
    apenasComTexto = ev.target.checked;
    listarMarcadores();
  });
  $('#so-pendentes').addEventListener('change', function (ev) {
    esconderConferidos = ev.target.checked;
    listarMarcadores();
  });
  $('#sem-setas').addEventListener('change', function (ev) {
    E.ocultarSetas = ev.target.checked;
    salvarPrefs();
    recalcularContagens();
    listarMarcadores(); listarSubareas();
    sujar();
  });
  $('#busca-poi').addEventListener('input', listarPois);

  $('#busca-subarea').addEventListener('input', function (ev) {
    subBusca = ev.target.value.trim();
    listarSubareas();
  });
  $('#sub-andar').addEventListener('change', function (ev) {
    subAndarAtual = ev.target.checked;
    listarSubareas();
  });
  $('#sub-esconder').addEventListener('change', function (ev) {
    subEsconderFeitas = ev.target.checked;
    listarSubareas();
  });
  $('#ordem-areas').addEventListener('change', function (ev) {
    ordemAreas = ev.target.value;
    salvarPrefs();
    listarSubareas();
  });

  $('#btn-limpar-selecao').addEventListener('click', function () {
    if (E.selecao) limparSelecao();
  });

  $('#btn-abrir-tudo').addEventListener('click', function () {
    var algumFechado = GRUPOS.some(function (g) { return !gruposAbertos[g.nome]; });
    GRUPOS.forEach(function (g) { gruposAbertos[g.nome] = algumFechado; });
    listarSubareas();
  });

  /* ============================================================ botoes === */
  function sincronizarBotoes() {
    $('#b-grade').classList.toggle('ativo', E.verGrade);
    $('#b-marcadores').classList.toggle('ativo', E.verMarcadores);
    $('#b-pois').classList.toggle('ativo', E.verPois);
    $('#b-exiva').classList.toggle('ativo', E.verExiva);
    $('#b-areas').classList.toggle('ativo', E.verAreas);
    document.body.classList.toggle('com-selecao', !!E.selecao);
    $('#b-ocultar').classList.toggle('ativo', E.ocultarFeitos);
    var bs = $('#sem-setas'); if (bs) bs.checked = E.ocultarSetas;
    $('#b-camada').classList.toggle('ativo', E.camada === 'waypoint');
    $('#b-camada').querySelector('.rot').textContent =
      E.camada === 'waypoint' ? 'Pathfinding' : 'Cores';
  }

  $('#b-grade').addEventListener('click', function () { alternar('verGrade'); });
  $('#b-marcadores').addEventListener('click', function () { alternar('verMarcadores'); });
  $('#b-pois').addEventListener('click', function () { alternar('verPois'); });
  $('#b-exiva').addEventListener('click', function () { alternar('verExiva'); });
  $('#b-areas').addEventListener('click', function () { alternar('verAreas'); });
  $('#b-ocultar').addEventListener('click', function () {
    alternar('ocultarFeitos'); listarMarcadores(); listarPois();
  });
  $('#b-camada').addEventListener('click', trocarCamada);
  $('#b-mais').addEventListener('click', function () { zoomPara(E.nivel + 1); });
  $('#b-menos').addEventListener('click', function () { zoomPara(E.nivel - 1); });
  $('#b-lateral').addEventListener('click', function () {
    document.body.classList.toggle('sem-lateral'); redimensionar();
  });
  $('#b-ajuda').addEventListener('click', function () { abrirAjuda(true); });
  $('#b-tela-cheia').addEventListener('click', alternarTelaCheia);

  function abrirAjuda(abrir) { $('#ajuda').classList.toggle('aberto', abrir); }

  /* ====================================================== compartilhar === */
  /** navigator.clipboard so existe em contexto seguro; em file:// cai no truque
      do textarea + execCommand, que ainda funciona em todo lugar. */
  function copiar(txt) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(txt).then(function () { return true; },
                                                     function () { return copiaAntiga(txt); });
    }
    return Promise.resolve(copiaAntiga(txt));
  }
  function copiaAntiga(txt) {
    try {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  /** O ponto compartilhado e o centro da tela - o mesmo que a URL guarda. */
  function pontoAtual() {
    var x = Math.floor(E.centroX), y = Math.floor(E.centroY);
    return { x: x, y: y, z: E.z, sub: subareaEm(x, y) };
  }

  function montarCompartilhar() {
    var p = pontoAtual();
    var coord = p.x + ', ' + p.y + ', ' + p.z;
    var hash = '#' + p.x + ',' + p.y + ',' + p.z + ':' + E.nivel;
    var local = location.origin === 'null'
      ? location.href.split('#')[0] + hash
      : location.origin + location.pathname + hash;

    var linhas = [
      ['Coordenada', coord],
      ['Local', nomeCompleto(p.sub) + ' · andar ' + nomeAndar(p.z)],
      ['Resumo', coord + '  (' + nomeCompleto(p.sub) + ')'],
      ['Link deste mapa', local],
      // sem o zoom: a escala do tibiamaps nao e a mesma daqui (o :7 daqui vira
      // :4 la), entao mandar o nosso nivel cairia num zoom errado.
      ['Link do tibiamaps.io', 'https://tibiamaps.io/map#' + p.x + ',' + p.y + ',' + p.z]
    ];

    var corpo = $('#compartilhar .linhas');
    corpo.innerHTML = '';
    linhas.forEach(function (l) {
      var div = document.createElement('div');
      div.className = 'linha-share';
      var rot = document.createElement('div');
      rot.className = 'rot';
      rot.textContent = l[0];
      var val = document.createElement('div');
      val.className = 'val';
      val.textContent = l[1];
      val.title = l[1];
      var bt = document.createElement('button');
      bt.className = 'btn mini';
      bt.textContent = 'copiar';

      // se as duas vias de copia falharem (navegador sem permissao, file://
      // sem gesto valido), deixa o texto selecionado para o Ctrl+C do usuario.
      function selecionarValor() {
        var sel = window.getSelection(), faixa = document.createRange();
        faixa.selectNodeContents(val);
        sel.removeAllRanges(); sel.addRange(faixa);
      }
      val.addEventListener('click', selecionarValor);

      bt.addEventListener('click', function () {
        copiar(l[1]).then(function (ok) {
          if (ok) {
            bt.textContent = 'copiado ✓';
            bt.classList.add('ativo');
          } else {
            selecionarValor();
            bt.textContent = 'Ctrl+C';
            bt.title = 'O navegador não deixou copiar sozinho. O texto já está ' +
                       'selecionado: aperte Ctrl+C.';
          }
          setTimeout(function () {
            bt.textContent = 'copiar';
            bt.classList.remove('ativo');
          }, 2200);
        });
      });
      div.appendChild(rot); div.appendChild(val); div.appendChild(bt);
      corpo.appendChild(div);
    });
  }

  function abrirCompartilhar(abrir) {
    if (abrir) montarCompartilhar();
    $('#compartilhar').classList.toggle('aberto', abrir);
  }

  $('#b-compartilhar').addEventListener('click', function () { abrirCompartilhar(true); });
  $('#compartilhar').addEventListener('click', function (ev) {
    if (ev.target.id === 'compartilhar' || ev.target.classList.contains('fechar')) {
      abrirCompartilhar(false);
    }
  });
  $('#ajuda').addEventListener('click', function (ev) {
    if (ev.target.id === 'ajuda' || ev.target.classList.contains('fechar')) abrirAjuda(false);
  });

  /* ====================================================== prefs e hash === */
  function salvarPrefs() {
    try {
      localStorage.setItem(CHAVE_PREFS, JSON.stringify({
        camada: E.camada, verMarcadores: E.verMarcadores, verPois: E.verPois,
        verGrade: E.verGrade, verExiva: E.verExiva, verAreas: E.verAreas,
        ocultarFeitos: E.ocultarFeitos, ocultarSetas: E.ocultarSetas,
        ordemAreas: ordemAreas
      }));
    } catch (e) { /* modo privado: apenas ignora */ }
  }
  function carregarPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(CHAVE_PREFS) || '{}');
      ['camada', 'verMarcadores', 'verPois', 'verGrade', 'verExiva', 'verAreas',
       'ocultarFeitos', 'ocultarSetas']
        .forEach(function (k) { if (p[k] !== undefined) E[k] = p[k]; });
      if (p.ordemAreas) ordemAreas = p.ordemAreas;   // validado ao ordenar
    } catch (e) { /* ignora */ }
  }

  var hashTimer = null, ignorarHash = false;
  function atualizarHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(function () {
      ignorarHash = true;
      // floor (e nao round) para o valor sobreviver ao ciclo salvar/recarregar
      // sem escorregar meio sqm por vez.
      var h = '#' + Math.floor(E.centroX) + ',' + Math.floor(E.centroY) + ',' + E.z + ':' + E.nivel;
      history.replaceState(null, '', h);
      setTimeout(function () { ignorarHash = false; }, 0);
    }, 180);
    atualizarCoord();
    atualizarDicaZoom();
  }

  function lerHash() {
    var m = /^#(-?\d+),(-?\d+),(\d+)(?::(\d+))?$/.exec(location.hash);
    if (!m) return false;
    E.centroX = +m[1]; E.centroY = +m[2];
    E.z = Math.min(15, Math.max(0, +m[3]));
    if (m[4] != null) E.nivel = Math.min(NIVEIS.length - 1, Math.max(0, +m[4]));
    limitarCentro();
    return true;
  }

  window.addEventListener('hashchange', function () {
    if (ignorarHash) return;
    if (lerHash()) { montarAndares(); listarMarcadores(); listarPois(); sujar(); }
  });

  /* ============================================================= inicio === */
  function montarSelects() {
    var opFiltro = '<option value="">todos os icones</option>';
    var opPoi = '';
    var contagem = {};
    MARCAS_JOGO.forEach(function (m) { contagem[m[3]] = (contagem[m[3]] || 0) + 1; });
    for (var i = 0; i < window.Icones.total; i++) {
      var n = window.Icones.nome(i);
      if (contagem[i] && !(E.ocultarSetas && ehSeta(i))) {
        opFiltro += '<option value="' + i + '">' + n + ' (' + contagem[i] + ')</option>';
      }
      opPoi += '<option value="' + i + '">' + n + '</option>';
    }
    $('#ordem-areas').value = ordemAreas;
    $('#filtro-icone').innerHTML = opFiltro;
    $('#poi-icone').innerHTML = opPoi;
    $('#poi-icone').value = 3;
  }

  function preencherRodape() {
    $('#info-mapa').textContent =
      PASTA + '/\n' +
      D.totalTiles.color + ' tiles · ' +
      (LIM.maxX - LIM.minX + 1) + '×' + (LIM.maxY - LIM.minY + 1) + ' sqm\n' +
      'x ' + LIM.minX + '-' + LIM.maxX + ' / y ' + LIM.minY + '-' + LIM.maxY + '\n' +
      MARCAS_JOGO.length + ' marcadores\n' +
      (TEM_AREAS ? AREAS.areas.length + ' áreas · ' + SUB.length + ' subáreas (' +
                   TOTAL_COM_MARCA + ' com marcador)'
                 : 'áreas da Cyclopedia não baixadas');
  }

  montarSelects();
  preencherRodape();
  sincronizarBotoes();
  if (!lerHash()) { E.centroX = 32369; E.centroY = 32241; E.z = Z_TERREO; E.nivel = 4; }
  montarAndares();
  listarMarcadores();
  listarPois();
  listarSubareas();

  window.addEventListener('resize', redimensionar);
  if (window.ResizeObserver) new ResizeObserver(redimensionar).observe(palco);
  redimensionar();
  atualizarHash();
  requestAnimationFrame(laco);

  // Gancho para o console do navegador (e para testes automatizados).
  window.MapaTibia = {
    estado: E,
    dados: D,
    irPara: irPara,
    trocarAndar: trocarAndar,
    zoom: zoomPara,
    redesenhar: function () { redimensionar(); desenhar(); },
    pois: function () { return pois; },
    tilesPendentes: function () { return pendentes; },
    progresso: PROG,
    subareas: SUB,
    gruposAtuais: function () { return GRUPOS; },
    subareaEm: subareaEm,
    totalSubareas: TOTAL_COM_MARCA,
    alternarSub: function (i) {
      var r = alternarSub(i);
      listarSubareas(); listarMarcadores(); listarPois(); sujar();
      return r;
    },
    alternarMarca: function (x, y, z) {
      var r = alternarMarca(x, y, z);
      listarMarcadores(); listarPois(); listarSubareas(); sujar();
      return r;
    },
    recarregarListas: function () {
      invalidarContagem();               // quem mexe em `progresso` na mao passa por aqui
      listarMarcadores(); listarPois(); listarSubareas(); sujar();
    }
  };
})();
