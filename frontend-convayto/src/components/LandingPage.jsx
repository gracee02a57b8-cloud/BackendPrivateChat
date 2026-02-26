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
      title: "Real-Time Chat",
      description:
        "Send and receive messages instantly with Supabase Realtime for live message updates.",
    },
    {
      icon: <MdSecurity className="h-8 w-8" />,
      title: "Secure Authentication",
      description:
        "Built-in user authentication with secure password handling and session management via Supabase.",
    },
    {
      icon: <MdSpeed className="h-8 w-8" />,
      title: "Lightning Fast",
      description:
        "Optimized performance with React Query, infinite pagination, and intelligent data prefetching.",
    },
    {
      icon: <FaMobile className="h-8 w-8" />,
      title: "Fully Responsive",
      description:
        "Seamlessly works on desktop, tablet, and mobile devices with adaptive UI design.",
    },
    {
      icon: <FaShieldAlt className="h-8 w-8" />,
      title: "Profile Management",
      description:
        "Customize your profile with profile pictures and personal information with full control.",
    },
    {
      icon: <IoSparkles className="h-8 w-8" />,
      title: "Dark Mode Support",
      description:
        "Toggle between light and dark themes for a comfortable experience at any time of day.",
    },
  ];

  const stats = [
    { number: "100%", label: "Open Source" },
    { number: "Real-Time", label: "Messaging" },
    { number: "Secure", label: "Authentication" },
    { number: "Responsive", label: "Design" },
  ];

  return (
    <MainContainer>
      {/* Hero Section */}
      <section className="w-full px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img
              src="/images/convayto-logo.png"
              alt="Convayto Logo"
              className="h-24 w-auto sm:h-32"
            />
          </div>

          {/* Main Heading */}
          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            Connect Instantly,
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              {" "}
              Chat Seamlessly
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-textSecondary dark:text-textSecondary-dark mb-8 text-lg sm:text-xl">
            Experience real-time messaging with security and performance at its
            core. Built with React and Supabase for a modern chat experience.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <button
              onClick={() => navigate("/signup")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-4 font-semibold text-white transition duration-300 hover:shadow-lg hover:shadow-blue-500/50"
            >
              Get Started
              <FaArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/signin")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-current px-8 py-4 font-semibold transition duration-300 hover:bg-opacity-10 hover:backdrop-blur"
            >
              Sign In
              <FaArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Hero Image */}
          <div className="mt-12 sm:mt-16">
            <img
              src="/images/convayto-mockup.jpg"
              alt="Convayto Mockup"
              className="mx-auto w-full max-w-sm rounded-lg shadow-lg sm:max-w-md sm:shadow-xl md:max-w-2xl md:rounded-xl md:shadow-2xl"
            />
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
              Powerful Features Built for You
            </h2>
            <p className="text-textSecondary dark:text-textSecondary-dark text-lg">
              Everything you need for seamless real-time communication
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
                Why Choose Convayto?
              </h2>
              <ul className="space-y-4">
                {[
                  "Open source and transparent",
                  "Built with modern technologies",
                  "Focused on user privacy",
                  "Continuous improvements",
                  "Active community support",
                  "Free to use and deploy",
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
                  Join thousands of users chatting on Convayto
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
              Built With Modern Technology
            </h2>
            <p className="text-textSecondary dark:text-textSecondary-dark text-lg">
              Using industry-leading tools and frameworks
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "React", description: "UI Library" },
              { name: "Supabase", description: "Backend & Database" },
              { name: "Tailwind CSS", description: "Styling" },
              { name: "React Query", description: "Data Fetching" },
              { name: "React Router", description: "Routing" },
              { name: "React Hook Form", description: "Form Management" },
              { name: "Vite", description: "Build Tool" },
              { name: "Supabase Realtime", description: "Real-Time Updates" },
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
              <h2 className="text-2xl font-bold">Privacy & Security</h2>
            </div>
            <p className="text-textSecondary dark:text-textSecondary-dark mb-4 text-lg">
              Built on Supabase infrastructure with secure authentication and
              protected access control. Your data is handled by industry-trusted
              services.
            </p>
            <ul className="text-textSecondary dark:text-textSecondary-dark space-y-2">
              <li>✓ Secure authentication via Supabase Auth</li>
              <li>✓ Password hashing and encryption</li>
              <li>✓ Protected routes and access control</li>
              <li>✓ Open source for transparency</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
            Ready to Start Chatting?
          </h2>
          <p className="text-textSecondary dark:text-textSecondary-dark mb-8 text-lg">
            Create your account now and connect with others in real-time. It
            only takes a minute.
          </p>
          <button
            onClick={() => navigate("/signup")}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-12 py-4 text-lg font-semibold text-white transition duration-300 hover:shadow-lg hover:shadow-blue-500/50"
          >
            Get Started Now
            <FaArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <section className="w-full border-t border-bgSecondary bg-white/30 px-4 py-12 dark:border-bgSecondary-dark dark:bg-black/30 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="mb-4 font-semibold">About</h3>
              <ul className="text-textSecondary dark:text-textSecondary-dark space-y-2 text-sm">
                <li>
                  <a
                    href="/about"
                    className="hover:text-textPrimary dark:hover:text-textPrimary-dark"
                  >
                    About Convayto
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/CodeWithAlamin/Convayto"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-textPrimary dark:hover:text-textPrimary-dark"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Legal</h3>
              <ul className="text-textSecondary dark:text-textSecondary-dark space-y-2 text-sm">
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-textPrimary dark:hover:text-textPrimary-dark"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-textPrimary dark:hover:text-textPrimary-dark"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Connect</h3>
              <ul className="text-textSecondary dark:text-textSecondary-dark space-y-2 text-sm">
                <li>
                  <a
                    href="https://x.com/CodeWithAlamin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-textPrimary dark:hover:text-textPrimary-dark"
                  >
                    Twitter
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com/in/CodeWithAlamin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-textPrimary dark:hover:text-textPrimary-dark"
                  >
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="text-textSecondary dark:text-textSecondary-dark mt-8 border-t border-bgSecondary pt-8 text-center text-sm dark:border-bgSecondary-dark">
            <p>
              © {new Date().getFullYear()} Convayto. All rights reserved.
              Licensed under Apache 2.0
            </p>
          </div>
        </div>
      </section>
    </MainContainer>
  );
};

export default LandingPage;
