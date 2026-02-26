import { Link, useNavigate } from "react-router-dom";
import { FaArrowRight, FaShieldAlt, FaMobile } from "react-icons/fa";
import { IoSparkles } from "react-icons/io5";
import { MdChat, MdSecurity, MdSpeed } from "react-icons/md";
import MainContainer from "./MainContainer";

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <MdChat className="h-8 w-8" />,
      title: "Чат в реальном времени",
      description:
        "Мгновенная отправка и получение сообщений через WebSocket-соединение.",
    },
    {
      icon: <MdSecurity className="h-8 w-8" />,
      title: "Безопасная авторизация",
      description:
        "Надёжная аутентификация с JWT-токенами и защищённым хранением паролей.",
    },
    {
      icon: <MdSpeed className="h-8 w-8" />,
      title: "Молниеносная скорость",
      description:
        "Оптимизированная производительность с React Query, пагинацией и интеллектуальной загрузкой данных.",
    },
    {
      icon: <FaMobile className="h-8 w-8" />,
      title: "Адаптивный дизайн",
      description:
        "Работает на ПК, планшетах и смартфонах с автоматической адаптацией интерфейса.",
    },
    {
      icon: <FaShieldAlt className="h-8 w-8" />,
      title: "Управление профилем",
      description:
        "Настройте аватар и личную информацию с полным контролем над данными.",
    },
    {
      icon: <IoSparkles className="h-8 w-8" />,
      title: "Тёмная тема",
      description:
        "Переключайтесь между светлой и тёмной темами для комфортного использования.",
    },
  ];

  const stats = [
    { number: "WebSocket", label: "Реальное время" },
    { number: "JWT", label: "Авторизация" },
    { number: "React", label: "Интерфейс" },
    { number: "Spring", label: "Бэкенд" },
  ];

  return (
    <MainContainer>
      {/* Hero Section */}
      <section className="w-full px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <span className="text-8xl sm:text-9xl">🐱</span>
          </div>

          {/* Main Heading */}
          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            Общайся мгновенно,
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              {" "}
              чатся свободно
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-textSecondary dark:text-textSecondary-dark mb-8 text-lg sm:text-xl">
            Современный мессенджер с обменом сообщениями в реальном времени,
            безопасностью и высокой производительностью.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <button
              onClick={() => navigate("/signup")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-4 font-semibold text-white transition duration-300 hover:shadow-lg hover:shadow-blue-500/50"
            >
              Регистрация
              <FaArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/signin")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-current px-8 py-4 font-semibold transition duration-300 hover:bg-opacity-10 hover:backdrop-blur"
            >
              Войти
              <FaArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="w-full bg-bgSecondary/50 px-4 py-16 dark:bg-bgSecondary-dark/50 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-blue-500 sm:text-4xl">
                  {stat.number}
                </div>
                <p className="text-textSecondary dark:text-textSecondary-dark mt-2 text-sm sm:text-base">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Мощные возможности для вас
            </h2>
            <p className="text-textSecondary dark:text-textSecondary-dark text-lg">
              Всё необходимое для удобного общения в реальном времени
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="rounded-lg border border-bgSecondary bg-white/50 p-6 backdrop-blur dark:border-bgSecondary-dark dark:bg-black/20"
              >
                <div className="mb-4 inline-flex rounded-lg bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {feature.icon}
                </div>
                <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                <p className="text-textSecondary dark:text-textSecondary-dark">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="w-full bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-20 dark:from-blue-950/20 dark:to-purple-950/20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 sm:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
                Почему BarsikChat?
              </h2>
              <ul className="space-y-4">
                {[
                  "Быстрая доставка сообщений",
                  "Современный стек технологий",
                  "Фокус на приватности",
                  "Постоянные улучшения",
                  "Адаптивный интерфейс",
                  "Обмен файлами и фото",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="mt-1 inline-block h-2 w-2 rounded-full bg-blue-500"></span>
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="mb-6 inline-flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500">
                  <div className="text-6xl text-white">💬</div>
                </div>
                <p className="text-lg font-semibold">
                  Присоединяйся к BarsikChat!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Stack Section */}
      <section className="w-full px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Современные технологии
            </h2>
            <p className="text-textSecondary dark:text-textSecondary-dark text-lg">
              Лучшие инструменты и фреймворки
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "React", description: "UI-библиотека" },
              { name: "Spring Boot", description: "Бэкенд" },
              { name: "PostgreSQL", description: "База данных" },
              { name: "React Query", description: "Загрузка данных" },
              { name: "React Router", description: "Маршрутизация" },
              { name: "Tailwind CSS", description: "Стилизация" },
              { name: "Vite", description: "Сборщик" },
              { name: "WebSocket", description: "Реальное время" },
            ].map((tech, index) => (
              <div
                key={index}
                className="rounded-lg border border-bgSecondary bg-white/50 p-4 text-center backdrop-blur dark:border-bgSecondary-dark dark:bg-black/20"
              >
                <h3 className="font-semibold">{tech.name}</h3>
                <p className="text-textSecondary dark:text-textSecondary-dark text-sm">
                  {tech.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="w-full bg-red-50/50 px-4 py-20 dark:bg-red-950/10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-lg border border-red-200 bg-white/50 p-8 dark:border-red-900/50 dark:bg-black/20">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <FaShieldAlt className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-bold">Приватность и безопасность</h2>
            </div>
            <p className="text-textSecondary dark:text-textSecondary-dark mb-4 text-lg">
              Безопасная аутентификация и защищённый контроль доступа.
              Ваши данные надёжно защищены.
            </p>
            <ul className="text-textSecondary dark:text-textSecondary-dark space-y-2">
              <li>✓ JWT-аутентификация</li>
              <li>✓ Хеширование паролей</li>
              <li>✓ Защищённые маршруты и контроль доступа</li>
              <li>✓ WebSocket с токен-авторизацией</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
            Готов начать общение?
          </h2>
          <p className="text-textSecondary dark:text-textSecondary-dark mb-8 text-lg">
            Создай аккаунт и начни общаться в реальном времени. Это займёт
            всего минуту.
          </p>
          <button
            onClick={() => navigate("/signup")}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-12 py-4 text-lg font-semibold text-white transition duration-300 hover:shadow-lg hover:shadow-blue-500/50"
          >
            Начать сейчас
            <FaArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <section className="w-full border-t border-bgSecondary bg-white/30 px-4 py-12 dark:border-bgSecondary-dark dark:bg-black/30 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="mb-4 font-semibold">О нас</h3>
              <ul className="text-textSecondary dark:text-textSecondary-dark space-y-2 text-sm">
                <li>
                  <a
                    href="/about"
                    className="hover:text-textPrimary dark:hover:text-textPrimary-dark"
                  >
                    О BarsikChat
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Правовая информация</h3>
              <ul className="text-textSecondary dark:text-textSecondary-dark space-y-2 text-sm">
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-textPrimary dark:hover:text-textPrimary-dark"
                  >
                    Политика конфиденциальности
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-textPrimary dark:hover:text-textPrimary-dark"
                  >
                    Условия использования
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">BarsikChat</h3>
              <p className="text-textSecondary dark:text-textSecondary-dark text-sm">
                Современный мессенджер для быстрого и безопасного общения.
              </p>
            </div>
          </div>
          <div className="text-textSecondary dark:text-textSecondary-dark mt-8 border-t border-bgSecondary pt-8 text-center text-sm dark:border-bgSecondary-dark">
            <p>
              © {new Date().getFullYear()} BarsikChat. Все права защищены.
            </p>
          </div>
        </div>
      </section>
    </MainContainer>
  );
};

export default LandingPage;
