import { describe, expect, it } from 'vitest';
import {
  buildVenueSearchIndex,
  filterVenuesByQuery,
  getVenueSearchFields,
  locationMatchesVenueQuery,
  matchesVenueIndex,
  matchesVenueQuery,
  normalizeVenueText,
  tokenizeVenueQuery,
  withinOneEdit,
} from './venueSearch';
import type { Location } from '../types/location';

const arena = {
  name: 'Arena São João Society',
  neighborhood: 'Jardim Botânico',
  address: 'Rua Mateus Leme, 1200',
  city: 'Curitiba',
  state: 'PR',
  cep: '80010-000',
  fieldType: 'SOCIETY',
} as Partial<Location>;

describe('normalizeVenueText', () => {
  it('remove acento, caixa e pontuação', () => {
    expect(normalizeVenueText('  São JOÃO — Jd. Botânico!  ')).toBe('sao joao jd botanico');
  });

  it('aceita números, null e undefined', () => {
    expect(normalizeVenueText(1200)).toBe('1200');
    expect(normalizeVenueText(null)).toBe('');
    expect(normalizeVenueText(undefined)).toBe('');
  });
});

describe('withinOneEdit', () => {
  it.each([
    ['society', 'society', true],
    ['society', 'socety', true], // falta
    ['society', 'sociiety', true], // sobra
    ['society', 'sociaty', true], // troca
    ['society', 'sociey', true],
    ['society', 'socity', true],
    ['society', 'sciety', true],
    ['society', 'soiety', true],
    ['society', 'sociwxy', false],
    ['jardim', 'jardmi', true], // letras vizinhas trocadas
    ['jardim', 'jardom', true],
    ['jardim', 'jardons', false],
    ['abc', 'abcde', false],
  ])('%s ~ %s = %s', (a, b, expected) => {
    expect(withinOneEdit(a, b)).toBe(expected);
  });
});

describe('matchesVenueQuery', () => {
  const fields = getVenueSearchFields(arena);

  it('busca vazia ou só espaços libera tudo', () => {
    expect(matchesVenueQuery(fields, '')).toBe(true);
    expect(matchesVenueQuery(fields, '   ')).toBe(true);
    expect(matchesVenueQuery(fields, null)).toBe(true);
  });

  it('ignora acento e caixa nos dois lados', () => {
    expect(matchesVenueQuery(fields, 'SAO JOAO')).toBe(true);
    expect(matchesVenueQuery(fields, 'são joão')).toBe(true);
    expect(matchesVenueQuery(fields, 'botanico')).toBe(true);
  });

  it('exige TODOS os termos, em qualquer campo', () => {
    expect(matchesVenueQuery(fields, 'arena curitiba')).toBe(true);
    expect(matchesVenueQuery(fields, 'jardim mateus')).toBe(true);
    expect(matchesVenueQuery(fields, 'arena londrina')).toBe(false);
    expect(matchesVenueQuery(fields, 'curitiba xyz')).toBe(false);
  });

  it('aceita prefixo de palavra', () => {
    expect(matchesVenueQuery(fields, 'are')).toBe(true);
    expect(matchesVenueQuery(fields, 'arena sa')).toBe(true);
    expect(matchesVenueQuery(fields, 'cur')).toBe(true);
  });

  it('procura por nome, bairro, endereço, cidade, UF e nome do estado', () => {
    expect(matchesVenueQuery(fields, 'arena')).toBe(true); // nome
    expect(matchesVenueQuery(fields, 'jardim')).toBe(true); // bairro
    expect(matchesVenueQuery(fields, 'mateus leme')).toBe(true); // endereço
    expect(matchesVenueQuery(fields, 'curitiba')).toBe(true); // cidade
    expect(matchesVenueQuery(fields, 'pr')).toBe(true); // UF
    expect(matchesVenueQuery(fields, 'parana')).toBe(true); // nome do estado
  });

  it('procura por CEP com ou sem hífen', () => {
    expect(matchesVenueQuery(fields, '80010-000')).toBe(true);
    expect(matchesVenueQuery(fields, '80010000')).toBe(true);
    expect(matchesVenueQuery(fields, '80010')).toBe(true);
    expect(matchesVenueQuery(fields, '99999')).toBe(false);
  });

  it('procura por tipo de campo', () => {
    expect(locationMatchesVenueQuery({ ...arena, name: 'Quadra X', fieldType: 'FUTSAL' }, 'futsal')).toBe(true);
    expect(locationMatchesVenueQuery({ name: 'Quadra X', activeFieldTypes: ['AREIA'] }, 'areia')).toBe(true);
    expect(locationMatchesVenueQuery({ name: 'Quadra X', fieldType: 'FUTSAL' }, 'society')).toBe(false);
  });

  describe('tolerância a erro de digitação', () => {
    it('tolera 1 erro em termos com 5+ letras', () => {
      expect(matchesVenueQuery(fields, 'curitba')).toBe(true); // falta
      expect(matchesVenueQuery(fields, 'curritiba')).toBe(true); // sobra
      expect(matchesVenueQuery(fields, 'curitibo')).toBe(true); // troca
      expect(matchesVenueQuery(fields, 'jardmi')).toBe(true); // letras vizinhas
      expect(matchesVenueQuery(fields, 'socety')).toBe(true); // prefixo com erro
      expect(matchesVenueQuery(fields, 'botanco')).toBe(true);
    });

    it('não tolera erro em termos com menos de 5 letras', () => {
      expect(matchesVenueQuery(fields, 'arana')).toBe(true); // 5 letras: 1 erro (arena)
      expect(matchesVenueQuery(fields, 'aren')).toBe(true); // prefixo exato
      expect(matchesVenueQuery(fields, 'arma')).toBe(false); // 4 letras com erro
      expect(matchesVenueQuery(fields, 'rus')).toBe(false);
    });

    it('não tolera 2 erros', () => {
      expect(matchesVenueQuery(fields, 'curtiba')).toBe(true); // 1 erro
      expect(matchesVenueQuery(fields, 'cirtbia')).toBe(false); // 2+ erros
    });

    it('não aplica tolerância a números (CEP)', () => {
      expect(matchesVenueQuery(fields, '80011')).toBe(false);
    });
  });

  describe('abreviações', () => {
    it('soc → society', () => {
      expect(matchesVenueQuery(['Arena Society'], 'soc')).toBe(true);
      expect(matchesVenueQuery(['Arena Futsal'], 'soc')).toBe(false);
    });

    it('fut → futsal', () => {
      expect(matchesVenueQuery(['Ginásio Futsal'], 'fut')).toBe(true);
      expect(matchesVenueQuery(['Arena Society'], 'fut')).toBe(false);
    });

    it('jd → jardim e vl → vila', () => {
      expect(matchesVenueQuery(['Jardim das Flores'], 'jd')).toBe(true);
      expect(matchesVenueQuery(['Vila Isabel'], 'vl')).toBe(true);
      expect(matchesVenueQuery(['Centro'], 'vl')).toBe(false);
    });

    it('funciona também quando a abreviação está no cadastro', () => {
      expect(matchesVenueQuery(['Jd. Botânico'], 'jardim')).toBe(true);
      expect(matchesVenueQuery(['Vl Mariana'], 'vila')).toBe(true);
      expect(matchesVenueQuery(['Soc. Arena'], 'society')).toBe(true);
    });

    it('combina abreviação com outros termos', () => {
      expect(matchesVenueQuery(['Arena Society', 'Jardim Botânico', 'Curitiba'], 'soc jd curit')).toBe(true);
      expect(matchesVenueQuery(['Arena Society', 'Vila Isabel', 'Curitiba'], 'soc jd')).toBe(false);
    });
  });
});

describe('tokenizeVenueQuery / índice reutilizável', () => {
  it('quebra a busca em termos normalizados', () => {
    expect(tokenizeVenueQuery('  Jd.  São-João ')).toEqual(['jd', 'sao', 'joao']);
    expect(tokenizeVenueQuery('')).toEqual([]);
  });

  it('o índice calculado uma vez responde a várias buscas', () => {
    const index = buildVenueSearchIndex(getVenueSearchFields(arena));
    expect(matchesVenueIndex(index, 'arena')).toBe(true);
    expect(matchesVenueIndex(index, 'londrina')).toBe(false);
  });
});

describe('filterVenuesByQuery', () => {
  const venues = [
    { id: '1', name: 'Arena Society Centro', city: 'Curitiba' },
    { id: '2', name: 'Ginásio Futsal Água Verde', city: 'Curitiba' },
    { id: '3', name: 'Quadra do Zé', city: 'Londrina' },
  ];

  it('filtra por vários termos', () => {
    const result = filterVenuesByQuery(venues, 'fut curitiba', (v) => getVenueSearchFields(v));
    expect(result.map((v) => v.id)).toEqual(['2']);
  });

  it('busca vazia devolve uma cópia da lista inteira', () => {
    const result = filterVenuesByQuery(venues, '', (v) => getVenueSearchFields(v));
    expect(result).toEqual(venues);
    expect(result).not.toBe(venues);
  });

  it('inclui campos extras do admin', () => {
    const result = filterVenuesByQuery(
      venues,
      '4199',
      (v) => getVenueSearchFields(v, v.id === '3' ? ['(41) 99999-0000'] : []),
    );
    expect(result.map((v) => v.id)).toEqual(['3']);
  });
});
