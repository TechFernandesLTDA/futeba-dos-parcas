import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { ApiResponse } from '../utils/api-response';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.error(res, 'Erro de validação', 400, errors.array());
      return;
    }

    next();
  };
};

// Validações de Autenticação
export const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter no mínimo 6 caracteres'),
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Nome deve ter no mínimo 2 caracteres'),
  body('phone')
    .optional()
    .isMobilePhone('pt-BR')
    .withMessage('Telefone inválido'),
  body('preferred_field_type')
    .optional()
    .isIn(['society', 'campo', 'futebol'])
    .withMessage('Tipo de campo inválido'),
];

export const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória'),
];

// Validações de UUID
export const uuidParamValidation = (paramName: string) => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} deve ser um UUID válido`),
];

// Validações de Schedule
export const createScheduleValidation = [
  body('field_id')
    .isUUID()
    .withMessage('field_id deve ser um UUID válido'),
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Nome deve ter no mínimo 2 caracteres'),
  body('recurrence_type')
    .isIn(['daily', 'weekly', 'custom'])
    .withMessage('Tipo de recorrência inválido'),
  body('time')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Horário deve estar no formato HH:MM'),
  body('duration')
    .isInt({ min: 30, max: 180 })
    .withMessage('Duração deve ser entre 30 e 180 minutos'),
  body('max_players')
    .optional()
    .isInt({ min: 2, max: 30 })
    .withMessage('Máximo de jogadores deve ser entre 2 e 30'),
  body('daily_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Valor diário deve ser positivo'),
  body('monthly_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Valor mensal deve ser positivo'),
];

// Validações de Game Stats
export const submitStatsValidation = [
  body('player_stats')
    .isArray({ min: 1 })
    .withMessage('Deve haver pelo menos 1 jogador'),
  body('player_stats.*.user_id')
    .isUUID()
    .withMessage('user_id deve ser um UUID válido'),
  body('player_stats.*.goals')
    .isInt({ min: 0 })
    .withMessage('Gols deve ser um número positivo'),
  body('player_stats.*.saves')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Defesas deve ser um número positivo'),
];
