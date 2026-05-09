export interface GroupFormData {
  name: string;
  description: string;
  isPublic?: boolean;
}

export function validateGroupForm(data: GroupFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.name.trim()) {
    errors.name = 'Nome do grupo é obrigatório';
  } else if (data.name.length < 3) {
    errors.name = 'Nome deve ter pelo menos 3 caracteres';
  } else if (data.name.length > 50) {
    errors.name = 'Nome deve ter no máximo 50 caracteres';
  }

  if (data.description.length > 500) {
    errors.description = 'Descrição deve ter no máximo 500 caracteres';
  }

  return errors;
}
