/**
 * Converte um objeto com campos em camelCase para snake_case.
 * Inverso de snakeToCamel — usado para enviar dados do frontend (camelCase)
 * ao Firestore (snake_case, padrão Android/Kotlin).
 */
export function camelToSnake<T = Record<string, unknown>>(obj: Record<string, unknown>): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null ? camelToSnake(item as Record<string, unknown>) : item
    ) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

    if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).toDate === 'function') {
      // Preservar timestamps do Firestore
      result[snakeKey] = value;
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map((item) =>
        typeof item === 'object' && item !== null && !(item as Record<string, unknown>)?.toDate
          ? camelToSnake(item as Record<string, unknown>)
          : item
      );
    } else if (value instanceof Date) {
      result[snakeKey] = value;
    } else if (value && typeof value === 'object') {
      result[snakeKey] = camelToSnake(value as Record<string, unknown>);
    } else {
      result[snakeKey] = value;
    }
  }
  return result as T;
}
