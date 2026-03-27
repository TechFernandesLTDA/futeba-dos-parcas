/**
 * Converte um objeto com campos em snake_case para camelCase.
 * Necessário porque o Firestore armazena campos em snake_case (padrão Android/Kotlin)
 * mas o frontend web usa camelCase (padrão TypeScript/React).
 */
export function snakeToCamel<T = Record<string, any>>(obj: Record<string, any>): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null ? snakeToCamel(item) : item
    ) as unknown as T;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    // Não converter recursivamente timestamps do Firestore (têm toDate())
    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      result[camelKey] = value;
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map((item) =>
        typeof item === 'object' && item !== null && !item.toDate
          ? snakeToCamel(item)
          : item
      );
    } else if (value && typeof value === 'object' && !value.toDate) {
      result[camelKey] = snakeToCamel(value);
    } else {
      result[camelKey] = value;
    }
  }
  return result as T;
}
