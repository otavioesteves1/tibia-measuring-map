# Mapa do Tibia — Measuring Tibia Quest

Rastreador da **Measuring Tibia Quest**: junta os PNGs de 256×256 do minimapa
num mapa contínuo navegável, organiza tudo pelas 20 áreas da Cyclopedia, e
acompanha o seu progresso rumo ao Discoverer Outfit.

Roda 100% offline, direto do disco.

## A quest, em resumo

Cada subárea tem **7 Points of Interest** sorteados só para o seu personagem —
os pontos de outros jogadores são diferentes e invisíveis para você. Achou os 7,
a subárea fica desbloqueada para sempre.

Eles não saem de qualquer lugar: são sorteados de um **pool fixo de posições**,
e esse pool é exatamente o que as bandeiras deste mapa marcam. É por isso que
riscar bandeira por bandeira funciona como checklist.

Por área concluída:

| Progresso | O que libera |
|---|---|
| 30% | mostra os NPCs da área no Cyclopedia Map |
| 70% | mostra passagens entre subáreas e teleports |
| 100% | mostra as criaturas, avisa de invasões e dá o achievement da área |

| Áreas 100% | Recompensa |
|---|---|
| 10 | **Discoverer Outfit** (NPC Charos) + achievement *Widely Travelled* |
| 15 | 1º addon |
| 20 | 2º addon + achievement *Measuring the World* |
| 50% | título *Dedicated Entrepreneur* |
| 100% | título *Globetrotter* |

São 22 achievements no total, valendo 34 pontos.

### O bônus de speed

O manual oficial diz, palavra por palavra:

> *"If you have fully discovered an area, your character benefits from a speed
> bonus **while in this area**. The more areas you have fully discovered, the
> higher the speed bonus."*

Então, ao contrário do que a wiki BR dá a entender:

- **não existe valor por cidade** — toda área concluída dá o mesmo bônus;
- o tamanho dele depende de **quantas** áreas você fechou no total;
- e ele vale **só enquanto você está dentro** de uma área já concluída, não é um
  buff permanente que você carrega pelo mapa.

A CipSoft publicou só os extremos: **100** com 1 área e **195** com 20 (notas do
Summer Update 2026). A curva exata não é pública — o jogo mostra o valor atual
num tooltip do Cyclopedia Map.

O painel mostra uma **estimativa** por interpolação linear, que dá +5 por área:

| Áreas | Speed (estimado) |
|---|---|
| 1 | ~100 |
| 5 | ~120 |
| 10 | ~145 |
| 15 | ~170 |
| 20 | ~195 |

Bate certinho nas duas pontas confirmadas, mas continua sendo conta minha, não
número oficial — está marcado com `~` no painel e explicado no tooltip.

### Fontes

- [Manual oficial do Tibia](https://www.tibia.com/gameguides/?subtopic=manual&section=interface) — mecânica do Cyclopedia Map e do speed
- [Cyclopedia/Map Areas (TibiaWiki EN)](https://tibia.fandom.com/wiki/Cyclopedia/Map_Areas) — lista oficial de áreas e subáreas descobríveis
- [Measuring Tibia Quest (TibiaWiki EN)](https://tibia.fandom.com/wiki/Measuring_Tibia_Quest) — recompensas, títulos e dicas
- [Updates/Summer Update 2026](https://tibia.fandom.com/wiki/Updates/Summer_Update_2026) — o intervalo 100–195
- [Measuring Tibia Quest (TibiaWiki BR)](https://www.tibiawiki.com.br/wiki/Measuring_Tibia_Quest) — lista de subáreas em português

---

## Como abrir

Dê duplo clique em **`abrir-mapa.bat`**.

Ele sobe um servidor local em `http://localhost:8765` (ligado só em `127.0.0.1`,
ninguém de fora enxerga) e abre o navegador. Feche a janela preta para desligar.

Se você não tiver Python instalado, o `.bat` abre o `index.html` direto — o mapa
também funciona assim, mas esse caminho não foi testado aqui; o modo servidor foi.

---

## O que está carregado

| | |
|---|---|
| Tiles coloridos | 1094 |
| Tiles de pathfinding | 1103 |
| Andares | 16 (z=0 a z=15) |
| Área | 2560 × 2048 sqm — x 31744–34303, y 30976–33023 |
| Marcadores do jogo | 5205, dos quais **4688 entram no checklist** |
| Áreas da Cyclopedia | 20 áreas da quest / **171 subáreas no checklist** |

As 517 setas vermelhas e verdes ficam de fora: elas marcam escadas, buracos e
cordas, não pontos para conferir. Se quiser trazê-las de volta, desmarque
*esconder as setas* na aba MARCADORES — a contagem se ajusta sozinha.

---

## Conferindo o mapa item por item

Este é o fluxo principal. Tudo é **salvo sozinho a cada mudança**.

| Ação | O que acontece |
|---|---|
| **clique** numa bandeira | vira **conferido**: fica cinza e com pouca opacidade. Clique de novo para desmarcar. |
| **clique** no mapa longe de bandeira | seleciona a região dali e acende ela |
| **Shift + clique** no mapa | conclui a **subárea** daquele ponto (Thais City, Green Claw Swamp…): o terreno dela fica cinza e sem cor, e **todas as bandeiras dela somem**, em todos os andares |
| `V` | conclui a subárea que está no centro da tela |
| `X` | esconde de vez tudo que já foi conferido — sobra só o que falta |
| **Ctrl + clique** | só abre o marcador na lista, sem conferir |
| **botão direito** (clique seco) | cria um POI seu naquele ponto |
| **botão direito** (arrastando) | caixa de seleção — veja abaixo |

Na aba MARCADORES, o botão `✓` de cada linha faz o mesmo que clicar no mapa, e
*só os que faltam conferir* deixa a lista só com o que sobrou.

### Marcar várias de uma vez

Cada botão do mouse tem um papel, sem modo para trocar:

| Ação | O que acontece |
|---|---|
| **arrastar com o esquerdo** | move o mapa |
| **arrastar com o direito** | desenha uma caixa; ao soltar, tudo dentro vira conferido. Enquanto arrasta, a caixa mostra ao vivo quantas bandeiras vai pegar e o tamanho em sqm |
| **Shift + arrastar com o direito** | o contrário: **desmarca** o que estiver dentro (a caixa fica vermelha) |
| **clique seco com o direito** | sem arrastar, continua criando um POI |
| `Esc` | cancela a caixa antes de soltar |

A caixa age só no **andar atual** e só no que está visível: setas escondidas,
subáreas já concluídas e o que estiver filtrado ficam de fora.

No topo tem um contador de progresso geral (`53%`). A tecla `A` desenha os
contornos e os nomes das áreas por cima do mapa.

### Áreas e subáreas

São as regiões da **Cyclopedia do próprio jogo**, não quadrantes: **21 áreas-mãe**
(Thais, Venore, Kazordoon, Edron, Zao…) com **192 subáreas** (Thais City, Green
Claw Swamp, Fibula, Jakundaf Desert…). **171 delas entram no checklist** — as
que a quest pede, tenham elas bandeira no seu arquivo ou não.

Os polígonos são 2D: uma subárea vale para os **16 andares**. Concluir "Thais
City" fecha a cidade inteira, de cima a baixo.

Cada marcador já vem com a sua subárea calculada por ponto-em-polígono. Os 600
que caem fora de qualquer contorno — cavernas que passam por baixo da borda, e
nenhum no térreo — foram colados na subárea mais próxima; a maior distância é de
75 sqm.

### Contador de recompensas

No topo da aba ÁREAS: quantas áreas você já fechou 100%, quantas subáreas e
pontos isso representa, e as recompensas com quantas faltam para cada uma. A
próxima fica destacada, as liberadas ficam verdes.

**A unidade de progresso é a subárea, não a bandeira.** Riscar bandeiras é o seu
controle de "por onde já passei"; o que move a porcentagem da área é marcar a
subárea como concluída — igual o jogo conta.

Dawnport não entra na conta — é a ilha tutorial e não faz parte da quest. Por
isso o total é **20**, e não 21.

### O que mede a dificuldade

**O número de subáreas.** Cada subárea fecha com 7 Points of Interest, não
importa se o pool de bandeiras dela tem 5 ou 140 — então o trabalho de uma área é
`subáreas × 7`, e só isso.

| Área | Subáreas | Pontos |
|---|---|---|
| Feyrist, Quirefang | 3 | 21 |
| Ab'Dendriel, Krailos | 4 | 28 |
| Northern Darama | 5 | 35 |
| Southern Darama, Oramond | 6 | 42 |
| Roshamuul | 7 | 49 |
| Kazordoon | 8 | 56 |
| Thais, Carlin, Tiquanda | 9 | 63 |
| Kilmaresh, Marapur | 11 | 77 |
| Edron, Hrodmir, Yalahar | 12 | 84 |
| Venore, Zao | 13 | 91 |
| **Vandura** | **16** | **112** |

Total: **173 subáreas, 1211 pontos** para achar — o site acompanha 171 delas
(1197 pontos).

### Ordenação da lista

| Ordem | Como funciona |
|---|---|
| **menos subáreas (mais fácil)** | padrão — puro dado, sem palpite |
| mais subáreas (mais difícil) | o inverso |
| menos subáreas faltando | fecha primeiro o que está mais perto |
| mais perto de terminar | por porcentagem |
| **por acesso e perigo** | ordem que eu sugeri — é palpite |
| menos bandeiras no total | áreas com pool pequeno |
| alfabética | achar pelo nome |

A escolha fica salva. Só a opção **por acesso e perigo** é chute meu (quest de
acesso, level exigido, perigo); ela vive em `data/quest.js` na linha `ordem` de
cada cidade, e a justificativa aparece ao lado do nome na lista.

### Quais subáreas contam

Cruzei as duas wikis para separar o que realmente vale:

| | Quantas | No mapa |
|---|---|---|
| Confirmadas nas duas | 160 | sem etiqueta |
| Só numa das duas | 13 | **?** — na dúvida, contam |
| Em nenhuma | o resto | **não conta** — fica fora da % da área |

As 13 em disputa: Ice Islands, Orc Lands, Krailos Mines, Southern Terramite
Tunnels, Kha'zeel Mountains, Oskayaat, Calassa e Venore Dragon Lair (só na BR);
Furious Crater, Ruins of Nuur, Salt Caves, Thais Peninsula e Norcferatu Fortress
(só na EN). Passe o mouse no **?** para ver qual fonte lista cada uma.

Na prática isso muda a conta: Thais fecha 100% com 8 subáreas, sem precisar de
Adventurers' Guild, Great Expedition Wharf e Newhaven, que não contam.

### Ver a região no mapa

A seleção liga a lista e o mapa nos dois sentidos:

| Ação | O que acontece |
|---|---|
| **clique na cidade** (na lista) | acende a área inteira no mapa e enquadra ela na tela |
| **clique na subárea** (na lista) | acende só ela e enquadra |
| **clique no mapa vazio** | seleciona a região dali, abre a cidade na lista e rola até a subárea |
| `Esc` ou **✕ seleção** | tira o destaque |

A região selecionada fica **acesa e o resto do mapa escurece**, com o nome numa
etiqueta em cima. O contorno é dourado; se a subárea já estiver concluída, é
verde.

Clicar **em cima de uma bandeira** continua riscando ela — a seleção de região só
acontece quando você clica longe das bandeiras.

### Na aba ÁREAS

A lista é uma árvore: cada **cidade** abre mostrando as subáreas dela.

Na linha da cidade:

- 🏆 — o achievement que ela dá em 100% (passe o mouse)
- os riscos na barra são os marcos de **30%** e **70%**; ficam verdes ao passar
- **−6** — a área tem 6 subáreas sem nenhum marcador seu, então elas não dá para
  acompanhar aqui (veja abaixo)
- **fora da quest** — Dawnport

- **checkbox da cidade** — conclui / reabre todas as subáreas dela de uma vez
- **checkbox da subárea** — conclui / reabre só ela
- **clique na linha** — enquadra a subárea na tela, no andar em que ela tem marcador
- **busca** — por nome de cidade ou de subárea; abre os grupos sozinha
- **só as que aparecem neste andar** — filtra pela sua posição atual
- **esconder as concluídas** — some com o que já acabou
- **abrir / fechar todas as cidades** — expande ou recolhe a árvore inteira
- **backup** — baixa um JSON com POIs **e** progresso
- **zerar** — apaga o progresso (mantém os POIs)

Nas subáreas:

- **nova** — existe nos arquivos do jogo, mas a wiki ainda não lista
- **!** — tem restrição de acesso (Asura Palace pede level 250, Zzaion só abre
  com Orc Raid em Zao Steppe…)

### Subáreas sem bandeira

Nem toda subárea da quest tem bandeira no `minimapmarkers.bin`. **Elas aparecem
na lista assim mesmo**, com a etiqueta **sem bandeira** e `—` no lugar da
contagem: dá para marcar normalmente, só que o mapa não ajuda a achar os 7
pontos — você faz no jogo e marca aqui quando fechar.

São **17**, em 7 áreas:

| Área | Sem bandeira |
|---|---|
| Kilmaresh | Central Steppe, Furious Crater, Green Belt, Rascacoon, The Wreckoning |
| Marapur | Moonfall, Moonstone Crater, Salgadora, Thalassara Surroundings |
| Roshamuul | as três de Isle of Ada |
| Edron | Cyclopolis, Edron Hero Fortress |
| Southern Darama | Ankrahmun Pharaoh Tombs |
| Thais | Targuna |
| Zao | Norcferatu Fortress |

Uma área só fecha 100% com **todas**, inclusive essas. O contador cobre **171
subáreas**.

O badge **−N** no nome da cidade quer dizer outra coisa: subáreas que a quest
tem mas que **nem existem nos dados do mapa** — Kilmaresh −2 (*Ruins of Nuur* e
*Salt Caves*, área nova demais). Essas não dá para acompanhar de jeito nenhum
por aqui.

Outra diferença: a lista do jogo tem **23 subáreas a mais** que a da wiki — a
página de lá está marcada como esboço. O contador usa a lista **do jogo**, que
vem do cliente e é mais atual.

---

## Controles

Arraste com o **botão esquerdo** para mover. Roda do mouse para zoom. Duplo
clique aproxima. O **botão direito** arrasta a caixa de seleção.

### Navegação
| Tecla | Ação |
|---|---|
| `←` `↑` `→` `↓` | mover o mapa |
| `=` / `-` | aproximar / afastar |
| `K` | subir um andar |
| `J` | descer um andar |
| `L` | voltar ao térreo (z=7) |
| `C` | centralizar no último ponto destacado |
| **roda do mouse na lista de andares** | sobe e desce de andar sem tirar a mão do mouse |

### Camadas
| Tecla | Ação |
|---|---|
| `P` | alterna **Cores** ↔ **Pathfinding** (`WaypointCost`) |
| `M` | marcadores do jogo |
| `O` | meus POIs |
| `X` | esconder o que já foi conferido |
| `A` | contornos e nomes das áreas da Cyclopedia |
| `G` | grade de 256×256 dos arquivos do minimapa |
| `E` | faixas de alcance do exiva (4 / 100 / 274) a partir do centro |

### Interface
| Tecla | Ação |
|---|---|
| `B` | mostrar/ocultar o painel lateral |
| `F` | tela cheia |
| `H` | lista de comandos (também no botão **? Comandos**, no topo) |
| `Y` | compartilhar a coordenada do centro da tela |

O campo **"ir para"** no topo aceita `32369, 32241, 7` (o `z` é opcional).

---

## Endereço da página e compartilhamento

A URL guarda a posição no formato `#x,y,z:zoom` — por exemplo
`#32369,32241,7:5`. Dá para favoritar um lugar e voltar exatamente nele depois.

O botão **⧉** no topo (ou a tecla `Y`) abre a janela de compartilhar, com o ponto
que está no **centro da tela** em cinco formatos, cada um com seu botão de copiar:

| | Exemplo |
|---|---|
| Coordenada | `32369, 32241, 7` |
| Local | `Thais › Thais City · andar 0` |
| Resumo | `32369, 32241, 7  (Thais › Thais City)` |
| Link deste mapa | `http://localhost:8765/#32369,32241,7:5` |
| Link do tibiamaps.io | `https://tibiamaps.io/map#32369,32241,7` |

O link do **tibiamaps.io** abre para qualquer pessoa, mesmo quem não tem esta
pasta. Vai direto na coordenada e no andar; o zoom fica no padrão de lá, porque a
escala deles não é a mesma daqui (o nível `:7` daqui vira `:4` lá).

Se o navegador não deixar copiar sozinho — o que acontece em `file://` — o texto
fica selecionado para você apertar <kbd>Ctrl</kbd>+<kbd>C</kbd>.

Para compartilhar um marcador específico, clique nele na lista lateral primeiro:
isso centraliza o mapa nele, e aí a janela de compartilhar já mostra a coordenada
certa.

---

## Meus POIs

Clique seco com o botão direito no mapa (sem arrastar) cria um POI com a
coordenada já preenchida. Eles ficam
no `localStorage` do navegador e aparecem no mapa com um **anel dourado** em
volta do ícone, para não se confundirem com os marcadores do jogo.

Na aba *POIs*:
- **exportar** / **backup** — baixa um JSON com POIs **e** progresso;
- **importar** — lê esse JSON de volta (ignora POIs repetidos na mesma coordenada
  e soma o progresso ao que já existe);
- **copiar p/ meus POIs** (aba *MARCADORES*) — copia os marcadores do jogo do
  andar atual para os seus, para você poder editar o texto deles.

POIs e progresso vivem no navegador, não em arquivo. Se você limpar os dados do
site, eles somem — por isso faça backup de vez em quando.

### Onde fica salvo

| Chave do `localStorage` | Conteúdo |
|---|---|
| `tibia-map-poi:pois:v1` | seus POIs |
| `tibia-map-poi:progresso:v1` | subáreas concluídas e marcadores conferidos |
| `tibia-map-poi:prefs:v1` | camada e sobreposições ligadas |

---

## De onde vêm os dados

Três fontes diferentes, de propósito:

| | Origem | Por quê |
|---|---|---|
| **PNGs do mapa** | `minimap-without-markers/minimap/` | versão limpa, sem o grid |
| **Marcadores** | `minimap/minimapmarkers.bin` | só existe no export do seu cliente |
| **Áreas da Cyclopedia** | `data/areas.json` | baixado de tibiamaps.io |

O `areas.json` é a **única** coisa que sai da rede, e só uma vez:

```bash
python tools/baixar_areas.py
```

Só precisa rodar de novo quando o Tibia adicionar regiões novas. Os nomes e
contornos das áreas são do cliente do Tibia (CipSoft), publicados em JSON pelo
tibiamaps.io.

O `minimap/` exportado com grid tem um **ponto preto pintado em todo pixel par**
(25% da imagem) — é o grid embutido, que deixa o mapa quadriculado e escuro. O
download *without markers* não tem isso. Os arquivos `WaypointCost` são idênticos
nas duas pastas.

Para ver a grade quando quiser, use a tecla `G` — ela é desenhada por cima, dá
para desligar, e ainda mostra o nome e o progresso de cada subárea.

### Atualizar

Copie os PNGs novos por cima da pasta do mapa e rode:

```bash
python tools/gerar_dados.py
```

Ele escolhe as pastas sozinho (prefere a `minimap-without-markers`), avisa se os
PNGs escolhidos têm o grid embutido, e reconstrói `data/mapdata.js` e
`data/markers.js`. Depois é só recarregar a página.

Para mandar na mão:

```bash
python tools/gerar_dados.py --tiles outra/pasta --marcadores outro/markers.bin
```

Os arquivos do cliente ficam normalmente em
`%APPDATA%\Tibia\packages\Tibia\minimap`, e o mapa completo sai em
tibiamaps.io/downloads.

---

## Estrutura

```
index.html              a página
assets/app.js           motor do mapa (canvas, zoom, marcadores, POIs)
assets/icones.js        os 20 ícones de marcador, desenhados em vetor
assets/app.css          estilo
data/mapdata.js         gerado — índice de quais tiles existem em cada andar
data/markers.js         gerado — os 5205 marcadores
data/areas.js           gerado — as 21 áreas e 192 subáreas
data/areas.json         baixado — fonte das áreas (tibiamaps.io)
data/quest.js           escrito à mão — recompensas, achievements e a ordem sugerida
tools/gerar_dados.py    regenerador dos arquivos data/*.js
tools/baixar_areas.py   baixa data/areas.json (única chamada de rede)
minimap-without-markers/minimap/   os PNGs usados (mapa limpo)
minimap/                export do cliente — dele sai só o minimapmarkers.bin
abrir-mapa.bat          atalho para abrir
```

Nada de bibliotecas externas e nenhum CDN. A única chamada de rede é o
`baixar_areas.py`, que você roda quando quiser.

---

## Detalhes técnicos

**Coordenadas.** Cada arquivo `Minimap_Color_X_Y_Z.png` cobre os sqm `X..X+255`
horizontalmente e `Y..Y+255` verticalmente, no andar `Z`. O pixel (0,0) da
imagem é exatamente o sqm (X, Y) — o mapa é desenhado em 1:1 nesse sistema, sem
reprojeção.

**Andares.** `z=7` é o térreo. Acima dele, `z=6..0` = `+1..+7`; abaixo,
`z=8..15` = `-1..-8`.

**Zoom.** Níveis fixos em potências de 2 (0.125× a 16×). Acima de 1× o
redimensionamento é nearest-neighbor, para o pixel art continuar nítido; abaixo
de 1× usa suavização, senão o mar pontilhado vira um xadrez.

**Áreas.** `data/areas.json` traz, por subárea, o nome, a área-mãe, o bbox e os
polígonos em sqm (115 mil pontos no total). O gerador faz o ponto-em-polígono de
cada marcador e grava o índice da subarea no próprio marcador (`m[5]`), então em
tempo de execução não sobra geometria para calcular. No mapa, uma subárea
concluída é dessaturada com `ctx.clip()` no próprio polígono.

**Marcadores.** O `minimapmarkers.bin` do Tibia 12+ é protobuf. O parser está em
`tools/gerar_dados.py` e o esquema é:

```
MarkerList { repeated Marker markers = 1; }
Marker     { Position pos = 1; uint32 icone = 2; string texto = 3; }
Position   { uint32 x = 1; uint32 y = 2; uint32 z = 3; }
```

**Memória.** Os tiles são carregados sob demanda e o cache guarda no máximo 520
imagens, descartando as menos usadas — assim dá para passear pelos 16 andares
sem estourar a RAM.

**Console.** `window.MapaTibia` expõe `irPara(x,y,z,zoom)`, `trocarAndar(z)`,
`zoom(n)`, `estado`, `pois()`, `progresso`, `subareas`, `alternarSetor(z,sx,sy)`
e `alternarMarca(x,y,z)`, se você quiser automatizar alguma coisa.
