# Measuring Tibia — mapa e rastreador

Rastreador da **Measuring Tibia Quest**: um mapa do Tibia navegável no navegador,
organizado pelas 20 áreas da Cyclopedia, para você riscar os Points of Interest
um por um e acompanhar o progresso até o Discoverer Outfit.

**➜ [Abrir o mapa](https://otavioesteves1.github.io/tibia-measuring-map/)**

Roda inteiro no navegador. Não tem servidor, não tem login, e o seu progresso
fica só na sua máquina.

---

## O que ele faz

- Mapa contínuo dos **16 andares**, com zoom, busca por coordenada e link direto
  para qualquer ponto (`#x,y,z:zoom`)
- **160 subáreas** da Cyclopedia com contorno real, agrupadas nas 20 áreas-mãe
- **Clique numa bandeira** para riscá-la; **arraste com o botão direito** para
  riscar várias de uma vez
- Contador das recompensas: Discoverer Outfit (10 áreas), addons (15 e 20),
  títulos e o bônus de speed
- Seus próprios POIs, com anotação, exportáveis em JSON
- Camada de **pathfinding** (`WaypointCost`), grade de setores e faixas de exiva

O manual completo, com todos os atalhos, está em **[LEIAME.md](LEIAME.md)**.

---

## O seu progresso é seu

Tudo que você marca fica no `localStorage` do **seu** navegador. Não sobe para
lugar nenhum, e cada pessoa que abrir o site começa do zero com o próprio
progresso.

Use o botão **backup** para baixar um JSON com os seus POIs e o seu progresso —
é o único jeito de levar para outra máquina.

---

## Rodar local

Não precisa, mas se quiser:

```bash
git clone https://github.com/otavioesteves1/tibia-measuring-map.git
cd tibia-measuring-map
python -m http.server 8765
```

E abra `http://localhost:8765`. No Windows dá para usar o `abrir-mapa.bat`.

### Atualizar o mapa com a sua própria exploração

Os dados vêm do minimapa do seu cliente. Substitua os PNGs em
`minimap-without-markers/minimap/` e o `minimap/minimapmarkers.bin` pelos seus e
rode:

```bash
python tools/baixar_areas.py    # so na primeira vez: baixa as areas da Cyclopedia
python tools/gerar_dados.py     # regera data/*.js
```

---

## Créditos e dados

O código é meu, mas o mapa não. Os dados vêm de:

- **[tibiamaps.io](https://tibiamaps.io)** — os tiles do minimapa e a lista de
  áreas/subáreas da Cyclopedia (`data/areas.json`, baixado por
  `tools/baixar_areas.py`)
- **[TibiaWiki EN](https://tibia.fandom.com/wiki/Measuring_Tibia_Quest)** e
  **[TibiaWiki BR](https://www.tibiawiki.com.br/wiki/Measuring_Tibia_Quest)** —
  recompensas, achievements e quais subáreas contam
- **[Manual oficial do Tibia](https://www.tibia.com/gameguides/?subtopic=manual&section=interface)** —
  a mecânica do Cyclopedia Map e do bônus de speed

Tibia é marca registrada da **CipSoft GmbH**. Este é um projeto de fã, sem
qualquer vínculo com a CipSoft, e o material de jogo aqui pertence a ela.

Os marcadores em `data/markers.js` saíram do meu `minimapmarkers.bin` — são o
pool de posições onde os Points of Interest podem aparecer, que é o mesmo para
todo mundo.

O código deste repositório está sob **MIT** (veja [LICENSE](LICENSE)). A licença
vale para o código, não para os dados de mapa de terceiros acima.
