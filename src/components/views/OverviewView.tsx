import React, { useState, useMemo } from 'react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { useGroups } from '../../hooks/useGroups';
import { useHolidays } from '../../hooks/useHolidays';
import { useToast } from '../../hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Calendar, Clock, Users, Folder, GripVertical, Archive, PlayCircle, Clock4, ChevronDown, ChevronRight, Search, Tag, Building2, Mail, Phone, MapPin, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { DatePickerButton } from '../shared/DatePickerButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { StandardModal } from '../modals/StandardModal';
import { ProjectModal } from '../modals/ProjectModal';
import { HolidayModal } from '../modals/HolidayModal';
import { ClientModal } from '../modals/ClientModal';
import { Group, Project, ProjectStatus, Holiday } from '../../types';
import { AppPageLayout } from '../layout/AppPageLayout';
import { getEffectiveProjectStatus, DurationFormattingService, normalizeToMidnight } from '@/services';
import { GroupOrchestrator } from '@/services/orchestrators/GroupOrchestrator';
import { NEUTRAL_COLORS } from '@/constants/colors';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import { TabComponent } from '../shared';
import { ClientsTab, HolidaysTab, ProjectsTab } from '@/components/features/overview';
type FilterByStatus = 'all' | 'active' | 'future' | 'past';
type OrganizeBy = 'group' | 'tag' | 'client';
type MainTab = 'projects' | 'clients' | 'holidays';
type ClientStatusFilter = 'all' | 'active' | 'archived';

export function OverviewView() {
  const { groups, projects, deleteGroup, addProject, updateProject, deleteProject, selectedProjectId, setSelectedProjectId } = useProjectContext();
  const { addGroup, updateGroup, refetch: fetchGroups } = useGroups();
  const { holidays, addHoliday, updateHoliday, deleteHoliday } = useHolidays();
  const { toast } = useToast();
  // Main tab state
  const [activeTab, setActiveTab] = useState<MainTab>('projects');
  // Filter and organize state
  const [organizeBy, setOrganizeBy] = useState<OrganizeBy>('group');
  const [filterByStatus, setFilterByStatus] = useState<FilterByStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByDate, setFilterByDate] = useState<Date | undefined>(undefined);
  // Client-specific filter state
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatusFilter>('active');
  // Holiday-specific state
  const [holidayStatusFilter, setHolidayStatusFilter] = useState<FilterByStatus>('all');
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  // Modal state for creating new items
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [createProjectGroupId, setCreateProjectGroupId] = useState<string | undefined>(undefined);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  // Group dialog state
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  // Project dialog state
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [projectGroupId, setProjectGroupId] = useState('default-group');
  const [projectStartDate, setProjectStartDate] = useState('');
  const [projectEndDate, setProjectEndDate] = useState('');
  const [projectEstimatedHours, setProjectEstimatedHours] = useState('');
  const [projectColor, setProjectColor] = useState('#6366f1');
  // Collapsible state for sections and groups
  const [collapsedSections, setCollapsedSections] = useState<{[key: string]: boolean}>({
    current: true,
    future: true,
    archived: true
  });
  const [collapsedGroups, setCollapsedGroups] = useState<{[key: string]: boolean}>({});
  const defaultColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6b7280'
  ];
  // Group management functions
  const handleAddGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setIsGroupDialogOpen(true);
  };
  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setIsGroupDialogOpen(true);
  };
  const handleSaveGroup = async () => {
    if (!groupName.trim()) return;
    try {
      // Get current user for Phase 5A API
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "User not authenticated",
          variant: "destructive",
        });
        return;
      }
      let result;
      if (editingGroup) {
        // Use GroupOrchestrator Phase 5A update workflow
        result = await GroupOrchestrator.executeGroupUpdateWorkflow(
          {
            id: editingGroup.id,
            name: groupName
          },
          user.id
        );
        if (!result.success) {
          console.error('Group update failed:', result.errors);
          toast({
            title: "Error",
            description: result.errors?.[0] || "Failed to update group",
            variant: "destructive",
          });
          return;
        }
        if (result.warnings && result.warnings.length > 0) {
          console.warn('Group update warnings:', result.warnings);
          toast({
            title: "Warning",
            description: result.warnings[0],
            variant: "default",
          });
        }
        // Refresh groups to get updated data from repository
        await fetchGroups();
      } else {
        // Use GroupOrchestrator Phase 5A creation workflow
        result = await GroupOrchestrator.executeGroupCreationWorkflow(
          {
            name: groupName
          },
          user.id
        );
        if (!result.success) {
          console.error('Group creation failed:', result.errors);
          toast({
            title: "Error",
            description: result.errors?.[0] || "Failed to create group",
            variant: "destructive",
          });
          return;
        }
        if (result.warnings && result.warnings.length > 0) {
          console.warn('Group creation warnings:', result.warnings);
          toast({
            title: "Warning",
            description: result.warnings[0],
            variant: "default",
          });
        }
        // Refresh groups to get new data from repository
        await fetchGroups();
      }
      // Show offline/sync status if relevant
      if (result.metadata?.offlineMode) {
        toast({
          title: "Offline Mode",
          description: "Changes saved locally and will sync when online",
          variant: "default",
        });
      }
      setIsGroupDialogOpen(false);
      resetGroupForm();
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'OverviewView', action: 'Group operation failed:' });
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Operation failed",
        variant: "destructive",
      });
    }
  };
  const resetGroupForm = () => {
    setEditingGroup(null);
    setGroupName('');
  };
  // Project management functions
  const handleAddProject = (groupId?: string) => {
    setEditingProject(null);
    setProjectName('');
    setProjectClient('');
    setProjectGroupId(groupId || 'work-group');
    setProjectStartDate('');
    setProjectEndDate('');
    setProjectEstimatedHours('');
    setProjectColor('#6366f1');
    setIsProjectDialogOpen(true);
  };
  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectClient(project.clientId || '');
    setProjectGroupId(project.groupId || 'work-group');
    setProjectStartDate(project.startDate.toISOString().split('T')[0]);
    setProjectEndDate(project.endDate.toISOString().split('T')[0]);
    setProjectEstimatedHours(project.estimatedHours.toString());
    setProjectColor(project.color);
    setIsProjectDialogOpen(true);
  };
  const handleSaveProject = () => {
    if (!projectName.trim() || !projectClient.trim() || !projectStartDate || !projectEndDate || !projectEstimatedHours) return;
    const startDate = new Date(projectStartDate);
    const endDate = new Date(projectEndDate);
    const estimatedHours = parseInt(projectEstimatedHours);
    if (editingProject) {
      updateProject(editingProject.id, {
        name: projectName,
        client: projectClient,
        groupId: projectGroupId,
        startDate,
        endDate,
        estimatedHours,
        color: projectColor
      });
      setIsProjectDialogOpen(false);
      resetProjectForm();
    } else {
      // Project creation is disabled - redirect to Timeline view
      alert('Please use the Timeline view to create new projects. This ensures proper row assignment.');
      setIsProjectDialogOpen(false);
      resetProjectForm();
    }
  };
  const resetProjectForm = () => {
    setEditingProject(null);
    setProjectName('');
    setProjectClient('');
    setProjectGroupId('work-group');
    setProjectStartDate('');
    setProjectEndDate('');
    setProjectEstimatedHours('');
    setProjectColor('#6366f1');
  };
  
  return (
    <AppPageLayout>
        {/* Header content moved to AppHeader in MainAppLayout */}
        <AppPageLayout.Header className="h-0 overflow-hidden">
          <div />
        </AppPageLayout.Header>
      {/* Tabs and Filter Controls */}
      <AppPageLayout.SubHeader className="px-0 py-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MainTab)} className="w-full">
          {/* Chrome-style tabs */}
          <div 
            className="flex items-end border-b border-gray-200 px-6"
            style={{
              backgroundColor: NEUTRAL_COLORS.gray25,
              paddingTop: '21px',
            }}
          >
            <TabComponent
              label="Projects"
              value="projects"
              isActive={activeTab === 'projects'}
              onClick={() => setActiveTab('projects')}
            />
            <TabComponent
              label="Clients"
              value="clients"
              isActive={activeTab === 'clients'}
              onClick={() => setActiveTab('clients')}
            />
            <TabComponent
              label="Holidays"
              value="holidays"
              isActive={activeTab === 'holidays'}
              onClick={() => setActiveTab('holidays')}
            />
            {/* Fill remaining space with background */}
            <div className="flex-1 border-b border-gray-200" style={{ marginBottom: '-1px' }} />
          </div>
          {/* Filter section with padding */}
          <div className="px-6 pt-6">
          {/* Projects Tab Content - Filters */}
          <TabsContent value="projects" className="mt-0">
            <div className="flex items-center justify-between">
              {/* Left side - Organization and filters */}
              <div className="flex items-center" style={{ gap: '21px' }}>
                {/* Add Project Button */}
                <Button
                  onClick={() => {
                    setSelectedProjectId(null);
                    // Use first group as default, or create a default group id
                    const defaultGroupId = groups[0]?.id || 'default-group';
                    setCreateProjectGroupId(defaultGroupId);
                    setIsCreatingProject(true);
                  }}
                  className="h-9 gap-2 shadow"
                >
                  <Plus className="w-4 h-4" />
                  Add Project
                </Button>
                {/* Organize By */}
                <ToggleGroup
                  type="single"
                  value={organizeBy}
                  onValueChange={(value) => value && setOrganizeBy(value as OrganizeBy)}
                  variant="outline"
                  className="border border-gray-200 rounded-lg h-9 p-1"
                >
                  <ToggleGroupItem value="group" aria-label="Organize by group" className="px-3 py-1 h-7 gap-1.5">
                    <Folder className="w-3 h-3" />
                    Group
                  </ToggleGroupItem>
                  <ToggleGroupItem value="client" aria-label="Organize by client" className="px-3 py-1 h-7 gap-1.5">
                    <Building2 className="w-3 h-3" />
                    Client
                  </ToggleGroupItem>
                  <ToggleGroupItem value="tag" aria-label="Organize by tag" className="px-3 py-1 h-7 gap-1.5">
                    <Tag className="w-3 h-3" />
                    Tag
                  </ToggleGroupItem>
                </ToggleGroup>
                {/* Status Filter */}
                <ToggleGroup
                  type="single"
                  value={filterByStatus}
                  onValueChange={(value) => value && setFilterByStatus(value as FilterByStatus)}
                  variant="outline"
                  className="border border-gray-200 rounded-lg h-9 p-1"
                >
                  <ToggleGroupItem value="all" aria-label="All projects" className="px-3 py-1 h-7">
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem value="active" aria-label="Active projects" className="px-3 py-1 h-7 gap-1.5">
                    <PlayCircle className="w-3 h-3" />
                    Active
                  </ToggleGroupItem>
                  <ToggleGroupItem value="future" aria-label="Future projects" className="px-3 py-1 h-7 gap-1.5">
                    <Clock4 className="w-3 h-3" />
                    Future
                  </ToggleGroupItem>
                  <ToggleGroupItem value="past" aria-label="Past projects" className="px-3 py-1 h-7 gap-1.5">
                    <Archive className="w-3 h-3" />
                    Past
                  </ToggleGroupItem>
                </ToggleGroup>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-8 pr-3 w-[200px]"
                    />
                  </div>
                  {/* Date Filter */}
                  <DatePickerButton
                    selected={filterByDate}
                    onSelect={setFilterByDate}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          {/* Clients Tab Content - Filters */}
          <TabsContent value="clients" className="mt-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: '21px' }}>
                {/* Add Client Button */}
                <Button
                  onClick={() => {
                    setEditingClientId(null);
                    setIsClientModalOpen(true);
                  }}
                  className="h-9 gap-2 shadow"
                >
                  <Plus className="w-4 h-4" />
                  Add Client
                </Button>
                {/* Status Filter */}
                <ToggleGroup
                  type="single"
                  value={clientStatusFilter}
                  onValueChange={(value) => value && setClientStatusFilter(value as ClientStatusFilter)}
                  variant="outline"
                  className="border border-gray-200 rounded-lg h-9 p-1"
                >
                  <ToggleGroupItem value="all" aria-label="All clients" className="px-3 py-1 h-7">
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem value="active" aria-label="Active clients" className="px-3 py-1 h-7 gap-1.5">
                    <PlayCircle className="w-3 h-3" />
                    Active
                  </ToggleGroupItem>
                  <ToggleGroupItem value="archived" aria-label="Archived clients" className="px-3 py-1 h-7 gap-1.5">
                    <Archive className="w-3 h-3" />
                    Archived
                  </ToggleGroupItem>
                </ToggleGroup>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search clients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-8 pr-3 w-[200px]"
                    />
                  </div>
                  {/* Date Filter */}
                  <DatePickerButton
                    selected={filterByDate}
                    onSelect={setFilterByDate}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          {/* Holidays Tab Content - Filters */}
          <TabsContent value="holidays" className="mt-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: '21px' }}>
                {/* Add Holiday Button */}
                <Button
                  onClick={() => {
                    setEditingHoliday(null);
                    setIsHolidayModalOpen(true);
                  }}
                  className="h-9 gap-2 shadow"
                >
                  <Plus className="w-4 h-4" />
                  Add Holiday
                </Button>
                {/* Status Filter */}
                <ToggleGroup
                  type="single"
                  value={holidayStatusFilter}
                  onValueChange={(value) => value && setHolidayStatusFilter(value as FilterByStatus)}
                  variant="outline"
                  className="border border-gray-200 rounded-lg h-9 p-1"
                >
                  <ToggleGroupItem value="all" aria-label="All holidays" className="px-3 py-1 h-7">
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem value="active" aria-label="Active holidays" className="px-3 py-1 h-7 gap-1.5">
                    <PlayCircle className="w-3 h-3" />
                    Active
                  </ToggleGroupItem>
                  <ToggleGroupItem value="future" aria-label="Future holidays" className="px-3 py-1 h-7 gap-1.5">
                    <Clock4 className="w-3 h-3" />
                    Future
                  </ToggleGroupItem>
                  <ToggleGroupItem value="past" aria-label="Past holidays" className="px-3 py-1 h-7 gap-1.5">
                    <Archive className="w-3 h-3" />
                    Past
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </TabsContent>
          </div>
        </Tabs>
      </AppPageLayout.SubHeader>
      {/* Content */}
      <AppPageLayout.Content className="flex-1 overflow-auto light-scrollbar p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MainTab)} className="h-full">
          {/* Projects Tab Content */}
          <TabsContent value="projects" className="h-full mt-0">
            <div className="px-[21px] pb-[21px] pt-[35px]">
              <ProjectsTab
                projects={projects}
                groups={groups}
                organizeBy={organizeBy}
                filterByStatus={filterByStatus}
                searchQuery={searchQuery}
                filterByDate={filterByDate}
                
                onProjectClick={(projectId) => setSelectedProjectId(projectId)}
                onDeleteProject={deleteProject}
                onClearFilters={() => {
                  setSearchQuery('');
                  setFilterByDate(undefined);
                  setFilterByStatus('all');
                }}
              />
            </div>
          </TabsContent>
          {/* Clients Tab Content */}
          <TabsContent value="clients" className="h-full mt-0">
            <div className="px-[21px] pb-[21px] pt-[35px]">
              <ClientsTab
                searchQuery={searchQuery}
                filterByDate={filterByDate}
                
                clientStatusFilter={clientStatusFilter}
              />
            </div>
          </TabsContent>
          {/* Holidays Tab Content */}
          <TabsContent value="holidays" className="h-full mt-0">
            <div className="px-[21px] pb-[21px] pt-[35px]">
              <HolidaysTab
                holidays={holidays}
                holidayStatusFilter={holidayStatusFilter}
                onHolidayClick={(holiday) => {
                  setEditingHoliday(holiday);
                  setIsHolidayModalOpen(true);
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </AppPageLayout.Content>
      
      {/* Project Modal */}
      <ProjectModal
        isOpen={!!selectedProjectId || isCreatingProject}
        onClose={() => {
          setSelectedProjectId(null);
          setIsCreatingProject(false);
          setCreateProjectGroupId(undefined);
        }}
        projectId={selectedProjectId || undefined}
        groupId={createProjectGroupId}
      />
      
      {/* Client Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => {
          setIsClientModalOpen(false);
          setEditingClientId(null);
        }}
        clientId={editingClientId}
      />
      
      {/* Holiday Modal */}
      <HolidayModal
        isOpen={isHolidayModalOpen}
        onClose={() => {
          setIsHolidayModalOpen(false);
          setEditingHoliday(null);
        }}
        holidayId={editingHoliday?.id}
      />
    </AppPageLayout>
  );
}