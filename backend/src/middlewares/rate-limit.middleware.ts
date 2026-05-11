import rateLimit from 'express-rate-limit';

// Limiter rigido para auth: 5 tentativas por IP a cada 15 min
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.',
  },
});

// Limiter geral para registro: 3 contas por IP por hora
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Limite de cadastros excedido. Tente novamente em 1 hora.',
  },
});

// Limiter geral para endpoints sensiveis (XP, financeiro, etc)
export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
