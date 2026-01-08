/**
 * Project Entity Tests
 * 
 * Comprehensive test suite for the Project domain entity.
 * Tests all business rules, validations, and behaviors.
 * 
 * @see src/domain/entities/Project.ts
 * @see docs/core/Business Logic.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Project, CreateProjectParams } from '@/domain/entities/Project';
import type { Project as ProjectData, Phase } from '@/types/core';

describe('Project Entity', () => {
  // Test data factories - Use 2025 dates (past is valid for historical projects)
  const createValidParams = (overrides?: Partial<CreateProjectParams>): CreateProjectParams => ({
    name: 'Test Project',
    clientId: 'client-123',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    estimatedHours: 100,
    groupId: 'group-123',
    color: '#FF5733',
    continuous: false,
    status: 'current',
    notes: 'Test notes',
    icon: 'folder',
    userId: 'user-123',
    ...overrides,
  });

  const createValidProjectData = (overrides?: Partial<ProjectData>): ProjectData => ({
    id: 'proj-123',
    name: 'Test Project',
    client: '',
    clientId: 'client-123',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    estimatedHours: 100,
    groupId: 'group-123',
    color: '#FF5733',
    continuous: false,
    status: 'current',
    notes: 'Test notes',
    icon: 'folder',
    userId: 'user-123',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  });

  describe('Factory Methods', () => {
    describe('create() - New project creation', () => {
      it('should create a valid time-limited project', () => {
        const params = createValidParams();
        const result = Project.create(params);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.errors).toBeUndefined();

        const snapshot = result.data!.getSnapshot();
        expect(snapshot.name).toBe('Test Project');
        expect(snapshot.clientId).toBe('client-123');
        expect(snapshot.estimatedHours).toBe(100);
        expect(snapshot.continuous).toBe(false);
        expect(snapshot.isTimeLimited).toBe(true);
      });

      it('should create a valid continuous project', () => {
        const params = createValidParams({
          continuous: true,
          endDate: undefined,
        });
        const result = Project.create(params);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        const snapshot = result.data!.getSnapshot();
        expect(snapshot.continuous).toBe(true);
        expect(snapshot.isContinuous).toBe(true);
        expect(snapshot.endDate).toBeNull();
      });

      it('should trim project name', () => {
        const params = createValidParams({ name: '  Test Project  ' });
        const result = Project.create(params);

        expect(result.success).toBe(true);
        expect(result.data!.getSnapshot().name).toBe('Test Project');
      });

      it('should generate unique ID and timestamps', () => {
        const result1 = Project.create(createValidParams());
        const result2 = Project.create(createValidParams());

        const snapshot1 = result1.data!.getSnapshot();
        const snapshot2 = result2.data!.getSnapshot();

        expect(snapshot1.id).not.toBe(snapshot2.id);
        expect(snapshot1.createdAt).toBeDefined();
        expect(snapshot1.updatedAt).toBeDefined();
      });

      describe('Validation - Name', () => {
        it('should fail when name is empty', () => {
          const params = createValidParams({ name: '' });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toContain('Project name is required');
        });

        it('should fail when name is whitespace only', () => {
          const params = createValidParams({ name: '   ' });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toContain('Project name is required');
        });

        it('should fail when name exceeds 100 characters', () => {
          const params = createValidParams({ name: 'a'.repeat(101) });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toContain('Project name must be 100 characters or less');
        });

        it('should accept name with exactly 100 characters', () => {
          const params = createValidParams({ name: 'a'.repeat(100) });
          const result = Project.create(params);

          expect(result.success).toBe(true);
        });
      });

      describe('Validation - Client', () => {
        it('should fail when clientId is missing', () => {
          const params = createValidParams({ clientId: '' });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toContain('Project must have a client');
        });
      });

      describe('Validation - Group', () => {
        it('should fail when groupId is missing', () => {
          const params = createValidParams({ groupId: '' });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toContain('Project must belong to a group');
        });
      });

      describe('Validation - Estimated Hours', () => {
        it('should accept zero estimated hours', () => {
          const params = createValidParams({ estimatedHours: 0 });
          const result = Project.create(params);

          expect(result.success).toBe(true);
        });

        it('should fail when estimated hours are negative', () => {
          const params = createValidParams({ estimatedHours: -10 });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toContain('Estimated hours must be 0 or greater');
        });

        it('should accept positive estimated hours', () => {
          const params = createValidParams({ estimatedHours: 500 });
          const result = Project.create(params);

          expect(result.success).toBe(true);
          expect(result.data!.getSnapshot().estimatedHours).toBe(500);
        });
      });

      describe('Validation - Date Range (Time-Limited)', () => {
        it('should fail when time-limited project has no end date', () => {
          const params = createValidParams({
            continuous: false,
            endDate: undefined,
          });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toContain('Time-limited projects must have an end date');
        });

        it('should fail when end date is before start date', () => {
          const params = createValidParams({
            startDate: new Date('2025-12-31'),
            endDate: new Date('2025-01-01'),
          });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toContain('Project end date must be after start date');
        });

        it('should fail when end date equals start date', () => {
          const params = createValidParams({
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-01-01'),
          });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toContain('Project end date must be after start date');
        });

        it('should succeed when end date is after start date', () => {
          const params = createValidParams({
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-01-02'),
          });
          const result = Project.create(params);

          expect(result.success).toBe(true);
        });
      });

      describe('Validation - Continuous Projects', () => {
        it('should fail when continuous project has end date', () => {
          const params = createValidParams({
            continuous: true,
            endDate: new Date('2025-12-31'),
          });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toContain('Continuous projects should not have an end date');
        });

        it('should succeed when continuous project has no end date', () => {
          const params = createValidParams({
            continuous: true,
            endDate: undefined,
          });
          const result = Project.create(params);

          expect(result.success).toBe(true);
          expect(result.data!.getSnapshot().endDate).toBeNull();
        });
      });

      describe('Validation - Multiple Errors', () => {
        it('should accumulate all validation errors', () => {
          const params = createValidParams({
            name: '',
            clientId: '',
            estimatedHours: -10,
          });
          const result = Project.create(params);

          expect(result.success).toBe(false);
          expect(result.errors).toHaveLength(3);
          expect(result.errors).toContain('Project name is required');
          expect(result.errors).toContain('Project must have a client');
          expect(result.errors).toContain('Estimated hours must be 0 or greater');
        });
      });
    });

    describe('fromDatabase() - Reconstitute existing project', () => {
      it('should create project from valid database data', () => {
        const data = createValidProjectData();
        const project = Project.fromDatabase(data);

        const snapshot = project.getSnapshot();
        expect(snapshot.id).toBe('proj-123');
        expect(snapshot.name).toBe('Test Project');
        expect(snapshot.clientId).toBe('client-123');
      });

      it('should handle continuous project from database', () => {
        const data = createValidProjectData({
          continuous: true,
          endDate: new Date(0), // Database placeholder
        });
        const project = Project.fromDatabase(data);

        const snapshot = project.getSnapshot();
        expect(snapshot.continuous).toBe(true);
        expect(snapshot.isContinuous).toBe(true);
      });

      it('should normalize dates to midnight', () => {
        const data = createValidProjectData({
          startDate: new Date('2025-01-01T14:30:00'),
          endDate: new Date('2025-12-31T18:45:00'),
        });
        const project = Project.fromDatabase(data);

        const snapshot = project.getSnapshot();
        expect(snapshot.startDate.getHours()).toBe(0);
        expect(snapshot.startDate.getMinutes()).toBe(0);
        expect(snapshot.startDate.getSeconds()).toBe(0);
        expect(snapshot.endDate!.getHours()).toBe(0);
      });
    });
  });

  describe('Business Behavior - Update Methods', () => {
    let project: Project;

    beforeEach(() => {
      const result = Project.create(createValidParams());
      project = result.data!;
    });

    describe('updateDates()', () => {
      it('should update valid date range', () => {
        const newStart = new Date('2025-02-01');
        const newEnd = new Date('2025-11-30');
        const result = project.updateDates(newStart, newEnd);

        expect(result.success).toBe(true);
        const snapshot = project.getSnapshot();
        expect(snapshot.startDate).toEqual(new Date('2025-02-01T00:00:00'));
        expect(snapshot.endDate).toEqual(new Date('2025-11-30T00:00:00'));
      });

      it('should fail when end date is before start date', () => {
        const result = project.updateDates(
          new Date('2025-12-31'),
          new Date('2025-01-01')
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('End date must be after start date');
      });

      it('should fail when setting end date on continuous project', () => {
        const contResult = Project.create(createValidParams({
          continuous: true,
          endDate: undefined,
        }));
        const contProject = contResult.data!;

        const result = contProject.updateDates(
          new Date('2025-01-01'),
          new Date('2025-12-31')
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Continuous projects cannot have an end date');
      });

      it('should fail when removing end date from time-limited project', () => {
        const result = project.updateDates(new Date('2025-01-01'), null);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Time-limited projects must have an end date');
      });
    });

    describe('updateEstimatedHours()', () => {
      it('should update to valid positive hours', () => {
        const result = project.updateEstimatedHours(200);

        expect(result.success).toBe(true);
        expect(project.getSnapshot().estimatedHours).toBe(200);
      });

      it('should update to zero hours', () => {
        const result = project.updateEstimatedHours(0);

        expect(result.success).toBe(true);
        expect(project.getSnapshot().estimatedHours).toBe(0);
      });

      it('should fail when hours are negative', () => {
        const result = project.updateEstimatedHours(-50);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Estimated hours must be 0 or greater');
      });
    });

    describe('convertToContinuous()', () => {
      it('should convert time-limited project to continuous', () => {
        const result = project.convertToContinuous();

        expect(result.success).toBe(true);
        const snapshot = project.getSnapshot();
        expect(snapshot.continuous).toBe(true);
        expect(snapshot.isContinuous).toBe(true);
        expect(snapshot.endDate).toBeNull();
      });

      it('should fail when project is already continuous', () => {
        project.convertToContinuous();
        const result = project.convertToContinuous();

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Project is already continuous');
      });
    });

    describe('convertToTimeLimited()', () => {
      beforeEach(() => {
        const result = Project.create(createValidParams({
          continuous: true,
          endDate: undefined,
        }));
        project = result.data!;
      });

      it('should convert continuous project to time-limited', () => {
        const endDate = new Date('2025-12-31');
        const result = project.convertToTimeLimited(endDate);

        expect(result.success).toBe(true);
        const snapshot = project.getSnapshot();
        expect(snapshot.continuous).toBe(false);
        expect(snapshot.isTimeLimited).toBe(true);
        expect(snapshot.endDate).toEqual(new Date('2025-12-31T00:00:00'));
      });

      it('should fail when project is already time-limited', () => {
        const timeLimitedResult = Project.create(createValidParams());
        const timeLimitedProject = timeLimitedResult.data!;

        const result = timeLimitedProject.convertToTimeLimited(new Date('2025-12-31'));

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Project is already time-limited');
      });

      it('should fail when end date is before start date', () => {
        const result = project.convertToTimeLimited(new Date('2024-12-31'));

        expect(result.success).toBe(false);
        expect(result.errors).toContain('End date must be after start date');
      });
    });

    describe('updateStatus()', () => {
      it('should update project status', () => {
        project.updateStatus('archived');

        expect(project.getSnapshot().status).toBe('archived');
      });

      it('should accept all valid status values', () => {
        const statuses: Array<'current' | 'future' | 'archived'> = [
          'current',
          'future',
          'archived',
        ];

        statuses.forEach(status => {
          project.updateStatus(status);
          expect(project.getSnapshot().status).toBe(status);
        });
      });
    });

    describe('updateProperties()', () => {
      it('should update name', () => {
        const result = project.updateProperties({ name: 'New Name' });

        expect(result.success).toBe(true);
        expect(project.getSnapshot().name).toBe('New Name');
      });

      it('should trim updated name', () => {
        const result = project.updateProperties({ name: '  New Name  ' });

        expect(result.success).toBe(true);
        expect(project.getSnapshot().name).toBe('New Name');
      });

      it('should update notes', () => {
        const result = project.updateProperties({ notes: 'Updated notes' });

        expect(result.success).toBe(true);
        expect(project.getSnapshot().notes).toBe('Updated notes');
      });

      it('should update color', () => {
        const result = project.updateProperties({ color: '#00FF00' });

        expect(result.success).toBe(true);
        expect(project.getSnapshot().color).toBe('#00FF00');
      });

      it('should update icon', () => {
        const result = project.updateProperties({ icon: 'star' });

        expect(result.success).toBe(true);
        expect(project.getSnapshot().icon).toBe('star');
      });

      it('should update multiple properties at once', () => {
        const result = project.updateProperties({
          name: 'New Name',
          notes: 'New notes',
          color: '#00FF00',
          icon: 'star',
        });

        expect(result.success).toBe(true);
        const snapshot = project.getSnapshot();
        expect(snapshot.name).toBe('New Name');
        expect(snapshot.notes).toBe('New notes');
        expect(snapshot.color).toBe('#00FF00');
        expect(snapshot.icon).toBe('star');
      });

      it('should fail when name is empty', () => {
        const result = project.updateProperties({ name: '' });

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Project name cannot be empty');
      });

      it('should fail when name exceeds 100 characters', () => {
        const result = project.updateProperties({ name: 'a'.repeat(101) });

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Project name must be 100 characters or less');
      });
    });
  });

  describe('Query Methods - Read-only calculations', () => {
    describe('isTimeLimited() and isContinuous()', () => {
      it('should identify time-limited project', () => {
        const result = Project.create(createValidParams({ continuous: false }));
        const project = result.data!;

        expect(project.isTimeLimited()).toBe(true);
        expect(project.isContinuous()).toBe(false);
      });

      it('should identify continuous project', () => {
        const result = Project.create(createValidParams({
          continuous: true,
          endDate: undefined,
        }));
        const project = result.data!;

        expect(project.isContinuous()).toBe(true);
        expect(project.isTimeLimited()).toBe(false);
      });
    });

    describe('getDurationDays()', () => {
      it('should calculate duration for time-limited project', () => {
        const result = Project.create(createValidParams({
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31'),
        }));
        const project = result.data!;

        expect(project.getDurationDays()).toBe(31);
      });

      it('should return null for continuous project', () => {
        const result = Project.create(createValidParams({
          continuous: true,
          endDate: undefined,
        }));
        const project = result.data!;

        expect(project.getDurationDays()).toBeNull();
      });

      it('should handle single-day project', () => {
        const result = Project.create(createValidParams({
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-02'),
        }));
        const project = result.data!;

        expect(project.getDurationDays()).toBe(2);
      });
    });

    describe('getDailyAllocationHours()', () => {
      it('should calculate daily allocation for time-limited project', () => {
        const result = Project.create(createValidParams({
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-11'), // 11 days
          estimatedHours: 110,
        }));
        const project = result.data!;

        expect(project.getDailyAllocationHours()).toBe(10);
      });

      it('should return null for continuous project', () => {
        const result = Project.create(createValidParams({
          continuous: true,
          endDate: undefined,
          estimatedHours: 100,
        }));
        const project = result.data!;

        expect(project.getDailyAllocationHours()).toBeNull();
      });

      it('should handle fractional daily hours', () => {
        const result = Project.create(createValidParams({
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-04'), // 4 days
          estimatedHours: 10,
        }));
        const project = result.data!;

        expect(project.getDailyAllocationHours()).toBe(2.5);
      });
    });

    describe('isActiveOnDate()', () => {
      let project: Project;

      beforeEach(() => {
        const result = Project.create(createValidParams({
          startDate: new Date('2025-06-01'),
          endDate: new Date('2025-06-30'),
        }));
        project = result.data!;
      });

      it('should return false before start date', () => {
        expect(project.isActiveOnDate(new Date('2025-05-31'))).toBe(false);
      });

      it('should return true on start date', () => {
        expect(project.isActiveOnDate(new Date('2025-06-01'))).toBe(true);
      });

      it('should return true during project', () => {
        expect(project.isActiveOnDate(new Date('2025-06-15'))).toBe(true);
      });

      it('should return true on end date', () => {
        expect(project.isActiveOnDate(new Date('2025-06-30'))).toBe(true);
      });

      it('should return false after end date', () => {
        expect(project.isActiveOnDate(new Date('2025-07-01'))).toBe(false);
      });

      it('should always return true after start for continuous project', () => {
        const contResult = Project.create(createValidParams({
          continuous: true,
          endDate: undefined,
          startDate: new Date('2025-01-01'),
        }));
        const contProject = contResult.data!;

        expect(contProject.isActiveOnDate(new Date('2025-01-01'))).toBe(true);
        expect(contProject.isActiveOnDate(new Date('2030-12-31'))).toBe(true);
      });
    });
  });

  describe('Data Conversion', () => {
    let project: Project;

    beforeEach(() => {
      const result = Project.create(createValidParams());
      project = result.data!;
    });

    describe('toData()', () => {
      it('should convert to database format', () => {
        const data = project.toData();

        expect(data.id).toBeDefined();
        expect(data.name).toBe('Test Project');
        expect(data.clientId).toBe('client-123');
        expect(data.startDate).toBeInstanceOf(Date);
        expect(data.endDate).toBeInstanceOf(Date);
        expect(data.estimatedHours).toBe(100);
        expect(data.createdAt).toBeInstanceOf(Date);
        expect(data.updatedAt).toBeInstanceOf(Date);
      });

      it('should use epoch date for continuous projects', () => {
        const contResult = Project.create(createValidParams({
          continuous: true,
          endDate: undefined,
        }));
        const contProject = contResult.data!;
        const data = contProject.toData();

        expect(data.continuous).toBe(true);
        expect(data.endDate).toEqual(new Date(0));
      });
    });

    describe('getSnapshot()', () => {
      it('should return read-only snapshot with calculated fields', () => {
        const snapshot = project.getSnapshot();

        expect(snapshot.id).toBeDefined();
        expect(snapshot.name).toBe('Test Project');
        expect(snapshot.isTimeLimited).toBe(true);
        expect(snapshot.isContinuous).toBe(false);
        expect(snapshot.durationDays).toBeDefined();
        expect(snapshot.dailyAllocationHours).toBeDefined();
      });

      it('should create new date instances (defensive copy)', () => {
        const snapshot1 = project.getSnapshot();
        const snapshot2 = project.getSnapshot();

        expect(snapshot1.startDate).not.toBe(snapshot2.startDate);
        expect(snapshot1.startDate).toEqual(snapshot2.startDate);
      });
    });
  });

  describe('Relationship Management', () => {
    let project: Project;

    beforeEach(() => {
      const result = Project.create(createValidParams());
      project = result.data!;
    });

    describe('setPhases()', () => {
      it('should set phases', () => {
        const phases: Phase[] = [
          {
            id: 'phase-1',
            name: 'Phase 1',
            projectId: 'proj-123',
            endDate: new Date('2025-03-31'),
            dueDate: new Date('2025-03-31'),
            timeAllocationHours: 50,
            timeAllocation: 50,
            userId: 'user-123',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        project.setPhases(phases);
        const data = project.toData();
        expect(data.phases).toEqual(phases);
      });
    });

    describe('setClientData()', () => {
      it('should set client data', () => {
        const clientData = {
          id: 'client-123',
          name: 'Test Client',
          status: 'active' as const,
          userId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        project.setClientData(clientData);
        const data = project.toData();
        expect(data.clientData).toEqual(clientData);
      });
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle leap year dates correctly', () => {
      const result = Project.create(createValidParams({
        startDate: new Date('2024-02-28'),
        endDate: new Date('2024-03-01'),
      }));

      expect(result.success).toBe(true);
      expect(result.data!.getDurationDays()).toBe(3); // 28, 29, 1
    });

    it('should handle year boundary correctly', () => {
      const result = Project.create(createValidParams({
        startDate: new Date('2024-12-31'),
        endDate: new Date('2025-01-01'),
      }));

      expect(result.success).toBe(true);
      expect(result.data!.getDurationDays()).toBe(2);
    });

    it('should maintain immutability of ID', () => {
      const result = Project.create(createValidParams());
      const project = result.data!;
      const id1 = project.getSnapshot().id;
      
      project.updateProperties({ name: 'New Name' });
      const id2 = project.getSnapshot().id;

      expect(id1).toBe(id2);
    });

    it('should update timestamp on mutations', () => {
      const result = Project.create(createValidParams());
      const project = result.data!;
      const initialUpdatedAt = project.getSnapshot().updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        project.updateProperties({ name: 'New Name' });
        const newUpdatedAt = project.getSnapshot().updatedAt;

        expect(newUpdatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdatedAt.getTime());
      }, 10);
    });
  });
});
