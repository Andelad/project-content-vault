import { generateRecurringEvents, validateRecurringConfig } from '../utils/recurringEvents';
import { CalendarEvent } from '../types';

describe('Recurring Events', () => {
  const baseEvent: Omit<CalendarEvent, 'id'> = {
    title: 'Weekly Meeting',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T11:00:00Z'),
    color: '#3b82f6',
    completed: false,
    duration: 1,
    type: 'planned'
  };

  describe('generateRecurringEvents', () => {
    it('should generate weekly recurring events with count', () => {
      const eventData = {
        ...baseEvent,
        recurring: {
          type: 'weekly' as const,
          interval: 1,
          count: 3
        }
      };

      const events = generateRecurringEvents(eventData);
      
      expect(events).toHaveLength(3);
      expect(events[0].startTime).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(events[1].startTime).toEqual(new Date('2024-01-08T10:00:00Z'));
      expect(events[2].startTime).toEqual(new Date('2024-01-15T10:00:00Z'));
      
      // Individual events should not have recurring metadata
      events.forEach(event => {
        expect(event.recurring).toBeUndefined();
      });
    });

    it('should generate daily recurring events', () => {
      const eventData = {
        ...baseEvent,
        recurring: {
          type: 'daily' as const,
          interval: 2, // Every 2 days
          count: 4
        }
      };

      const events = generateRecurringEvents(eventData);
      
      expect(events).toHaveLength(4);
      expect(events[0].startTime).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(events[1].startTime).toEqual(new Date('2024-01-03T10:00:00Z'));
      expect(events[2].startTime).toEqual(new Date('2024-01-05T10:00:00Z'));
      expect(events[3].startTime).toEqual(new Date('2024-01-07T10:00:00Z'));
    });

    it('should generate monthly recurring events', () => {
      const eventData = {
        ...baseEvent,
        recurring: {
          type: 'monthly' as const,
          interval: 1,
          count: 3
        }
      };

      const events = generateRecurringEvents(eventData);
      
      expect(events).toHaveLength(3);
      expect(events[0].startTime).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(events[1].startTime).toEqual(new Date('2024-02-01T10:00:00Z'));
      expect(events[2].startTime).toEqual(new Date('2024-03-01T10:00:00Z'));
    });

    it('should stop at end date even if count is higher', () => {
      const eventData = {
        ...baseEvent,
        recurring: {
          type: 'weekly' as const,
          interval: 1,
          count: 10,
          endDate: new Date('2024-01-15T00:00:00Z')
        }
      };

      const events = generateRecurringEvents(eventData);
      
      // Should only generate 3 events (Jan 1, 8, 15) before hitting end date
      expect(events).toHaveLength(3);
      expect(events[2].startTime).toEqual(new Date('2024-01-15T10:00:00Z'));
    });

    it('should return single event for non-recurring events', () => {
      const events = generateRecurringEvents(baseEvent);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(baseEvent);
    });

    it('should preserve event duration correctly', () => {
      const eventData = {
        ...baseEvent,
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:30:00Z'), // 2.5 hour duration
        recurring: {
          type: 'weekly' as const,
          interval: 1,
          count: 2
        }
      };

      const events = generateRecurringEvents(eventData);
      
      expect(events).toHaveLength(2);
      
      // Check first event
      expect(events[0].startTime).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(events[0].endTime).toEqual(new Date('2024-01-01T12:30:00Z'));
      
      // Check second event (one week later)
      expect(events[1].startTime).toEqual(new Date('2024-01-08T10:00:00Z'));
      expect(events[1].endTime).toEqual(new Date('2024-01-08T12:30:00Z'));
    });
  });

  describe('validateRecurringConfig', () => {
    it('should validate valid recurring config', () => {
      const config = {
        type: 'weekly' as const,
        interval: 1,
        count: 10
      };
      
      expect(validateRecurringConfig(config)).toBeNull();
    });

    it('should reject zero interval', () => {
      const config = {
        type: 'weekly' as const,
        interval: 0,
        count: 10
      };
      
      expect(validateRecurringConfig(config)).toBe('Interval must be greater than 0');
    });

    it('should reject negative interval', () => {
      const config = {
        type: 'weekly' as const,
        interval: -1,
        count: 10
      };
      
      expect(validateRecurringConfig(config)).toBe('Interval must be greater than 0');
    });

    it('should reject both end date and count', () => {
      const config = {
        type: 'weekly' as const,
        interval: 1,
        count: 10,
        endDate: new Date('2024-01-15T00:00:00Z')
      };
      
      expect(validateRecurringConfig(config)).toBe('Cannot specify both end date and count');
    });

    it('should reject zero count', () => {
      const config = {
        type: 'weekly' as const,
        interval: 1,
        count: 0
      };
      
      expect(validateRecurringConfig(config)).toBe('Count must be greater than 0');
    });

    it('should accept end date without count', () => {
      const config = {
        type: 'weekly' as const,
        interval: 1,
        endDate: new Date('2024-01-15T00:00:00Z')
      };
      
      expect(validateRecurringConfig(config)).toBeNull();
    });

    it('should return null for null config', () => {
      expect(validateRecurringConfig(null)).toBeNull();
      expect(validateRecurringConfig(undefined)).toBeNull();
    });
  });
});
