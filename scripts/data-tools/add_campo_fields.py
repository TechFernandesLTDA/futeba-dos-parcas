"""Adiciona quadras de CAMPO nos locais que devem ter"""
import firebase_admin
from firebase_admin import credentials, firestore

try:
    firebase_admin.get_app()
except:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("\n" + "="*60)
print("ADICIONAR QUADRAS DE CAMPO")
print("="*60 + "\n")

# Buscar locais que devem ter Campo
# Segundo a lista original: JB tem Society E Campo (mas no DB só tem Society e Futsal)

locations_to_add_campo = {
    "JB Esportes & Eventos": 2,  # Adicionar 2 quadras de Campo
}

# Pegar todos os locais
locations = {}
for loc in db.collection('locations').stream():
    data = loc.to_dict()
    locations[data.get('name', '')] = loc.id

print("Locais encontrados para adicionar Campo:")
for location_name, num_fields in locations_to_add_campo.items():
    location_id = locations.get(location_name)
    if location_id:
        print(f"  - {location_name} ({num_fields} quadras de Campo)")
    else:
        print(f"  - {location_name}: NAO ENCONTRADO NO DATABASE")

print("\n" + "="*60)
response = input("\nDeseja adicionar estas quadras? (s/n): ")
print("="*60 + "\n")

if response.lower() != 's':
    print("Operacao cancelada.")
    exit()

# Adicionar quadras
for location_name, num_fields in locations_to_add_campo.items():
    location_id = locations.get(location_name)
    if not location_id:
        print(f"[SKIP] {location_name}: Local nao encontrado")
        continue

    print(f"\n[PROCESSO] {location_name}:")

    for i in range(1, num_fields + 1):
        field_data = {
            'locationId': location_id,
            'name': f'Campo {i}',
            'type': 'CAMPO',
            'hourlyPrice': 180.0,  # Preco padrao para Campo
            'isActive': True,
            'photos': [],
            'surface': 'Grama natural',
            'isCovered': False,
            'dimensions': '105m x 68m',
            'createdAt': firestore.SERVER_TIMESTAMP
        }

        doc_ref = db.collection('fields').add(field_data)
        field_id = doc_ref[1].id
        print(f"  [OK] Campo {i} criado (ID: {field_id[:20]}...)")

print("\n" + "="*60)
print("CONCLUIDO!")
print("="*60 + "\n")

# Verificar resultado final
print("Verificando tipos de quadras agora:\n")
fields = db.collection('fields').stream()
types_count = {'FUTSAL': 0, 'SOCIETY': 0, 'CAMPO': 0}

for field in fields:
    field_type = field.to_dict().get('type', 'UNKNOWN')
    if field_type in types_count:
        types_count[field_type] += 1

print(f"FUTSAL: {types_count['FUTSAL']}")
print(f"SOCIETY: {types_count['SOCIETY']}")
print(f"CAMPO: {types_count['CAMPO']}")
print(f"\nTotal: {sum(types_count.values())} quadras")
print("\n" + "="*60 + "\n")
