"""Verifica detalhes de um jogo especifico"""
import firebase_admin
from firebase_admin import credentials, firestore
import sys

try:
    firebase_admin.get_app()
except:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("\n" + "="*60)
print("VERIFICAR JOGO")
print("="*60 + "\n")

# Listar todos os jogos
games = db.collection('games').stream()

print("JOGOS CADASTRADOS:\n")
for game in games:
    data = game.to_dict()
    print(f"ID: {game.id}")
    print(f"  Owner: {data.get('ownerName', 'SEM NOME')}")
    print(f"  Data: {data.get('date', 'SEM DATA')}")
    print(f"  Hora: {data.get('time', 'SEM HORA')}")
    print(f"  Status: {data.get('status', 'SEM STATUS')}")
    print(f"  Location ID: {data.get('locationId', 'SEM LOCAL')}")
    print(f"  Field ID: {data.get('fieldId', 'SEM QUADRA')}")

    # Pegar nome do local
    location_id = data.get('locationId')
    if location_id:
        location = db.collection('locations').document(location_id).get()
        if location.exists:
            print(f"  Local: {location.to_dict().get('name')}")

    # Contar confirmacoes
    confirmations = db.collection('games').document(game.id).collection('confirmations').stream()
    count = len(list(confirmations))
    print(f"  Confirmacoes: {count}")
    print()

print("="*60 + "\n")
