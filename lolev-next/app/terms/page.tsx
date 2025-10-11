export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: October 2, 2025
          </p>
        </div>

        <div className="space-y-4">
          <section>
            <p className="text-muted-foreground">
              By accessing and using lolev.beer, you accept and agree to be bound by the terms and provisions of this agreement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Use License</h2>
            <p className="text-muted-foreground">Permission is granted to temporarily access the materials on lolev.beer for personal, non-commercial use only. You may not modify, distribute, or reproduce any content without prior written permission.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Age Restriction</h2>
            <p className="text-muted-foreground">You must be 21 years or older to use this website. By using this site, you represent that you are of legal drinking age.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Disclaimer</h2>
            <p className="text-muted-foreground">The materials on lolev.beer are provided on an 'as is' basis. Lolev Beer makes no warranties, expressed or implied, and hereby disclaims all other warranties including, without limitation, implied warranties for a particular purpose.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Limitations</h2>
            <p className="text-muted-foreground">In no event shall Lolev Beer or its suppliers be liable for any damages arising out of the use or inability to use the materials on lolev.beer.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Accuracy of Materials</h2>
            <p className="text-muted-foreground">The materials appearing on lolev.beer could include technical, typographical, or photographic errors. We do not warrant that any materials are accurate, complete, or current.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Links</h2>
            <p className="text-muted-foreground">We have not reviewed all sites linked to our website and are not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Lolev Beer.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Modifications</h2>
            <p className="text-muted-foreground">Lolev Beer may revise these terms of service at any time without notice. By using this website you are agreeing to be bound by the current version of these terms of service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
            <div className="text-muted-foreground">
              <p>Lolev Beer</p>
              <p>Email: <a href="mailto:info@lolev.beer" className="text-primary hover:underline">info@lolev.beer</a></p>
              <p>Phone: <a href="tel:4123368965" className="text-primary hover:underline">(412) 336-8965</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
