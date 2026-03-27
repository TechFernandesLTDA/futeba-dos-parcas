/**
 * Converte um objeto com campos em camelCase para snake_case.
 * Inverso de snakeToCamel — usado para enviar dados do frontend (camelCase)
 * ao Firestore (snake_case, padrão Android/Kotlin).
 */
export function camelToSnake<T = Record<string, any>>(obj: Record<string, any>): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null ? camelToSnake(item) : item
    ) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      // Preservar timestamps do Firestore
      result[snakeKey] = value;
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map((item) =>
        typeof item === 'object' && item !== null && !item?.toDate
          ? camelToSnake(item)
          : item
      );
    } else if (value instanceof Date) {
      result[snakeKey] = value;
    } else if (value && typeof value === 'object') {
      result[snakeKey] = camelToSnake(value);
    } else {
      result[snakeKey] = value;
    }
  }
  return result as T;
}
