export interface DemoDataLike {
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string | null;
  seedId?: string | null;
  demoDataReason?: string | null;
}

export function isDemoData(value?: DemoDataLike | null): boolean {
  if (!value) return false;
  return value.demoData === true ||
    value.isMock === true ||
    value.dataOrigin === 'DEMO' ||
    value.dataOrigin === 'TEST' ||
    Boolean(value.seedId);
}

export function getDemoDataLabel(value?: DemoDataLike | null): string {
  if (!isDemoData(value)) return '';
  if (value?.dataOrigin === 'TEST') return 'Teste';
  return 'Fictício';
}
