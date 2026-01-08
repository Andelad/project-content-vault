/**
 * Calendar Event Orchestrator Tests
 * 
 * Tests for event workflows including:
 * - Event form validation
 * - Event creation workflows
 * - Event update workflows
 * - Recurring event handling
 * 
 * @see src/services/orchestrators/CalendarEventOrchestrator.ts
 */

import { describe, it, expect } from 'vitest';
import { CalendarEventOrchestrator, type EventFormData } from '../CalendarEventOrchestrator';

describe('CalendarEventOrchestrator', () => {
  
  // Test data factory
  const createValidFormData = (overrides: Partial<EventFormData> = {}): EventFormData => ({
    description: 'Test Event',
    notes: '',
    groupId: 'group-1',
    startDate: '2026-01-15',
    startTime: '09:00',
    endDate: '2026-01-15',
    endTime: '10:00',
    projectId: 'project-1',
    color: '#3b82f6',
    completed: false,
    category: 'event' as const,
    isRecurring: false,
    recurringType: 'daily' as const,
    recurringInterval: 1,
    recurringEndType: 'never' as const,
    recurringEndDate: '',
    recurringCount: 0,
    monthlyPattern: 'date' as const,
    monthlyDate: 15,
    monthlyWeekOfMonth: 1,
    monthlyDayOfWeek: 1,
    ...overrides,
  });
  
  describe('validateEventForm', () => {
    it('should validate valid event form data', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData();
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(Object.keys(errors)).toHaveLength(0);
    });
    
    it('should reject event without start date', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        startDate: '',
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(errors.startDateTime).toBeTruthy();
    });
    
    it('should reject event without start time', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        startTime: '',
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(errors.startDateTime).toBeTruthy();
    });
    
    it('should reject event without end date', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        endDate: '',
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(errors.endDateTime).toBeTruthy();
    });
    
    it('should reject event without end time', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        endTime: '',
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(errors.endDateTime).toBeTruthy();
    });
    
    it('should reject event with end before start', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        startDate: '2026-01-15',
        startTime: '10:00',
        endDate: '2026-01-15',
        endTime: '09:00', // Earlier than start
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(errors.endDateTime).toBeTruthy();
    });
    
    it('should validate multi-day event', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        startDate: '2026-01-15',
        startTime: '14:00',
        endDate: '2026-01-17',
        endTime: '10:00',
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(Object.keys(errors)).toHaveLength(0);
    });
    
    it('should validate event spanning midnight', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        startDate: '2026-01-15',
        startTime: '23:00',
        endDate: '2026-01-16',
        endTime: '01:00',
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(Object.keys(errors)).toHaveLength(0);
    });
    
    it('should reject recurring event with invalid interval', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        isRecurring: true,
        recurringInterval: 0, // Invalid
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(errors.recurringInterval).toBeTruthy();
    });
    
    it('should reject recurring event with end date before start', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        isRecurring: true,
        recurringEndType: 'date',
        startDate: '2026-01-15',
        recurringEndDate: '2026-01-10', // Before start
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(errors.recurringEndDate).toBeTruthy();
    });
    
    it('should validate recurring event with valid end date', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        isRecurring: true,
        recurringEndType: 'date',
        startDate: '2026-01-15',
        recurringEndDate: '2026-06-15',
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(Object.keys(errors)).toHaveLength(0);
    });
    
    it('should validate recurring event with never ending', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        isRecurring: true,
        recurringEndType: 'never',
        recurringInterval: 7,
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(Object.keys(errors)).toHaveLength(0);
    });
    
    it('should validate recurring event with count', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        isRecurring: true,
        recurringEndType: 'count',
        recurringCount: 10,
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle same start and end time', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        startDate: '2026-01-15',
        startTime: '10:00',
        endDate: '2026-01-15',
        endTime: '10:00', // Same as start
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      // Should have an error for zero duration
      expect(errors.endDateTime).toBeTruthy();
    });
    
    it('should handle year boundary event', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        startDate: '2025-12-31',
        startTime: '23:00',
        endDate: '2026-01-01',
        endTime: '01:00',
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(Object.keys(errors)).toHaveLength(0);
    });
    
    it('should handle leap year dates', () => {
      const orchestrator = new CalendarEventOrchestrator();
      const formData = createValidFormData({
        startDate: '2024-02-29', // Leap year
        startTime: '10:00',
        endDate: '2024-02-29',
        endTime: '12:00',
      });
      
      const errors = orchestrator.validateEventForm(formData);
      
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});
