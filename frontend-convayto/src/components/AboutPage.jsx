import { FaGithub, FaLinkedin, FaTwitter } from "react-icons/fa";
import { MdOpenInNew } from "react-icons/md";
import MainContainer from "./MainContainer";

const AboutPage = () => {
  return (
    <MainContainer>
      <div className="mx-auto max-w-4xl px-4 py-8 leading-relaxed">
        <h1 className="sr-only">About Convayto</h1>

        <img
          className="pointer-events-none mx-auto mb-6 w-full max-w-xs select-none"
          src="/images/convayto-logo.png"
          alt="Convayto"
        />

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Project Overview</h2>
          <p>
            Convayto is an open-source real-time chat application built with
            React.js and Supabase. It demonstrates modern web development
            practices and is designed as a learning resource for developers
            interested in real-time features, authentication, and full-stack
            development. Whether you're learning React patterns or exploring
            Supabase capabilities, Convayto provides a solid foundation to
            understand and build upon.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Goals</h2>
          <ul className="list-disc pl-5">
            <li>
              Build a real-world example of modern React patterns and practices.
            </li>
            <li>
              Demonstrate real-time data synchronization with Supabase Realtime.
            </li>
            <li>
              Provide a learning resource for developers interested in
              authentication, database design, and responsive UI.
            </li>
            <li>
              Create an open-source project that encourages learning,
              contributions, and community collaboration.
            </li>
            <li>
              Show how to build performant applications with infinite
              pagination, smart caching, and optimized data fetching.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Developer</h2>

          <div className="mb-4 flex flex-col items-center gap-4 sm:flex-row">
            <img
              src="https://github.com/CodeWithAlamin.png"
              alt="Alamin's Photo"
              className="h-36 w-36 rounded-md"
            />

            <div>
              <p className="mb-2">
                Convayto is developed and maintained by{" "}
                <strong className="text-bgAccent dark:text-textAccent-dark">
                  Alamin
                </strong>
                , a passionate web developer dedicated to building and learning.
                Connect with me on LinkedIn, Twitter, and GitHub.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-textAccent dark:text-textAccent-dark">
            <a
              href="https://www.linkedin.com/in/CodeWithAlamin"
              className="flex items-center hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaLinkedin className="mr-2" /> LinkedIn
            </a>
            <a
              href="https://twitter.com/CodeWithAlamin"
              className="flex items-center hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaTwitter className="mr-2" /> X (Twitter)
            </a>
            <a
              href="https://github.com/CodeWithAlamin"
              className="flex items-center hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaGithub className="mr-2" /> GitHub
            </a>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 grid-rows-2 gap-2 sm:grid-cols-2 sm:grid-rows-1">
          <a
            href="https://github.com/CodeWithAlamin/Convayto"
            className="flex items-center justify-center rounded-lg bg-gray-800 px-6 py-3 text-white hover:bg-gray-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Source Code</span>
            <FaGithub className="ml-2" />
          </a>

          <a
            href="https://convayto.vercel.app"
            className="flex items-center justify-center rounded-lg bg-textAccent px-6 py-3 text-white hover:bg-textAccentDim dark:bg-textAccentDim dark:hover:bg-textAccentDim-dark"
            rel="noopener noreferrer"
          >
            <span>Convayto</span>
            <MdOpenInNew className="ml-2" />
          </a>
        </section>

        <footer className="mt-6 text-center text-sm opacity-70">
          <p>
            © Copyright by{" "}
            <a
              href="https://www.linkedin.com/in/CodeWithAlamin"
              className="text-blue-500 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Alamin
            </a>
            . Licensed under the Apache License 2.0. Contributions are welcome!.
          </p>
        </footer>
      </div>
    </MainContainer>
  );
};

export default AboutPage;
