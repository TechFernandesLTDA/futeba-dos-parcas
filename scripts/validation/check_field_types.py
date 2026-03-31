"""Verifica tipos de quadras cadastradas"""
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
print("VERIFICACAO DE TIPOS DE QUADRAS")
print("="*60 + "\n")

fields = db.collection('fields').stream()

# Contar por tipo
types_count = defaultdict(int)
fields_by_location = defaultdict(list)

for field in fields:
    data = field.to_dict()
    field_type = data.get('type', 'UNKNOWN')
    location_id = data.get('location_id', 'NO_LOCATION')

    types_count[field_type] += 1
    fields_by_location[location_id].append({
        'id': field.id,
        'name': data.get('name'),
        'type': field_type
    })

print(f"Total de quadras: {sum(types_count.values())}\n")

print("DISTRIBUICAO POR TIPO:")
for field_type, count in sorted(types_count.items()):
    print(f"  {field_type}: {count}")

print("\n" + "="*60)
print("LOCAIS E SUAS QUADRAS:")
print("="*60 + "\n")

# Pegar nomes dos locais
locations = {}
for loc in db.collection('locations').stream():
    locations[loc.id] = loc.to_dict().get('name', 'SEM NOME')

# Mostrar por local
for location_id, fields_list in sorted(fields_by_location.items(), key=lambda x: locations.get(x[0], '')):
    location_name = locations.get(location_id, 'LOCAL NAO ENCONTRADO')
    print(f"\n{location_name} ({len(fields_list)} quadras):")

    for field in fields_list:
        print(f"  - {field['name']}: {field['type']}")

print("\n" + "="*60 + "\n")
