import { describe, it, expect } from 'vitest';

// Example domain rule test - shows the pattern
describe('Example: How Tests Work', () => {
  describe('Basic test structure', () => {
    it('should pass a simple assertion', () => {
      const result = 1 + 1;
      expect(result).toBe(2);
    });

    it('should test boolean logic', () => {
      const isValid = true;
      expect(isValid).toBe(true);
      expect(isValid).toBeTruthy();
    });

    it('should test strings', () => {
      const message = 'Hello, World!';
      expect(message).toContain('World');
      expect(message).toHaveLength(13);
    });

    it('should test arrays', () => {
      const numbers = [1, 2, 3, 4, 5];
      expect(numbers).toHaveLength(5);
      expect(numbers).toContain(3);
      expect(numbers[0]).toBe(1);
    });

    it('should test objects', () => {
      const user = { name: 'John', age: 30 };
      expect(user).toHaveProperty('name');
      expect(user.name).toBe('John');
      expect(user).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('Testing dates (relevant for your project)', () => {
    it('should compare dates correctly', () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    });

    it('should validate date logic', () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      
      // This is business logic validation
      const isValidRange = end >= start;
      expect(isValidRange).toBe(true);
    });

    it('should fail when dates are invalid', () => {
      const start = new Date('2025-01-31');
      const end = new Date('2025-01-01');
      
      const isValidRange = end >= start;
      expect(isValidRange).toBe(false); // This test passes because we EXPECT it to be false
    });
  });

  describe('Testing business logic patterns', () => {
    // Example: Simple validation function (like your domain rules)
    function validateProject(project: { name: string; hours: number }) {
      const errors: string[] = [];
      
      if (!project.name || project.name.trim() === '') {
        errors.push('Name is required');
      }
      
      if (project.hours <= 0) {
        errors.push('Hours must be positive');
      }
      
      if (project.hours > 1000) {
        errors.push('Hours cannot exceed 1000');
      }
      
      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    }

    it('should validate valid project', () => {
      const result = validateProject({ name: 'Test Project', hours: 40 });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should fail when name is empty', () => {
      const result = validateProject({ name: '', hours: 40 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should fail when hours are negative', () => {
      const result = validateProject({ name: 'Test', hours: -10 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Hours must be positive');
    });

    it('should fail when hours exceed limit', () => {
      const result = validateProject({ name: 'Test', hours: 1500 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Hours cannot exceed 1000');
    });

    it('should accumulate multiple errors', () => {
      const result = validateProject({ name: '', hours: -10 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Name is required');
      expect(result.errors).toContain('Hours must be positive');
    });
  });

  describe('How matchers work', () => {
    it('toBe vs toEqual', () => {
      // toBe: strict equality (===)
      expect(5).toBe(5);
      
      // toEqual: deep equality (for objects/arrays)
      expect({ a: 1 }).toEqual({ a: 1 });
      // expect({ a: 1 }).toBe({ a: 1 }); // This would FAIL!
    });

    it('truthy/falsy matchers', () => {
      expect(true).toBeTruthy();
      expect(1).toBeTruthy();
      expect('hello').toBeTruthy();
      
      expect(false).toBeFalsy();
      expect(0).toBeFalsy();
      expect('').toBeFalsy();
      expect(null).toBeFalsy();
      expect(undefined).toBeFalsy();
    });

    it('number matchers', () => {
      expect(10).toBeGreaterThan(5);
      expect(5).toBeLessThan(10);
      expect(10).toBeGreaterThanOrEqual(10);
      expect(5).toBeLessThanOrEqual(5);
      expect(0.1 + 0.2).toBeCloseTo(0.3); // Floating point safe
    });

    it('string matchers', () => {
      expect('Hello World').toContain('World');
      expect('test@example.com').toMatch(/^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/);
      expect('HELLO').toEqual('HELLO');
    });

    it('array/object matchers', () => {
      expect([1, 2, 3]).toHaveLength(3);
      expect([1, 2, 3]).toContain(2);
      expect({ name: 'John' }).toHaveProperty('name');
      expect({ name: 'John', age: 30 }).toMatchObject({ name: 'John' });
    });
  });

  describe('Testing async code', () => {
    it('should test promises', async () => {
      const fetchData = () => Promise.resolve('data');
      
      const result = await fetchData();
      expect(result).toBe('data');
    });

    it('should test rejected promises', async () => {
      const fetchData = () => Promise.reject(new Error('Failed'));
      
      await expect(fetchData()).rejects.toThrow('Failed');
    });

    it('should test async/await', async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });
});

// This file demonstrates:
// 1. How to structure tests with describe/it blocks
// 2. Different matcher types (toBe, toEqual, toContain, etc.)
// 3. How to test business logic validation
// 4. How to test async code
// 5. Common patterns you'll use in your real tests
