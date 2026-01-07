import React from 'react';
import { Clock, Calendar, BarChart3, Clock3, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { useAuth } from '@/contexts/AuthContext';

const LandingPage = () => {
  const { user } = useAuth();

  const navigateToApp = () => {
    // If user is logged in, go to app, otherwise go to auth
    window.location.href = user ? '/app' : '/auth';
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/lovable-uploads/b7b3f5f1-d45e-4fc7-9113-f39c988b4951.png" alt="Budgi Logo" className="h-8 w-8" />
          <span className="text-xl font-bold">Budgi</span>
        </div>
        <Button variant="outline" onClick={navigateToApp}>
          {user ? 'Go to App' : 'Sign In'}
        </Button>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 max-w-4xl mx-auto leading-tight">
          Get a bird's eye view of your{' '}
          <span className="bg-gradient-primary bg-clip-text text-transparent">time</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Budgi gives you a visual overview of your time commitments. 
          Need to take a break or add a new client? Budgi lets you see 
          the impact at a glance.
        </p>
        <Button 
          size="lg" 
          className="text-lg px-8 py-6 h-auto"
          onClick={navigateToApp}
        >
          {user ? 'Open Budgi' : 'Get Started'}
        </Button>
      </section>

      {/* Main Feature Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-bold mb-6">
              Plan your calendar to facilitate deep work
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Budgi is built on the notion of time-blocking – creating single-purpose spaces 
              in which to be focussed and efficient. We help you get lost in work, or fully 
              absorbed over coffee with a friend, by helping you plan all your tasks over time.
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-500/20 rounded-lg">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm">Project 1 • Client</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-500/20 rounded-lg">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-sm">Project 2 • Client</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-500/20 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm">Project 3 • Client</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
            <Calendar className="h-8 w-8 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Visual Time Overview</h3>
            <p className="text-muted-foreground">
              Get a visual overview of your time commitments. Plan in your workload, 
              holidays, surprise events, and never lose track of your most important commitments.
            </p>
          </div>
          
          <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
            <BarChart3 className="h-8 w-8 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Workload Visualizer</h3>
            <p className="text-muted-foreground">
              Our workload visualiser helps you see where you've over-committed, 
              and how you can shuffle things around to get back in control.
            </p>
          </div>
          
          <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
            <Clock3 className="h-8 w-8 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Kill Burnout & Procrastination</h3>
            <p className="text-muted-foreground">
              When you don't know how much time you have, it's easy to work too hard. 
              Budgi gives you a live update of your priorities.
            </p>
          </div>
          
          <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
            <Zap className="h-8 w-8 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Auto-Planning Features</h3>
            <p className="text-muted-foreground">
              Our auto-estimate feature helps give you an immediate look at new commitments, 
              while allowing you to plan it into your calendar at a future date.
            </p>
          </div>
          
          <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
            <Shield className="h-8 w-8 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Guilt-Free Breaks</h3>
            <p className="text-muted-foreground">
              Stay on track with clear priorities, or take guilt-free breaks knowing 
              exactly where you stand with your commitments.
            </p>
          </div>
          
          <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
            <Calendar className="h-8 w-8 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Quick Scheduling</h3>
            <p className="text-muted-foreground">
              Quickly schedule a holiday or see the knock-on effect of new deadlines 
              with our intuitive visual interface.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="bg-white/5 rounded-3xl p-12 border border-white/10">
          <h2 className="text-4xl font-bold mb-6">
            Ready to take control of your time?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who use Budgi to plan their time 
            and achieve deep work.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-6 h-auto"
            onClick={navigateToApp}
          >
            {user ? 'Open Budgi' : 'Get Started Free'}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 text-center border-t border-white/10">
        <p className="text-muted-foreground">
          © 2024 Budgi. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;