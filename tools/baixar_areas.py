# -*- coding: utf-8 -*-
"""
Baixa a lista de areas/subareas da Cyclopedia (tibiamaps.io) para data/areas.json.

E a unica chamada de rede do projeto inteiro, e so precisa rodar quando o Tibia
adicionar regioes novas. Depois disso o mapa funciona 100% offline.

Fonte : https://tibiamaps.io/_json/areas.json
Dados : nomes e contornos das areas da Cyclopedia, originalmente do cliente do
        Tibia (CipSoft). Uso pessoal.

Uso:  python tools/baixar_areas.py
"""
import json
import os
import sys
import urllib.request

URL = "https://tibiamaps.io/_json/areas.json"
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "data", "areas.json")


def main():
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    print("baixando %s ..." % URL)

    req = urllib.request.Request(URL, headers={"User-Agent": "tibia-map-poi/1.0 (uso pessoal)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        bruto = r.read()

    # valida antes de gravar: melhor falhar aqui do que deixar um arquivo quebrado
    dados = json.loads(bruto.decode("utf-8"))
    if not isinstance(dados, list) or not dados:
        sys.exit("ERRO: esperava uma lista de areas, veio outra coisa.")
    faltando = [c for c in ("area", "subarea", "id", "bbox", "rings") if c not in dados[0]]
    if faltando:
        sys.exit("ERRO: o formato mudou, faltam os campos: %s" % ", ".join(faltando))

    with open(DESTINO, "wb") as f:
        f.write(bruto)

    areas = sorted({a["area"] for a in dados})
    print("OK  -> data/areas.json  (%.1f KB)" % (len(bruto) / 1024.0))
    print("  areas ....: %d" % len(areas))
    print("  subareas .: %d" % len(dados))
    print("  %s" % ", ".join(areas))
    print("\nAgora rode:  python tools/gerar_dados.py")


if __name__ == "__main__":
    main()
