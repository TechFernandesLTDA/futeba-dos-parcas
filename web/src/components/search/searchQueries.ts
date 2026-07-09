import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';

export function buildPublicGroupSearchQuery(searchTerm: string, prefixUpperBound: string) {
  return query(
    collection(db, 'groups'),
    where('is_public', '==', true),
    where('name', '>=', searchTerm),
    where('name', '<=', prefixUpperBound),
    orderBy('name'),
    limit(10),
  );
}
