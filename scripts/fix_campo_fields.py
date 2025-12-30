"""Corrige locationId das quadras de Campo"""
import firebase_admin
from firebase_admin import credentials, firestore

try:
    firebase_admin.get_app()
except:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("\nCorrigindo quadras de Campo...")

# Buscar JB Esportes
locations = db.collection('locations').where('name', '==', 'JB Esportes & Eventos').stream()
jb_location_id = None

for loc in locations:
    jb_location_id = loc.id
    break

if not jb_location_id:
    print("ERRO: JB Esportes & Eventos não encontrado!")
    exit(1)

print(f"JB Esportes & Eventos ID: {jb_location_id}")

# Deletar quadras de Campo antigas
fields = db.collection('fields').where('type', '==', 'CAMPO').stream()
for field in fields:
    print(f"Deletando quadra antiga: {field.id}")
    field.reference.delete()

# Criar novas quadras de Campo
for i in range(1, 3):
    field_data = {
        'locationId': jb_location_id,
        'name': f'Campo {i}',
        'type': 'CAMPO',
        'hourlyPrice': 180.0,
        'isActive': True,
        'photos': [],
        'surface': 'Grama natural',
        'isCovered': False,
        'dimensions': '105m x 68m',
        'createdAt': firestore.SERVER_TIMESTAMP
    }

    doc_ref = db.collection('fields').add(field_data)
    print(f"Campo {i} criado (ID: {doc_ref[1].id})")

print("\nQuadras de Campo corrigidas!\n")
