/**
 * Converte um objeto com campos em snake_case para camelCase.
 * Necessário porque o Firestore armazena campos em snake_case (padrão Android/Kotlin)
 * mas o frontend web usa camelCase (padrão TypeScript/React).
 *
 * IMPORTANTE - Resolução de colisão snake_case vs camelCase:
 * Se o documento contiver AMBOS `experience_points` (snake) e `experiencePoints` (camel),
 * o valor convertido do campo snake_case tem PRIORIDADE, pois é o campo canônico
 * atualizado pelas Cloud Functions. O campo camelCase é tratado como legado.
 * Iteramos primeiro os campos snake_case para que eles sobrescrevam os camelCase
 * duplicados que possam existir no documento.
 */
export function snakeToCamel<T = Record<string, unknown>>(obj: Record<string, unknown>): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null ? snakeToCamel(item as Record<string, unknown>) : item
    ) as unknown as T;
  }

  // Separar chaves snake_case das camelCase para processar snake_case por último,
  // garantindo que o valor convertido do campo canônico (snake) sobrescreva
  // qualquer campo camelCase duplicado/legado que exista no documento.
  const entries = Object.entries(obj);
  const isSnakeCase = (key: string) => key.includes('_');
  const camelEntries = entries.filter(([k]) => !isSnakeCase(k));
  const snakeEntries = entries.filter(([k]) => isSnakeCase(k));
  const orderedEntries = [...camelEntries, ...snakeEntries];

  const result: Record<string, unknown> = {};
  for (const [key, value] of orderedEntries) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    // Não converter recursivamente timestamps do Firestore (têm toDate())
    if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).toDate === 'function') {
      result[camelKey] = value;
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map((item) =>
        typeof item === 'object' && item !== null && !(item as Record<string, unknown>).toDate
          ? snakeToCamel(item as Record<string, unknown>)
          : item
      );
    } else if (value && typeof value === 'object' && !(value as Record<string, unknown>).toDate) {
      result[camelKey] = snakeToCamel(value as Record<string, unknown>);
    } else {
      result[camelKey] = value;
    }
  }
  return result as T;
}
