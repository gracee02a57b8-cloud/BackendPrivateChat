import MainContainer from "./MainContainer";

const PrivacyPolicy = () => {
  return (
    <MainContainer>
      <div className="mx-auto max-w-4xl px-4 py-8 leading-relaxed">
        <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">1. Introduction</h2>
          <p>
            Convayto ("we", "our", or "us") is committed to protecting your
            privacy. This Privacy Policy explains how we collect, use, and
            protect your information when you use our application.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">
            2. Information We Collect
          </h2>
          <p className="mb-3">We collect the following information:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Account Information:</strong> Email, username, full name,
              and profile picture
            </li>
            <li>
              <strong>Message Data:</strong> Content of messages you send
              through the app
            </li>
            <li>
              <strong>Usage Data:</strong> How you interact with the application
            </li>
            <li>
              <strong>Device Information:</strong> IP address, browser type, and
              device type
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">
            3. How We Use Your Information
          </h2>
          <p className="mb-3">We use collected information to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Provide and maintain the Convayto service</li>
            <li>Authenticate your account and manage your session</li>
            <li>Deliver messages between users</li>
            <li>Improve application functionality and user experience</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">4. Data Storage</h2>
          <p>
            Your data is stored securely using Supabase, a PostgreSQL-based
            backend service. Supabase implements industry-standard security
            practices including encryption, Row-Level Security policies, and
            regular backups.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">5. Data Sharing</h2>
          <p>
            We do not sell, trade, or rent your personal information to third
            parties. Your data may be shared only to the extent necessary to
            provide the service (e.g., your profile is visible to other users
            for chat purposes).
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">6. Your Rights</h2>
          <p className="mb-3">You have the right to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Access your personal data</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your account and associated data</li>
            <li>Opt-out of non-essential data collection</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, contact us through GitHub issues or the
            contact information provided in the application.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">7. Security</h2>
          <p>
            We implement Row-Level Security at the database level, password
            hashing, and secure session management. However, no method of
            transmission over the internet is 100% secure. We encourage you to
            use strong passwords and secure connections.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">
            8. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy periodically. Changes will be
            effective when posted to the application. Your continued use of
            Convayto constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">9. Contact Us</h2>
          <p>
            For questions about this Privacy Policy, please open an issue on our{" "}
            <a
              href="https://github.com/CodeWithAlamin/Convayto"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              GitHub repository
            </a>
            .
          </p>
        </section>

        <footer className="mt-12 border-t border-bgSecondary pt-6 dark:border-bgSecondary-dark">
          <p className="text-sm opacity-70">Last updated: January 23, 2026</p>
        </footer>
      </div>
    </MainContainer>
  );
};

export default PrivacyPolicy;
