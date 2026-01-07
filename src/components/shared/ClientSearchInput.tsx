import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '../shadcn/input';
import { Label } from '../shadcn/label';
import { supabase } from '@/integrations/supabase/client';
import { Client } from '@/types/core';
import { Client as ClientEntity } from '@/domain/entities/Client';

interface ClientSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClientSelect: (clientName: string) => void;
  onAddClient?: () => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
  showAddButton?: boolean;
  error?: string;
}

export function ClientSearchInput({
  value,
  onChange,
  onClientSelect,
  onAddClient,
  disabled = false,
  label = "Client",
  placeholder = "Type to search or add client...",
  className = "",
  showAddButton = true,
  error
}: ClientSearchInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Fetch all clients from database
  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name');
      
      if (!error && data) {
        // Transform database format to Client type using ClientEntity
        const transformedClients: Client[] = data.map(dbClient => 
          ClientEntity.fromDatabase(dbClient).toData()
        );
        setAllClients(transformedClients);
      }
    };
    
    fetchClients();
    
    // Subscribe to client changes
    const subscription = supabase
      .channel('clients_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'clients' 
      }, () => {
        fetchClients();
      })
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Get the 3 most recently created/updated clients
  const recentClients = useMemo(() => {
    return allClients
      .sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      })
      .slice(0, 3)
      .map(c => c.name);
  }, [allClients]);

  // Filter clients based on search query
  const searchResults = useMemo(() => {
    if (!value.trim()) {
      // When there's no search query, show recent clients
      return recentClients;
    }
    
    const query = value.toLowerCase().trim();
    return allClients
      .filter(client => client.name.toLowerCase().includes(query))
      .map(c => c.name);
  }, [value, allClients, recentClients]);

  // Handle client selection
  const handleSelectClient = (clientName: string) => {
    onClientSelect(clientName);
    onChange(clientName);
    setShowDropdown(false);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <Label>{label}</Label>}
      <div className="relative" ref={dropdownRef}>
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          className={`w-full pr-10 ${error ? 'border-destructive' : ''}`}
          disabled={disabled}
        />
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        
        {/* Error Message */}
        {error && (
          <p className="text-sm text-destructive mt-1">{error}</p>
        )}
        
        {/* Dropdown */}
        {showDropdown && !disabled && (
          <div className="absolute top-full left-0 w-full mt-1 bg-popover border border-border rounded-md shadow-lg z-[100]">
            <div className="max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                <>
                  {/* Show existing clients */}
                  {searchResults.map((clientName) => (
                    <button
                      key={clientName}
                      className="w-full px-3 py-2 text-left hover:bg-accent/50 border-b border-border/30 last:border-b-0"
                      onClick={() => handleSelectClient(clientName)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {clientName}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  {/* Add New Client button */}
                  {showAddButton && onAddClient && (
                    <button
                      className="w-full px-3 py-2 text-left hover:bg-accent/50 border-t border-border flex items-center gap-2 text-primary"
                      onClick={() => {
                        setShowDropdown(false);
                        onAddClient();
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">Add New Client</span>
                    </button>
                  )}
                </>
              ) : value.trim() ? (
                <>
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    No existing clients found
                  </div>
                  {showAddButton && onAddClient && (
                    <button
                      className="w-full px-3 py-2 text-left hover:bg-accent/50 border-t border-border flex items-center gap-2 text-primary"
                      onClick={() => {
                        setShowDropdown(false);
                        onAddClient();
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">Add New Client</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    Start typing to search clients
                  </div>
                  {showAddButton && onAddClient && (
                    <button
                      className="w-full px-3 py-2 text-left hover:bg-accent/50 border-t border-border flex items-center gap-2 text-primary"
                      onClick={() => {
                        setShowDropdown(false);
                        onAddClient();
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">Add New Client</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
