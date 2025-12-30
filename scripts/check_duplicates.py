"""
Script para verificar e remover locais duplicados no Firestore
"""

import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict

# Inicializar Firebase Admin
try:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
except:
    pass  # Já inicializado

db = firestore.client()

def find_duplicates():
    """Encontra locais duplicados por nome"""
    print("\n" + "="*60)
    print("🔍 VERIFICANDO DUPLICATAS")
    print("="*60 + "\n")
    
    locations = db.collection('locations').stream()
    
    # Agrupar por nome
    locations_by_name = defaultdict(list)
    
    for loc in locations:
        data = loc.to_dict()
        name = data.get('name', '').strip().lower()
        locations_by_name[name].append({
            'id': loc.id,
            'name': data.get('name'),
            'address': data.get('address'),
            'neighborhood': data.get('neighborhood'),
            'created_at': data.get('created_at')
        })
    
    # Encontrar duplicatas
    duplicates = {name: locs for name, locs in locations_by_name.items() if len(locs) > 1}
    
    if not duplicates:
        print("✅ Nenhuma duplicata encontrada!")
        return []
    
    print(f"⚠️  Encontradas {len(duplicates)} duplicatas:\n")
    
    for name, locs in duplicates.items():
        print(f"📍 {locs[0]['name']} ({len(locs)} cópias):")
        for i, loc in enumerate(locs, 1):
            created = loc.get('created_at')
            created_str = created.strftime('%Y-%m-%d %H:%M:%S') if created else 'Sem data'
            print(f"   {i}. ID: {loc['id'][:20]}... | {loc['address']} | Criado: {created_str}")
        print()
    
    return duplicates

def remove_duplicates(duplicates, keep_strategy='newest'):
    """
    Remove duplicatas mantendo apenas uma cópia
    keep_strategy: 'newest' (mais recente) ou 'oldest' (mais antigo)
    """
    print("\n" + "="*60)
    print("🗑️  REMOVENDO DUPLICATAS")
    print(f"Estratégia: Manter o {keep_strategy}")
    print("="*60 + "\n")
    
    total_removed = 0
    total_fields_moved = 0
    
    for name, locs in duplicates.items():
        # Ordenar por data de criação (tratar None)
        def get_timestamp(loc):
            created = loc.get('created_at')
            if created is None:
                return 0  # Colocar no início se não tem data
            try:
                return created.timestamp()
            except:
                return 0
        
        sorted_locs = sorted(locs, key=get_timestamp)
        
        # Escolher qual manter
        if keep_strategy == 'newest':
            keep_loc = sorted_locs[-1]  # Mais recente
            remove_locs = sorted_locs[:-1]
        else:
            keep_loc = sorted_locs[0]  # Mais antigo
            remove_locs = sorted_locs[1:]
        
        print(f"📍 {keep_loc['name']}:")
        print(f"   ✅ Mantendo: {keep_loc['id'][:20]}...")
        
        # Para cada local a ser removido
        for loc in remove_locs:
            # Buscar quadras associadas
            fields = db.collection('fields').where('location_id', '==', loc['id']).stream()
            fields_list = list(fields)
            
            if fields_list:
                print(f"   📦 Movendo {len(fields_list)} quadra(s) de {loc['id'][:20]}... para {keep_loc['id'][:20]}...")
                
                # Mover quadras para o local que será mantido
                for field in fields_list:
                    field_ref = db.collection('fields').document(field.id)
                    field_ref.update({'location_id': keep_loc['id']})
                    total_fields_moved += 1
            
            # Deletar o local duplicado
            db.collection('locations').document(loc['id']).delete()
            print(f"   🗑️  Removido: {loc['id'][:20]}...")
            total_removed += 1
        
        print()
    
    print(f"{'='*60}")
    print(f"✅ Limpeza concluída!")
    print(f"{'='*60}")
    print(f"Locais removidos: {total_removed}")
    print(f"Quadras movidas: {total_fields_moved}")
    print(f"{'='*60}\n")

def list_all_locations():
    """Lista todos os locais únicos"""
    print("\n" + "="*60)
    print("📋 LISTA DE TODOS OS LOCAIS (SEM DUPLICATAS)")
    print("="*60 + "\n")
    
    locations = db.collection('locations').stream()
    
    # Agrupar por nome para contar
    locations_by_name = defaultdict(list)
    
    for loc in locations:
        data = loc.to_dict()
        name = data.get('name', '').strip()
        locations_by_name[name].append({
            'id': loc.id,
            'address': data.get('address'),
            'neighborhood': data.get('neighborhood'),
        })
    
    # Ordenar alfabeticamente
    sorted_names = sorted(locations_by_name.keys())
    
    for i, name in enumerate(sorted_names, 1):
        locs = locations_by_name[name]
        loc = locs[0]  # Pegar o primeiro
        
        # Contar quadras
        fields = db.collection('fields').where('location_id', '==', loc['id']).stream()
        field_count = len(list(fields))
        
        status = "✅" if field_count > 0 else "⚠️ "
        print(f"{i:2d}. {status} {name}")
        print(f"     📍 {loc['address']}, {loc['neighborhood']}")
        print(f"     🏟️  {field_count} quadra(s)")
        
        if len(locs) > 1:
            print(f"     ⚠️  {len(locs)} duplicatas!")
        print()
    
    print(f"{'='*60}")
    print(f"Total de locais únicos: {len(locations_by_name)}")
    print(f"{'='*60}\n")

def main():
    # 1. Listar todos os locais
    list_all_locations()
    
    # 2. Verificar duplicatas
    duplicates = find_duplicates()
    
    # 3. Se houver duplicatas, perguntar se quer remover
    if duplicates:
        print("\n⚠️  ATENÇÃO: Duplicatas encontradas!")
        print("Deseja remover as duplicatas? (s/n): ", end='')
        
        # Para execução automática, vamos remover
        response = 's'  # Pode mudar para input() se quiser confirmação manual
        
        if response.lower() == 's':
            remove_duplicates(duplicates, keep_strategy='newest')
            
            # Listar novamente após limpeza
            print("\n" + "="*60)
            print("📋 VERIFICAÇÃO FINAL")
            print("="*60)
            list_all_locations()
        else:
            print("❌ Operação cancelada.")
    else:
        print("✅ Banco de dados limpo! Nenhuma ação necessária.")

if __name__ == "__main__":
    main()
