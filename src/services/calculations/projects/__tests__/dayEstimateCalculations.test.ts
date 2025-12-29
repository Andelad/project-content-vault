import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateProjectDayEstimates } from '../dayEstimateCalculations';
import type { Project, PhaseDTO, Phase, Settings, CalendarEvent, Holiday } from '@/types/core';

// Mock TimelineRules to control event breakdown and grouping
vi.mock('@/domain/rules', () => {
  return {
    TimelineRules: {
      filterEventsForProject: vi.fn((events: CalendarEvent[], project: Project) =>
        events.filter((e) => e.projectId === project.id)
      ),
      groupEventsByDate: vi.fn((events: CalendarEvent[]) => {
        const map = new Map<string, CalendarEvent[]>();
        events.forEach((event) => {
          const key = event.startTime.toISOString().slice(0, 10);
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(event);
        });
        return map;
      }),
      calculateDayTimeBreakdown: vi.fn((eventsOnDay: CalendarEvent[]) => {
        return eventsOnDay.reduce(
          (acc, event) => {
            const hours = event.duration ?? 0;
            if (event.type === 'planned') acc.plannedEventHours += hours;
            else acc.completedEventHours += hours;
            return acc;
          },
          { plannedEventHours: 0, completedEventHours: 0 }
        );
      })
    }
  };
});

const baseSettings: Settings = {
  weeklyWorkHours: {
    monday: [{ id: 'slot', startTime: '09:00', endTime: '17:00', duration: 8 }],
    tuesday: [{ id: 'slot', startTime: '09:00', endTime: '17:00', duration: 8 }],
    wednesday: [{ id: 'slot', startTime: '09:00', endTime: '17:00', duration: 8 }],
    thursday: [{ id: 'slot', startTime: '09:00', endTime: '17:00', duration: 8 }],
    friday: [{ id: 'slot', startTime: '09:00', endTime: '17:00', duration: 8 }],
    saturday: [{ id: 'slot', startTime: '09:00', endTime: '17:00', duration: 8 }],
    sunday: []
  }
};

const noHolidays: Holiday[] = [];

// Fixed clock so working-day filtering includes the test range
const NOW = new Date('2025-01-01T00:00:00Z');

describe('dayEstimateCalculations redistribution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('redistributes remaining phase hours across only unblocked working days', () => {
    const project: Project = {
      id: 'p1',
      name: 'Project',
      client: '',
      clientId: '',
      startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-04'),
  estimatedHours: 20,
      color: '#000',
      groupId: 'g1',
      userId: 'u1',
      createdAt: NOW,
      updatedAt: NOW
    };

    const milestone: Phase = {
      id: 'm1',
      name: 'Phase',
      projectId: project.id,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-04'),
      dueDate: new Date('2025-01-04'),
      timeAllocationHours: 9, // total allocation
      timeAllocation: 9,
      userId: 'u1',
      createdAt: NOW,
      updatedAt: NOW
    };

    // Block Jan 2 with an event (planned or completed), so auto-estimate should skip that day
    const events: CalendarEvent[] = [
      {
        id: 'e1',
        title: 'Planned work',
        startTime: new Date('2025-01-02T10:00:00Z'),
        endTime: new Date('2025-01-02T11:00:00Z'),
        duration: 1,
        projectId: project.id,
        color: '#000',
        type: 'planned'
      }
    ];

    const estimates = calculateProjectDayEstimates(project, [milestone], baseSettings, noHolidays, events);
    const milestoneEstimates = estimates.filter((e) => e.source === 'milestone-allocation');

  // Should produce estimates only on unblocked working days (Jan 1, 3, 4)
  expect(milestoneEstimates).toHaveLength(3);
  const dates = milestoneEstimates.map((e) => e.date.toISOString().slice(0, 10)).sort();
  expect(dates).toEqual(['2025-01-01', '2025-01-03', '2025-01-04']);

    // Hours should be evenly redistributed across the remaining days
    const uniqueHours = new Set(milestoneEstimates.map((e) => e.hours));
    expect(uniqueHours.size).toBe(1);
    expect(milestoneEstimates[0].hours).toBeCloseTo(8 / 3); // (9 - 1 planned hour) / 3 days

    // Total must match remaining allocation (no hidden hours)
    const total = milestoneEstimates.reduce((sum, e) => sum + e.hours, 0);
    expect(total).toBeCloseTo(8);
  });
});

describe('auto-estimate clamps when planned+completed exceed allocation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns no auto-estimates when events exceed phase allocation', () => {
    const project: Project = {
      id: 'p-overrun',
      name: 'Project',
      client: '',
      clientId: '',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-05'),
      estimatedHours: 28,
      color: '#000',
      groupId: 'g1',
      userId: 'u1',
      createdAt: NOW,
      updatedAt: NOW
    };

    const phase: Phase = {
      id: 'm-overrun',
      name: 'Phase',
      projectId: project.id,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-05'),
      dueDate: new Date('2025-01-05'),
      timeAllocationHours: 28,
      timeAllocation: 28,
      userId: 'u1',
      createdAt: NOW,
      updatedAt: NOW
    };

    // Planned+completed totals 29h across the phase window
    const events: CalendarEvent[] = [
      {
        id: 'e1',
        title: 'Planned work',
        startTime: new Date('2025-01-02T10:00:00Z'),
        endTime: new Date('2025-01-02T17:00:00Z'),
        duration: 7,
        projectId: project.id,
        color: '#000',
        type: 'planned'
      },
      {
        id: 'e2',
        title: 'Completed work',
        startTime: new Date('2025-01-03T09:00:00Z'),
        endTime: new Date('2025-01-03T18:00:00Z'),
        duration: 9,
        projectId: project.id,
        color: '#000',
        type: 'completed'
      },
      {
        id: 'e3',
        title: 'More completed work',
        startTime: new Date('2025-01-04T09:00:00Z'),
        endTime: new Date('2025-01-04T18:00:00Z'),
        duration: 13,
        projectId: project.id,
        color: '#000',
        type: 'completed'
      }
    ];

    const estimates = calculateProjectDayEstimates(project, [phase], baseSettings, noHolidays, events);
    const autoEstimates = estimates.filter((e) => e.source === 'milestone-allocation');

    expect(autoEstimates).toHaveLength(0);
  });
});

describe('recurring milestone intervals within project window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('monthly recurrence anchored outside project only allocates within project dates', () => {
    const project: Project = {
      id: 'p2',
      name: 'Recurring Project',
      client: '',
      clientId: '',
      startDate: new Date('2025-12-17'),
      endDate: new Date('2025-12-24'),
      estimatedHours: 40,
      color: '#000',
      groupId: 'g1',
      userId: 'u1',
      createdAt: NOW,
      updatedAt: NOW
    };

    const milestone: Phase = {
      id: 'm2',
      name: 'Recurring Phase',
      projectId: project.id,
      endDate: new Date('2025-12-17'),
      dueDate: new Date('2025-12-17'),
      timeAllocationHours: 8,
      timeAllocation: 8,
      isRecurring: true,
      recurringConfig: {
        type: 'monthly',
        interval: 1,
        monthlyPattern: 'date',
        monthlyDate: 16
      },
      userId: 'u1',
      createdAt: NOW,
      updatedAt: NOW
    };

    const estimates = calculateProjectDayEstimates(project, [milestone], baseSettings, noHolidays, []);
    const recurringEstimates = estimates.filter((e) => e.source === 'milestone-allocation');

    // Should only include working days within the project window (anchors outside the window ignored)
    const dates = recurringEstimates.map((e) => e.date.toISOString().slice(0, 10)).sort();
  expect(dates[0] >= '2025-12-17').toBe(true);
  expect(dates[dates.length - 1] <= '2025-12-24').toBe(true);

    // Weekend Sunday should be skipped (base settings have no Sunday hours), so 7 working days
    expect(recurringEstimates).toHaveLength(7);

    const total = recurringEstimates.reduce((sum, e) => sum + e.hours, 0);
    expect(total).toBeCloseTo(8);
  });

  it('weekly recurrence uses prior anchor before project start to bound first interval', () => {
    const project: Project = {
      id: 'p3',
      name: 'Weekly Recurring',
      client: '',
      clientId: '',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-05'),
      estimatedHours: 20,
      color: '#000',
      groupId: 'g1',
      userId: 'u1',
      createdAt: NOW,
      updatedAt: NOW
    };

    const milestone: Phase = {
      id: 'm3',
      name: 'Weekly Phase',
      projectId: project.id,
      endDate: new Date('2025-01-05'),
      dueDate: new Date('2025-01-05'),
      timeAllocationHours: 5,
      timeAllocation: 5,
      isRecurring: true,
      recurringConfig: {
        type: 'weekly',
        interval: 1,
        weeklyDayOfWeek: 0 // Sunday anchor
      },
      userId: 'u1',
      createdAt: NOW,
      updatedAt: NOW
    };

    const estimates = calculateProjectDayEstimates(project, [milestone], baseSettings, noHolidays, []);
    const recurringEstimates = estimates.filter((e) => e.source === 'milestone-allocation');

    const dates = recurringEstimates.map((e) => e.date.toISOString().slice(0, 10)).sort();
  expect(dates[0] >= '2025-01-01').toBe(true);
  expect(dates[dates.length - 1] <= '2025-01-05').toBe(true);

    // Sunday has no working hours; expect Wed-Sat (4 days)
    expect(recurringEstimates).toHaveLength(4);

    const total = recurringEstimates.reduce((sum, e) => sum + e.hours, 0);
    expect(total).toBeCloseTo(5);
  });
});
