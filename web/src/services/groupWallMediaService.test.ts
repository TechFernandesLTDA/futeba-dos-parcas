import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callableMock, httpsCallableMock, functionsMock } = vi.hoisted(() => {
  const callable = vi.fn();
  return {
    callableMock: callable,
    httpsCallableMock: vi.fn(() => callable),
    functionsMock: { region: 'southamerica-east1' },
  };
});
vi.mock('firebase/functions', () => ({ httpsCallable: httpsCallableMock }));
vi.mock('./firebaseFunctions', () => ({ functions: functionsMock }));

import { createGroupWallMediaDraft } from './groupWallMediaService';

const CLIENT_REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('groupWallMediaService', () => {
  beforeEach(() => {
    callableMock.mockReset();
  });

  it('usa App Check limitado e valida o contrato do draft', async () => {
    callableMock.mockResolvedValue({
      data: {
        postId: POST_ID,
        uploadPath: `groups/group-1/wall_media_staging/${POST_ID}/user-1/source.mp4`,
        expiresAt: '2026-07-11T16:00:00.000Z',
        maxBytes: 25 * 1024 * 1024,
        pipelineVersion: 1,
        duplicate: false,
      },
    });

    await expect(createGroupWallMediaDraft({
      groupId: 'group-1',
      text: 'Gol!',
      declaredContentType: 'video/mp4',
      sizeBytes: 1024,
      fileName: 'gol.mp4',
      clientRequestId: CLIENT_REQUEST_ID,
    })).resolves.toMatchObject({postId: POST_ID, pipelineVersion: 1});

    expect(httpsCallableMock).toHaveBeenCalledWith(
      functionsMock,
      'createGroupWallMediaDraft',
      { limitedUseAppCheckTokens: true },
    );
  });

  it('falha de forma segura para resposta incompleta', async () => {
    callableMock.mockResolvedValue({data: {postId: POST_ID}});
    await expect(createGroupWallMediaDraft({
      groupId: 'group-1',
      text: '',
      declaredContentType: 'image/jpeg',
      sizeBytes: 10,
      fileName: 'foto.jpg',
      clientRequestId: CLIENT_REQUEST_ID,
    })).rejects.toThrow('Resposta inválida');
  });

  it('recusa caminho de upload fora do staging reservado para o grupo', async () => {
    callableMock.mockResolvedValue({
      data: {
        postId: POST_ID,
        uploadPath: `groups/outro-grupo/wall_media_staging/${POST_ID}/user-1/source.mp4`,
        expiresAt: '2026-07-11T16:00:00.000Z',
        maxBytes: 25 * 1024 * 1024,
        pipelineVersion: 1,
        duplicate: false,
      },
    });

    await expect(createGroupWallMediaDraft({
      groupId: 'group-1',
      text: '',
      declaredContentType: 'video/mp4',
      sizeBytes: 10,
      fileName: 'gol.mp4',
      clientRequestId: CLIENT_REQUEST_ID,
    })).rejects.toThrow('Resposta inválida');
  });

  it('não chama o backend com clientRequestId fora do formato UUID v4', async () => {
    await expect(createGroupWallMediaDraft({
      groupId: 'group-1',
      text: '',
      declaredContentType: 'image/jpeg',
      sizeBytes: 10,
      fileName: 'foto.jpg',
      clientRequestId: 'request-invalido',
    })).rejects.toThrow('Identificador inválido');
    expect(callableMock).not.toHaveBeenCalled();
  });
});
