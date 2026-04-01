/**
 * Converte um objeto com campos em snake_case para camelCase.
 * Necessário porque o Firestore armazena campos em snake_case (padrão Android/Kotlin)
 * mas o frontend web usa camelCase (padrão TypeScript/React).
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

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
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
