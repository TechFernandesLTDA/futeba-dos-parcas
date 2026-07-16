import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type BreadcrumbEntityKind = 'game' | 'group' | 'location' | 'user';
export type BreadcrumbEntityLabels = Readonly<Record<string, string>>;

interface BreadcrumbEntityContextValue {
  labels: BreadcrumbEntityLabels;
  publish: (kind: BreadcrumbEntityKind, id: string, label: string) => void;
}

const EMPTY_LABELS: BreadcrumbEntityLabels = Object.freeze({});
const BreadcrumbEntityContext = createContext<BreadcrumbEntityContextValue | null>(null);

const entityKey = (kind: BreadcrumbEntityKind, id: string) => `${kind}:${id}`;

/**
 * Cache leve de nomes já carregados pelas telas. Não realiza I/O e permanece
 * disponível durante a sessão para enriquecer rotas irmãs da mesma entidade.
 */
export function BreadcrumbEntityProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});

  const publish = useCallback((kind: BreadcrumbEntityKind, id: string, label: string) => {
    const normalizedId = id.trim();
    const normalizedLabel = label.trim().slice(0, 120);
    if (!normalizedId || !normalizedLabel) return;

    const key = entityKey(kind, normalizedId);
    setLabels((current) => current[key] === normalizedLabel
      ? current
      : { ...current, [key]: normalizedLabel });
  }, []);

  const value = useMemo(() => ({ labels, publish }), [labels, publish]);
  return (
    <BreadcrumbEntityContext.Provider value={value}>
      {children}
    </BreadcrumbEntityContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBreadcrumbEntityLabels(): BreadcrumbEntityLabels {
  return useContext(BreadcrumbEntityContext)?.labels ?? EMPTY_LABELS;
}

/** Publica somente metadados que a tela já recebeu da sua fonte de dados. */
// eslint-disable-next-line react-refresh/only-export-components
export function useBreadcrumbEntityLabel(
  kind: BreadcrumbEntityKind,
  id?: string | null,
  label?: string | null,
) {
  const context = useContext(BreadcrumbEntityContext);
  const publish = context?.publish;

  useLayoutEffect(() => {
    if (!publish || !id || !label) return;
    publish(kind, id, label);
  }, [id, kind, label, publish]);
}
