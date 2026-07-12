// @vitest-environment node

import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import {
  createGroupWallMediaOutboxFingerprint,
  GROUP_WALL_MEDIA_OUTBOX_DEFAULT_TTL_MS,
  GroupWallMediaOutbox,
  GroupWallMediaOutboxUnavailableError,
} from './groupWallMediaOutbox';

const FIRST_REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const THIRD_REQUEST_ID = '33333333-3333-4333-8333-333333333333';

function createFile(
  contents = 'video-content',
  name = 'partida.mp4',
  type = 'video/mp4',
  lastModified = 1_720_000_000_000,
) {
  return new File([contents], name, { type, lastModified });
}

function createSubject(options: {
  factory?: IDBFactory | null;
  databaseName?: string;
  now?: () => number;
  defaultTtlMs?: number;
} = {}) {
  return new GroupWallMediaOutbox({
    indexedDBFactory: options.factory === undefined ? new IDBFactory() : options.factory,
    databaseName: options.databaseName ?? `group-wall-outbox-${crypto.randomUUID()}`,
    now: options.now,
    defaultTtlMs: options.defaultTtlMs,
  });
}

function createInput(overrides: Partial<Parameters<GroupWallMediaOutbox['put']>[0]> = {}) {
  const file = overrides.file ?? createFile();
  return {
    ownerUid: 'user-1',
    groupId: 'group-1',
    text: 'Gol no fim do jogo',
    file,
    fingerprint: createGroupWallMediaOutboxFingerprint({
      groupId: overrides.groupId ?? 'group-1',
      text: overrides.text ?? 'Gol no fim do jogo',
      file,
      highlightRef: overrides.highlightRef,
    }),
    clientRequestId: FIRST_REQUEST_ID,
    ...overrides,
  };
}

describe('createGroupWallMediaOutboxFingerprint', () => {
  it('normaliza a legenda e mantém a identidade estável sem ler os bytes', () => {
    const file = createFile();
    const first = createGroupWallMediaOutboxFingerprint({
      groupId: 'group-1',
      text: '  Gol no fim  ',
      file,
      highlightRef: { gameId: 'game-1', highlightId: 'goal-1' },
    });
    const second = createGroupWallMediaOutboxFingerprint({
      groupId: 'group-1',
      text: 'Gol no fim',
      file,
      highlightRef: { gameId: 'game-1', highlightId: 'goal-1' },
    });

    expect(first).toBe(second);
  });

  it('muda quando metadados relevantes do arquivo ou intenção mudam', () => {
    const base = createGroupWallMediaOutboxFingerprint({
      groupId: 'group-1',
      text: 'Gol',
      file: createFile(),
    });

    expect(createGroupWallMediaOutboxFingerprint({
      groupId: 'group-1',
      text: 'Defesa',
      file: createFile(),
    })).not.toBe(base);
    expect(createGroupWallMediaOutboxFingerprint({
      groupId: 'group-1',
      text: 'Gol',
      file: createFile('longer-video-content'),
    })).not.toBe(base);
    expect(createGroupWallMediaOutboxFingerprint({
      groupId: 'group-1',
      text: 'Gol',
      file: createFile('video-content', 'outro.mp4'),
    })).not.toBe(base);
  });
});
describe('GroupWallMediaOutbox', () => {
  it('persiste e reidrata arquivo e metadados da intenção', async () => {
    const now = 20_000;
    const subject = createSubject({ now: () => now });
    const file = createFile('conteúdo do vídeo', 'lance final.mp4', 'video/mp4', 19_000);
    const highlightRef = { gameId: 'game-1', highlightId: 'goal-1' };

    await subject.put(createInput({ file, highlightRef }));
    const restored = await subject.restore('user-1', 'group-1');

    expect(restored).toMatchObject({
      ownerUid: 'user-1',
      groupId: 'group-1',
      text: 'Gol no fim do jogo',
      clientRequestId: FIRST_REQUEST_ID,
      highlightRef,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + GROUP_WALL_MEDIA_OUTBOX_DEFAULT_TTL_MS,
    });
    expect(restored?.file).toBeInstanceOf(File);
    expect(restored?.file.name).toBe(file.name);
    expect(restored?.file.type).toBe(file.type);
    expect(restored?.file.lastModified).toBe(file.lastModified);
    expect(restored?.file.size).toBe(file.size);
    expect(await restored?.file.text()).toBe(await file.text());
  });

  it('restaura a intenção depois de fechar e reabrir a base', async () => {
    const factory = new IDBFactory();
    const databaseName = 'reload-database';
    const firstSession = createSubject({ factory, databaseName });
    await firstSession.put(createInput());
    await firstSession.close();

    const reloadedSession = createSubject({ factory, databaseName });

    await expect(reloadedSession.restore('user-1', 'group-1')).resolves.toMatchObject({
      clientRequestId: FIRST_REQUEST_ID,
      text: 'Gol no fim do jogo',
    });
  });

  it('mantém somente a intenção mais recente por usuário e grupo', async () => {
    let now = 100_000;
    const subject = createSubject({ now: () => now });
    await subject.put(createInput());

    now += 1;
    await subject.put(createInput({
      text: 'Segunda tentativa',
      clientRequestId: SECOND_REQUEST_ID,
    }));

    await expect(subject.restore('user-1', 'group-1')).resolves.toMatchObject({
      text: 'Segunda tentativa',
      clientRequestId: SECOND_REQUEST_ID,
      createdAt: now,
      updatedAt: now,
    });
    await expect(subject.reconcile('user-1')).resolves.toMatchObject({
      entries: [{ groupId: 'group-1', clientRequestId: SECOND_REQUEST_ID }],
      expiredOrInvalidRemoved: 0,
    });
  });

  it('isola as intenções por usuário e grupo', async () => {
    const subject = createSubject();
    await subject.put(createInput());
    await subject.put(createInput({
      groupId: 'group-2',
      clientRequestId: SECOND_REQUEST_ID,
    }));
    await subject.put(createInput({
      ownerUid: 'user-2',
      clientRequestId: THIRD_REQUEST_ID,
    }));

    expect((await subject.reconcile('user-1')).entries.map((entry) => entry.groupId).sort())
      .toEqual(['group-1', 'group-2']);
    expect((await subject.reconcile('user-2')).entries).toHaveLength(1);
    await expect(subject.restore('user-2', 'group-2')).resolves.toBeNull();
  });

  it('limita a expiração solicitada ao TTL local e respeita uma expiração menor', async () => {
    const now = 50_000;
    const subject = createSubject({ now: () => now, defaultTtlMs: 60_000 });

    const capped = await subject.put(createInput({ expiresAt: now + 120_000 }));
    expect(capped.expiresAt).toBe(now + 60_000);

    const shorter = await subject.put(createInput({
      expiresAt: now + 10_000,
      clientRequestId: SECOND_REQUEST_ID,
    }));
    expect(shorter.expiresAt).toBe(now + 10_000);
  });

  it('remove automaticamente uma intenção expirada', async () => {
    let now = 10_000;
    const subject = createSubject({ now: () => now, defaultTtlMs: 5_000 });
    await subject.put(createInput());

    now += 5_001;

    await expect(subject.restore('user-1', 'group-1')).resolves.toBeNull();
    await expect(subject.reconcile('user-1')).resolves.toEqual({
      entries: [],
      expiredOrInvalidRemoved: 0,
    });
  });

  it('reconcilia em ordem recente e poda expirados', async () => {
    let now = 1_000;
    const subject = createSubject({ now: () => now, defaultTtlMs: 10_000 });
    await subject.put(createInput({
      groupId: 'expired-group',
      expiresAt: 1_500,
    }));

    now = 2_000;
    await subject.put(createInput({
      groupId: 'older-group',
      clientRequestId: SECOND_REQUEST_ID,
    }));

    now = 3_000;
    await subject.put(createInput({
      groupId: 'newer-group',
      clientRequestId: THIRD_REQUEST_ID,
    }));

    await expect(subject.reconcile('user-1')).resolves.toMatchObject({
      entries: [
        { groupId: 'newer-group', updatedAt: 3_000 },
        { groupId: 'older-group', updatedAt: 2_000 },
      ],
      expiredOrInvalidRemoved: 1,
    });
    await expect(subject.restore('user-1', 'expired-group')).resolves.toBeNull();
  });

  it('remove uma intenção específica e limpa todas as intenções no logout', async () => {
    const subject = createSubject();
    await subject.put(createInput());
    await subject.put(createInput({
      groupId: 'group-2',
      clientRequestId: SECOND_REQUEST_ID,
    }));
    await subject.put(createInput({
      ownerUid: 'user-2',
      clientRequestId: THIRD_REQUEST_ID,
    }));

    await subject.remove('user-1', 'group-1');
    await expect(subject.restore('user-1', 'group-1')).resolves.toBeNull();
    expect((await subject.reconcile('user-1')).entries).toHaveLength(1);

    await subject.clearOwner('user-1');
    expect((await subject.reconcile('user-1')).entries).toHaveLength(0);
    expect((await subject.reconcile('user-2')).entries).toHaveLength(1);
  });

  it('rejeita identificadores, UUID e expiração inválidos', async () => {
    const now = 10_000;
    const subject = createSubject({ now: () => now });

    await expect(subject.put(createInput({ ownerUid: '  ' }))).rejects.toThrow('ownerUid inválido');
    await expect(subject.put(createInput({ clientRequestId: 'not-a-uuid' })))
      .rejects.toThrow('clientRequestId inválido');
    await expect(subject.put(createInput({ expiresAt: now })))
      .rejects.toThrow('Expiração inválida');
  });

  it('falha de forma tipada quando IndexedDB não existe', async () => {
    const subject = createSubject({ factory: null });

    await expect(subject.restore('user-1', 'group-1'))
      .rejects.toBeInstanceOf(GroupWallMediaOutboxUnavailableError);
  });
});
