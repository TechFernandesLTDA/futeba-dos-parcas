"""Script simples para analisar Firestore sem emojis"""
import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict

# Inicializar Firebase
cred = credentials.Certificate('scripts/serviceAccountKey.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

print("\n" + "="*60)
print("ANALISE FIRESTORE - Futeba dos Parcas")
print("="*60 + "\n")

collections = [
    "users", "locations", "fields", "games",
    "confirmations", "teams", "statistics",
    "player_stats", "live_games", "notifications"
]

total_docs = 0
print("RESUMO POR COLLECTION:\n")

for coll_name in collections:
    try:
        docs = list(db.collection(coll_name).stream())
        count = len(docs)
        total_docs += count

        status = "OK" if count > 0 else "VAZIO"
        print(f"[{status:6}] {coll_name:20} {count:4} documentos")

        # Detalhes especificos
        if coll_name == "locations" and count > 0:
            # Verificar quantos tem quadras
            locs_with_fields = 0
            total_fields = 0
            for doc in docs:
                fields = db.collection('fields').where('location_id', '==', doc.id).stream()
                field_count = len(list(fields))
                if field_count > 0:
                    locs_with_fields += 1
                    total_fields += field_count

            print(f"         - Com quadras: {locs_with_fields}/{count}")
            print(f"         - Total quadras: {total_fields}")
            if locs_with_fields < count:
                print(f"         ! {count - locs_with_fields} locais SEM quadras")

        elif coll_name == "users" and count > 0:
            roles = defaultdict(int)
            mock_count = 0
            for doc in docs:
                data = doc.to_dict()
                role = data.get('role', 'UNKNOWN')
                roles[role] += 1
                if data.get('isMock') or doc.id.startswith('mock_'):
                    mock_count += 1

            for role, cnt in roles.items():
                print(f"         - {role}: {cnt}")
            print(f"         - Mock: {mock_count}")

        elif coll_name == "games" and count > 0:
            statuses = defaultdict(int)
            for doc in docs:
                status = doc.to_dict().get('status', 'UNKNOWN')
                statuses[status] += 1

            for st, cnt in statuses.items():
                print(f"         - {st}: {cnt}")

    except Exception as e:
        print(f"[ERRO  ] {coll_name:20} {str(e)[:40]}")

print("\n" + "="*60)
print(f"TOTAL: {total_docs} documentos")
print("="*60 + "\n")
