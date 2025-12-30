"""Verifica duplicatas simples"""
import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict

try:
    firebase_admin.get_app()
except:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("\n" + "="*60)
print("VERIFICACAO DE DUPLICATAS")
print("="*60 + "\n")

locations = db.collection('locations').stream()

# Agrupar por nome
locations_by_name = defaultdict(list)

for loc in locations:
    data = loc.to_dict()
    name = data.get('name', '').strip().lower()
    locations_by_name[name].append({
        'id': loc.id,
        'name': data.get('name'),
        'address': data.get('address'),
        'neighborhood': data.get('neighborhood')
    })

# Encontrar duplicatas
duplicates = {name: locs for name, locs in locations_by_name.items() if len(locs) > 1}

if not duplicates:
    print("Nenhuma duplicata encontrada!")
    print(f"\nTotal de {len(locations_by_name)} locais unicos.")
else:
    print(f"Encontradas {len(duplicates)} duplicatas:\n")

    for name, locs in duplicates.items():
        print(f"{locs[0]['name']} ({len(locs)} copias):")
        for i, loc in enumerate(locs, 1):
            print(f"  {i}. ID: {loc['id'][:20]}... | {loc['address']}")
        print()

print("="*60 + "\n")
