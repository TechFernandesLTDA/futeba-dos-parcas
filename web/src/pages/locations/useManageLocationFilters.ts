import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Location } from '../../types/location';
import {
  ManageLocationQueryState,
  clearManageFilters,
  countActiveManageFilters,
  parseManageFilters,
  serializeManageFilters,
} from './manageLocationUrlState';
import { pruneGeoSelection } from './manageLocationFacets';

export interface UpdateOptions {
  /** true = não cria entrada no histórico (digitação da busca). */
  replace?: boolean;
}

/**
 * Estado dos filtros do admin guardado na URL (#4372): link compartilhável e o
 * "voltar" do navegador restaura. Mexer em Estado/Cidade derruba, na mesma
 * atualização, as seleções de Cidade/Bairro que deixaram de existir.
 */
export function useManageLocationFilters(locations: readonly Location[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseManageFilters(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<ManageLocationQueryState>, options: UpdateOptions = {}) => {
      setSearchParams(
        (previous) => {
          const merged = { ...parseManageFilters(previous), ...patch };
          return serializeManageFilters(pruneGeoSelection(locations, merged), previous);
        },
        { replace: options.replace ?? false },
      );
    },
    [locations, setSearchParams],
  );

  const clearAll = useCallback(() => {
    setSearchParams((previous) =>
      serializeManageFilters(clearManageFilters(parseManageFilters(previous)), previous));
  }, [setSearchParams]);

  return {
    filters,
    update,
    clearAll,
    activeCount: countActiveManageFilters(filters),
  };
}
