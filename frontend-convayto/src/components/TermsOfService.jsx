import MainContainer from "./MainContainer";

const TermsOfService = () => {
  return (
    <MainContainer>
      <div className="mx-auto max-w-4xl px-4 py-8 leading-relaxed">
        <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing and using Convayto, you accept and agree to be bound by
            the terms and provision of this agreement. If you do not agree to
            abide by the above, please do not use this service.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">2. Use License</h2>
          <p className="mb-3">
            Permission is granted to temporarily download one copy of the
            materials (information or software) on Convayto for personal,
            non-commercial transitory viewing only. This is the grant of a
            license, not a transfer of title, and under this license you may
            not:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Modify or copy the materials</li>
            <li>
              Use the materials for any commercial purpose or for any public
              display
            </li>
            <li>
              Attempt to decompile or reverse engineer any software contained on
              Convayto
            </li>
            <li>
              Remove any copyright or proprietary notations from the materials
            </li>
            <li>
              Transfer the materials to another person or "mirror" the materials
              on any other server
            </li>
            <li>Transmit harmful or malicious code through the platform</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">3. Disclaimer</h2>
          <p>
            The materials on Convayto are provided on an "as is" basis. Convayto
            makes no warranties, expressed or implied, and hereby disclaims and
            negates all other warranties including, without limitation, implied
            warranties or conditions of merchantability, fitness for a
            particular purpose, or non-infringement of intellectual property or
            other violation of rights.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">4. Limitations</h2>
          <p>
            In no event shall Convayto or its suppliers be liable for any
            damages (including, without limitation, damages for loss of data or
            profit, or due to business interruption) arising out of the use or
            inability to use the materials on Convayto, even if we or our
            authorized representative has been notified orally or in writing of
            the possibility of such damage.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">
            5. Accuracy of Materials
          </h2>
          <p>
            The materials appearing on Convayto could include technical,
            typographical, or photographic errors. Convayto does not warrant
            that any of the materials on our application are accurate, complete,
            or current. Convayto may make changes to the materials contained on
            our application at any time without notice.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">6. Links</h2>
          <p>
            Convayto has not reviewed all of the sites linked to its application
            and is not responsible for the contents of any such linked site. The
            inclusion of any link does not imply endorsement by Convayto of the
            site. Use of any such linked website is at the user's own risk.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">7. Modifications</h2>
          <p>
            Convayto may revise these terms of service for our application at
            any time without notice. By using this application, you are agreeing
            to be bound by the then current version of these terms of service.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">8. Governing Law</h2>
          <p>
            These terms and conditions are governed by and construed in
            accordance with the laws of the jurisdiction in which the service is
            provided, and you irrevocably submit to the exclusive jurisdiction
            of the courts in that location.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">9. User Conduct</h2>
          <p className="mb-3">Users agree not to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Harass, abuse, or threaten other users</li>
            <li>Post spam, advertisements, or promotional content</li>
            <li>Attempt unauthorized access to the service</li>
            <li>Violate any applicable laws or regulations</li>
            <li>
              Share sensitive or private information of others without consent
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-xl font-semibold">10. Termination</h2>
          <p>
            We reserve the right to terminate or suspend your account and access
            to the service immediately, without prior notice or liability, for
            any reason whatsoever, including if you breach the Terms.
          </p>
        </section>

        <footer className="mt-12 border-t border-bgSecondary pt-6 dark:border-bgSecondary-dark">
          <p className="text-sm opacity-70">Last updated: January 23, 2026</p>
        </footer>
      </div>
    </MainContainer>
  );
};

export default TermsOfService;
