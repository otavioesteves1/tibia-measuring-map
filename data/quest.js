/* =============================================================================
   quest.js - Dados da Measuring Tibia Quest.

   ESCRITO A MAO (nao e gerado pelo gerar_dados.py). Se o jogo mudar, edite aqui.

   Fontes:
   - tibia.com/gameguides (manual > interface > Cyclopedia Map)  <- oficial
   - tibia.fandom.com/wiki/Cyclopedia/Map_Areas                  <- lista oficial
   - tibia.fandom.com/wiki/Measuring_Tibia_Quest
   - tibiawiki.com.br/wiki/Measuring_Tibia_Quest

   Como funciona:
   - Cada subarea tem 7 Points of Interest, sorteados por personagem a partir de
     um POOL FIXO de posicoes - que e justamente o que as bandeiras do mapa sao.
   - 30% da area  -> mostra os NPCs no Cyclopedia Map
   - 70% da area  -> mostra passagens entre subareas e teleports
   - 100% da area -> mostra as criaturas, avisa de invasoes, da o achievement
                     e liga o bonus de speed DENTRO daquela area
   ========================================================================== */
window.MAPA_QUEST = {
  fontes: [
    ['Manual oficial do Tibia',
     'https://www.tibia.com/gameguides/?subtopic=manual&section=interface'],
    ['Cyclopedia/Map Areas (TibiaWiki EN)',
     'https://tibia.fandom.com/wiki/Cyclopedia/Map_Areas'],
    ['Measuring Tibia Quest (TibiaWiki EN)',
     'https://tibia.fandom.com/wiki/Measuring_Tibia_Quest'],
    ['Measuring Tibia Quest (TibiaWiki BR)',
     'https://www.tibiawiki.com.br/wiki/Measuring_Tibia_Quest']
  ],

  poiPorSubarea: 7,
  totalAreas: 20,

  marcos: [
    { pct: 30, o_que: 'mostra os NPCs da area no mapa' },
    { pct: 70, o_que: 'mostra passagens entre subareas e teleports' },
    { pct: 100, o_que: 'mostra as criaturas, avisa de invasoes, da o achievement e liga o speed' }
  ],

  recompensas: [
    { areas: 10, o_que: 'Discoverer Outfit', onde: 'NPC Charos, no Adventurers Guild',
      extra: 'achievement "Widely Travelled"' },
    { areas: 15, o_que: '1o addon do Discoverer', onde: 'NPC Charos' },
    { areas: 20, o_que: '2o addon do Discoverer', onde: 'NPC Charos',
      extra: 'achievement "Measuring the World"' }
  ],

  titulos: [
    { pct: 50, nome: 'Dedicated Entrepreneur' },
    { pct: 100, nome: 'Globetrotter' }
  ],

  achievementsTotal: { quantos: 22, pontos: 34 },

  /* SPEED - o manual oficial diz, palavra por palavra:
       "If you have fully discovered an area, your character benefits from a
        speed bonus while in this area. The more areas you have fully
        discovered, the higher the speed bonus."
     E as notas do Summer Update 2026:
       "Fully discovering areas now grants extra movement speed within those
        areas, with the bonus scaling from 100 to 195 speed."

     Ou seja: NAO existe valor por cidade. Toda area concluida da o mesmo bonus,
     e o tamanho dele depende de QUANTAS areas voce concluiu no total. E o bonus
     so vale enquanto voce esta DENTRO de uma area ja concluida.

     A CipSoft nao publicou a tabela exata - o jogo mostra o valor atual num
     tooltip do Cyclopedia Map. A conta do site e uma INTERPOLACAO LINEAR entre
     os dois extremos confirmados (100 com 1 area, 195 com 20), o que da +5 por
     area. Bate certinho nas pontas, mas continua sendo estimativa. */
  speed: {
    min: 100,
    max: 195,
    exato: false,
    ondeVerOExato: 'tooltip do Cyclopedia Map, dentro do jogo',
    soDentroDaArea: true
  },

  /* TIRADO DO CHECKLIST: nao participa da quest, entao some da lista, nao conta
     em progresso nem recompensa, e o terreno fica cinza e sem bandeiras no
     mapa (igual uma subarea concluida - so que sem ✓).

     Duas listas, a primeira vale para a AREA INTEIRA:
       foraDaQuest            -> todas as subareas da area
       subareasForaDaQuest    -> so as subareas citadas
     Para trazer algo de volta, e so apagar a linha. */
  // Dawnport e a ilha tutorial: nao entra na quest e o personagem nao volta.
  foraDaQuest: ['Dawnport'],

  subareasForaDaQuest: {
    "Hrodmir":   ["Chyllfroest Chakoya Caves", "Chyllfroest Icefire Caves"],
    "Thais":     ["Temple of Light", "Isle of Destiny", "Rookgaard", "Meluna", "Travora"],
    "Oramond":   ["Podzilla Maw"],
    "Quirefang": ["Blue Valley"],
    "Kilmaresh": ["Great Expedition Island"]
  },

  /* Ordem sugerida para fazer a quest. E PALPITE, nao vem de fonte nenhuma.
     Criterio, em peso decrescente: precisa de quest de acesso? exige level?
     as criaturas machucam? quantas subareas e quanto barco da? */
  areas: {
    "Thais":             { ordem: 1, achievement: "All Hail the King",
                          nota: "Cidade inicial: sem quest de acesso, tudo a pe." },
    "Ab'Dendriel":       { ordem: 2, achievement: "Elven Woods",
                          nota: "Mainland, sem quest de acesso. Draconia e Elvenbane pedem uma subida." },
    "Carlin":            { ordem: 3, achievement: "Long Live the Queen",
                          nota: "Mainland tranquilo; as ilhas (Folda, Senja, Vega) pedem barco." },
    "Kazordoon":         { ordem: 4, achievement: "Dwarven Mines",
                          nota: "Minas labirinticas, mas sem quest de acesso." },
    "Venore":            { ordem: 5, achievement: "Jewel in the Swamp",
                          nota: "Mainland. Dark Cathedral e Plains of Havoc mordem." },
    "Edron":             { ordem: 6, achievement: "Stronghold of Edron",
                          nota: "Barco direto de qualquer cidade. Azzilon Castle e a mais chata." },
    "Northern Darama":   { ordem: 7, achievement: "Daraman's Footsteps",
                          nota: "Darashia e deserto. Drefia e o ponto perigoso." },
    "Southern Darama":   { ordem: 8, achievement: "Mummy's Dearest",
                          nota: "Ankrahmun e tumbas. Cobra Bastion pede acesso proprio." },
    "Tiquanda":          { ordem: 9, achievement: "King Of The Jungle",
                          nota: "Port Hope e selva. Asura Palace pede level 250." },
    "Krailos":           { ordem: 10, achievement: "The Ogre Steppe",
                          nota: "Curta, mas os ogros batem forte." },
    "Hrodmir":           { ordem: 11, achievement: "Race to the Pole",
                          nota: "Espalhada pelo gelo: muito barco entre as ilhas." },
    "Vandura":           { ordem: 12, achievement: "Liberty Bay Watch",
                          nota: "A maior de todas, e quase tudo em ilha separada." },
    "Oramond":           { ordem: 13, achievement: "Glooth Punk",
                          nota: "Precisa de acesso a Rathleton." },
    "Yalahar":           { ordem: 14, achievement: "Ancient Splendor",
                          nota: "Precisa da In Service of Yalahar para abrir os quarters." },
    "Feyrist":           { ordem: 15, achievement: "Realms of Dreams",
                          nota: "Curta, mas precisa de acesso ao mundo dos sonhos." },
    "Zao":               { ordem: 16, achievement: "Lizard Kingdom",
                          nota: "Pede progresso na Wrath of the Emperor. Zzaion so abre com Orc Raid." },
    "Quirefang":         { ordem: 17, achievement: "Trip to the Beach",
                          nota: "Curta, mas a Hive pede as quests dos gnomos." },
    "Roshamuul":         { ordem: 18, achievement: "Twisted Dreams",
                          nota: "Criaturas muito fortes. A wiki avisa: tome cuidado aqui." },
    "Kilmaresh":         { ordem: 19, achievement: "The Empire's Glory",
                          nota: "Area nova, acesso por Issavi." },
    "Marapur":           { ordem: 20, achievement: "Snake Pit",
                          nota: "A mais recente e a mais longe de tudo." },
    "Dawnport":          { ordem: 99, achievement: null,
                          nota: "Ilha tutorial. Nao faz parte da quest." }
  },
  /* Subareas que CONTAM para a quest (161): as 160 que as duas wikis listam,
     mais Venore Dragon Lair - so a wiki BR cita, mas e confirmada como parte
     de Venore por quem joga (jogador, set/2026). */
  subareasCertas: {
      "Ab'Dendriel": [
          "Ab'Dendriel City",
          "Ab'Dendriel Surroundings",
          "Draconia",
          "Elvenbane"
      ],
      "Carlin": [
          "Carlin City",
          "Carlin Surroundings",
          "Fields of Glory",
          "Folda",
          "Ghostlands",
          "Isle of the Kings",
          "Senja",
          "Vega"
      ],
      "Edron": [
          "Azzilon Castle",
          "Cormaya",
          "Cyclopolis",
          "Edron Castle",
          "Edron Dragon Lair",
          "Edron Goblin Den",
          "Edron Hero Fortress",
          "Edron Orc Lands",
          "Edron Surroundings",
          "Edron Troll Den",
          "Grimvale",
          "Stonehome"
      ],
      "Feyrist": [
          "Candia",
          "Fae Village",
          "Feyrist Meadows"
      ],
      "Hrodmir": [
          "Bittermor",
          "Formorgar Glacier",
          "Grimlund",
          "Helheim",
          "Inukaya",
          "Krimhorn",
          "Nibelor",
          "Okolnir",
          "Ragnir",
          "Svargrond City",
          "Svargrond Surroundings",
          "Tyrsung"
      ],
      "Kazordoon": [
          "Femor Hills",
          "Horned Fox Lair",
          "Kazordoon City",
          "Kazordoon Surroundings",
          "Kazordoon Troll Den",
          "Rorc Plains",
          "Ulderek's Rock"
      ],
      "Kilmaresh": [
          "Central Steppe",
          "Green Belt",
          "Issavi",
          "Kilmaresh Mountains",
          "Nykri Delta",
          "Rascacoon",
          "Southern Steppe",
          "The Wreckoning"
      ],
      "Krailos": [
          "Krailos Ruins",
          "Krailos Steppe",
          "Ogre Village"
      ],
      "Marapur": [
          "Emerald Gardens",
          "Fading Isles",
          "Moonfall",
          "Moonstone Crater",
          "Murmuring Wilderness",
          "Salgadora",
          "Silent Waters",
          "Silvertides",
          "Sparkling Lagoon",
          "Stardance Mountains",
          "Thalassara Surroundings"
      ],
      "Northern Darama": [
          "Daramian Minotaur Pyramid",
          "Darashia City",
          "Drefia",
          "Lion's Rock",
          "Northern Darama Desert"
      ],
      "Oramond": [
          "Oramond Marshes",
          "Oramond Minotaur Camp",
          "Oramond Mountain Hideout",
          "Rathleton City",
          "Rathleton Slum",
          "Rathleton Workshops"
      ],
      "Quirefang": [
          "Gray Beach",
          "Hive Pools",
          "Hive Pyramids"
      ],
      "Roshamuul": [
          "Ingol",
          "Isle of Ada - Adaean Mines",
          "Isle of Ada - Bastion",
          "Isle of Ada - Outskirts",
          "Lower Roshamuul",
          "Roshamuul Mountains",
          "Upper Roshamuul"
      ],
      "Southern Darama": [
          "Ankrahmun City",
          "Ankrahmun Pharaoh Tombs",
          "Cobra Bastion",
          "Kha'zeel Dragon Lairs",
          "Southern Darama Desert"
      ],
      "Thais": [
          "Aragonia",
          "Fibula",
          "Greenshore",
          "Mount Sternum",
          "Targuna",
          "Thais City",
          "Thais Surroundings",
          "Thais Trolls' Cave"
      ],
      "Tiquanda": [
          "Asura Palace",
          "Banuta",
          "Chor",
          "Forbidden Lands of Tiquanda",
          "Medusa Tower",
          "Port Hope City",
          "Port Hope Surroundings"
      ],
      "Vandura": [
          "Bounac",
          "Goroma",
          "Hellgorge",
          "Kharos",
          "Laguna Islands",
          "Liberty Bay City",
          "Liberty Bay Surroundings",
          "Malada",
          "Meriana",
          "Nargor",
          "Ramoa",
          "Talahu",
          "Treasure Island",
          "Vandura Cultist Hideout",
          "Vandura Quara Caves"
      ],
      "Venore": [
          "Amazon Camp",
          "Black Knight Villa",
          "Dark Cathedral",
          "Gloom Caverns",
          "Green Claw Swamp",
          "Jakundaf Desert",
          "Outlaw Camp",
          "Plains of Havoc",
          "Shadowthorn",
          "Venore City",
          "Venore Dragon Lair",
          "Venore Southern Swamp",
          "Venore Surroundings"
      ],
      "Yalahar": [
          "Fenrock",
          "Isle of Evil",
          "Mistrock",
          "Yalahar Alchemist Quarter",
          "Yalahar Arena Quarter",
          "Yalahar Cemetery Quarter",
          "Yalahar Centre",
          "Yalahar Factory Quarter",
          "Yalahar Foreigner Quarter",
          "Yalahar Magician Quarter",
          "Yalahar Sunken Quarter",
          "Yalahar Trade Quarter"
      ],
      "Zao": [
          "Chazorai",
          "Corrupted Gardens",
          "Dragonblaze Peaks",
          "Emperor's Castle",
          "Falcon Bastion",
          "Muggy Plains",
          "Razachai",
          "Spirittrails",
          "Vengoth",
          "Zao Orc Fortress",
          "Zao Steppe",
          "Zzaion"
      ]
  },

  /* As 12 em que as fontes discordam - aparecem com "?" na lista. A wiki EN
     marca numa tabela quais sao descobriveis; a BR tem uma lista propria e a
     pagina dela esta marcada como esboco. Sem checar no jogo nao da para cravar. */
  subareasDuvidosas: {
      "Carlin": {
          "Ice Islands": "PT"
      },
      "Kazordoon": {
          "Orc Lands": "PT"
      },
      "Kilmaresh": {
          "Furious Crater": "EN",
          "Ruins of Nuur": "EN",
          "Salt Caves": "EN"
      },
      "Krailos": {
          "Krailos Mines": "PT"
      },
      "Southern Darama": {
          "Southern Terramite Tunnels": "PT"
      },
      "Thais": {
          "Thais Peninsula": "EN"
      },
      "Tiquanda": {
          "Kha'zeel Mountains": "PT",
          "Oskayaat": "PT"
      },
      "Vandura": {
          "Calassa": "PT"
      },
      "Zao": {
          "Norcferatu Fortress": "EN"
      }
  },

  // Notas de acesso, para nao tomar susto.
  notasSubarea: {
    'Asura Palace': 'pede level 250',
    'Zzaion': 'so abre durante Orc Raid em Zao Steppe',
    'Cobra Bastion': 'pede acesso proprio',
    'Ice Islands': 'dificil: depende de naufragar na ilha do Arctic Faun',
    'Isle of Ada - Bastion': 'Roshamuul: criaturas muito fortes',
    'Isle of Ada - Outskirts': 'Roshamuul: criaturas muito fortes',
    'Isle of Ada - Adaean Mines': 'Roshamuul: criaturas muito fortes'
  }
};
