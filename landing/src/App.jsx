import { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Benefits from './components/Benefits';
import Stats from './components/Stats';
import HowItWorks from './components/HowItWorks';
import Features from './components/Features';
import Pricing from './components/Pricing';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Loading from './components/Loading';
import ScrollToTop from './components/ScrollToTop';
import SEO from './components/SEO';
import './App.css';

function App() {
  const [selectedPlan, setSelectedPlan] = useState(null);

  return (
    <div className="App">
      <SEO />
      <Loading />
      <Header />
      <main>
        <Hero />
        <Benefits />
        <Stats />
        <HowItWorks />
        <Features />
        <Pricing onPlanSelect={setSelectedPlan} />
        <Contact selectedPlan={selectedPlan} onPlanApplied={() => setSelectedPlan(null)} />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}

export default App;
