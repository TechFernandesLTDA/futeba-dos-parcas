import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {FUNCTION_REGION} from "../constants";

const db = () => admin.firestore();

/**
 * Callable ADMIN-only para popular a colecao official-groups
 * com os 11 grupos oficiais iniciais (regiao, dia, campo, faixa etaria).
 */
export const seedOfficialGroups = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: false,
  },
  async (request) => {
    if (request.auth?.token?.role !== "ADMIN") {
      throw new Error("Apenas administradores podem executar o seed.");
    }

    const officialGroups = [
      {
        name: "Peladeiros da Zona Sul",
        description: "Quem joga na Zona Sul de SP. Sociedade, futsal, campo — vale tudo!",
        category: "REGIAO",
        icon: "📍",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        name: "Peladeiros da Zona Norte",
        description: "Galera da ZN que não perde uma pelada. Bora fechar time!",
        category: "REGIAO",
        icon: "📍",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        name: "Peladeiros da Zona Leste",
        description: "Zona Leste raiz! Society, campo, onde tiver pelada, tem ZL.",
        category: "REGIAO",
        icon: "📍",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        name: "Peladeiros da Zona Oeste",
        description: "ZO na área! Bora dominar os campos e society da região.",
        category: "REGIAO",
        icon: "📍",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        name: "Quarta de Ouro",
        description: "O meio da semana é sagrado. Quarta é dia de pelada!",
        category: "DIA_SEMANA",
        icon: "🗓️",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        name: "Sabadão dos Parças",
        description: "Sábado é dia oficial dos parças. Pelada + resenha garantidos.",
        category: "DIA_SEMANA",
        icon: "🗓️",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        name: "Society Raiz",
        description: "Pra quem curte aquele society 7x7. Toque de bola e drible.",
        category: "TIPO_CAMPO",
        icon: "⚽",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        name: "Campo é Campo",
        description: "11 contra 11, gramado, chuteira society? Aqui não, é chuteira de trava!",
        category: "TIPO_CAMPO",
        icon: "⚽",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        name: "Futsal Nato",
        description: "Quadra, bola pesada, pivô e ala. Futsal raiz.",
        category: "TIPO_CAMPO",
        icon: "⚽",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        name: "Master 35+",
        description: "A idade chega mas a resenha continua. Pelada pra quem tem história.",
        category: "FAIXA_ETARIA",
        icon: "👴",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        name: "Sub-30 Crias",
        description: "Novinha, sangue novo. Energia e velocidade!",
        category: "FAIXA_ETARIA",
        icon: "⚡",
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
    ];

    const batch = db().batch();
    const added: string[] = [];

    for (const group of officialGroups) {
      const docRef = db().collection("official-groups").doc();
      batch.set(docRef, group);
      added.push(group.name);
    }

    await batch.commit();

    return {
      success: true,
      count: added.length,
      groups: added,
    };
  }
);
