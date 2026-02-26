import MainContainer from "./MainContainer";

const AboutPage = () => {
  return (
    <MainContainer>
      <div className="mx-auto max-w-4xl px-4 py-8 leading-relaxed">
        <h1 className="sr-only">О BarsikChat</h1>

        <div className="pointer-events-none mb-6 flex select-none flex-col items-center">
          <span className="text-8xl">🐱</span>
          <span className="mt-2 text-3xl font-bold text-textAccent dark:text-textAccent-dark">
            BarsikChat
          </span>
        </div>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">О проекте</h2>
          <p>
            BarsikChat — это современный мессенджер для мгновенного общения
            в реальном времени. Приложение построено на React.js и Spring Boot,
            обеспечивая быструю и безопасную доставку сообщений. BarsikChat
            поддерживает личные и групповые чаты, обмен файлами, тёмную тему
            и адаптивный интерфейс для любых устройств.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Возможности</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Обмен сообщениями в реальном времени через WebSocket</li>
            <li>Безопасная аутентификация с JWT-токенами</li>
            <li>Личные и групповые чаты</li>
            <li>Обмен файлами и изображениями</li>
            <li>Тёмная и светлая темы оформления</li>
            <li>Адаптивный дизайн для мобильных и десктопных устройств</li>
            <li>Push-уведомления</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Технологии</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              "React.js",
              "Spring Boot",
              "PostgreSQL",
              "WebSocket",
              "Tailwind CSS",
              "Docker",
            ].map((tech) => (
              <div
                key={tech}
                className="rounded-lg border border-bgSecondary bg-white/50 p-3 text-center dark:border-bgSecondary-dark dark:bg-black/20"
              >
                <span className="font-semibold">{tech}</span>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-6 text-center text-sm opacity-70">
          <p>© {new Date().getFullYear()} BarsikChat</p>
        </footer>
      </div>
    </MainContainer>
  );
};

export default AboutPage;
