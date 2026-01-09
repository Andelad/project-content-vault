/**
 * Client Orchestrator Tests
 * 
 * Tests for client management workflows including:
 * - Client validation
 * - Client creation workflows
 * - Client update workflows
 * - Client deletion workflows
 * 
 * Note: These tests focus on validation logic and error handling.
 * Database operations are mocked as they require Supabase integration.
 * 
 * @see src/services/orchestrators/ClientOrchestrator.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientOrchestrator } from '../ClientOrchestrator';
import type { Client, ClientStatus } from '@/shared/types/core';
import { supabase } from '@/infrastructure/database/client';

// Mock Supabase
vi.mock('@/infrastructure/database/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('ClientOrchestrator', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for auth
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);
  });
  
  describe('createClientWorkflow', () => {
    it('should validate required client name', async () => {
      // Mock empty clients list
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);
      
      const result = await ClientOrchestrator.createClientWorkflow({
        name: '', // Invalid: empty name
        status: 'active' as ClientStatus,
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
    
    it('should reject client name that is too long', async () => {
      // Mock empty clients list
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);
      
      const result = await ClientOrchestrator.createClientWorkflow({
        name: 'A'.repeat(300), // Too long
        status: 'active' as ClientStatus,
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
    
    it('should validate email format if provided', async () => {
      // Mock empty clients list
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);
      
      const result = await ClientOrchestrator.createClientWorkflow({
        name: 'Valid Client',
        status: 'active' as ClientStatus,
        contactEmail: 'invalid-email', // Invalid email format
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
    
    it('should detect duplicate client names', async () => {
      const existingClients: Client[] = [
        {
          id: 'client-1',
          userId: 'user-123',
          name: 'Existing Client',
          status: 'active' as ClientStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      // Mock existing clients
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: existingClients.map(c => ({
                id: c.id,
                user_id: c.userId,
                name: c.name,
                status: c.status,
                contact_email: c.contactEmail || null,
                contact_phone: c.contactPhone || null,
                billing_address: c.billingAddress || null,
                notes: c.notes || null,
                created_at: c.createdAt.toISOString(),
                updated_at: c.updatedAt.toISOString(),
              })),
              error: null,
            })),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);
      
      const result = await ClientOrchestrator.createClientWorkflow({
        name: 'Existing Client', // Duplicate
        status: 'active' as ClientStatus,
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.toLowerCase().includes('already exists'))).toBe(true);
    });
    
    it('should successfully create valid client', async () => {
      const newClient = {
        id: 'client-new',
        user_id: 'user-123',
        name: 'New Client',
        status: 'active',
        contact_email: 'client@example.com',
        contact_phone: '+1234567890',
        billing_address: '123 Main St',
        notes: 'Test notes',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Mock empty clients list for duplicate check
      let callCount = 0;
      const mockFrom = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          // First call: getAllClients for duplicate check
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  data: [],
                  error: null,
                })),
              })),
            })),
          };
        } else {
          // Second call: insert new client
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: newClient,
                  error: null,
                })),
              })),
            })),
          };
        }
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);
      
      const result = await ClientOrchestrator.createClientWorkflow({
        name: 'New Client',
        status: 'active' as ClientStatus,
        contactEmail: 'client@example.com',
        contactPhone: '+1234567890',
        billingAddress: '123 Main St',
        notes: 'Test notes',
      });
      
      expect(result.success).toBe(true);
      expect(result.client).toBeDefined();
      expect(result.client?.name).toBe('New Client');
    });
  });
  
  describe('updateClientWorkflow', () => {
    it('should validate updated name', async () => {
      const result = await ClientOrchestrator.updateClientWorkflow('client-1', {
        name: '', // Invalid: empty name
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
    
    it('should validate updated email format', async () => {
      const result = await ClientOrchestrator.updateClientWorkflow('client-1', {
        name: 'Valid Name',
        contactEmail: 'invalid-email',
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
    
    it('should successfully update valid client', async () => {
      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);
      
      const result = await ClientOrchestrator.updateClientWorkflow('client-1', {
        name: 'Updated Name',
        status: 'inactive' as ClientStatus,
        contactEmail: 'updated@example.com',
      });
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('deleteClientWorkflow', () => {
    it('should successfully delete client', async () => {
      const mockFrom = vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);
      
      const result = await ClientOrchestrator.deleteClientWorkflow('client-1');
      
      expect(result.success).toBe(true);
    });
    
    it('should fail to delete client with projects', async () => {
      const mockFrom = vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: { code: '23503', message: 'Foreign key constraint' },
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);
      
      const result = await ClientOrchestrator.deleteClientWorkflow('client-1');
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Cannot delete client with associated projects');
    });
  });
  
  describe('Client Status', () => {
    it('should accept active status', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: 'client-1',
                user_id: 'user-123',
                name: 'Test Client',
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);
      
      const result = await ClientOrchestrator.createClientWorkflow({
        name: 'Test Client',
        status: 'active' as ClientStatus,
      });
      
      expect(result.success).toBe(true);
    });
    
    it('should accept inactive status', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: 'client-1',
                user_id: 'user-123',
                name: 'Test Client',
                status: 'inactive',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);
      
      const result = await ClientOrchestrator.createClientWorkflow({
        name: 'Test Client',
        status: 'inactive' as ClientStatus,
      });
      
      expect(result.success).toBe(true);
    });
  });
});
