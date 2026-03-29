"""Cria um jogo de teste válido"""
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta

try:
    firebase_admin.get_app()
except:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("\n" + "="*60)
print("CRIAR JOGO DE TESTE")
print("="*60 + "\n")

# Pegar todas as quadras e pegar a primeira
fields = list(db.collection('fields').stream())
if not fields:
    print("ERRO: Nenhuma quadra encontrada!")
    exit(1)

field = fields[0]
field_data = field.to_dict()
field_id = field.id
location_id = field_data.get('locationId')

print(f"Quadra selecionada: {field_data.get('name')} (ID: {field_id})")
print(f"Location ID: {location_id}")

# Pegar o local
location = db.collection('locations').document(location_id).get()
if not location.exists:
    print("ERRO: Local não encontrado!")
    exit(1)

location_data = location.to_dict()
print(f"Local: {location_data.get('name')}")

# Pegar todos os usuários e pegar o primeiro
users = list(db.collection('users').stream())
if not users:
    print("ERRO: Nenhum usuário encontrado!")
    exit(1)

user = users[0]
user_data = user.to_dict()
user_id = user.id

print(f"Usuário: {user_data.get('name')}")

# Criar jogo para amanhã às 19h
tomorrow = datetime.now() + timedelta(days=1)
game_date = tomorrow.strftime('%Y-%m-%d')
game_time = "19:00"
game_end_time = "20:00"

game_data = {
    'date': game_date,
    'time': game_time,
    'endTime': game_end_time,
    'locationId': location_id,
    'fieldId': field_id,
    'locationName': location_data.get('name'),
    'locationAddress': location_data.get('address'),
    'locationLat': location_data.get('latitude'),
    'locationLng': location_data.get('longitude'),
    'fieldName': field_data.get('name'),
    'gameType': field_data.get('type'),
    'ownerName': user_data.get('name'),
    'ownerId': user_id,
    'dailyPrice': 60.0,
    'maxPlayers': 14,
    'maxGoalkeepers': 2,
    'confirmationCount': 0,
    'goalkeeperCount': 0,
    'recurrence': 'none',
    'status': 'SCHEDULED',
    'createdAt': firestore.SERVER_TIMESTAMP
}

print(f"\nCriando jogo:")
print(f"  Data: {game_date}")
print(f"  Horário: {game_time} - {game_end_time}")

doc_ref = db.collection('games').add(game_data)
game_id = doc_ref[1].id

print(f"\nJogo criado com sucesso!")
print(f"ID: {game_id}")
print("\n" + "="*60 + "\n")
