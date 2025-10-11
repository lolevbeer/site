export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: October 2, 2025
          </p>
        </div>

        <div className="space-y-4">
          <section>
            <p className="text-muted-foreground">
              Lolev Beer is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information when you visit lolev.beer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Information We Collect</h2>
            <p className="text-muted-foreground mb-2">We collect browser/device information, usage data, location data, and information you voluntarily provide.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">How We Use Your Information</h2>
            <p className="text-muted-foreground">We use collected information to improve our website, respond to inquiries, send updates (with consent), analyze traffic, and address technical issues.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Information Sharing</h2>
            <p className="text-muted-foreground">We do not sell your personal information. We may share data with service providers, for legal compliance, or to protect our rights and safety.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Security & Children's Privacy</h2>
            <p className="text-muted-foreground">We use security measures to protect your data. Our website is not intended for anyone under 21.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Your Rights</h2>
            <p className="text-muted-foreground">You may have rights to access, update, delete, or restrict processing of your personal data depending on your location.</p>
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
