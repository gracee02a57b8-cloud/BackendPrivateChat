import MainContainer from "./MainContainer";

const TermsOfService = () => {
  return (
    <MainContainer>
      <div className="mx-auto max-w-4xl px-4 py-8 leading-relaxed">
        <h1 className="mb-8 text-3xl font-bold">Условия использования</h1>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">1. Принятие условий</h2>
          <p>
            Используя BarsikChat, вы принимаете и соглашаетесь соблюдать
            настоящие условия. Если вы не согласны с ними, пожалуйста,
            не используйте данный сервис.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">2. Лицензия</h2>
          <p className="mb-3">
            Разрешается использование BarsikChat для личного
            некоммерческого общения. В рамках данной лицензии запрещается:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Использовать сервис в коммерческих целях без разрешения</li>
            <li>Пытаться декомпилировать или реверс-инжинирить программное обеспечение</li>
            <li>Передавать вредоносный код через платформу</li>
            <li>Копировать или зеркалировать материалы на другие серверы</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">3. Отказ от гарантий</h2>
          <p>
            Материалы BarsikChat предоставляются «как есть». BarsikChat не даёт
            никаких гарантий, явных или подразумеваемых, включая гарантии
            товарной пригодности или соответствия определённой цели.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">4. Ограничение ответственности</h2>
          <p>
            BarsikChat не несёт ответственности за любые убытки, возникшие
            в результате использования или невозможности использования сервиса.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">5. Точность материалов</h2>
          <p>
            Материалы BarsikChat могут содержать технические или типографские
            ошибки. BarsikChat может вносить изменения в любое время без
            предварительного уведомления.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">6. Ссылки</h2>
          <p>
            BarsikChat не несёт ответственности за содержание внешних сайтов,
            на которые могут вести ссылки из приложения. Использование таких
            сайтов осуществляется на ваш собственный риск.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">7. Изменения условий</h2>
          <p>
            BarsikChat может пересмотреть настоящие условия в любое время.
            Продолжая использовать приложение, вы соглашаетесь с актуальной
            версией условий.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">8. Правила поведения</h2>
          <p className="mb-3">Пользователи обязуются не:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Оскорблять, преследовать или угрожать другим пользователям</li>
            <li>Отправлять спам и рекламу</li>
            <li>Пытаться получить несанкционированный доступ к сервису</li>
            <li>Нарушать применимые законы и нормативные акты</li>
            <li>Распространять личную информацию других лиц без согласия</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">9. Прекращение доступа</h2>
          <p>
            Мы оставляем за собой право заблокировать или удалить ваш аккаунт
            без предварительного уведомления в случае нарушения настоящих условий.
          </p>
        </section>

        <footer className="mt-12 border-t border-bgSecondary pt-6 dark:border-bgSecondary-dark">
          <p className="text-sm opacity-70">Последнее обновление: 23 января 2026</p>
        </footer>
      </div>
    </MainContainer>
  );
};

export default TermsOfService;
