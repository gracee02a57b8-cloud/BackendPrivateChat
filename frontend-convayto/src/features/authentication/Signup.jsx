import {
  APP_NAME,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  USERNAME_REGEX,
} from "../../config";
import { useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { useSignup } from "./useSignup";
import { useUser } from "./useUser";
import Loader from "../../components/Loader";
import Heading from "../../components/Heading";
import MainContainer from "../../components/MainContainer";
import FormContainer from "../../components/FormContainer";
import InputBox from "../../components/InputBox";
import SubmitBtn from "../../components/SubmitBtn";
import TextLink from "../../components/TextLink";
import LogoLarge from "../../components/LogoLarge";

function Signup() {
  useEffect(() => { document.title = APP_NAME + " — Регистрация"; }, []);
  const { signup, isPending, isSuccess } = useSignup();
  const { isAuthenticated } = useUser();
  const navigate = useNavigate();

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
    watch,
  } = useForm({
    defaultValues: {
      fullname: "",
      username: "",
      tag: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");

  useEffect(() => {
    if (isAuthenticated || isSuccess) {
      const pendingConf = sessionStorage.getItem("pendingConference");
      if (pendingConf) {
        sessionStorage.removeItem("pendingConference");
        navigate(`/conference/${pendingConf}`, { replace: true });
      } else {
        navigate("/chat", { replace: true });
      }
    }
  }, [isAuthenticated, isSuccess, navigate]);

  const onSubmit = ({ fullname, username, tag, password }) => {
    signup({ username: username.trim(), password, tag: tag.trim(), fullname: fullname.trim() });
  };

  return (
    <MainContainer>
      <LogoLarge />

      <FormContainer onSubmit={handleSubmit(onSubmit)}>
        <Heading addClass="text-3xl">Регистрация</Heading>

        <Controller
          name="fullname"
          control={control}
          rules={{
            required: "Введите имя.",
            minLength: {
              value: 2,
              message: "Минимум 2 символа.",
            },
            maxLength: {
              value: 50,
              message: "Максимум 50 символов.",
            },
          }}
          render={({ field }) => (
            <InputBox
              type="text"
              value={field.value}
              onChange={field.onChange}
              onBlur={() => trigger("fullname")}
              placeholder="Имя"
              htmlFor="fullname"
              error={errors.fullname?.message}
              disabled={isPending}
              autoFocus
            />
          )}
        />

        <Controller
          name="username"
          control={control}
          rules={{
            required: "Введите логин.",
            pattern: {
              value: USERNAME_REGEX,
              message: "Логин не может быть пустым.",
            },
            minLength: {
              value: MIN_USERNAME_LENGTH,
              message: `Минимум ${MIN_USERNAME_LENGTH} символа.`,
            },
            maxLength: {
              value: MAX_USERNAME_LENGTH,
              message: `Максимум ${MAX_USERNAME_LENGTH} символов.`,
            },
          }}
          render={({ field }) => (
            <InputBox
              type="text"
              value={field.value}
              onChange={field.onChange}
              onBlur={() => trigger("username")}
              placeholder="Логин"
              htmlFor="username"
              error={errors.username?.message}
              disabled={isPending}
            />
          )}
        />

        <Controller
          name="tag"
          control={control}
          rules={{
            required: "Введите тег.",
            maxLength: {
              value: 25,
              message: "Максимум 25 символов.",
            },
          }}
          render={({ field }) => (
            <InputBox
              type="text"
              value={field.value}
              onChange={field.onChange}
              onBlur={() => trigger("tag")}
              placeholder="Тег (@yourtag)"
              htmlFor="tag"
              error={errors.tag?.message}
              disabled={isPending}
            />
          )}
        />

        <Controller
          name="password"
          control={control}
          rules={{
            required: "Введите пароль.",
            minLength: {
              value: MIN_PASSWORD_LENGTH,
              message: `Минимум ${MIN_PASSWORD_LENGTH} символов.`,
            },
          }}
          render={({ field }) => (
            <InputBox
              type="password"
              value={field.value}
              onChange={field.onChange}
              onBlur={() => trigger("password")}
              placeholder="Пароль"
              htmlFor="password"
              error={errors.password?.message}
              disabled={isPending}
            />
          )}
        />

        <Controller
          name="confirmPassword"
          control={control}
          rules={{
            required: "Подтвердите пароль.",
            validate: (value) =>
              value === password || "Пароли не совпадают.",
          }}
          render={({ field }) => (
            <InputBox
              type="password"
              value={field.value}
              onChange={field.onChange}
              onBlur={() => trigger("confirmPassword")}
              placeholder="Подтвердите пароль"
              htmlFor="confirmPassword"
              error={errors.confirmPassword?.message}
              disabled={isPending}
            />
          )}
        />

        <SubmitBtn disabled={isPending} type="submit">
          {isPending ? (
            <>
              <Loader size="small" />
              <span className="ml-2">Регистрация...</span>
            </>
          ) : (
            <span>Зарегистрироваться</span>
          )}
        </SubmitBtn>

        <p>
          Уже есть аккаунт?{" "}
          <TextLink to="/signin">Войти</TextLink>
        </p>
      </FormContainer>
    </MainContainer>
  );
}

export default Signup;
