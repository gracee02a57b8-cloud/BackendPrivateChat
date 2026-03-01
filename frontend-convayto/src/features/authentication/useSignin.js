import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signin as ApiSignin } from "./apiAuth";
import toast from "react-hot-toast";

export function useSignin() {
  const queryClient = useQueryClient();

  const { mutate: signin, isPending } = useMutation({
    mutationFn: ({ username, password, rememberMe }) => ApiSignin({ username, password, rememberMe }),
    onMutate: () => {
      toast.loading("Вход...");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data);
      toast.dismiss();
    },
    onError: (error) => {
      toast.dismiss();
      toast.error(error.message);
    },
  });

  return { signin, isPending };
}
