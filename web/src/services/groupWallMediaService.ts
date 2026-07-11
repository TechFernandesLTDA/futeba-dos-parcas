import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseFunctions';

export interface CreateGroupWallMediaDraftRequest {
  groupId: string;
  text: string;
  declaredContentType: string;
  sizeBytes: number;
  fileName: string;
  clientRequestId: string;
  highlightRef?: { gameId: string; highlightId: string } | null;
}

export interface GroupWallMediaDraftResponse {
  postId: string;
  uploadPath: string;
  expiresAt: string;
  maxBytes: number;
  pipelineVersion: number;
  duplicate: boolean;
}

const createDraftCallable = httpsCallable<
  CreateGroupWallMediaDraftRequest,
  Record<string, unknown>
>(functions, 'createGroupWallMediaDraft', { limitedUseAppCheckTokens: true });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requireString = (value: unknown, field: string) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Resposta inválida ao preparar mídia: ${field}.`);
  }
  return value;
};

export async function createGroupWallMediaDraft(
  request: CreateGroupWallMediaDraftRequest,
): Promise<GroupWallMediaDraftResponse> {
  if (!UUID_PATTERN.test(request.clientRequestId)) {
    throw new Error('Identificador inválido ao preparar mídia.');
  }
  const response = await createDraftCallable(request);
  const data = response.data;
  const maxBytes = Number(data.maxBytes);
  const pipelineVersion = Number(data.pipelineVersion);
  const postId = requireString(data.postId, 'postId');
  const uploadPath = requireString(data.uploadPath, 'uploadPath');
  const expiresAt = requireString(data.expiresAt, 'expiresAt');
  const pathSegments = uploadPath.split('/');

  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 ||
      !Number.isSafeInteger(pipelineVersion) || pipelineVersion <= 0 ||
      !Number.isFinite(Date.parse(expiresAt)) ||
      typeof data.duplicate !== 'boolean' ||
      !/^[a-f0-9]{40}$/.test(postId) ||
      pathSegments.length !== 6 ||
      pathSegments[0] !== 'groups' ||
      pathSegments[1] !== request.groupId ||
      pathSegments[2] !== 'wall_media_staging' ||
      pathSegments[3] !== postId ||
      pathSegments[4].length === 0 ||
      !/^source\.(?:jpg|png|webp|mp4)$/.test(pathSegments[5])) {
    throw new Error('Resposta inválida ao preparar mídia.');
  }

  return {
    postId,
    uploadPath,
    expiresAt,
    maxBytes,
    pipelineVersion,
    duplicate: data.duplicate,
  };
}
