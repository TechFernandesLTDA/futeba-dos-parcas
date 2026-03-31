"""Deleta um jogo especifico"""
import firebase_admin
from firebase_admin import credentials, firestore

try:
    firebase_admin.get_app()
except:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

game_id = "AtUQ4pdcTrPhflHNfume"

print(f"\nDeletando jogo {game_id}...")

# Deletar confirmacoes primeiro
confirmations = db.collection('games').document(game_id).collection('confirmations').stream()
for conf in confirmations:
    conf.reference.delete()

# Deletar o jogo
db.collection('games').document(game_id).delete()

print(f"Jogo {game_id} deletado com sucesso!\n")
