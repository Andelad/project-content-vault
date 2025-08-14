import React, { useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useApp } from '../contexts/AppContext';
import { Plus, Edit, Trash2, Calendar, Clock, Users, FolderPlus, Grid3X3, List, GripVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Group, Project } from '../types';

type ViewType = 'grid' | 'list';

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
  const { groups, projects, addGroup, updateGroup, deleteGroup, addProject, updateProject, deleteProject, reorderGroups, reorderProjects, setSelectedProjectId } = useApp();

  // View toggle state
  const [viewType, setViewType] = useState<ViewType>('list');

  // Group dialog state
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupColor, setGroupColor] = useState('#6366f1');

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

  const defaultColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6b7280'
  ];

  // Group management functions
  const handleAddGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDescription('');
    setGroupColor('#6366f1');
    setIsGroupDialogOpen(true);
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || '');
    setGroupColor(group.color);
    setIsGroupDialogOpen(true);
  };

  const handleSaveGroup = () => {
    if (!groupName.trim()) return;

    if (editingGroup) {
      updateGroup(editingGroup.id, {
        name: groupName,
        description: groupDescription,
        color: groupColor
      });
    } else {
      addGroup({
        name: groupName,
        description: groupDescription,
        color: groupColor
      });
    }

    setIsGroupDialogOpen(false);
    resetGroupForm();
  };

  const resetGroupForm = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDescription('');
    setGroupColor('#6366f1');
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
    setProjectClient(project.client);
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
    } else {
      addProject({
        name: projectName,
        client: projectClient,
        groupId: projectGroupId,
        rowId: 'work-row-1', // Provide default rowId
        startDate,
        endDate,
        estimatedHours,
        color: projectColor
      });
    }

    setIsProjectDialogOpen(false);
    resetProjectForm();
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

  const getDuration = (startDate: Date, endDate: Date) => {
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;
    
    if (weeks === 0) return `${diffDays} days`;
    if (days === 0) return `${weeks} weeks`;
    return `${weeks}w ${days}d`;
  };

  const getProjectsByGroup = (groupId: string) => {
    return projects.filter(project => project.groupId === groupId);
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
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: project.color }}
              />
              <div>
                <CardTitle className="text-base">{project.name}</CardTitle>
                <CardDescription className="text-sm">
                  {project.client}
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteProject(project.id);
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>
              {formatDate(project.startDate)} - {formatDate(project.endDate)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-600" />
            <span className="font-semibold text-gray-900">{project.estimatedHours} hours estimated</span>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Duration: {getDuration(project.startDate, project.endDate)}</span>
            <Badge 
              variant="secondary" 
              className="bg-gray-100 text-gray-700"
            >
              Active
            </Badge>
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
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {/* Left section - Project info */}
            <div className="flex items-center gap-4 flex-1">
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0" 
                style={{ backgroundColor: project.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
                  <span className="text-sm text-gray-600 whitespace-nowrap">{project.client}</span>
                </div>
              </div>
            </div>

            {/* Middle section - Timeline info */}
            <div className="flex items-center gap-6 flex-1 justify-center">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span className="whitespace-nowrap">
                  {formatDate(project.startDate)} - {formatDate(project.endDate)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="whitespace-nowrap font-semibold text-gray-900">{project.estimatedHours}h estimated</span>
              </div>
              
              <div className="text-sm text-gray-500">
                <span>Duration: {getDuration(project.startDate, project.endDate)}</span>
              </div>
            </div>

            {/* Right section - Status and actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Badge 
                variant="secondary" 
                className="bg-gray-100 text-gray-700"
              >
                Active
              </Badge>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id);
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </DraggableProject>
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8">
        <div className="flex items-center space-x-6">
          <h1 className="text-lg font-semibold text-[#595956]">Projects</h1>
          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
            {projects.length} projects in {groups.length} groups
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <ToggleGroup
            type="single"
            value={viewType}
            onValueChange={(value) => value && setViewType(value as ViewType)}
            className="border border-gray-200 rounded-lg"
          >
            <ToggleGroupItem value="list" aria-label="List view" className="px-3 py-2">
              <List className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view" className="px-3 py-2">
              <Grid3X3 className="w-4 h-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={handleAddGroup}>
                <FolderPlus className="w-4 h-4 mr-2" />
                New Group
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingGroup ? 'Edit Group' : 'Create New Group'}
                </DialogTitle>
                <DialogDescription>
                  {editingGroup 
                    ? 'Modify the details of your project group.' 
                    : 'Create a new group to organize your projects.'
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="group-name">Group Name</Label>
                  <Input
                    id="group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name"
                    autoFocus
                  />
                </div>
                
                <div>
                  <Label htmlFor="group-description">Description (Optional)</Label>
                  <Textarea
                    id="group-description"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="Brief description of this group"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="group-color">Color</Label>
                  <div className="flex gap-2 mt-2">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          groupColor === color ? 'border-gray-400 scale-110' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setGroupColor(color)}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={handleSaveGroup} 
                    className="flex-1"
                    disabled={!groupName.trim()}
                  >
                    {editingGroup ? 'Update Group' : 'Create Group'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsGroupDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#02c0b7] hover:bg-[#02a09a] text-white" onClick={() => handleAddProject()}>
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingProject ? 'Edit Project' : 'Create New Project'}
                </DialogTitle>
                <DialogDescription>
                  {editingProject 
                    ? 'Modify the details of your project.' 
                    : 'Add a new project with timeline and budget information.'
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Project name"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="project-client">Client</Label>
                    <Input
                      id="project-client"
                      value={projectClient}
                      onChange={(e) => setProjectClient(e.target.value)}
                      placeholder="Client name"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="project-group">Group</Label>
                  <Select value={projectGroupId} onValueChange={setProjectGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: group.color }}
                            />
                            {group.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="project-start-date">Start Date</Label>
                    <Input
                      id="project-start-date"
                      type="date"
                      value={projectStartDate}
                      onChange={(e) => setProjectStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="project-end-date">End Date</Label>
                    <Input
                      id="project-end-date"
                      type="date"
                      value={projectEndDate}
                      onChange={(e) => setProjectEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="project-hours">Estimated Hours</Label>
                  <Input
                    id="project-hours"
                    type="number"
                    min="1"
                    value={projectEstimatedHours}
                    onChange={(e) => setProjectEstimatedHours(e.target.value)}
                    placeholder="Total estimated hours"
                  />
                </div>

                <div>
                  <Label htmlFor="project-color">Color</Label>
                  <div className="flex gap-2 mt-2">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          projectColor === color ? 'border-gray-400 scale-110' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setProjectColor(color)}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={handleSaveProject} 
                    className="flex-1"
                    disabled={!projectName.trim() || !projectClient.trim() || !projectStartDate || !projectEndDate || !projectEstimatedHours}
                  >
                    {editingProject ? 'Update Project' : 'Create Project'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsProjectDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto light-scrollbar">
        <div className="p-[21px] space-y-8">
        {groups.map((group, groupIndex) => {
          const groupProjects = getProjectsByGroup(group.id);
          
          return (
            <DraggableGroup
              key={group.id}
              group={group}
              index={groupIndex}
              onMoveGroup={handleMoveGroup}
            >
              <div className="space-y-4">
              {/* Group Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: group.color }}
                  />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{group.name}</h2>
                    {group.description && (
                      <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {groupProjects.length} projects
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddProject(group.id)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Project
                  </Button>
                  
                  {group.id !== 'work-group' && group.id !== 'home-group' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditGroup(group)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteGroup(group.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Projects Display */}
              {groupProjects.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="text-gray-400 mb-2">
                      <Users className="w-12 h-12" />
                    </div>
                    <p className="text-gray-600 mb-4">No projects in this group yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddProject(group.id)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Project
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className={viewType === 'grid' 
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
                  : "space-y-3"
                }>
                  {groupProjects.map((project, projectIndex) => 
                    viewType === 'grid' 
                      ? renderGridProject(project, projectIndex, group.id)
                      : renderListProject(project, projectIndex, group.id)
                  )}
                </div>
              )}
              
              {group.id !== groups[groups.length - 1].id && <Separator />}
              </div>
            </DraggableGroup>
          );
        })}

        {groups.length === 2 && getProjectsByGroup('work-group').length === 0 && getProjectsByGroup('home-group').length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="text-gray-400 mb-4">
                <Users className="w-16 h-16" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Projects</h3>
              <p className="text-gray-600 text-center mb-6 max-w-md">
                Organize your work by creating project groups and adding projects with timelines and budgets.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleAddGroup}
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Create Group
                </Button>
                <Button
                  className="bg-[#02c0b7] hover:bg-[#02a09a] text-white"
                  onClick={() => handleAddProject()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Project
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
    </DndProvider>
  );
}