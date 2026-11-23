# Agrupa os achados de um JSONL da simulação e mostra a cobertura por ação.
# Uso: python3 scripts/bateria/simulacao/agregar.py <saida.jsonl>
import json,sys,collections,re
f=sys.argv[1]
ev=[json.loads(l) for l in open(f)]
print("eventos",len(ev),"semanas",max(e['semana'] for e in ev))
acoes=collections.Counter(e['acao'] for e in ev)
print("acoes distintas",len(acoes),"ritmo",sum(1 for e in ev if e.get('ritmo')))
grp=collections.defaultdict(list)
for e in ev:
    if not e['achado']: continue
    msg=re.sub(r'[A-Za-z0-9]{20}','<id>',e.get('msg') or '')
    msg=re.sub(r'\d+','N',msg)[:160]
    grp[(e['acao'],e['esperado'],e['obtido'],msg)].append(e)
print("achados",sum(len(v) for v in grp.values()),"grupos",len(grp))
for k,v in sorted(grp.items(),key=lambda kv:-len(kv[1])):
    sem=sorted(set(x['semana'] for x in v))
    print(f"{len(v):4d} | {k[0]} | esp={k[1]} obt={k[2]} | sem {sem[0]}-{sem[-1]} | {k[3]}")
# ok counts per action (coverage)
ok=collections.Counter(e['acao'] for e in ev if e['obtido']=='ok')
print("\nCOBERTURA (ok/total):")
for a,n in sorted(acoes.items()):
    print(f"  {a}: {ok[a]}/{n}")
