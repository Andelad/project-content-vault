import React from 'react';
import { ProjectProvider } from './contexts/ProjectContext';
import { TimelineProvider } from './contexts/TimelineContext';
import { PlannerProvider } from './contexts/PlannerContext';
import { SettingsProvider } from './contexts/SettingsContext';

function SimpleApp() {
  const [step, setStep] = React.useState(5); // Start with all contexts

  const tests = [
    { name: 'No contexts', component: <div>Base React app works</div> },
    { name: 'SettingsContext', component: <SettingsProvider><div>SettingsContext works</div></SettingsProvider> },
    { name: 'TimelineContext', component: <TimelineProvider><div>TimelineContext works</div></TimelineProvider> },
    { name: 'PlannerContext', component: <PlannerProvider><div>PlannerContext works</div></PlannerProvider> },
    { name: 'ProjectContext', component: <ProjectProvider><div>ProjectContext works</div></ProjectProvider> },
    { 
      name: 'All contexts combined', 
      component: (
        <SettingsProvider>
          <TimelineProvider>
            <PlannerProvider>
              <ProjectProvider>
                <div>All contexts work together!</div>
              </ProjectProvider>
            </PlannerProvider>
          </TimelineProvider>
        </SettingsProvider>
      )
    }
  ];

  const currentTest = tests[step];

  return (
    <div style={{ padding: '20px' }}>
      <h1>Context Debug Test</h1>
      <h2>Testing: {currentTest.name}</h2>
      <div style={{ margin: '20px 0' }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          Previous
        </button>
        <span style={{ margin: '0 10px' }}>
          {step + 1} / {tests.length}
        </span>
        <button onClick={() => setStep(Math.min(tests.length - 1, step + 1))} disabled={step === tests.length - 1}>
          Next
        </button>
      </div>
      <div style={{ border: '1px solid #ccc', padding: '20px', margin: '20px 0' }}>
        {currentTest.component}
      </div>
    </div>
  );
}

export default SimpleApp;
