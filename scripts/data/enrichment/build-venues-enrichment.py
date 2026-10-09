#!/usr/bin/env python
"""Gera scripts/data/venues-enriquecimento-r9.json (modo enriquecimento, #4195).

Entradas:
  --snapshot  JSON de produção (scripts/data/snapshot-venues.js)
  --maps      JSONL de fichas do Google Maps (maps-evidence-r9.jsonl)
  --datasets  glob dos datasets curados (venues-*.json): horários/quantidade/piso já com fonte
  --out       dataset de saída

Regras (não destrutivo, só dado com fonte):
  * telefone/site/instagram da ficha do Maps só entram quando o campo está vazio em produção
    e a ficha é do mesmo município e do mesmo estabelecimento (nome parecido ou mesma rua+número);
  * 'Permanentemente/Temporariamente fechado' vira external_data.operational_status (nada é apagado);
  * horários de datasets curados substituem apenas o padrão do importador (08:00-23:59, 7 dias);
  * quantidade de quadras só entra quando a fonte dá número explícito (CURATED) ou o dataset já
    traz qtd_quadras; descrições no singular ("quadra de futebol sintético, coberta") valem 1 (mínimo).
"""
import argparse, glob, json, re, unicodedata
from urllib.parse import quote_plus

def norm(s):
    return re.sub(r"[^a-z0-9 ]+", " ", unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()).strip()

STOP = {"arena", "society", "futebol", "quadra", "quadras", "esportes", "esporte", "centro", "de", "da", "do", "dos", "das",
        "e", "campo", "sports", "sport", "aluguel", "clube", "ginasio", "cancha", "complexo", "espaco", "soccer", "locacao"}

def toks(n):
    return [t for t in norm(n).split() if t not in STOP and len(t) > 2]

def digits(s):
    return re.sub(r"\D", "", s or "")

# Contagens com número explícito na fonte (página oficial ou guia citado). Chave: (cidade, nome em produção).
CURATED = {
    ("Porto Alegre", "Soccer Sports"): dict(
        qtd_quadras=2, detalhe_quadras="1 quadra de society (grama sintética, coberta) + 1 quadra de futsal (piso poliesportivo de madeira, coberta; também vôlei)",
        tipo_piso="grama sintética (society) e madeira (futsal/vôlei)", site="https://soccersportspoa.com.br",
        precos=[{"item": "Futsal/vôlei avulso", "valor": "R$ 130 (unidade de tempo não informada no site)"},
                {"item": "Futsal/vôlei mensalista", "valor": "R$ 110"},
                {"item": "Society avulso", "valor": "R$ 160"},
                {"item": "Society mensalista", "valor": "R$ 140"},
                {"item": "Combo quadra + espaço social", "valor": "R$ 600 por 3 h (R$ 700 por 4 h)"}],
        fontes=[{"url": "https://soccersportspoa.com.br", "dado": "site oficial (Floresta, Porto Alegre): quadra de society coberta com grama sintética, quadra coberta de piso poliesportivo de madeira para futsal/vôlei e tabela de valores"}]),
    ("São Paulo", "Soccer Mania Futebol Society"): dict(
        qtd_quadras=1, detalhe_quadras="1 campo de society (grama sintética, 20x40 m)", tipo_piso="grama sintética", site="https://www.soccermania.com.br/",
        precos=[{"item": "Aluguel de campo (1h30 a 2h)", "valor": "a partir de R$ 350"}, {"item": "Festa infantil", "valor": "a partir de R$ 599"}],
        fontes=[{"url": "https://www.soccermania.com.br/", "dado": "site oficial: '01 campo de grama sintética, 02 vestiários e espaço com churrasqueiras'; aluguel de campo a partir de R$ 350 (1h30 a 2h), dimensões 20x40 m"}]),
    ("Porto Alegre", "HD Sports Complex"): dict(
        qtd_quadras=6, detalhe_quadras="4 quadras de society (cobertas, medidas oficiais) + 1 quadra de futsal + 1 campo de futebol 11 sintético oficial",
        tipo_piso="grama sintética", site="https://www.hdsportscomplex.com.br/", telefone="(51) 99312-1476",
        horarios={"segunda": "09:00-00:00", "terca": "09:00-00:00", "quarta": "09:00-00:00", "quinta": "09:00-00:00", "sexta": "09:00-00:00", "sabado": "08:00-22:00", "domingo": "19:00-22:00"},
        fontes=[{"url": "https://www.hdsportscomplex.com.br/complexo", "dado": "site oficial: 'complexo poliesportivo, completamente coberto, composto de quatro quadras de futebol society, quadra de futsal e campo 11 sintético tamanho oficial'; telefone (51) 99312.1476; horário: segunda a sexta 09h às 24h, sábado 08h às 22h, domingo 19h às 22h"}]),
    ("São Paulo", "Power Sports Vip"): dict(
        qtd_quadras=6, detalhe_quadras="6 quadras de society (4 cobertas e 2 abertas)", tipo_piso="grama sintética", site="https://www.powersportsvip.com.br/",
        fontes=[{"url": "https://www.powersportsvip.com.br/", "dado": "site oficial: '6 quadras de futebol society (4 cobertas e 2 abertas) para locação avulsa ou mensal, todas com grama sintética importada'; também 1 quadra de tênis aberta (não contada)"}]),
    ("Curitiba", "Trieste Stadium (Trieste FC)"): dict(
        qtd_quadras=1, detalhe_quadras="1 campo de futebol oficial (gramado sintético)", tipo_piso="campo (gramado sintético)", site="https://triestefc.com.br/",
        fontes=[{"url": "https://triestefc.com.br/o-clube/estrutura/", "dado": "site oficial do Trieste FC (Estrutura): complexo esportivo com campo oficial de futebol, escolinha, academia, piscinas e ginásio poliesportivo"}]),
    ("Joinville", "Soratto Futebol Society"): dict(
        qtd_quadras=1, detalhe_quadras="1 quadra de society (grama sintética)", tipo_piso="grama sintética",
        fontes=[{"url": "https://www.webquadras.com.br/sorattosociety", "dado": "página do centro no WebQuadras (descrição indexada em 08/10/2026): 'uma quadra para futebol society com grama sintética'; ficha do Google Maps confirma o endereço R. Perdiz, 799, Aventureiro"}]),
}
# Dataset curado descreve no singular: mínimo de 1 quadra/campo (a fonte não dá número).
SINGULAR_MIN = {("Colombo", "Kanxa Esportiva Santos Dumont"), ("Fazenda Rio Grande", "Arena LIFAZ"), ("Piraquara", "Cancha do Bombeiro Pica Pau")}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", required=True); ap.add_argument("--maps", required=True)
    ap.add_argument("--datasets", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    prod = json.load(open(a.snapshot, encoding="utf-8"))
    ds = {}
    for f in glob.glob(a.datasets):
        d = json.load(open(f, encoding="utf-8"))
        if d.get("modo") == "enriquecimento":
            continue
        for v in d["venues"]:
            ds[(norm(v["endereco"]["cidade"]), norm(v["nome"]))] = v
    maps = {}
    for l in open(a.maps, encoding="utf-8"):
        j = json.loads(l)
        if "err" not in j and j.get("id"):
            maps[j["id"]] = j
    out, stats = [], {}
    def bump(k): stats[k] = stats.get(k, 0) + 1
    for loc in prod:
        d = loc["data"]
        ext = d.get("external_data") or {}
        if d.get("owner_id") != "system-venue-import" or ext.get("imported_by") != "venue-dataset-import":
            continue
        city, name = d.get("city", ""), d["name"]
        v = {"nome": name, "location_id": loc["id"],
             "endereco": {"rua": None, "numero": None, "bairro": None, "cidade": city, "uf": d.get("state") or "PR", "cep": None},
             "telefone": None, "whatsapp": None, "site": None, "instagram": None, "preco_hora": None, "qtd_quadras": None,
             "detalhe_quadras": None, "tipo_piso": None, "horarios": None, "nota_media": None, "contagem_avaliacoes": None,
             "comentarios": [], "fotos": [], "fontes": [], "confidence": "média", "coordenadas": None, "rodada_dados": "R9",
             "finalidade": ext.get("finalidade"), "origem": "web"}
        changed, src = [], []
        src_d = ds.get((norm(city), norm(name)))
        cur = CURATED.get((city, name))
        nfields = len(loc["fields"])
        # 1) horários de dataset curado, só sobre o padrão do importador
        days = ",".join(map(str, sorted(d.get("operating_days") or [])))
        default_hours = d.get("opening_time") == "08:00" and d.get("closing_time") == "23:59" and days == "0,1,2,3,4,5,6"
        if src_d and src_d.get("horarios") and default_hours and not (cur and cur.get("horarios")):
            v["horarios"] = src_d["horarios"]; changed.append("horarios"); src += src_d["fontes"][:2]
        # 2) quantidade de quadras
        if nfields == 0:
            if cur and cur.get("qtd_quadras"):
                for k in ("qtd_quadras", "detalhe_quadras", "tipo_piso"):
                    v[k] = cur.get(k)
                changed.append("quadras"); bump("quadras_curated")
            elif src_d and src_d.get("qtd_quadras"):
                v["qtd_quadras"], v["detalhe_quadras"], v["tipo_piso"] = src_d["qtd_quadras"], src_d.get("detalhe_quadras"), src_d.get("tipo_piso")
                changed.append("quadras"); src += src_d["fontes"][:2]; bump("quadras_dataset")
            elif (city, name) in SINGULAR_MIN and src_d:
                v["qtd_quadras"] = 1
                v["detalhe_quadras"] = "1 " + (src_d.get("detalhe_quadras") or "campo de futebol") + " (mínimo: a fonte descreve no singular, sem número)"
                v["tipo_piso"] = src_d.get("tipo_piso")
                changed.append("quadras"); src += src_d["fontes"][:1]; bump("quadras_singular_min")
        # 3) curados: horários/preços/site/telefone com fonte própria
        if cur:
            for k in ("precos", "horarios", "site", "telefone"):
                if cur.get(k) and (k != "site" or not d.get("website")) and (k != "telefone" or not d.get("phone")):
                    if k == "horarios" and not default_hours:
                        continue
                    v[k] = cur[k]; changed.append(k)
            src += cur["fontes"]
            if cur.get("precos"): bump("com_preco")
        # 4) ficha do Google Maps (mesmo município e mesmo estabelecimento)
        m = maps.get(loc["id"])
        if m:
            addr = (m.get("addr") or "").replace("Endereço:", "").strip()
            same_city = norm(city) in norm(addr)
            tk = toks(name)
            h1 = norm(m.get("h1") or "")
            street_hit = bool(d.get("street") and d.get("number") and norm(d["street"].split()[-1]) in norm(addr) and str(d["number"]) in addr)
            name_hit = bool(tk) and any(t in h1 for t in tk)
            if same_city and (name_hit or street_hit):
                mapsurl = "https://www.google.com/maps/search/" + quote_plus(m.get("q") or name)
                took = []
                ph = (m.get("phone") or "").replace("Telefone:", "").strip()
                if ph and not d.get("phone") and not v["telefone"]:
                    v["telefone"] = ph; took.append("telefone " + ph)
                web = m.get("web")
                if web and "instagram.com" in web and not d.get("instagram"):
                    v["instagram"] = web.split("instagram.com/")[1].split("?")[0].strip("/"); took.append("instagram")
                elif web and not d.get("website") and not v["site"] and "google." not in web:
                    v["site"] = web.split("?")[0] if "facebook.com" in web else web; took.append("site")
                st = {"PERM": "permanentemente_fechado", "TEMP": "temporariamente_fechado"}.get(m.get("closed") or "")
                if st:
                    v["status_operacional"] = st; took.append("status " + st)
                if took:
                    changed += [t.split()[0] for t in took]
                    src.append({"url": mapsurl, "dado": "ficha do Google Maps (consultada em 08/10/2026, '%s'): %s" % (m.get("h1"), "; ".join(took))})
                    bump("maps_aplicado")
            else:
                bump("maps_descartado_divergente")
        if not changed:
            continue
        seen, fontes = set(), []
        for s in src:
            if s["url"] not in seen:
                seen.add(s["url"]); fontes.append(s)
        v["fontes"] = fontes
        if cur and cur.get("fontes") and any(len(c) for c in [cur["fontes"]]) and "quadras" in changed and "official" not in v:
            v["confidence"] = "alta" if any("site oficial" in s["dado"] for s in cur["fontes"]) else "média"
        out.append(v)
    dataset = {
        "gerado_em": "2026-10-08", "rodada": 9, "slug": "enriquecimento", "issue": 4195, "modo": "enriquecimento",
        "titulo": "Enriquecimento não destrutivo (R9)",
        "coleta": {"data": "2026-10-08", "ferramentas": "sites oficiais, fichas do Google Maps no navegador e datasets curados R1-R8",
                   "regra": "patch mode: só preenche campos vazios (ou o horário padrão do importador); fontes acrescentadas; nada é apagado; segue DRAFT/não verificado"},
        "estatisticas": stats, "venues": out}
    json.dump(dataset, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("entradas:", len(out), stats)

if __name__ == "__main__":
    main()
