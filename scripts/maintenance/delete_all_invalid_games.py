"""Deleta todos os jogos inválidos (sem local ou quadra)"""
import firebase_admin
from firebase_admin import credentials, firestore

try:
    firebase_admin.get_app()
except:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("\n" + "="*60)
print("DELETAR JOGOS INVALIDOS")
print("="*60 + "\n")

games = db.collection('games').stream()

deleted_count = 0

for game in games:
    data = game.to_dict()
    location_id = data.get('locationId', '')
    field_id = data.get('fieldId', '')
    owner_name = data.get('ownerName', '')

    # Se não tem local OU não tem quadra OU não tem owner, é inválido
    if not location_id or not field_id or not owner_name:
        print(f"Deletando jogo inválido: {game.id}")
        print(f"  Owner: {owner_name or 'SEM NOME'}")
        print(f"  Local: {location_id or 'SEM LOCAL'}")
        print(f"  Quadra: {field_id or 'SEM QUADRA'}")

        # Deletar confirmações primeiro
        confirmations = db.collection('games').document(game.id).collection('confirmations').stream()
        for conf in confirmations:
            conf.reference.delete()

        # Deletar o jogo
        db.collection('games').document(game.id).delete()
        deleted_count += 1
        print()

print("="*60)
print(f"Total de jogos inválidos deletados: {deleted_count}")
print("="*60 + "\n")
