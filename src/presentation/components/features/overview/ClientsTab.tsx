import React, { useState, useMemo } from 'react';
import { Search, Building2, Mail, Phone, MapPin, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/shadcn/card';
import { Badge } from '@/presentation/components/shadcn/badge';
import { ClientModal } from '@/presentation/components/modals/ClientModal';
import { useClients } from '@/presentation/hooks/data/useClients';
import { useProjectContext } from '@/presentation/contexts/ProjectContext';
import { normalizeToMidnight } from '@/presentation/utils/dateCalculations';;

type ClientStatusFilter = 'all' | 'active' | 'archived';

interface ClientsTabProps {
  searchQuery: string;
  filterByDate: Date | undefined;
  clientStatusFilter: ClientStatusFilter;
}

export function ClientsTab({
  searchQuery,
  filterByDate,
  clientStatusFilter,
}: ClientsTabProps) {
  const { clients, loading } = useClients();
  const { projects } = useProjectContext();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const filteredClients = useMemo(() => {
    let filtered = [...clients];

    // Filter by status
    if (clientStatusFilter === 'active') {
      filtered = filtered.filter(client => client.status === 'active');
    } else if (clientStatusFilter === 'archived') {
      filtered = filtered.filter(client => client.status === 'archived');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        client =>
          client.name.toLowerCase().includes(query) ||
          client.contactEmail?.toLowerCase().includes(query) ||
          client.contactPhone?.toLowerCase().includes(query)
      );
    }

    // Filter by date
    if (filterByDate) {
      const targetDate = normalizeToMidnight(new Date(filterByDate));
      const clientIdsWithProjectsOnDate = new Set(
        projects
          .filter(p => {
            const start = normalizeToMidnight(new Date(p.startDate));
            const end = normalizeToMidnight(new Date(p.endDate));
            return start <= targetDate && targetDate <= end;
          })
          .map(p => p.clientId)
      );
      filtered = filtered.filter(client => clientIdsWithProjectsOnDate.has(client.id));
    }

    return filtered;
  }, [clients, clientStatusFilter, searchQuery, filterByDate, projects]);

  const getProjectCount = (clientId: string) => {
    return projects.filter(p => p.clientId === clientId).length;
  };

  const getActiveProjectCount = (clientId: string) => {
    const today = normalizeToMidnight(new Date());
    return projects.filter(p => {
      if (p.clientId !== clientId) return false;
      const start = normalizeToMidnight(new Date(p.startDate));
      const end = normalizeToMidnight(new Date(p.endDate));
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

  if (filteredClients.length === 0) {
    return (
      <>
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
              {searchQuery || filterByDate ? 'No clients found' : 'No clients yet'}
            </h3>
            <p className="text-gray-600 text-center mb-6 max-w-md">
              {searchQuery || filterByDate
                ? 'Try adjusting your filters or search query'
                : 'Clients are automatically created when you add projects with client information.'}
            </p>
          </CardContent>
        </Card>
        <ClientModal
          isOpen={isClientModalOpen}
          onClose={() => {
            setIsClientModalOpen(false);
            setSelectedClientId(null);
          }}
          clientId={selectedClientId}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Results count */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'}
          </Badge>
        </div>

        {/* Clients list */}
        <div className="space-y-2">
          {filteredClients.map((client) => {
            // Count projects for this client by clientId (authoritative)
            const clientProjects = projects.filter((p) => p.clientId === client.id);
            const projectCount = clientProjects.length;
            const activeProjectCount = clientProjects.filter(
              (p) => new Date(p.startDate) <= new Date() && new Date(p.endDate) >= new Date()
            ).length;

            return (
              <Card
                key={client.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedClientId(client.id);
                  setIsClientModalOpen(true);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate text-sm">
                            {client.name}
                          </h3>
                          <Badge
                            variant={client.status === 'active' ? 'default' : 'secondary'}
                            className="flex-shrink-0 text-xs"
                          >
                            {client.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

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

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <FileText className="w-3 h-3" />
                        <span>
                          {projectCount} {projectCount === 1 ? 'project' : 'projects'}
                        </span>
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
      </div>

      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => {
          setIsClientModalOpen(false);
          setSelectedClientId(null);
        }}
        clientId={selectedClientId}
      />
    </>
  );
}
