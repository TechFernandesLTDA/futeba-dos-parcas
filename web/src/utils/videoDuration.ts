/**
 * Le a duracao de um arquivo de video criando um elemento <video> efemero.
 * Resolve null se o metadata nao estiver disponivel ou demorar demais.
 * O blob URL criado e sempre revogado.
 */
export async function readVideoDuration(file: File, timeoutMs = 4000): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    probe.onloadedmetadata = () => {
      const duration = probe.duration;
      finish(Number.isFinite(duration) ? duration : null);
    };
    probe.onerror = () => finish(null);
    setTimeout(() => finish(null), timeoutMs);
    probe.src = objectUrl;
  });
}
