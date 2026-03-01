import { useEffect, useState, useRef } from "react";
import { useSignin } from "./useSignin";
import Loader from "../../components/Loader";
import { useUser } from "./useUser";
import Heading from "../../components/Heading";
import InputBox from "../../components/InputBox";
import TextLink from "../../components/TextLink";
import SubmitBtn from "../../components/SubmitBtn";
import MainContainer from "../../components/MainContainer";
import { useNavigate } from "react-router-dom";
import FormContainer from "../../components/FormContainer";
import { Controller, useForm } from "react-hook-form";
import LogoLarge from "../../components/LogoLarge";
import { APP_NAME } from "../../config";

function Signin() {
  useEffect(() => { document.title = APP_NAME + " — Вход"; }, []);
  const { signin, isPending } = useSignin();
  const navigate = useNavigate();
  const { isAuthenticated } = useUser();
  const [rememberMe, setRememberMe] = useState(false);
  const autoLoginAttempted = useRef(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/chat", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Auto-login from saved credentials
  useEffect(() => {
    if (autoLoginAttempted.current) return;
    if (isAuthenticated) return;
    const saved = localStorage.getItem("rememberMe");
    const savedUser = localStorage.getItem("savedUsername");
    const savedPass = localStorage.getItem("savedPassword");
    if (saved === "true" && savedUser && savedPass) {
      autoLoginAttempted.current = true;
      try {
        const password = atob(savedPass);
        signin(
          { username: savedUser, password, rememberMe: true },
          {
            onSuccess: () => {
              const pendingConf = sessionStorage.getItem("pendingConference");
              if (pendingConf) {
                sessionStorage.removeItem("pendingConference");
                navigate(`/conference/${pendingConf}`, { replace: true });
              } else {
                navigate("/chat", { replace: true });
              }
            },
          },
        );
      } catch {
        // Corrupted saved data — clear it
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("savedUsername");
        localStorage.removeItem("savedPassword");
      }
    }
  }, [isAuthenticated, signin, navigate]);

  const onSubmit = (data) => {
    const { username, password } = data;

    if (!username || !password) return;

    signin(
      { username, password, rememberMe },
      {
        onSuccess: () => {
          const pendingConf = sessionStorage.getItem("pendingConference");
          if (pendingConf) {
            sessionStorage.removeItem("pendingConference");
            navigate(`/conference/${pendingConf}`, { replace: true });
          } else {
            navigate("/chat", { replace: true });
          }
        },
      },
    );
  };

  return (
    <MainContainer>
      <LogoLarge />

      <FormContainer onSubmit={handleSubmit(onSubmit)}>
        <Heading addClass="text-3xl">Вход в аккаунт</Heading>

        <Controller
          name="username"
          control={control}
          rules={{
            required: "Введите имя пользователя.",
          }}
          render={({ field }) => (
            <InputBox
              type="text"
              value={field.value || ""}
              onChange={field.onChange}
              placeholder="Имя пользователя"
              htmlFor="username"
              error={errors.username?.message}
              onBlur={() => trigger("username")}
              disabled={isPending}
              autoFocus
            />
          )}
        />

        <Controller
          name="password"
          control={control}
          rules={{ required: "Введите пароль." }}
          render={({ field }) => (
            <InputBox
              type="password"
              value={field.value || ""}
              onChange={field.onChange}
              placeholder="Пароль"
              htmlFor="password"
              error={errors.password?.message}
              onBlur={() => trigger("password")}
              disabled={isPending}
            />
          )}
        />

        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none text-sm text-LightGray dark:text-LightGray-dark">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isPending}
            className="h-4 w-4 rounded border-LightShade/50 text-textAccentDim focus:ring-textAccentDim dark:border-LightShade dark:text-textAccentDim-dark"
          />
          Запомнить меня
        </label>

        <SubmitBtn disabled={isPending}>
          {isPending ? (
            <>
              <Loader size="small" />
              <span className="ml-2">Вход...</span>
            </>
          ) : (
            <span>Войти</span>
          )}
        </SubmitBtn>

        <p>
          Нет аккаунта?{" "}
          <TextLink to="/signup">Зарегистрироваться</TextLink>
        </p>
      </FormContainer>
    </MainContainer>
  );
}

export default Signin;
