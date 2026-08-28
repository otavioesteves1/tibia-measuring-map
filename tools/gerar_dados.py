# -*- coding: utf-8 -*-
"""
Gera os arquivos de dados usados pelo visualizador (data/mapdata.js e data/markers.js).

Os PNGs do mapa e o arquivo de marcadores podem vir de pastas diferentes: da para
usar o mapa limpo (sem o grid embutido) junto com os marcadores de outro download.

Uso:
    python tools/gerar_dados.py
    python tools/gerar_dados.py --tiles minimap-without-markers/minimap
    python tools/gerar_dados.py --marcadores minimap/minimapmarkers.bin
"""
import os
import re
import json
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RAIZ, "data")

SETOR = 256  # cada PNG do minimap cobre 256x256 sqm

RE_TILE = re.compile(r"^Minimap_(Color|WaypointCost)_(\d+)_(\d+)_(\d+)\.png$", re.I)

# Onde procurar os PNGs, em ordem de preferencia. O download "without markers"
# do tibiamaps vem sem o grid pontilhado embutido, entao ele ganha do ./minimap
# exportado pelo cliente.
PASTAS_TILES = [
    os.path.join("minimap-without-markers", "minimap"),
    "minimap-without-markers",
    "minimap",
]

# Onde procurar o minimapmarkers.bin. O download do tibiamaps nao traz esse
# arquivo - ele so existe na pasta exportada do seu cliente.
PASTAS_MARCADORES = [
    "minimap",
    os.path.join("minimap-without-markers", "minimap"),
    "minimap-without-markers",
    ".",
]


# ------------------------------------------------------------- descoberta ---
def tem_tiles(pasta):
    if not os.path.isdir(pasta):
        return 0
    return sum(1 for n in os.listdir(pasta) if RE_TILE.match(n))


def achar_pasta_tiles(escolhida=None):
    if escolhida:
        p = escolhida if os.path.isabs(escolhida) else os.path.join(RAIZ, escolhida)
        if not tem_tiles(p):
            sys.exit("ERRO: nenhum PNG Minimap_* em %s" % p)
        return p
    for rel in PASTAS_TILES:
        p = os.path.join(RAIZ, rel)
        if tem_tiles(p):
            return p
    sys.exit("ERRO: nao achei nenhuma pasta com PNGs Minimap_*.\n"
             "      Procurei em: %s" % ", ".join(PASTAS_TILES))


def achar_marcadores(escolhido=None):
    if escolhido:
        p = escolhido if os.path.isabs(escolhido) else os.path.join(RAIZ, escolhido)
        return p if os.path.exists(p) else None
    for rel in PASTAS_MARCADORES:
        p = os.path.join(RAIZ, rel, "minimapmarkers.bin")
        if os.path.exists(p):
            return p
    return None


def tem_grade_embutida(pasta):
    """O download 'com grid' do tibiamaps pinta um ponto preto em cada pixel par.
       Devolve True/False, ou None se nao der para checar (sem Pillow)."""
    try:
        from PIL import Image
    except ImportError:
        return None
    for nome in sorted(os.listdir(pasta)):
        if not nome.lower().startswith("minimap_color_"):
            continue
        px = Image.open(os.path.join(pasta, nome)).convert("RGB").load()
        pares = [px[x, y] for y in range(0, 64, 2) for x in range(0, 64, 2)]
        impares = [px[x, y] for y in range(1, 64, 2) for x in range(1, 64, 2)]
        pretos_par = sum(1 for c in pares if c == (0, 0, 0))
        pretos_impar = sum(1 for c in impares if c == (0, 0, 0))
        # tile totalmente preto (area nao explorada) nao serve de amostra
        if pretos_par == len(pares) and pretos_impar == len(impares):
            continue
        return pretos_par == len(pares) and pretos_impar < len(impares) * 0.5
    return None


# ---------------------------------------------------------------- protobuf ---
def _varint(b, i):
    r = 0
    s = 0
    while True:
        x = b[i]
        i += 1
        r |= (x & 0x7F) << s
        if not x & 0x80:
            return r, i
        s += 7


def _campos(b):
    """Decodifica uma mensagem protobuf simples em {numero_do_campo: [valores]}."""
    out = {}
    i = 0
    while i < len(b):
        chave, i = _varint(b, i)
        campo, tipo = chave >> 3, chave & 7
        if tipo == 0:
            v, i = _varint(b, i)
        elif tipo == 2:
            n, i = _varint(b, i)
            v = b[i:i + n]
            i += n
        elif tipo == 5:
            v = b[i:i + 4]
            i += 4
        elif tipo == 1:
            v = b[i:i + 8]
            i += 8
        else:
            raise ValueError("wire type %d nao suportado (campo %d)" % (tipo, campo))
        out.setdefault(campo, []).append(v)
    return out


def ler_marcadores(caminho):
    """minimapmarkers.bin (Tibia 12+) e protobuf:
         MarkerList { repeated Marker markers = 1; }
         Marker     { Position pos = 1; uint32 icone = 2; string texto = 3; uint32 _ = 4; }
         Position   { uint32 x = 1; uint32 y = 2; uint32 z = 3; }
    """
    if not os.path.exists(caminho):
        return []
    dados = open(caminho, "rb").read()
    marcas = []
    for bruto in _campos(dados).get(1, []):
        m = _campos(bruto)
        if 1 not in m:
            continue
        p = _campos(m[1][0])
        x = p.get(1, [0])[0]
        y = p.get(2, [0])[0]
        z = p.get(3, [0])[0]
        icone = m.get(2, [0])[0]
        texto = m.get(3, [b""])[0].decode("utf-8", "replace").strip()
        marcas.append([x, y, z, icone, texto])
    marcas.sort(key=lambda m: (m[2], m[1], m[0]))
    return marcas


# -------------------------------------------------------------------- tiles ---
def indexar_tiles(pasta):
    cor = {}       # z -> set((sx, sy))
    custo = {}     # z -> set((sx, sy))
    for nome in os.listdir(pasta):
        m = RE_TILE.match(nome)
        if not m:
            continue
        tipo, x, y, z = m.group(1).lower(), int(m.group(2)), int(m.group(3)), int(m.group(4))
        alvo = cor if tipo == "color" else custo
        alvo.setdefault(z, set()).add((x, y))
    return cor, custo


# ------------------------------------------------- areas da Cyclopedia ---
# Os poligonos sao 2D (x,y): uma area vale para os 16 andares. Marcadores de
# subsolo costumam cair um pouco fora do contorno de superficie, entao quem nao
# cai dentro de nenhum poligono e colado na subarea mais proxima ate este limite.
COLAR_ATE = 100  # sqm


def carregar_areas():
    caminho = os.path.join(DATA, "areas.json")
    if not os.path.exists(caminho):
        return None
    return json.load(open(caminho, encoding="utf-8"))


def _dentro(x, y, a):
    b = a["bbox"]
    if not (b[0] <= x <= b[2] and b[1] <= y <= b[3]):
        return False
    dentro = False
    for anel in a["rings"]:
        n = len(anel)
        j = n - 1
        for i in range(n):
            xi, yi = anel[i]
            xj, yj = anel[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                dentro = not dentro
            j = i
    return dentro


def _dist2_ate(x, y, a):
    b = a["bbox"]
    dx = max(b[0] - x, 0, x - b[2])
    dy = max(b[1] - y, 0, y - b[3])
    if dx * dx + dy * dy > COLAR_ATE * COLAR_ATE:
        return None
    melhor = None
    for anel in a["rings"]:
        for px, py in anel:
            d = (px - x) ** 2 + (py - y) ** 2
            if melhor is None or d < melhor:
                melhor = d
    return melhor


def atribuir_areas(marcas, areas):
    """Devolve (indices, exatos, colados, orfaos): para cada marcador, o indice
       da subarea em `areas`, ou -1."""
    # grade grosseira de 512 para nao testar as 192 subareas em cada marcador
    grade = {}
    for i, a in enumerate(areas):
        b = a["bbox"]
        for gx in range(b[0] // 512, b[2] // 512 + 1):
            for gy in range(b[1] // 512, b[3] // 512 + 1):
                grade.setdefault((gx, gy), []).append(i)

    indices = []
    exatos = colados = orfaos = 0
    for m in marcas:
        x, y = m[0], m[1]
        achou = -1
        for i in grade.get((x // 512, y // 512), ()):
            if _dentro(x, y, areas[i]):
                achou = i
                break
        if achou >= 0:
            exatos += 1
        else:
            melhor = melhor_i = None
            for i, a in enumerate(areas):
                d = _dist2_ate(x, y, a)
                if d is not None and (melhor is None or d < melhor):
                    melhor, melhor_i = d, i
            if melhor_i is not None:
                achou = melhor_i
                colados += 1
            else:
                orfaos += 1
        indices.append(achou)
    return indices, exatos, colados, orfaos


def escrever_js(caminho, nome_var, obj):
    with open(caminho, "w", encoding="utf-8") as f:
        f.write("// Arquivo gerado por tools/gerar_dados.py - nao edite a mao.\n")
        f.write("window.%s = " % nome_var)
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")


def arg(nome):
    if nome in sys.argv:
        i = sys.argv.index(nome)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        sys.exit("ERRO: %s precisa de um caminho depois" % nome)
    return None


def main():
    os.makedirs(DATA, exist_ok=True)

    pasta_tiles = achar_pasta_tiles(arg("--tiles"))
    arq_marcas = achar_marcadores(arg("--marcadores"))
    rel_tiles = os.path.relpath(pasta_tiles, RAIZ).replace("\\", "/")

    cor, custo = indexar_tiles(pasta_tiles)
    todos = set()
    for d in (cor, custo):
        for s in d.values():
            todos |= s
    if not todos:
        sys.exit("ERRO: nenhum PNG Minimap_* encontrado em %s" % pasta_tiles)

    minx = min(p[0] for p in todos)
    maxx = max(p[0] for p in todos) + SETOR - 1
    miny = min(p[1] for p in todos)
    maxy = max(p[1] for p in todos) + SETOR - 1

    def compacta(d):
        # z -> ["31744_30976", ...]
        return {str(z): ["%d_%d" % p for p in sorted(s)] for z, s in sorted(d.items())}

    mapdata = {
        "setor": SETOR,
        "limites": {"minX": minx, "maxX": maxx, "minY": miny, "maxY": maxy},
        "pastaTiles": rel_tiles,
        "tiles": {"color": compacta(cor), "waypoint": compacta(custo)},
        "totalTiles": {"color": sum(len(v) for v in cor.values()),
                       "waypoint": sum(len(v) for v in custo.values())},
    }
    escrever_js(os.path.join(DATA, "mapdata.js"), "MAPA_DADOS", mapdata)

    marcas = ler_marcadores(arq_marcas) if arq_marcas else []

    # ---- areas da Cyclopedia (opcional) --------------------------------
    areas = carregar_areas()
    resumo_areas = None
    if areas:
        idx, exatos, colados, orfaos = atribuir_areas(marcas, areas)
        for m, i in zip(marcas, idx):
            m.append(i)                       # marcador vira [x,y,z,icone,texto,subarea]
        usadas = len({i for i in idx if i >= 0})
        nomes_areas = sorted({a["area"] for a in areas})
        escrever_js(os.path.join(DATA, "areas.js"), "MAPA_AREAS", {
            "areas": nomes_areas,
            "subareas": [{"id": a["id"], "area": a["area"], "subarea": a["subarea"],
                          "bbox": a["bbox"], "center": a["center"], "rings": a["rings"]}
                         for a in areas],
        })
        resumo_areas = (len(nomes_areas), len(areas), usadas, exatos, colados, orfaos)
    else:
        for m in marcas:
            m.append(-1)

    escrever_js(os.path.join(DATA, "markers.js"), "MAPA_MARCADORES", marcas)

    print("OK")
    print("  mapa (PNGs) .....: %s" % rel_tiles)
    print("  marcadores ......: %s"
          % (os.path.relpath(arq_marcas, RAIZ).replace("\\", "/") if arq_marcas
             else "NENHUM (minimapmarkers.bin nao encontrado)"))
    grade = tem_grade_embutida(pasta_tiles)
    if grade is True:
        print("  AVISO ...........: estes PNGs tem o grid pontilhado embutido.")
        print("                     Use o download 'without markers' para o mapa limpo,")
        print("                     e a tecla G para a grade quando quiser ve-la.")
    elif grade is False:
        print("  grid embutido ...: nao (mapa limpo)")
    print("  tiles color .....: %d" % mapdata["totalTiles"]["color"])
    print("  tiles waypoint ..: %d" % mapdata["totalTiles"]["waypoint"])
    print("  andares .........: %s" % ", ".join(str(z) for z in sorted(cor)))
    print("  limites .........: X %d..%d  Y %d..%d  (%dx%d sqm)"
          % (minx, maxx, miny, maxy, maxx - minx + 1, maxy - miny + 1))
    print("  marcas lidas ....: %d (%d com texto)"
          % (len(marcas), sum(1 for m in marcas if m[4])))
    if resumo_areas:
        n_areas, n_sub, usadas, exatos, colados, orfaos = resumo_areas
        print("  areas ...........: %d areas / %d subareas (%d com marcador)"
              % (n_areas, n_sub, usadas))
        print("                     %d marcadores dentro do poligono, %d colados na "
              "subarea mais proxima" % (exatos, colados))
        if orfaos:
            print("                     %d ficaram sem area (mais de %d sqm de qualquer uma)"
                  % (orfaos, COLAR_ATE))
    else:
        print("  areas ...........: data/areas.json nao existe.")
        print("                     Rode  python tools/baixar_areas.py  para ter a")
        print("                     lista de cidades e subareas da Cyclopedia.")


if __name__ == "__main__":
    main()
