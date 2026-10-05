import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import SignalStripHero from "./components/SignalStripHero";
import {
  AlertsSection,
  GetItSection,
  TrustSection,
  WorkspaceSection,
} from "./components/LandingSections";

export default function LandingPage() {
  return (
    <main className="landing-page">
      <SiteHeader />
      <SignalStripHero />
      <TrustSection />
      <WorkspaceSection />
      <AlertsSection />
      <GetItSection />
      <SiteFooter />
    </main>
  );
}
