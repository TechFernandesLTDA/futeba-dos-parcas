"""Verifica quais locais precisam de enriquecimento (GPS, fotos)"""
import firebase_admin
from firebase_admin import credentials, firestore

try:
    firebase_admin.get_app()
except:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("\n" + "="*60)
print("VERIFICACAO DE ENRIQUECIMENTO")
print("="*60 + "\n")

locations = db.collection('locations').stream()

total = 0
sem_gps = 0
sem_foto = 0
sem_horario = 0

for loc in locations:
    data = loc.to_dict()
    total += 1

    has_gps = data.get('latitude') is not None and data.get('longitude') is not None
    has_photo = data.get('photo_url') is not None and data.get('photo_url') != ''
    has_hours = data.get('opening_time') is not None

    if not has_gps:
        sem_gps += 1
    if not has_photo:
        sem_foto += 1
    if not has_hours:
        sem_horario += 1

    if not (has_gps and has_photo and has_hours):
        print(f"Local: {data.get('name', 'SEM NOME')[:40]}")
        if not has_gps:
            print("  ! Falta GPS (lat/long)")
        if not has_photo:
            print("  ! Falta foto")
        if not has_horario:
            print("  ! Falta horario")
        print()

print("="*60)
print(f"Total de locais: {total}")
print(f"Sem GPS: {sem_gps}")
print(f"Sem foto: {sem_foto}")
print(f"Sem horario: {sem_horario}")

if sem_gps > 0 or sem_foto > 0 or sem_horario > 0:
    print("\nRecomendacao: Execute 'python scripts/enrich_locations.py'")
else:
    print("\nTodos os locais estao completos!")

print("="*60 + "\n")
