import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "./apiAuth";

export function useUser() {
  const queryClient = useQueryClient();

  const { isLoading, data } = useQuery({
    queryKey: ["user"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min — don't re-fetch profile too often
  });

  // When any apiFetch call gets a 401, clear the cached user
  // so ProtectedRoute redirects to /signin via React Router
  useEffect(() => {
    const onExpired = () => {
      queryClient.setQueryData(["user"], { session: null });
    };
    window.addEventListener("auth:session-expired", onExpired);
    return () => window.removeEventListener("auth:session-expired", onExpired);
  }, [queryClient]);

  const user = data?.session?.user;

  const invalidateUser = () => {
    queryClient.invalidateQueries({ queryKey: ["user"] });
  };

  return {
    isLoading,
    session: data?.session,
    user,
    isAuthenticated: user?.role === "authenticated",
    invalidateUser,
  };
}
