import React, { useState, useMemo } from 'react';
import { useClients } from '@/hooks/useClients';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Search, Building2, Mail, Phone, MapPin, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Client } from '@/types/core';

type ViewType = 'grid' | 'list';
type ClientStatusFilter = 'all' | 'active' | 'archived';

interface ClientsListViewProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterByDate: string;
  onDateChange: (date: string) => void;
  viewType: ViewType;
  statusFilter: ClientStatusFilter;
}

export function ClientsListView({ 
  searchQuery, 
  onSearchChange,
  filterByDate,
  onDateChange,
  viewType,
  statusFilter 
}: ClientsListViewProps) {
  const { clients, loading } = useClients();
  const { projects } = useProjectContext();

  // Filter clients
  const filteredClients = useMemo(() => {
    let filtered = [...clients];

    // Filter by status
    if (statusFilter === 'active') {
      filtered = filtered.filter(client => client.status === 'active');
    } else if (statusFilter === 'archived') {
      filtered = filtered.filter(client => client.status === 'archived');
    }
    // 'all' shows everything (active, inactive, archived)

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(client =>
        client.name.toLowerCase().includes(query) ||
        client.contactEmail?.toLowerCase().includes(query) ||
        client.contactPhone?.toLowerCase().includes(query)
      );
    }

    // Filter by date - show clients that have a project on the selected date
    if (filterByDate) {
      const targetDate = new Date(filterByDate);
      targetDate.setHours(0, 0, 0, 0);
      
      // Get client IDs that have projects on this date
      const clientIdsWithProjectsOnDate = new Set(
        projects.filter(p => {
          const start = new Date(p.startDate);
          const end = new Date(p.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          return start <= targetDate && targetDate <= end;
        }).map(p => p.clientId)
      );
      
      filtered = filtered.filter(client => 
        clientIdsWithProjectsOnDate.has(client.id)
      );
    }

    return filtered;
  }, [clients, statusFilter, searchQuery, filterByDate, projects]);

  // Get project count for each client
  const getProjectCount = (clientId: string) => {
    return projects.filter(p => p.clientId === clientId).length;
  };

  // Get active project count for each client
  const getActiveProjectCount = (clientId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return projects.filter(p => {
      if (p.clientId !== clientId) return false;
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return start <= today && today <= end;
    }).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-500">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results count */}
      {filteredClients.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'}
          </Badge>
        </div>
      )}

      {/* Clients list */}
      {filteredClients.length > 0 ? (
        <div className={viewType === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
          : "space-y-2"
        }>
          {filteredClients.map(client => {
            const projectCount = getProjectCount(client.id);
            const activeProjectCount = getActiveProjectCount(client.id);
            
            return viewType === 'grid' ? (
              // Grid view
              <Card key={client.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base font-semibold truncate">
                          {client.name}
                        </CardTitle>
                      </div>
                    </div>
                    <Badge 
                      variant={client.status === 'active' ? 'default' : 'secondary'}
                      className="ml-2 flex-shrink-0"
                    >
                      {client.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Contact Information */}
                  {(client.contactEmail || client.contactPhone || client.billingAddress) && (
                    <div className="space-y-2 text-xs text-gray-600">
                      {client.contactEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{client.contactEmail}</span>
                        </div>
                      )}
                      {client.contactPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{client.contactPhone}</span>
                        </div>
                      )}
                      {client.billingAddress && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{client.billingAddress}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Project Stats */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-gray-600">
                        <FileText className="w-3 h-3" />
                        <span>{projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
                      </div>
                      {activeProjectCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {activeProjectCount} active
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {client.notes && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 line-clamp-2">{client.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              // List view
              <Card key={client.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    {/* Left section - Client info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate text-sm">{client.name}</h3>
                          <Badge 
                            variant={client.status === 'active' ? 'default' : 'secondary'}
                            className="flex-shrink-0 text-xs"
                          >
                            {client.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Middle section - Contact info */}
                    <div className="flex items-center gap-4 flex-1 justify-center">
                      {client.contactEmail && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{client.contactEmail}</span>
                        </div>
                      )}
                      {client.contactPhone && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Phone className="w-3 h-3" />
                          <span className="whitespace-nowrap">{client.contactPhone}</span>
                        </div>
                      )}
                    </div>

                    {/* Right section - Project stats */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <FileText className="w-3 h-3" />
                        <span>{projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
                      </div>
                      {activeProjectCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {activeProjectCount} active
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* No results message */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-gray-400 mb-4">
              {searchQuery || filterByDate ? (
                <Search className="w-16 h-16" />
              ) : (
                <Building2 className="w-16 h-16" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery || filterByDate 
                ? 'No clients found'
                : 'No clients yet'
              }
            </h3>
            <p className="text-gray-600 text-center mb-6 max-w-md">
              {searchQuery || filterByDate
                ? 'Try adjusting your filters or search query'
                : 'Clients are automatically created when you add projects with client information.'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
