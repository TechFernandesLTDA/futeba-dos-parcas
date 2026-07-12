/** Resolves a fresh authenticated download URL for a protected Wall object. */
export async function resolveWallPostStorageUrl(path: string): Promise<string> {
  const [{ getDownloadURL, ref: storageRef }, { storage }] = await Promise.all([
    import('firebase/storage'),
    import('../services/firebaseStorage'),
  ]);
  return getDownloadURL(storageRef(storage, path));
}
