import React, { useState } from 'react';
import { Folder, Edit3, Briefcase, Zap, Target, Lightbulb, Rocket, Star, Heart, Gift, Music, Camera, Code, Book, Gamepad2, Coffee, Home, Building, Car, Plane, Map, Globe } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useApp } from '../../contexts/AppContext';

interface ProjectIconIndicatorProps {
  project: any;
  mode?: 'days' | 'weeks';
}

// Icon mapping - matches the icons from ProjectDetailModal
const ICON_MAP: { [key: string]: any } = {
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
  const { setSelectedProjectId } = useApp();
  
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="relative w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md"
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
            <IconComponent className="w-3 h-3 text-foreground" />
          </div>
          
          {/* Edit icon overlay */}
          <div 
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Edit3 className="w-3 h-3 text-foreground" />
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="ml-2">
        <div className="text-xs">
          <div className="font-medium">{project.name}</div>
          <div className="text-muted-foreground">Click to edit project</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}