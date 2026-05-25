import { useQuery } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  query as fsQuery,
  orderBy,
  limit as fsLimit,
} from "firebase/firestore";
import { db } from "../services/firebase";

interface SeasonArchive {
  id: string;
  monthKey: string;
  name: string;
  mvpUserName?: string;
  mvpUserId?: string;
  mvpPoints?: number;
  archivedAt: Date;
  playersCount: number;
}

export function useHallOfFame(groupId?: string) {
  return useQuery({
    queryKey: ["hall-of-fame", groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const ref = collection(db, "season-archive", groupId, "seasons");
      const q = fsQuery(ref, orderBy("archived_at", "desc"), fsLimit(12));
      const snap = await getDocs(q);

      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          monthKey: data.month_key,
          name: data.name,
          mvpUserName: data.mvp_user_name,
          mvpUserId: data.mvp_user_id,
          mvpPoints: data.mvp_points,
          archivedAt: data.archived_at?.toDate() || new Date(),
          playersCount: data.standings?.length || 0,
        } as SeasonArchive;
      });
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!groupId,
  });
}
