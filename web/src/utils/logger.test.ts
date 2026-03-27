import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, logger } from './logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logger.warn chama console.warn', () => {
    logger.warn('aviso teste');
    expect(console.warn).toHaveBeenCalled();
  });

  it('logger.error chama console.error', () => {
    logger.error('erro teste');
    expect(console.error).toHaveBeenCalled();
  });

  it('createLogger adiciona contexto', () => {
    const log = createLogger('AuthContext');
    log.error('falha no login');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[AuthContext]'),
      expect.anything()
    );
  });

  it('createLogger aceita dados estruturados', () => {
    const log = createLogger('Games');
    log.warn('query lenta', { duration: 5000 });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Games]'),
      expect.objectContaining({ duration: 5000 })
    );
  });
});
