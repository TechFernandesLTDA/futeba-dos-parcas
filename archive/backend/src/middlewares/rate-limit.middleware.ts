import rateLimit from 'express-rate-limit';

// Limiter rigido para auth: 5 tentativas por IP a cada 15 min.
// skipSuccessfulRequests: conta apenas falhas, evitando penalizar
// usuários legítimos que ocasionalmente erram a senha.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.',
  },
});

// Limiter geral para registro: 3 contas por IP por hora.
// TODO: usar Redis store antes de escalar horizontalmente (store padrão é in-memory).
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Limite de cadastros excedido. Tente novamente em 1 hora.',
  },
});
