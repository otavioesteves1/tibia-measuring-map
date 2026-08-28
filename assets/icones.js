/* =============================================================================
   icones.js - Desenha os 20 icones de marcador do minimapa do Tibia em canvas.
   Nao depende de nenhum arquivo de imagem: tudo e vetor puro.
   ========================================================================== */
(function (global) {
  'use strict';

  // Ordem oficial dos icones no minimapmarkers.bin (indice 0..19).
  var NOMES = [
    'Certo',        // 0  MarkTick
    'Interrogacao', // 1  MarkQuestionMark
    'Exclamacao',   // 2  MarkExclamationMark
    'Estrela',      // 3  MarkStar
    'Errado',       // 4  MarkCrossMark
    'Cruz',         // 5  MarkCross
    'Boca',         // 6  MarkMouth
    'Pa',           // 7  MarkBrush
    'Espada',       // 8  MarkSword
    'Bandeira',     // 9  MarkFlag
    'Cadeado',      // 10 MarkLock
    'Bolsa',        // 11 MarkBag
    'Caveira',      // 12 MarkSkull
    'Dinheiro',     // 13 MarkDollar
    'Seta N (verm)',// 14 MarkRedNorth
    'Seta S (verm)',// 15 MarkRedSouth
    'Seta L (verm)',// 16 MarkRedEast
    'Seta O (verm)',// 17 MarkRedWest
    'Seta N (verde)',// 18 MarkGreenNorth
    'Seta S (verde)' // 19 MarkGreenSouth
  ];

  var FUNDOS = [
    '#3f9a45', '#3d78bd', '#c4453a', '#c99524', '#c4453a',
    '#d9d3c4', '#c25f83', '#8a6238', '#7d8794', '#3f9a45',
    '#8b8577', '#8a6238', '#2f2c28', '#3f9a45',
    '#c4453a', '#c4453a', '#c4453a', '#c4453a',
    '#3f9a45', '#3f9a45'
  ];

  var TAM = 22;          // lado do canvas de cada icone, em pixels
  var cache = {};        // "indice@tamanho" -> HTMLCanvasElement

  function corDoIcone(i) { return FUNDOS[i] || '#8b8577'; }
  function nomeDoIcone(i) { return NOMES[i] || ('Icone ' + i); }

  /* ---------------------------------------------------------- primitivas --- */
  function poligono(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function texto(ctx, s, cx, cy, tamanho) {
    ctx.font = '700 ' + tamanho + 'px Georgia,"Times New Roman",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, cx, cy);
  }

  function seta(ctx, direcao) {
    // direcao: 'N' | 'S' | 'L' | 'O'  -- desenhada numa caixa 0..1
    var p = {
      N: [[.5, .18], [.86, .62], [.64, .62], [.64, .84], [.36, .84], [.36, .62], [.14, .62]],
      S: [[.5, .84], [.14, .40], [.36, .40], [.36, .18], [.64, .18], [.64, .40], [.86, .40]],
      L: [[.84, .5], [.40, .14], [.40, .36], [.18, .36], [.18, .64], [.40, .64], [.40, .86]],
      O: [[.18, .5], [.62, .14], [.62, .36], [.84, .36], [.84, .64], [.62, .64], [.62, .86]]
    }[direcao];
    poligono(ctx, p);
  }

  /* -------------------------------------------------------- glifos 0..19 --- */
  // Todos desenham numa caixa de 0..1 (o chamador ja aplicou a escala).
  var GLIFOS = {
    0: function (c) {                                   // certo
      c.strokeStyle = c.fillStyle; c.lineWidth = .16;
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(.22, .52); c.lineTo(.42, .72); c.lineTo(.80, .28); c.stroke();
    },
    1: function (c) { texto(c, '?', .5, .54, .78); },   // interrogacao
    2: function (c) { texto(c, '!', .5, .54, .78); },   // exclamacao
    3: function (c) {                                   // estrela
      var pts = [], i, ang, r;
      for (i = 0; i < 10; i++) {
        ang = -Math.PI / 2 + i * Math.PI / 5;
        r = (i % 2 ? .18 : .40);
        pts.push([.5 + Math.cos(ang) * r, .5 + Math.sin(ang) * r]);
      }
      poligono(c, pts);
    },
    4: function (c) {                                   // errado (X)
      c.strokeStyle = c.fillStyle; c.lineWidth = .17; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(.26, .26); c.lineTo(.74, .74);
      c.moveTo(.74, .26); c.lineTo(.26, .74);
      c.stroke();
    },
    5: function (c) {                                   // cruz (templo)
      c.fillStyle = '#b03a30';
      c.fillRect(.41, .14, .18, .72);
      c.fillRect(.18, .36, .64, .18);
    },
    6: function (c) {                                   // boca
      c.beginPath(); c.ellipse(.5, .5, .34, .20, 0, 0, 6.29); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = .07;
      c.beginPath(); c.moveTo(.17, .5); c.lineTo(.83, .5); c.stroke();
    },
    7: function (c) {                                   // pa
      c.strokeStyle = c.fillStyle; c.lineWidth = .13; c.lineCap = 'round';
      c.beginPath(); c.moveTo(.66, .20); c.lineTo(.38, .58); c.stroke();
      poligono(c, [[.20, .54], [.46, .70], [.30, .86], [.13, .70]]);
      c.fillRect(.60, .12, .22, .10);
    },
    8: function (c) {                                   // espada
      c.strokeStyle = c.fillStyle; c.lineWidth = .12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(.5, .12); c.lineTo(.5, .74); c.stroke();
      c.lineWidth = .10;
      c.beginPath(); c.moveTo(.26, .62); c.lineTo(.74, .62); c.stroke();
      c.beginPath(); c.moveTo(.38, .86); c.lineTo(.62, .86); c.stroke();
    },
    9: function (c) {                                   // bandeira
      c.strokeStyle = c.fillStyle; c.lineWidth = .11; c.lineCap = 'round';
      c.beginPath(); c.moveTo(.30, .12); c.lineTo(.30, .88); c.stroke();
      poligono(c, [[.34, .16], [.82, .30], [.34, .46]]);
    },
    10: function (c) {                                  // cadeado
      c.strokeStyle = c.fillStyle; c.lineWidth = .12;
      c.beginPath(); c.arc(.5, .42, .21, Math.PI, 0); c.stroke();
      c.beginPath(); c.roundRect ? c.roundRect(.24, .42, .52, .42, .07)
                                 : c.rect(.24, .42, .52, .42);
      c.fill();
    },
    11: function (c) {                                  // bolsa
      c.strokeStyle = c.fillStyle; c.lineWidth = .10;
      c.beginPath(); c.arc(.5, .38, .17, Math.PI, 0); c.stroke();
      poligono(c, [[.22, .38], [.78, .38], [.86, .86], [.14, .86]]);
    },
    12: function (c) {                                  // caveira
      c.beginPath(); c.arc(.5, .42, .30, 0, 6.29); c.fill();
      c.fillRect(.32, .58, .36, .22);
      c.fillStyle = '#20201d';
      c.beginPath(); c.arc(.39, .41, .085, 0, 6.29); c.fill();
      c.beginPath(); c.arc(.61, .41, .085, 0, 6.29); c.fill();
      c.fillRect(.46, .55, .08, .10);
      c.fillRect(.40, .70, .05, .12);
      c.fillRect(.55, .70, .05, .12);
    },
    13: function (c) { texto(c, '$', .5, .54, .72); },  // dinheiro
    14: function (c) { seta(c, 'N'); },
    15: function (c) { seta(c, 'S'); },
    16: function (c) { seta(c, 'L'); },
    17: function (c) { seta(c, 'O'); },
    18: function (c) { seta(c, 'N'); },
    19: function (c) { seta(c, 'S'); }
  };

  /* -------------------------------------------------------------- render --- */
  // Cinza usado quando o marcador ja foi conferido no jogo ("desativado").
  var CINZA = '#5a5750';

  function desenhar(ctx, indice, x, y, lado, apagado) {
    var fundo = apagado ? CINZA : corDoIcone(indice);
    var claro = (indice === 5) && !apagado;  // fundo claro pede glifo escuro
    var r = lado / 2;

    ctx.save();
    ctx.translate(x, y);

    // sombra + moldura circular
    ctx.beginPath();
    ctx.arc(r, r, r - lado * 0.06, 0, 6.29);
    ctx.fillStyle = fundo;
    ctx.fill();
    ctx.lineWidth = Math.max(1, lado * 0.09);
    ctx.strokeStyle = claro ? 'rgba(60,50,35,.9)' : 'rgba(15,13,10,.85)';
    ctx.stroke();

    // glifo
    ctx.save();
    ctx.translate(lado * 0.18, lado * 0.18);
    ctx.scale(lado * 0.64, lado * 0.64);
    ctx.fillStyle = claro ? '#2a251d' : (apagado ? '#9c978c' : '#f6f1e4');
    ctx.strokeStyle = ctx.fillStyle;
    (GLIFOS[indice] || GLIFOS[9])(ctx);
    ctx.restore();

    ctx.restore();
  }

  /** Devolve (e memoriza) um canvas pronto com o icone desenhado.
      Com `apagado`, sai na versao cinza de "ja conferido". */
  function obter(indice, lado, apagado) {
    lado = lado || TAM;
    var chave = indice + '@' + lado + (apagado ? '@off' : '');
    if (cache[chave]) return cache[chave];

    var cv = document.createElement('canvas');
    var dpr = Math.min(global.devicePixelRatio || 1, 3);
    cv.width = cv.height = Math.round(lado * dpr);
    cv.style.width = cv.style.height = lado + 'px';
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    desenhar(ctx, indice, 0, 0, lado, apagado);
    cache[chave] = cv;
    return cv;
  }

  /** Versao data-URL, para reusar o mesmo icone em centenas de <img> da lista
      sem criar um <canvas> por linha. */
  var cacheUrl = {};
  function url(indice, lado, apagado) {
    lado = lado || TAM;
    var chave = indice + '@' + lado + (apagado ? '@off' : '');
    if (!cacheUrl[chave]) cacheUrl[chave] = obter(indice, lado, apagado).toDataURL('image/png');
    return cacheUrl[chave];
  }

  global.Icones = {
    TAM: TAM,
    CINZA: CINZA,
    total: NOMES.length,
    nome: nomeDoIcone,
    cor: corDoIcone,
    obter: obter,
    url: url,
    desenhar: desenhar
  };
})(window);
