import React, { useState, useEffect } from 'react';
import { StandardModal, MODAL_BUTTON_LABELS } from './StandardModal';
import { ProjectModal } from './ProjectModal';
import { useClients } from '@/hooks/data/useClients';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Input } from '../shadcn/input';
import { Label } from '../shadcn/label';
import { Badge } from '../shadcn/badge';
import { Card, CardContent } from '../shadcn/card';
import { Building2, Folder, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/ui/use-toast';
import type { Client } from '@/shared/types/core';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string | null;
}

export function ClientModal({ isOpen, onClose, clientId }: ClientModalProps) {
  const { clients, updateClient, deleteClient, addClient } = useClients();
  const { projects } = useProjectContext();
  const { toast } = useToast();

  const [localName, setLocalName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Find the client
  const client = clients.find(c => c.id === clientId);
  const isCreating = !clientId;

  // Find projects for this client
  const clientProjects = client ? projects.filter(p => p.clientId === client.id) : [];

  // Initialize local state when client changes
  useEffect(() => {
    if (client) {
      setLocalName(client.name);
    } else if (isOpen && isCreating) {
      setLocalName('');
    }
  }, [client, isOpen, isCreating]);

  // Handle save
  const handleSave = async () => {
    if (!localName.trim()) {
      toast({
        title: "Error",
        description: "Client name is required",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isCreating) {
        const createdClient = await addClient({ name: localName.trim() });
        if (!createdClient) {
          // Validation failed - error toast already shown by useClients
          setIsSubmitting(false);
          return;
        }
        toast({
          title: "Success",
          description: "Client created successfully"
        });
      } else if (client) {
        await updateClient(client.id, { name: localName.trim() });
        toast({
          title: "Success",
          description: "Client updated successfully"
        });
      }
      onClose();
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'ClientModal', action: `Failed to ${isCreating ? 'create' : 'update'} client:` });
      toast({
        title: "Error",
        description: `Failed to ${isCreating ? 'create' : 'update'} client`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!client) return;

    // Check if client has projects
    if (clientProjects.length > 0) {
      toast({
        title: "Cannot Delete Client",
        description: `This client has ${clientProjects.length} project${clientProjects.length === 1 ? '' : 's'}. Please remove or reassign all projects before deleting the client.`,
        variant: "destructive"
      });
      setShowDeleteConfirm(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteClient(client.id);
      toast({
        title: "Success",
        description: "Client deleted successfully"
      });
      onClose();
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'ClientModal', action: 'Failed to delete client:' });
      toast({
        title: "Error",
        description: "Failed to delete client",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Handle project click
  const handleProjectClick = (projectId: string) => {
    setSelectedProjectId(projectId);
    setIsProjectModalOpen(true);
  };

  // Handle project modal close
  const handleProjectModalClose = () => {
    setIsProjectModalOpen(false);
    setSelectedProjectId(null);
  };

  return (
    <>
      <StandardModal
        isOpen={isOpen}
        onClose={onClose}
        title={isCreating ? "Create Client" : "Client Details"}
        description={isCreating ? "Add a new client" : "Edit client information and view associated projects"}
        size="md"
        primaryAction={{
          label: isCreating ? MODAL_BUTTON_LABELS.CREATE : MODAL_BUTTON_LABELS.UPDATE,
          onClick: handleSave,
          disabled: !localName.trim() || isSubmitting,
          loading: isSubmitting && !showDeleteConfirm
        }}
        secondaryAction={{
          label: MODAL_BUTTON_LABELS.CANCEL,
          onClick: onClose
        }}
        destructiveAction={!isCreating && client ? {
          label: MODAL_BUTTON_LABELS.DELETE,
          onClick: () => setShowDeleteConfirm(true)
        } : undefined}
      >
        <div className="space-y-6">
          {/* Client Name Section */}
          <div className="space-y-2">
            <Label htmlFor="client-name" className="text-sm font-medium">
              Client Name <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="client-name"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Enter client name"
                className="pl-10"
              />
            </div>
          </div>

          {/* Associated Projects Section - only show when editing */}
          {!isCreating && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Associated Projects
                </Label>
                <Badge variant="secondary">
                  {clientProjects.length} {clientProjects.length === 1 ? 'project' : 'projects'}
                </Badge>
              </div>

              {clientProjects.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto light-scrollbar">
                {clientProjects.map((project) => (
                  <Card 
                    key={project.id} 
                    className="border border-border cursor-pointer hover:shadow-md transition-shadow hover:border-primary/50"
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: project.color }}
                        >
                          <Folder className="w-4 h-4 text-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {project.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant="outline" className="flex-shrink-0 text-xs">
                          {project.estimatedHours}h
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  <Folder className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  No projects assigned to this client
                </CardContent>
              </Card>
            )}
            </div>
          )}

          {/* Delete Warning */}
          {!isCreating && clientProjects.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-medium mb-1">Cannot delete client with projects</p>
                <p>Remove or reassign all projects before deleting this client.</p>
              </div>
            </div>
          )}
        </div>
      </StandardModal>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <StandardModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Client"
          description="Are you sure you want to delete this client? This action cannot be undone."
          size="sm"
          primaryAction={{
            label: "Delete",
            onClick: handleDelete,
            variant: 'destructive',
            loading: isSubmitting,
            disabled: isSubmitting || clientProjects.length > 0
          }}
          secondaryAction={{
            label: MODAL_BUTTON_LABELS.CANCEL,
            onClick: () => setShowDeleteConfirm(false)
          }}
        >
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              You are about to delete <strong>{client.name}</strong>.
            </p>
            {clientProjects.length > 0 && (
              <p className="text-sm text-destructive font-medium">
                This client has {clientProjects.length} project{clientProjects.length === 1 ? '' : 's'} and cannot be deleted.
              </p>
            )}
          </div>
        </StandardModal>
      )}

      {/* Project Modal */}
      {selectedProjectId && (
        <ProjectModal
          isOpen={isProjectModalOpen}
          onClose={handleProjectModalClose}
          projectId={selectedProjectId}
        />
      )}
    </>
  );
}
