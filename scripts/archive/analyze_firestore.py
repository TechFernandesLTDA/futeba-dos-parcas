"""
Script para analisar a estrutura completa do Firestore
Gera relatório detalhado de todas as collections e documentos
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from collections import defaultdict
import json

# Inicializar Firebase Admin
cred = credentials.Certificate('scripts/serviceAccountKey.json')
firebase_admin.initialize_app(cred)

db = firestore.client()

def analyze_collection(collection_name):
    """Analisa uma collection específica"""
    print(f"\n{'='*60}")
    print(f"📂 COLLECTION: {collection_name}")
    print(f"{'='*60}")
    
    try:
        docs = db.collection(collection_name).stream()
        docs_list = list(docs)
        
        if not docs_list:
            print(f"⚠️  Collection vazia ou não existe")
            return
        
        print(f"✅ Total de documentos: {len(docs_list)}")
        
        # Analisar campos
        all_fields = set()
        field_types = defaultdict(set)
        sample_data = {}
        
        for doc in docs_list:
            data = doc.to_dict()
            if not sample_data:
                sample_data = data
            
            for field, value in data.items():
                all_fields.add(field)
                field_types[field].add(type(value).__name__)
        
        # Mostrar campos
        print(f"\n📝 Campos encontrados ({len(all_fields)}):")
        for field in sorted(all_fields):
            types = ', '.join(field_types[field])
            print(f"   • {field}: {types}")
        
        # Estatísticas específicas por collection
        print(f"\n📊 Estatísticas:")
        
        if collection_name == "users":
            roles = defaultdict(int)
            mock_count = 0
            for doc in docs_list:
                data = doc.to_dict()
                role = data.get('role', 'UNKNOWN')
                roles[role] += 1
                if data.get('isMock') or doc.id.startswith('mock_'):
                    mock_count += 1
            
            print(f"   Por Role:")
            for role, count in roles.items():
                print(f"      • {role}: {count}")
            print(f"   Usuários Mock: {mock_count}")
        
        elif collection_name == "locations":
            active = sum(1 for doc in docs_list if doc.to_dict().get('is_active', False))
            verified = sum(1 for doc in docs_list if doc.to_dict().get('is_verified', False))
            print(f"   Locais Ativos: {active}/{len(docs_list)}")
            print(f"   Locais Verificados: {verified}/{len(docs_list)}")
            
            # Verificar quantos locais têm quadras
            locations_with_fields = 0
            total_fields = 0
            for doc in docs_list:
                fields = db.collection('fields').where('location_id', '==', doc.id).stream()
                field_count = len(list(fields))
                if field_count > 0:
                    locations_with_fields += 1
                    total_fields += field_count
            
            print(f"   Locais com Quadras: {locations_with_fields}/{len(docs_list)}")
            print(f"   Total de Quadras: {total_fields}")
            print(f"   ⚠️  Locais SEM quadras: {len(docs_list) - locations_with_fields}")
        
        elif collection_name == "fields":
            active = sum(1 for doc in docs_list if doc.to_dict().get('is_active', False))
            types = defaultdict(int)
            for doc in docs_list:
                field_type = doc.to_dict().get('type', 'UNKNOWN')
                types[field_type] += 1
            
            print(f"   Quadras Ativas: {active}/{len(docs_list)}")
            print(f"   Por Tipo:")
            for ftype, count in types.items():
                print(f"      • {ftype}: {count}")
        
        elif collection_name == "games":
            statuses = defaultdict(int)
            for doc in docs_list:
                status = doc.to_dict().get('status', 'UNKNOWN')
                statuses[status] += 1
            
            print(f"   Por Status:")
            for status, count in statuses.items():
                print(f"      • {status}: {count}")
        
        elif collection_name == "confirmations":
            statuses = defaultdict(int)
            goalkeepers = 0
            for doc in docs_list:
                data = doc.to_dict()
                status = data.get('status', 'UNKNOWN')
                statuses[status] += 1
                if data.get('is_goalkeeper'):
                    goalkeepers += 1
            
            print(f"   Por Status:")
            for status, count in statuses.items():
                print(f"      • {status}: {count}")
            print(f"   Confirmações como Goleiro: {goalkeepers}")
        
        # Mostrar exemplo de documento
        if sample_data:
            print(f"\n📄 Exemplo de documento:")
            print(json.dumps(sample_data, indent=2, default=str)[:500] + "...")
        
    except Exception as e:
        print(f"❌ Erro ao analisar collection: {e}")

def main():
    print("\n" + "="*60)
    print("🔍 ANÁLISE COMPLETA DO FIRESTORE")
    print(f"Projeto: futebadosparcas")
    print(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    # Collections principais
    collections = [
        "users",
        "locations",
        "fields",
        "games",
        "confirmations",
        "teams",
        "statistics",
        "player_stats",
        "live_games",
        "notifications"
    ]
    
    # Analisar cada collection
    for collection_name in collections:
        analyze_collection(collection_name)
    
    # Resumo final
    print(f"\n{'='*60}")
    print("📈 RESUMO GERAL")
    print(f"{'='*60}")
    
    total_docs = 0
    existing_collections = 0
    
    for collection_name in collections:
        try:
            docs = list(db.collection(collection_name).stream())
            count = len(docs)
            total_docs += count
            if count > 0:
                existing_collections += 1
            status = "✅" if count > 0 else "⚠️ "
            print(f"{status} {collection_name}: {count} documentos")
        except:
            print(f"❌ {collection_name}: Erro ao acessar")
    
    print(f"\nTotal de Collections: {len(collections)}")
    print(f"Collections com Dados: {existing_collections}")
    print(f"Total de Documentos: {total_docs}")
    
    print(f"\n{'='*60}")
    print("✅ Análise concluída!")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
