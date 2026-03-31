"""Cria temporada ativa e badges no Firestore"""
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
print("CRIAR TEMPORADA ATIVA E BADGES")
print("="*60 + "\n")

# Criar temporada ativa (Q4 2025)
season_data = {
    'name': 'Temporada Q4 2025',
    'startDate': '2025-10-01',
    'endDate': '2025-12-31',
    'isActive': True,
    'pointsPerGame': 10,
    'pointsPerGoal': 3,
    'pointsPerAssist': 2,
    'pointsPerCleanSheet': 5,
    'promotionThreshold': 100,
    'relegationThreshold': 30,
    'createdAt': firestore.SERVER_TIMESTAMP
}

season_ref = db.collection('seasons').add(season_data)
season_id = season_ref[1].id

print(f"Temporada criada: {season_data['name']}")
print(f"ID: {season_id}\n")

# Criar badges
badges = [
    {
        'id': 'hat_trick',
        'name': 'Hat-Trick',
        'description': 'Marque 3 gols em uma partida',
        'type': 'HAT_TRICK',
        'rarity': 'EPIC',
        'iconUrl': '',
        'requirement': 3
    },
    {
        'id': 'paredao',
        'name': 'Paredao',
        'description': 'Nao tome gols em uma partida como goleiro',
        'type': 'PAREDAO',
        'rarity': 'RARE',
        'iconUrl': '',
        'requirement': 1
    },
    {
        'id': 'fominha',
        'name': 'Fominha',
        'description': 'Participe de 5 jogos',
        'type': 'FOMINHA',
        'rarity': 'COMMON',
        'iconUrl': '',
        'requirement': 5
    },
    {
        'id': 'streak_7',
        'name': 'Sequencia 7 dias',
        'description': 'Jogue por 7 dias consecutivos',
        'type': 'STREAK_7',
        'rarity': 'RARE',
        'iconUrl': '',
        'requirement': 7
    },
    {
        'id': 'artilheiro_mes',
        'name': 'Artilheiro do Mes',
        'description': 'Seja o maior artilheiro do mes',
        'type': 'ARTILHEIRO_MES',
        'rarity': 'LEGENDARY',
        'iconUrl': '',
        'requirement': 1
    },
    {
        'id': 'organizador_master',
        'name': 'Organizador Master',
        'description': 'Organize 10 jogos',
        'type': 'ORGANIZADOR_MASTER',
        'rarity': 'EPIC',
        'iconUrl': '',
        'requirement': 10
    },
    {
        'id': 'lenda',
        'name': 'Lenda',
        'description': 'Alcance nivel 50',
        'type': 'LENDA',
        'rarity': 'LEGENDARY',
        'iconUrl': '',
        'requirement': 50
    }
]

print("Criando badges...")
for badge in badges:
    doc_ref = db.collection('badges').document(badge['id'])
    doc_ref.set(badge)
    print(f"  - {badge['name']} ({badge['rarity']})")

print(f"\n{len(badges)} badges criadas!")

# Criar participacao para o usuario
users = list(db.collection('users').stream())
if users:
    user_id = users[0].id
    participation_data = {
        'seasonId': season_id,
        'userId': user_id,
        'points': 45,
        'division': 'BRONZE',
        'gamesPlayed': 4,
        'goalsScored': 8,
        'assists': 5,
        'cleanSheets': 1,
        'mvpCount': 0,
        'joinedAt': firestore.SERVER_TIMESTAMP
    }

    db.collection('season_participations').add(participation_data)
    print(f"\nParticipacao criada para usuario {user_id}")
    print(f"Pontos: {participation_data['points']}")
    print(f"Divisao: {participation_data['division']}")

print("\n" + "="*60 + "\n")
