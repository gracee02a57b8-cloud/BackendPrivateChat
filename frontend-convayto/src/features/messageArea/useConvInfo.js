import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getConvInfoById, getGroupConvInfo } from "./apiConvInfo";
import { useUser } from "../authentication/useUser";

function useConvInfo() {
  const { userId: friendUserId, roomId } = useParams();
  const { user } = useUser();
  const myUserId = user?.id;

  // Определяем: это групповой чат (roomId) или приватный (friendUserId)
  const isGroup = !!roomId;
  const queryKey = isGroup ? ["convInfo", "room", roomId] : ["convInfo", friendUserId];

  const {
    data: convInfo,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: () =>
      isGroup
        ? getGroupConvInfo({ roomId })
        : getConvInfoById({ myUserId, friendUserId }),

    // convInfo is not going to change so we can set staleTime to Infinity
    staleTime: Infinity,
    enabled: !!(friendUserId || roomId),
  });

  return { convInfo, isPending, isError, error };
}

export default useConvInfo;
