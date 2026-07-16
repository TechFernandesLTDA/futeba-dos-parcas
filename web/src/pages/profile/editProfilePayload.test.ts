import { describe, expect, it } from 'vitest';
import { buildPublicProfileUpdate } from './editProfilePayload';

describe('buildPublicProfileUpdate', () => {
  it('envia somente campos públicos permitidos pelas Rules', () => {
    const payload = buildPublicProfileUpdate({
      nickname: 'craque',
      preferredPosition: 'MEIA',
      bio: 'Jogo às quartas.',
      favoriteTeam: 'corinthians',
      strikerRating: 4,
      midRating: 4.5,
      defenderRating: 3,
      gkRating: 1.5,
    }, 'Rubens G');

    expect(payload).toEqual({
      name: 'Rubens G',
      nickname: 'craque',
      preferred_position: 'MEIA',
      bio: 'Jogo às quartas.',
      favorite_team: 'corinthians',
      striker_rating: 4,
      mid_rating: 4.5,
      defender_rating: 3,
      gk_rating: 1.5,
      striker_rating_set: true,
      mid_rating_set: true,
      defender_rating_set: true,
      gk_rating_set: true,
    });
    expect(payload).not.toHaveProperty('updated_at');
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('gender');
  });

  it('normaliza campos opcionais ausentes para null, nunca undefined', () => {
    const payload = buildPublicProfileUpdate({
      nickname: '',
      bio: '',
      strikerRating: 0,
      midRating: 0,
      defenderRating: 0,
      gkRating: 0,
    }, 'Jogador Novo');

    expect(payload.preferred_position).toBeNull();
    expect(payload.favorite_team).toBeNull();
    expect(Object.values(payload)).not.toContain(undefined);
  });
});
