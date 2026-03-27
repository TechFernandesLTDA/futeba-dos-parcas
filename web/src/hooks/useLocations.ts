import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { Location } from '../types/location';

export const useLocations = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const locRef = collection(db, 'locations');
    const q = query(locRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        ...snakeToCamel<Location>(d.data()),
        id: d.id,
      }));
      setLocations(data);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { locations, loading, error };
};

export const useLocationDetail = (locationId?: string) => {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    const fetchLocation = async () => {
      try {
        const locDoc = await getDoc(doc(db, 'locations', locationId));
        if (locDoc.exists()) {
          setLocation({ ...snakeToCamel<Location>(locDoc.data()), id: locDoc.id });
        }
        setLoading(false);
      } catch (err: unknown) {
        setError((err as Error).message);
        setLoading(false);
      }
    };

    fetchLocation();
  }, [locationId]);

  return { location, loading, error };
};
