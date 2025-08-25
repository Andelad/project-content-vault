// Test to verify milestone date picker logic fixes

// Test scenario 1: Creating first milestone
// Project: Jan 1 to Jan 31
// Expected: First milestone should have date range from Jan 2 to Jan 30
// Default date should be Jan 2

function testFirstMilestone() {
  const projectStartDate = new Date('2025-01-01');
  const projectEndDate = new Date('2025-01-31');
  const existingMilestones = [];
  
  // Simulate creating a new milestone with default date logic
  const getDefaultMilestoneDate = (projectStartDate, projectEndDate, existingMilestones) => {
    let defaultDate = new Date(projectStartDate);
    defaultDate.setDate(defaultDate.getDate() + 1);
    
    if (existingMilestones.length > 0) {
      const sortedMilestones = [...existingMilestones].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      const lastMilestone = sortedMilestones[sortedMilestones.length - 1];
      const dayAfterLast = new Date(lastMilestone.dueDate);
      dayAfterLast.setDate(dayAfterLast.getDate() + 1);
      
      if (dayAfterLast > defaultDate) {
        defaultDate = dayAfterLast;
      }
    }
    
    const projectEnd = new Date(projectEndDate);
    projectEnd.setDate(projectEnd.getDate() - 1);
    if (defaultDate > projectEnd) {
      defaultDate = projectEnd;
    }
    
    return defaultDate;
  };
  
  const firstMilestoneDate = getDefaultMilestoneDate(projectStartDate, projectEndDate, existingMilestones);
  
  console.log('Test 1 - First Milestone:');
  console.log(`Project range: ${projectStartDate.toDateString()} to ${projectEndDate.toDateString()}`);
  console.log(`First milestone default date: ${firstMilestoneDate.toDateString()}`);
  console.log(`Expected: ${new Date('2025-01-02').toDateString()}`);
  console.log(`✓ Test passed: ${firstMilestoneDate.getTime() === new Date('2025-01-02').getTime()}\n`);
}

// Test scenario 2: Creating second milestone after first
// Project: Jan 1 to Jan 31
// First milestone: Jan 10
// Expected: Second milestone should have date range from Jan 11 to Jan 30
// Default date should be Jan 11

function testSecondMilestone() {
  const projectStartDate = new Date('2025-01-01');
  const projectEndDate = new Date('2025-01-31');
  const existingMilestones = [
    { id: '1', dueDate: new Date('2025-01-10') }
  ];
  
  const getDefaultMilestoneDate = (projectStartDate, projectEndDate, existingMilestones) => {
    let defaultDate = new Date(projectStartDate);
    defaultDate.setDate(defaultDate.getDate() + 1);
    
    if (existingMilestones.length > 0) {
      const sortedMilestones = [...existingMilestones].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      const lastMilestone = sortedMilestones[sortedMilestones.length - 1];
      const dayAfterLast = new Date(lastMilestone.dueDate);
      dayAfterLast.setDate(dayAfterLast.getDate() + 1);
      
      if (dayAfterLast > defaultDate) {
        defaultDate = dayAfterLast;
      }
    }
    
    const projectEnd = new Date(projectEndDate);
    projectEnd.setDate(projectEnd.getDate() - 1);
    if (defaultDate > projectEnd) {
      defaultDate = projectEnd;
    }
    
    return defaultDate;
  };
  
  const secondMilestoneDate = getDefaultMilestoneDate(projectStartDate, projectEndDate, existingMilestones);
  
  console.log('Test 2 - Second Milestone:');
  console.log(`Project range: ${projectStartDate.toDateString()} to ${projectEndDate.toDateString()}`);
  console.log(`Existing milestone: ${existingMilestones[0].dueDate.toDateString()}`);
  console.log(`Second milestone default date: ${secondMilestoneDate.toDateString()}`);
  console.log(`Expected: ${new Date('2025-01-11').toDateString()}`);
  console.log(`✓ Test passed: ${secondMilestoneDate.getTime() === new Date('2025-01-11').getTime()}\n`);
}

// Test scenario 3: Valid date range calculation for second milestone
// Should only allow dates between first milestone and end date

function testDateRangeCalculation() {
  const projectStartDate = new Date('2025-01-01');
  const projectEndDate = new Date('2025-01-31');
  const firstMilestone = { id: '1', dueDate: new Date('2025-01-10') };
  const secondMilestone = { id: '2', dueDate: new Date('2025-01-20') }; // Current position
  const allMilestones = [firstMilestone, secondMilestone];
  
  const getValidDateRange = (milestone, projectStartDate, projectEndDate, allMilestones) => {
    let minDate = new Date(projectStartDate);
    minDate.setDate(minDate.getDate() + 1);
    
    let maxDate = new Date(projectEndDate);
    maxDate.setDate(maxDate.getDate() - 1);

    const otherMilestones = allMilestones
      .filter(m => m.id !== milestone.id)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    if (otherMilestones.length === 0) {
      return { minDate, maxDate };
    }
    
    const firstOtherMilestone = otherMilestones[0];
    if (milestone.dueDate <= firstOtherMilestone.dueDate) {
      const dayBefore = new Date(firstOtherMilestone.dueDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      maxDate = dayBefore;
      return { minDate, maxDate };
    }
    
    for (let i = 0; i < otherMilestones.length - 1; i++) {
      const currentOther = otherMilestones[i];
      const nextOther = otherMilestones[i + 1];
      
      if (milestone.dueDate > currentOther.dueDate && milestone.dueDate < nextOther.dueDate) {
        const dayAfter = new Date(currentOther.dueDate);
        dayAfter.setDate(dayAfter.getDate() + 1);
        const dayBefore = new Date(nextOther.dueDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        
        return { minDate: dayAfter, maxDate: dayBefore };
      }
    }
    
    const lastOtherMilestone = otherMilestones[otherMilestones.length - 1];
    const dayAfter = new Date(lastOtherMilestone.dueDate);
    dayAfter.setDate(dayAfter.getDate() + 1);
    minDate = dayAfter;
    
    return { minDate, maxDate };
  };
  
  const { minDate, maxDate } = getValidDateRange(secondMilestone, projectStartDate, projectEndDate, allMilestones);
  
  console.log('Test 3 - Date Range for Second Milestone:');
  console.log(`Project range: ${projectStartDate.toDateString()} to ${projectEndDate.toDateString()}`);
  console.log(`First milestone: ${firstMilestone.dueDate.toDateString()}`);
  console.log(`Second milestone current date: ${secondMilestone.dueDate.toDateString()}`);
  console.log(`Valid range: ${minDate.toDateString()} to ${maxDate.toDateString()}`);
  console.log(`Expected min: ${new Date('2025-01-11').toDateString()}`);
  console.log(`Expected max: ${new Date('2025-01-30').toDateString()}`);
  console.log(`✓ Min date test passed: ${minDate.getTime() === new Date('2025-01-11').getTime()}`);
  console.log(`✓ Max date test passed: ${maxDate.getTime() === new Date('2025-01-30').getTime()}\n`);
}

// Run all tests
testFirstMilestone();
testSecondMilestone();
testDateRangeCalculation();

console.log('All tests completed! 🚀');
