"""
Script para popular o Firestore com dados REAIS de locais e quadras de Curitiba
Baseado em informações reais fornecidas pelo usuário
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Inicializar Firebase Admin
try:
    cred = credentials.Certificate('scripts/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
except:
    pass  # Já inicializado

db = firestore.client()

# Dados reais dos locais
LOCAIS_CURITIBA = [
    {
        "name": "JB Esportes & Eventos",
        "address": "Rua João Bettega, 3173",
        "neighborhood": "Portão",
        "city": "Curitiba",
        "state": "PR",
        "phone": "(41) 99290-2962",
        "description": "Um dos maiores e mais tradicionais da cidade. Complexo esportivo completo.",
        "amenities": ["Vestiários completos", "Estacionamento", "Bar/Lanchonete", "Iluminação profissional"],
        "fields": [
            {"name": "Quadra Futsal 1", "type": "FUTSAL", "surface": "Madeira", "is_covered": True, "price": 150.0},
            {"name": "Quadra Futsal 2", "type": "FUTSAL", "surface": "Madeira", "is_covered": True, "price": 150.0},
            {"name": "Quadra Futsal 3", "type": "FUTSAL", "surface": "Madeira", "is_covered": True, "price": 150.0},
            {"name": "Quadra Futsal 4", "type": "FUTSAL", "surface": "Madeira", "is_covered": True, "price": 150.0},
            {"name": "Quadra Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": True, "price": 200.0},
            {"name": "Quadra Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": True, "price": 200.0},
            {"name": "Quadra Society 3", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 180.0},
            {"name": "Quadra Society 4", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 180.0},
        ]
    },
    {
        "name": "Brasil Soccer",
        "address": "Rua João Bettega, 1250",
        "neighborhood": "Portão",
        "city": "Curitiba",
        "state": "PR",
        "phone": "(41) 98403-9747",
        "description": "Centro de futebol society. Muito usado para eventos e pós-jogo.",
        "amenities": ["Restaurante", "Churrasqueiras", "Estacionamento amplo", "Vestiários"],
        "fields": [
            {"name": "Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 180.0},
            {"name": "Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 180.0},
            {"name": "Society 3", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 180.0},
            {"name": "Society 4", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 180.0},
            {"name": "Society 5", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 180.0},
        ]
    },
    {
        "name": "Top Sports Centro Esportivo",
        "address": "Rua João Bettega, 2709",
        "neighborhood": "Portão",
        "city": "Curitiba",
        "state": "PR",
        "phone": "(41) 3346-1117",
        "description": "Local clássico na João Bettega. Centro esportivo completo.",
        "amenities": ["Vestiários", "Iluminação", "Espaço de convivência"],
        "fields": [
            {"name": "Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
            {"name": "Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
            {"name": "Society 3", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
            {"name": "Society 4", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
            {"name": "Society 5", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
            {"name": "Society 6", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
        ]
    },
    {
        "name": "Meia Alta Society",
        "address": "Rua Nossa Senhora da Cabeça, 1845",
        "neighborhood": "CIC",
        "city": "Curitiba",
        "state": "PR",
        "phone": "(41) 98522-9744",
        "description": "Futebol society com foco em jogos noturnos e mensalistas.",
        "amenities": ["Iluminação", "Área externa"],
        "fields": [
            {"name": "Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 160.0},
            {"name": "Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 160.0},
            {"name": "Society 3", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 160.0},
        ]
    },
    {
        "name": "Premium Esportes e Eventos",
        "address": "Rua Renato Polatti, 2535",
        "neighborhood": "Campo Comprido",
        "city": "Curitiba",
        "state": "PR",
        "phone": "(41) 98754-8314",
        "description": "Centro esportivo para grupos fixos e campeonatos amadores.",
        "amenities": ["Vestiários", "Estacionamento", "Iluminação"],
        "fields": [
            {"name": "Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
            {"name": "Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
            {"name": "Society 3", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
            {"name": "Society 4", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
        ]
    },
    {
        "name": "Arena Amigos da Bola",
        "address": "Rua Estados Unidos, 2851",
        "neighborhood": "Boa Vista",
        "city": "Curitiba",
        "state": "PR",
        "phone": "(41) 99272-6241",
        "description": "Arena de lazer com foco em grupos fixos e confraternizações.",
        "amenities": ["Bar", "Churrasqueiras", "Vestiários", "Estacionamento"],
        "fields": [
            {"name": "Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 180.0},
            {"name": "Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 180.0},
        ]
    },
    {
        "name": "Eco Soccer",
        "address": "Rua Nilo Peçanha, 2575",
        "neighborhood": "Pilarzinho",
        "city": "Curitiba",
        "state": "PR",
        "phone": "(41) 99671-8900",
        "description": "Futebol society para jogadores de bairro e mensalistas.",
        "amenities": ["Iluminação", "Vestiários"],
        "fields": [
            {"name": "Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 150.0},
            {"name": "Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 150.0},
            {"name": "Society 3", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 150.0},
        ]
    },
    {
        "name": "Gol de Placa Society",
        "address": "Boa Vista",
        "neighborhood": "Boa Vista",
        "city": "Curitiba",
        "state": "PR",
        "description": "Futebol society para jogos rápidos.",
        "amenities": ["Iluminação"],
        "fields": [
            {"name": "Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 140.0},
            {"name": "Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 140.0},
        ]
    },
    {
        "name": "Copacabana Sports",
        "address": "Rua Antônio Simm, 809",
        "neighborhood": "Capão da Imbuia",
        "city": "Curitiba",
        "state": "PR",
        "phone": "(41) 98825-4162",
        "description": "Centro esportivo com alto nível de avaliação.",
        "amenities": ["Vestiários", "Iluminação", "Espaço de convivência"],
        "fields": [
            {"name": "Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
            {"name": "Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
            {"name": "Society 3", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 170.0},
        ]
    },
    {
        "name": "Duga Sports",
        "address": "Rua Dr. Joaquim Ignácio Silveira da Motta, 1211",
        "neighborhood": "Uberaba",
        "city": "Curitiba",
        "state": "PR",
        "phone": "(41) 3359-9577",
        "description": "Arena esportiva com pós-jogo forte.",
        "amenities": ["Bar", "Churrasqueira", "Estacionamento"],
        "fields": [
            {"name": "Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 160.0},
            {"name": "Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 160.0},
        ]
    },
    {
        "name": "Goleadores Futebol Society",
        "address": "Av. Senador Salgado Filho, 1690",
        "neighborhood": "Uberaba",
        "city": "Curitiba",
        "state": "PR",
        "phone": "(41) 98422-6729",
        "description": "Futebol society com alta rotatividade de jogos.",
        "amenities": ["Iluminação", "Área ampla"],
        "fields": [
            {"name": "Society 1", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 150.0},
            {"name": "Society 2", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 150.0},
            {"name": "Society 3", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 150.0},
            {"name": "Society 4", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 150.0},
            {"name": "Society 5", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 150.0},
            {"name": "Society 6", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 150.0},
            {"name": "Society 7", "type": "SOCIETY", "surface": "Grama Sintética", "is_covered": False, "price": 150.0},
        ]
    },
    {
        "name": "Quadra do Batel",
        "address": "Batel",
        "neighborhood": "Batel",
        "city": "Curitiba",
        "state": "PR",
        "description": "Quadra urbana de futsal.",
        "amenities": ["Iluminação"],
        "fields": [
            {"name": "Quadra Futsal", "type": "FUTSAL", "surface": "Taco", "is_covered": False, "price": 120.0},
        ]
    },
]

def populate_firestore():
    """Popula o Firestore com dados reais"""
    print("\n" + "="*60)
    print("🔥 POPULANDO FIRESTORE COM DADOS REAIS")
    print("="*60 + "\n")
    
    total_locations = 0
    total_fields = 0
    
    # ID do admin/owner padrão (pode ser ajustado)
    default_owner_id = "mock_admin"
    
    for local_data in LOCAIS_CURITIBA:
        try:
            # Criar documento do local
            location_ref = db.collection('locations').document()
            
            location = {
                'name': local_data['name'],
                'address': local_data['address'],
                'city': local_data.get('city', 'Curitiba'),
                'state': local_data.get('state', 'PR'),
                'neighborhood': local_data.get('neighborhood', ''),
                'region': '',  # Pode ser preenchido depois
                'owner_id': default_owner_id,
                'is_verified': True,
                'is_active': True,
                'rating': 4.5,
                'rating_count': 0,
                'description': local_data.get('description', ''),
                'amenities': local_data.get('amenities', []),
                'phone': local_data.get('phone', ''),
                'opening_time': '08:00',
                'closing_time': '23:00',
                'operating_days': [1, 2, 3, 4, 5, 6, 7],
                'min_game_duration_minutes': 60,
                'created_at': firestore.SERVER_TIMESTAMP
            }
            
            location_ref.set(location)
            total_locations += 1
            
            print(f"✅ Local criado: {local_data['name']}")
            
            # Criar quadras do local
            for field_data in local_data.get('fields', []):
                field_ref = db.collection('fields').document()
                
                field = {
                    'location_id': location_ref.id,
                    'name': field_data['name'],
                    'type': field_data['type'],
                    'surface': field_data.get('surface', 'Grama Sintética'),
                    'is_covered': field_data.get('is_covered', False),
                    'hourly_price': field_data.get('price', 150.0),
                    'is_active': True,
                    'photos': [],
                    'dimensions': '50x30m' if field_data['type'] == 'SOCIETY' else '40x20m'
                }
                
                field_ref.set(field)
                total_fields += 1
            
            print(f"   📍 {len(local_data.get('fields', []))} quadra(s) criada(s)")
            
        except Exception as e:
            print(f"❌ Erro ao criar {local_data['name']}: {e}")
    
    print(f"\n{'='*60}")
    print(f"✅ POPULAÇÃO CONCLUÍDA!")
    print(f"{'='*60}")
    print(f"Total de Locais: {total_locations}")
    print(f"Total de Quadras: {total_fields}")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    populate_firestore()
