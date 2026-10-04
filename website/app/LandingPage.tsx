import HeroSection from "./HeroSection";
import OperationMarquee from "./OperationMarquee";
import ProductStory from "./ProductStory";
import CapabilitiesSection from "./CapabilitiesSection";
import TabStack from "./TabStack";
import EndingSection from "./EndingSection";

export default function LandingPage() {
  return (
    <main className="landing-page">
      <HeroSection />
      <OperationMarquee />
      <ProductStory />
      <CapabilitiesSection />
      <section className="tabs-intro" data-section="tabs-intro" id="tabs"><span className="section-kicker">SIX WORKSPACES</span><h2>EVERY TAB</h2><p>One tab for each high-frequency job</p></section>
      <section className="tab-stack-section" data-section="tab-stack"><TabStack /></section>
      <EndingSection />
    </main>
  );
}
