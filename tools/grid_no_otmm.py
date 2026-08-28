# -*- coding: utf-8 -*-
"""
Pinta o grid pontilhado nos arquivos .otmm do minimapa do cliente (RubinOT /
OTClient), do mesmo jeito que o download "com grid" do tibiamaps faz nos PNGs:
um ponto preto em todo sqm de coordenada par (x % 2 == 0 e y % 2 == 0).

NUNCA escreve na pasta de entrada. Sempre gera uma pasta nova.

Formato do .otmm desta pasta (descoberto por engenharia reversa, confirmado
contra os PNGs do mesmo lugar):

  Variante B - bloco COM dados, sem compressao:
      offset  0   "OTDH"
      offset  4   uint32  = 4
      offset  8   uint32  x do bloco
      offset 12   uint32  y do bloco
      offset 16   uint32  z do bloco
      offset 20   uint32  (contador interno, nao mexemos)
      offset 24   corpo:
                    +0     4096 bytes  flags   (1 por tile)
                    +4096  4096 bytes  CORES   (1 por tile)  <- so isto muda
                    +8192  4096 bytes  speed   (1 por tile)
                    +12288 resto       dados extras do cliente
      Os tiles vao em linha (indice = y * 64 + x), bloco de 64x64.
      A cor e indice no cubo 6x6x6 do OTClient: r=(i/36)%6*51, g=(i/6)%6*51,
      b=(i%6)*51. O indice 0 e preto - e o que o grid usa.

  Variante A - bloco vazio, zlib, assinatura "OTMM HD 1.0". Tudo 255 (nao
      explorado). Nao recebe grid: ponto preto em area preta nao aparece.

Uso:
    python tools/grid_no_otmm.py --entrada <pasta> --saida <pasta>
    python tools/grid_no_otmm.py --entrada <pasta> --saida <pasta> --so-tibia
"""
import os
import re
import shutil
import struct
import sys
import time

BLOCO = 64
CAB = 24
OFF_COR = 4096
COR_GRID = 0                      # indice 0 = preto no cubo 6x6x6

RE_OTMM = re.compile(r"^minimap\d+_(\d+)_(\d+)_(\d+)\.otmm$", re.I)

# area coberta pelos PNGs do mapa do Tibia
TIBIA = (31744, 34303, 30976, 33023)


def arg(nome, padrao=None):
    if nome in sys.argv:
        i = sys.argv.index(nome)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        sys.exit("ERRO: %s precisa de um valor" % nome)
    return padrao


def variante(b):
    """'B' = bloco com dados (o que recebe grid), 'A' = vazio, None = estranho."""
    if len(b) < 28 or b[:4] != b"OTDH":
        return None
    return "A" if struct.unpack_from("<H", b, 4)[0] == 25 else "B"


def pintar_grid(b):
    """Devolve (bytes novos, quantos tiles viraram preto). Mesmo tamanho."""
    bx, by = struct.unpack_from("<II", b, 8)
    m = bytearray(b)
    base = CAB + OFF_COR
    n = 0
    # bx e by sao multiplos de 64, entao a paridade local ja e a do mundo
    for y in range(BLOCO):
        if (by + y) % 2:
            continue
        linha = base + y * BLOCO
        for x in range(0, BLOCO, 2) if (bx % 2 == 0) else range(1, BLOCO, 2):
            if m[linha + x] != COR_GRID:
                n += 1
            m[linha + x] = COR_GRID
    return bytes(m), n


def main():
    entrada = arg("--entrada")
    saida = arg("--saida")
    so_tibia = "--so-tibia" in sys.argv

    if not entrada or not saida:
        sys.exit(__doc__)
    entrada = os.path.abspath(entrada)
    saida = os.path.abspath(saida)

    if not os.path.isdir(entrada):
        sys.exit("ERRO: pasta de entrada nao existe: %s" % entrada)
    if os.path.normcase(entrada) == os.path.normcase(saida):
        sys.exit("ERRO: saida nao pode ser a mesma pasta da entrada.")
    if "program files" in os.path.normcase(saida):
        sys.exit("ERRO: por seguranca este script nao escreve dentro de Program Files.\n"
                 "      Gere numa pasta sua e copie na mao depois de testar.")

    os.makedirs(saida, exist_ok=True)
    t0 = time.time()
    n_b = n_a = n_outros = n_copiados = 0
    n_pontos = 0
    n_fora = 0

    nomes = os.listdir(entrada)
    total = len(nomes)
    for i, nome in enumerate(nomes, 1):
        orig = os.path.join(entrada, nome)
        if not os.path.isfile(orig):
            continue
        destino = os.path.join(saida, nome)

        m = RE_OTMM.match(nome)
        if not m:
            shutil.copy2(orig, destino)          # PNGs, .gitignore, etc.
            n_copiados += 1
            continue

        bx, by = int(m.group(1)), int(m.group(2))
        if so_tibia and not (TIBIA[0] <= bx <= TIBIA[1] and TIBIA[2] <= by <= TIBIA[3]):
            shutil.copy2(orig, destino)
            n_fora += 1
            continue

        b = open(orig, "rb").read()
        v = variante(b)
        if v == "B":
            novo, pontos = pintar_grid(b)
            assert len(novo) == len(b), "tamanho mudou em %s" % nome
            open(destino, "wb").write(novo)
            n_b += 1
            n_pontos += pontos
        else:
            shutil.copy2(orig, destino)
            if v == "A":
                n_a += 1
            else:
                n_outros += 1

        if i % 5000 == 0:
            print("  ... %d/%d" % (i, total), flush=True)

    print("\nOK  -> %s" % saida)
    print("  blocos com grid ....: %d" % n_b)
    print("  tiles pintados .....: %d" % n_pontos)
    print("  blocos vazios ......: %d (copiados sem mexer)" % n_a)
    if n_fora:
        print("  fora da area Tibia .: %d (copiados sem mexer)" % n_fora)
    if n_outros:
        print("  formato estranho ...: %d (copiados sem mexer)" % n_outros)
    print("  outros arquivos ....: %d (PNGs etc, copiados)" % n_copiados)
    print("  tempo ..............: %.1fs" % (time.time() - t0))


if __name__ == "__main__":
    main()
