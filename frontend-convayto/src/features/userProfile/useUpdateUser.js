import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCurrentUser } from "./apiUserAccount";
import toast from "react-hot-toast";

export function useUpdateUser() {
  const queryClient = useQueryClient();

  const { mutate: updateUser, isPending: isUpdating } = useMutation({
    mutationFn: updateCurrentUser,
    onMutate: () => {
      toast.loading("Обновление...");
    },
    onSuccess: (data) => {
      // Optimistically update avatar in cache so it shows immediately
      if (data?.user?.user_metadata?.avatar_url) {
        queryClient.setQueryData(["user"], (old) => {
          if (!old?.session?.user) return old;
          return {
            ...old,
            session: {
              ...old.session,
              user: {
                ...old.session.user,
                user_metadata: {
                  ...old.session.user.user_metadata,
                  avatar_url: data.user.user_metadata.avatar_url,
                },
              },
            },
          };
        });
      }
      // Also refetch from server to get fully fresh data
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error) => {
      toast.dismiss();
      toast.error(error.message);
    },
  });

  return { updateUser, isUpdating };
}
