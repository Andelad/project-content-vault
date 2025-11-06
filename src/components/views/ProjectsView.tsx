import React, { useState, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useProjectContext } from '../../contexts/ProjectContext';
import { useGroups } from '../../hooks/useGroups';
import { useHolidays } from '../../hooks/useHolidays';
import { useToast } from '../../hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Calendar, Clock, Users, FolderPlus, Grid3X3, List, GripVertical, Archive, PlayCircle, Clock4, ChevronDown, ChevronRight, Search, Tag, Building2 } from 'lucide-react';
import { Button } from '../ui/button';
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
import { Group, Project, ProjectStatus } from '../../types';
import { AppPageLayout } from '../layout/AppPageLayout';
import { getEffectiveProjectStatus, DurationFormattingService } from '@/services';
import { GroupOrchestrator } from '@/services/orchestrators/GroupOrchestrator';
import { ClientsListView } from './ClientsListView';
import { NEUTRAL_COLORS } from '@/constants/colors';

type ViewType = 'grid' | 'list';
type FilterByStatus = 'all' | 'active' | 'future' | 'past';
type OrganizeBy = 'group' | 'tag' | 'client';
type MainTab = 'projects' | 'clients' | 'holidays';
type ClientStatusFilter = 'all' | 'active' | 'archived';

// Chrome-style tab component
interface TabProps {
  label: string;
  value: string;
  isActive: boolean;
  onClick: () => void;
}

const ChromeTab = ({ label, isActive, onClick }: TabProps) => {
  return (
    <button
      onClick={onClick}
      className={`
        relative px-6 text-sm font-medium transition-all duration-200 flex items-center justify-center
        text-gray-800
        ${isActive ? 'z-10' : 'z-0'}
      `}
      style={{
        height: isActive ? '40px' : '39px',
        backgroundColor: isActive ? 'white' : NEUTRAL_COLORS.gray200,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        marginRight: '-2px',
        borderTop: `1px solid ${isActive ? NEUTRAL_COLORS.gray200 : 'transparent'}`,
        borderLeft: `1px solid ${isActive ? NEUTRAL_COLORS.gray200 : 'transparent'}`,
        borderRight: `1px solid ${isActive ? NEUTRAL_COLORS.gray200 : 'transparent'}`,
        borderBottom: isActive ? '1px solid white' : '1px solid transparent',
        marginBottom: '-1px',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </button>
  );
};

// Drag and drop item types
const ItemTypes = {
  GROUP: 'group',
  PROJECT: 'project'
};

// Draggable Group Component
function DraggableGroup({ 
  group, 
  index, 
  onMoveGroup, 
  children 
}: { 
  group: Group; 
  index: number; 
  onMoveGroup: (fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.GROUP,
    item: { type: ItemTypes.GROUP, id: group.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemTypes.GROUP,
    hover: (item: { type: string; id: string; index: number }) => {
      if (!item || item.type !== ItemTypes.GROUP) return;
      
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      onMoveGroup(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  return (
    <div ref={(node) => preview(drop(node))} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <div className="flex items-start gap-3">
        <div ref={drag} className="cursor-move pt-6 text-gray-400 hover:text-gray-600">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// Draggable Project Component
function DraggableProject({ 
  project, 
  index, 
  groupId,
  onMoveProject, 
  children 
}: { 
  project: Project; 
  index: number; 
  groupId: string;
  onMoveProject: (groupId: string, fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.PROJECT,
    item: { type: ItemTypes.PROJECT, id: project.id, index, groupId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemTypes.PROJECT,
    hover: (item: { type: string; id: string; index: number; groupId: string }) => {
      if (!item || item.type !== ItemTypes.PROJECT) return;
      if (item.groupId !== groupId) return; // Only allow reordering within the same group
      
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      onMoveProject(groupId, dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  return (
    <div ref={(node) => preview(drop(node))} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <div className="flex items-center gap-2">
        <div ref={drag} className="cursor-move text-gray-400 hover:text-gray-600 p-1">
          <GripVertical className="w-3 h-3" />
        </div>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ProjectsView() {
  const { groups, projects, deleteGroup, addProject, updateProject, deleteProject, reorderGroups, reorderProjects, selectedProjectId, setSelectedProjectId } = useProjectContext();
  const { addGroup, updateGroup, refetch: fetchGroups } = useGroups();
  const { holidays, addHoliday, updateHoliday, deleteHoliday } = useHolidays();
  const { toast } = useToast();

  // Main tab state
  const [activeTab, setActiveTab] = useState<MainTab>('projects');

  // View toggle state
  const [viewType, setViewType] = useState<ViewType>('list');
  
  // Filter and organize state
  const [organizeBy, setOrganizeBy] = useState<OrganizeBy>('group');
  const [filterByStatus, setFilterByStatus] = useState<FilterByStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByDate, setFilterByDate] = useState('');
  
  // Client-specific filter state
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatusFilter>('active');

  // Holiday-specific state
  const [holidayStatusFilter, setHolidayStatusFilter] = useState<FilterByStatus>('all');
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);

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
      console.error('Group operation failed:', error);
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Duration formatting is now handled by DurationFormattingService

  const getProjectsByGroup = (groupId: string) => {
    return projects.filter(project => project.groupId === groupId);
  };

  const getProjectsByGroupAndStatus = (groupId: string, status: ProjectStatus) => {
    return projects.filter(project => project.groupId === groupId && getEffectiveProjectStatus(project) === status);
  };

  const getProjectCountByStatus = (status: ProjectStatus) => {
    return projects.filter(project => getEffectiveProjectStatus(project) === status).length;
  };

  // Filter and organize projects
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // Filter by status
    if (filterByStatus === 'active') {
      filtered = filtered.filter(p => getEffectiveProjectStatus(p) === 'current');
    } else if (filterByStatus === 'future') {
      filtered = filtered.filter(p => getEffectiveProjectStatus(p) === 'future');
    } else if (filterByStatus === 'past') {
      filtered = filtered.filter(p => getEffectiveProjectStatus(p) === 'archived');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.clientData?.name && p.clientData.name.toLowerCase().includes(query)) ||
        (p.client && p.client.toLowerCase().includes(query))
      );
    }

    // Filter by date
    if (filterByDate) {
      const targetDate = new Date(filterByDate);
      targetDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(p => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return start <= targetDate && targetDate <= end;
      });
    }

    return filtered;
  }, [projects, filterByStatus, searchQuery, filterByDate]);

  // Organize filtered projects
  const organizedProjects = useMemo(() => {
    if (organizeBy === 'group') {
      // Group by group
      const byGroup: { [key: string]: { group: Group; projects: Project[] } } = {};
      groups.forEach(group => {
        byGroup[group.id] = { group, projects: [] };
      });
      filteredProjects.forEach(project => {
        if (byGroup[project.groupId]) {
          byGroup[project.groupId].projects.push(project);
        }
      });
      return Object.values(byGroup).filter(g => g.projects.length > 0);
    } else if (organizeBy === 'client') {
      // Group by client
      const byClient: { [key: string]: Project[] } = {};
      filteredProjects.forEach(project => {
        const clientName = project.clientData?.name || project.client || 'No Client';
        if (!byClient[clientName]) {
          byClient[clientName] = [];
        }
        byClient[clientName].push(project);
      });
      return Object.entries(byClient).map(([clientName, projects]) => ({
        key: clientName,
        label: clientName,
        projects
      }));
    } else {
      // Group by tag (placeholder - would need tag implementation)
      return [{
        key: 'all',
        label: 'All Projects',
        projects: filteredProjects
      }];
    }
  }, [organizeBy, filteredProjects, groups]);

  // Collapsible toggle functions
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleGroup = (groupId: string, section: string) => {
    const key = `${section}-${groupId}`;
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isSectionCollapsed = (section: string) => {
    return collapsedSections[section] || false;
  };

  const isGroupCollapsed = (groupId: string, section: string) => {
    const key = `${section}-${groupId}`;
    return collapsedGroups[key] !== false; // Default to collapsed (true) unless explicitly set to false
  };

  // Handle drag and drop
  const handleMoveGroup = (fromIndex: number, toIndex: number) => {
    reorderGroups(fromIndex, toIndex);
  };

  const handleMoveProject = (groupId: string, fromIndex: number, toIndex: number) => {
    reorderProjects(groupId, fromIndex, toIndex);
  };

  // Render project in grid format
  const renderGridProject = (project: Project, index: number, groupId: string) => (
    <DraggableProject
      key={project.id}
      project={project}
      index={index}
      groupId={groupId}
      onMoveProject={handleMoveProject}
    >
      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedProjectId(project.id)}>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0" 
                style={{ backgroundColor: project.color }}
              />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-medium truncate">{project.name}</CardTitle>
                <CardDescription className="text-xs truncate">
                  {project.clientData?.name || project.client || 'No client'}
                </CardDescription>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                deleteProject(project.id);
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 h-6 w-6"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-2 pt-0 px-4 pb-3">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Calendar className="w-3 h-3" />
            <span className="truncate">
              {formatDate(project.startDate)} - {formatDate(project.endDate)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs">
              <Clock className="w-3 h-3 text-gray-600" />
              <span className="font-medium text-gray-900">{project.estimatedHours}h</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </DraggableProject>
  );

  // Render project in list format
  const renderListProject = (project: Project, index: number, groupId: string) => (
    <DraggableProject
      key={project.id}
      project={project}
      index={index}
      groupId={groupId}
      onMoveProject={handleMoveProject}
    >
      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedProjectId(project.id)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Left section - Project info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: project.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 truncate text-sm">{project.name}</h3>
                  <span className="text-xs text-gray-600 whitespace-nowrap">
                    {project.clientData?.name || project.client || 'No client'}
                  </span>
                </div>
              </div>
            </div>

            {/* Middle section - Timeline info */}
            <div className="flex items-center gap-4 flex-1 justify-center">
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Calendar className="w-3 h-3" />
                <span className="whitespace-nowrap">
                  {formatDate(project.startDate)} - {formatDate(project.endDate)}
                </span>
              </div>
              
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3 h-3 text-gray-600" />
                <span className="whitespace-nowrap font-medium text-gray-900">{project.estimatedHours}h</span>
              </div>
              
              <div className="text-xs text-gray-500">
                <span>{DurationFormattingService.formatDuration(project.startDate, project.endDate)}</span>
              </div>
            </div>

            {/* Right section - Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteProject(project.id);
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 h-6 w-6"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </DraggableProject>
  );

  return (
    <DndProvider backend={HTML5Backend}>
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
              backgroundColor: 'rgb(249, 250, 251)', // bg-gray-50
              paddingTop: '21px',
            }}
          >
            <ChromeTab
              label="Projects"
              value="projects"
              isActive={activeTab === 'projects'}
              onClick={() => setActiveTab('projects')}
            />
            <ChromeTab
              label="Clients"
              value="clients"
              isActive={activeTab === 'clients'}
              onClick={() => setActiveTab('clients')}
            />
            <ChromeTab
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
                    setEditingProject(null);
                    setProjectName('');
                    setProjectClient('');
                    setProjectGroupId('work-group');
                    setProjectStartDate('');
                    setProjectEndDate('');
                    setProjectEstimatedHours('');
                    setProjectColor('#6366f1');
                    setIsProjectDialogOpen(true);
                  }}
                  className="h-9 gap-2"
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
                    <FolderPlus className="w-3 h-3" />
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

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 pr-3 w-[200px]"
                  />
                </div>

                {/* Date Filter */}
                <Input
                  type="date"
                  value={filterByDate}
                  onChange={(e) => setFilterByDate(e.target.value)}
                  className="h-9 w-[160px]"
                  placeholder="Filter by date"
                />
              </div>

              {/* Right side - View toggle */}
              <ToggleGroup
                type="single"
                value={viewType}
                onValueChange={(value) => value && setViewType(value as ViewType)}
                variant="outline"
                className="border border-gray-200 rounded-lg h-9 p-1"
              >
                <ToggleGroupItem value="list" aria-label="List view" className="px-3 py-1 h-7">
                  <List className="w-4 h-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" aria-label="Grid view" className="px-3 py-1 h-7">
                  <Grid3X3 className="w-4 h-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </TabsContent>

          {/* Clients Tab Content - Filters */}
          <TabsContent value="clients" className="mt-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: '21px' }}>
                {/* Add Client Button */}
                <Button
                  onClick={() => {
                    // TODO: Implement client creation
                    console.log('Add client clicked');
                  }}
                  className="h-9 gap-2"
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

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 pr-3 w-[200px]"
                  />
                </div>

                {/* Date Filter */}
                <Input
                  type="date"
                  value={filterByDate}
                  onChange={(e) => setFilterByDate(e.target.value)}
                  className="h-9 w-[160px]"
                  placeholder="Filter by date"
                />
              </div>

              {/* Right side - View toggle */}
              <ToggleGroup
                type="single"
                value={viewType}
                onValueChange={(value) => value && setViewType(value as ViewType)}
                variant="outline"
                className="border border-gray-200 rounded-lg h-9 p-1"
              >
                <ToggleGroupItem value="list" aria-label="List view" className="px-3 py-1 h-7">
                  <List className="w-4 h-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" aria-label="Grid view" className="px-3 py-1 h-7">
                  <Grid3X3 className="w-4 h-4" />
                </ToggleGroupItem>
              </ToggleGroup>
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
                  className="h-9 gap-2"
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

              {/* Right side - empty to maintain layout */}
              <div />
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
            <div className="px-[21px] pb-[21px] pt-[35px] space-y-8">
              
              {/* Results count */}
              {filteredProjects.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
                  </Badge>
                  {(searchQuery || filterByDate || filterByStatus !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterByDate('');
                        setFilterByStatus('all');
                      }}
                      className="h-7 text-xs"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}

              {/* Organized Projects Display */}
              {organizedProjects.length > 0 ? (
                <div className="space-y-6">
                  {organizedProjects.map((section, index) => {
                    // Handle group organization
                    if ('group' in section) {
                      const groupData = section as { group: Group; projects: Project[] };
                      return (
                        <DraggableGroup
                          key={`group-${groupData.group.id}`}
                          group={groupData.group}
                          index={index}
                          onMoveGroup={handleMoveGroup}
                        >
                          <div className="space-y-3">
                            {/* Group Header */}
                            <div className="flex items-center gap-3">
                              <FolderPlus className="w-4 h-4 text-gray-500" />
                              <h3 className="text-lg font-medium text-gray-900">{groupData.group.name}</h3>
                              <Badge variant="outline" className="text-xs">
                                {groupData.projects.length}
                              </Badge>
                            </div>

                            {/* Projects Display */}
                            <div className={viewType === 'grid' 
                              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
                              : "space-y-2"
                            }>
                              {groupData.projects.map((project, projectIndex) => 
                                viewType === 'grid' 
                                  ? renderGridProject(project, projectIndex, groupData.group.id)
                                  : renderListProject(project, projectIndex, groupData.group.id)
                              )}
                            </div>
                          </div>
                        </DraggableGroup>
                      );
                    } else {
                      // Handle client or tag organization
                      const sectionData = section as { key: string; label: string; projects: Project[] };
                      return (
                        <div key={`section-${sectionData.key}`} className="space-y-3">
                          {/* Section Header */}
                          <div className="flex items-center gap-3">
                            {organizeBy === 'client' ? (
                              <Building2 className="w-4 h-4 text-gray-500" />
                            ) : (
                              <Tag className="w-4 h-4 text-gray-500" />
                            )}
                            <h3 className="text-lg font-medium text-gray-900">{sectionData.label}</h3>
                            <Badge variant="outline" className="text-xs">
                              {sectionData.projects.length}
                            </Badge>
                          </div>

                          {/* Projects Display */}
                          <div className={viewType === 'grid' 
                            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
                            : "space-y-2"
                          }>
                            {sectionData.projects.map((project, projectIndex) => 
                              viewType === 'grid' 
                                ? renderGridProject(project, projectIndex, project.groupId)
                                : renderListProject(project, projectIndex, project.groupId)
                            )}
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              ) : (
                /* No results message */
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="text-gray-400 mb-4">
                      {searchQuery || filterByDate || filterByStatus !== 'all' ? (
                        <Search className="w-16 h-16" />
                      ) : (
                        <Users className="w-16 h-16" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {searchQuery || filterByDate || filterByStatus !== 'all' 
                        ? 'No projects found'
                        : 'No projects yet'
                      }
                    </h3>
                    <p className="text-gray-600 text-center mb-6 max-w-md">
                      {searchQuery || filterByDate || filterByStatus !== 'all'
                        ? 'Try adjusting your filters or search query'
                        : 'Start by going to the Timeline view to create your first group and projects.'
                      }
                    </p>
                    {(searchQuery || filterByDate || filterByStatus !== 'all') && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery('');
                          setFilterByDate('');
                          setFilterByStatus('all');
                        }}
                      >
                        Clear filters
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Clients Tab Content */}
          <TabsContent value="clients" className="h-full mt-0">
            <div className="px-[21px] pb-[21px] pt-[35px]">
              <ClientsListView 
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterByDate={filterByDate}
                onDateChange={setFilterByDate}
                viewType={viewType}
                statusFilter={clientStatusFilter}
              />
            </div>
          </TabsContent>

          {/* Holidays Tab Content */}
          <TabsContent value="holidays" className="h-full mt-0">
            <div className="px-[21px] pb-[21px] pt-[35px]">
              {/* Filtered holidays list */}
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const filteredHolidays = holidays.filter(holiday => {
                  const startDate = new Date(holiday.startDate);
                  const endDate = new Date(holiday.endDate);
                  startDate.setHours(0, 0, 0, 0);
                  endDate.setHours(0, 0, 0, 0);

                  if (holidayStatusFilter === 'all') return true;
                  
                  if (holidayStatusFilter === 'active') {
                    // Active: ongoing now (today is between start and end)
                    return today >= startDate && today <= endDate;
                  }
                  
                  if (holidayStatusFilter === 'future') {
                    // Future: starts after today
                    return startDate > today;
                  }
                  
                  if (holidayStatusFilter === 'past') {
                    // Past: ended before today
                    return endDate < today;
                  }
                  
                  return true;
                });

                return (
                  <div className="space-y-2">
                    {filteredHolidays.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                          <div className="text-gray-400 mb-4">
                            <Calendar className="w-16 h-16" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            No holidays found
                          </h3>
                          <p className="text-gray-600 text-center mb-6 max-w-md">
                            {holidayStatusFilter !== 'all'
                              ? 'Try adjusting your filter to see more holidays'
                              : 'Add your first holiday to get started.'
                            }
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      filteredHolidays.map((holiday) => {
                        const startDate = new Date(holiday.startDate);
                        const endDate = new Date(holiday.endDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        let statusBadge = null;
                        let statusVariant: "default" | "secondary" | "outline" = "secondary";
                        if (today >= startDate && today <= endDate) {
                          statusBadge = 'Active';
                          statusVariant = "default";
                        } else if (startDate > today) {
                          statusBadge = 'Future';
                          statusVariant = "outline";
                        } else {
                          statusBadge = 'Past';
                          statusVariant = "secondary";
                        }

                        // Calculate duration
                        const durationMs = endDate.getTime() - startDate.getTime();
                        const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1;

                        return (
                          <Card
                            key={holiday.id}
                            onClick={() => {
                              setEditingHoliday(holiday);
                              setIsHolidayModalOpen(true);
                            }}
                            className="hover:shadow-lg transition-shadow cursor-pointer"
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                {/* Left section - Holiday info */}
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-medium text-gray-900 truncate text-sm">{holiday.title}</h3>
                                      <Badge 
                                        variant={statusVariant}
                                        className="flex-shrink-0 text-xs"
                                      >
                                        {statusBadge}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                {/* Middle section - Date range */}
                                <div className="flex items-center gap-4 flex-1 justify-center">
                                  <div className="text-xs text-gray-600">
                                    <span className="whitespace-nowrap">
                                      {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="mx-2 text-gray-400">→</span>
                                    <span className="whitespace-nowrap">
                                      {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                  </div>
                                </div>

                                {/* Right section - Duration */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <div className="flex items-center gap-1 text-xs text-gray-600">
                                    <Clock className="w-3 h-3" />
                                    <span>{durationDays} {durationDays === 1 ? 'day' : 'days'}</span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                );
              })()}
            </div>
          </TabsContent>
        </Tabs>
      </AppPageLayout.Content>
    </AppPageLayout>

    {/* Project Edit Modal */}
    <ProjectModal
      isOpen={!!selectedProjectId}
      onClose={() => setSelectedProjectId(null)}
      projectId={selectedProjectId || undefined}
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
    </DndProvider>
  );
}