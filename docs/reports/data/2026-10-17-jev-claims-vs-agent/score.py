import json,sys
K=['error-banner','modal','broken-image','overlap','loading']
# python3 score.py docs/reports/data/2026-10-17-jev-claims-vs-agent .
S=sys.argv[1]; REPO=sys.argv[2]
key={r["id"]:r["shot"] for r in json.load(open(f"{S}/agent-answers.json"))["rows"]}
jev={r['shot']['imagePath']:r['nouls'] for r in json.load(open(f"{REPO}/docs/reports/data/2026-10-17-jev-claims/answers.json"))['claims']}
agent={}
agent={r["id"]:{f"c{j}":r["answers"][k] for j,k in enumerate(K)} for r in json.load(open(f"{S}/agent-answers.json"))["rows"]}
NATIVE={'form-app':['error-banner'],'stacking-context':['modal']}
assert set(agent)==set(key), (len(agent),len(key))
rows=[]
for i,shot in key.items():
    a={K[j]:agent[i][f"c{j}"] for j in range(5)}
    rows.append((shot,jev[shot['imagePath']],a))
truth=lambda s,k: s['plant']==k or k in NATIVE.get(s['fixture'],[])
def auroc(pos,neg):
    t=sum((p>n)+0.5*(p==n) for p in pos for n in neg); return t/(len(pos)*len(neg))
for name,ix in (('jev',1),('agent',2)):
    tot=[0,0,0,0]
    print(f"## {name}")
    for k in K:
        pos=[r[ix][k] for r in rows if truth(r[0],k)]
        clean=[r[ix][k] for r in rows if not truth(r[0],k) and r[0]['plant']=='none']
        oth=[r[ix][k] for r in rows if not truth(r[0],k) and r[0]['plant']!='none']
        c=sum(v>=0.5 for v in pos); fc=sum(v>=0.5 for v in clean); fo=sum(v>=0.5 for v in oth)
        tot[0]+=c;tot[1]+=len(pos);tot[2]+=fc;tot[3]+=fo
        print(f"| {k} | {c}/{len(pos)} | {fc}/{len(clean)} | {fo}/{len(oth)} | {auroc(pos,clean+oth):.2f} |")
    print("total caught",tot[0],"/",tot[1],"clean FA",tot[2],"other FA",tot[3])
    wrong=[(r[0]['fixture'],r[0]['plant'],k,r[ix][k]) for r in rows for k in K if (r[ix][k]>=0.5)!=truth(r[0],k)]
    print("wrong:",wrong)
