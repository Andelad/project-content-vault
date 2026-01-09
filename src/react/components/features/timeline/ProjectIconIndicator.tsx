import React, { useState } from 'react';
import { Folder, Edit3, Briefcase, Zap, Target, Lightbulb, Rocket, Star, Heart, Gift, Music, Camera, Code, Book, Gamepad2, Coffee, Home, Building, Car, Plane, Map, Globe } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Project } from '@/types/core';

interface ProjectIconIndicatorProps {
  project: Project;
  mode?: 'days' | 'weeks';
}

type IconComponent = React.ComponentType<{ className?: string }>;

// Icon mapping - matches the icons from ProjectModal
const ICON_MAP: Record<string, IconComponent> = {
  'folder': Folder,
  'briefcase': Briefcase,
  'target': Target,
  'rocket': Rocket,
  'lightbulb': Lightbulb,
  'zap': Zap,
  'star': Star,
  'heart': Heart,
  'gift': Gift,
  'code': Code,
  'book': Book,
  'camera': Camera,
  'music': Music,
  'gamepad2': Gamepad2,
  'coffee': Coffee,
  'home': Home,
  'building': Building,
  'car': Car,
  'plane': Plane,
  'map': Map,
  'globe': Globe
};

export function ProjectIconIndicator({ project, mode = 'days' }: ProjectIconIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { setSelectedProjectId } = useProjectContext();
  
  // Get the icon component
  const getIconComponent = (iconName?: string) => {
    if (!iconName) return Folder;
    return ICON_MAP[iconName.toLowerCase()] || Folder;
  };
  
  const IconComponent = getIconComponent(project.icon);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedProjectId(project.id);
  };
  
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          className="absolute top-[8px] left-[10px] w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg drop-shadow-sm pointer-events-auto"
          style={{ backgroundColor: project.color }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleClick}
        >
          {/* Main icon */}
          <div 
            className={`transition-opacity duration-200 ${
              isHovered ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <IconComponent className="w-4 h-4 text-foreground" />
          </div>
          
          {/* Edit icon overlay */}
          <div 
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Edit3 className="w-4 h-4 text-foreground" />
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="ml-2">
        <div className="text-xs">
          <div className="font-medium">
            {project.name}
            {(project.clientData?.name || project.client) && (
              <span className="text-muted-foreground font-normal"> • {project.clientData?.name || project.client}</span>
            )}
          </div>
          <div className="text-muted-foreground">Click to edit project</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}