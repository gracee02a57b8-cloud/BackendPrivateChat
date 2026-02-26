import MainContainer from "./MainContainer";

const PrivacyPolicy = () => {
  return (
    <MainContainer>
      <div className="mx-auto max-w-4xl px-4 py-8 leading-relaxed">
        <h1 className="mb-8 text-3xl font-bold">Политика конфиденциальности</h1>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">1. Введение</h2>
          <p>
            BarsikChat («мы», «наш» или «нас») стремится защитить вашу
            конфиденциальность. Настоящая политика объясняет, как мы собираем,
            используем и защищаем вашу информацию при использовании приложения.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">
            2. Собираемая информация
          </h2>
          <p className="mb-3">Мы собираем следующую информацию:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Данные аккаунта:</strong> имя пользователя, тег и пароль
            </li>
            <li>
              <strong>Данные сообщений:</strong> содержание сообщений, которые
              вы отправляете через приложение
            </li>
            <li>
              <strong>Данные использования:</strong> как вы взаимодействуете
              с приложением
            </li>
            <li>
              <strong>Данные устройства:</strong> IP-адрес, тип браузера
              и устройства
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">
            3. Использование информации
          </h2>
          <p className="mb-3">Мы используем собранную информацию для:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Предоставления и поддержки сервиса BarsikChat</li>
            <li>Аутентификации вашего аккаунта и управления сессиями</li>
            <li>Доставки сообщений между пользователями</li>
            <li>Улучшения функциональности и пользовательского опыта</li>
            <li>Соблюдения правовых обязательств</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">4. Хранение данных</h2>
          <p>
            Ваши данные надёжно хранятся в базе данных PostgreSQL с применением
            стандартных практик безопасности, включая шифрование паролей
            и регулярное резервное копирование.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">5. Передача данных</h2>
          <p>
            Мы не продаём, не обмениваем и не сдаём в аренду вашу личную
            информацию третьим лицам. Данные могут быть переданы только в той
            мере, которая необходима для предоставления сервиса.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">6. Ваши права</h2>
          <p className="mb-3">Вы имеете право:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Получить доступ к своим персональным данным</li>
            <li>Запросить исправление неточной информации</li>
            <li>Запросить удаление аккаунта и связанных данных</li>
            <li>Отказаться от необязательного сбора данных</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">7. Безопасность</h2>
          <p>
            Мы применяем хеширование паролей, JWT-аутентификацию и безопасное
            управление сессиями. Однако ни один способ передачи данных через
            интернет не является на 100% безопасным. Мы рекомендуем использовать
            надёжные пароли.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">
            8. Изменения политики
          </h2>
          <p>
            Мы можем периодически обновлять настоящую политику. Изменения
            вступают в силу с момента публикации в приложении. Продолжение
            использования BarsikChat означает принятие обновлённой политики.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">9. Контакты</h2>
          <p>
            По вопросам о настоящей политике конфиденциальности свяжитесь
            с администрацией через приложение.
          </p>
        </section>

        <footer className="mt-12 border-t border-bgSecondary pt-6 dark:border-bgSecondary-dark">
          <p className="text-sm opacity-70">Последнее обновление: 23 января 2026</p>
        </footer>
      </div>
    </MainContainer>
  );
};

export default PrivacyPolicy;
