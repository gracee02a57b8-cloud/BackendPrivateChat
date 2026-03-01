import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signup as apiSignup } from "./apiAuth";
import toast from "react-hot-toast";

export function useSignup() {
  const queryClient = useQueryClient();

  const {
    mutate: signup,
    isPending,
    error,
    isSuccess,
  } = useMutation({
    mutationFn: ({ username, password, tag, fullname }) =>
      apiSignup({ username, password, tag, fullname }),
    onMutate: () => {
      toast.loading("Регистрация...");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data);
      toast.dismiss();
      toast.success("Аккаунт создан!");
    },
    onError: (error) => {
      toast.dismiss();
      toast.error(error.message);
    },
  });

  return { signup, isPending, error, isSuccess };
}
