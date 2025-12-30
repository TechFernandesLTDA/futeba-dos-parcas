"""Remove quadras órfãs (sem locationId válido)"""
import firebase_admin
from firebase_admin import credentials, firestore

try:
    firebase_admin.get_app()
except:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("\n" + "="*60)
print("CORRIGIR QUADRAS ORFAS")
print("="*60 + "\n")

fields = db.collection('fields').stream()

deleted = 0
kept = 0

for field in fields:
    field_data = field.to_dict()
    location_id = field_data.get('locationId')

    if not location_id or location_id == 'None':
        print(f"Deletando quadra órfã: {field_data.get('name')} (ID: {field.id})")
        field.reference.delete()
        deleted += 1
    else:
        # Verificar se o location existe
        loc = db.collection('locations').document(location_id).get()
        if not loc.exists:
            print(f"Deletando quadra com location inválido: {field_data.get('name')} (location_id: {location_id})")
            field.reference.delete()
            deleted += 1
        else:
            kept += 1

print(f"\n{deleted} quadras órfãs deletadas")
print(f"{kept} quadras válidas mantidas")
print("\n" + "="*60 + "\n")
