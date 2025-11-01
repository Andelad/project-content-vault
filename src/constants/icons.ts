// Project icons mapping
import {
  Folder, Briefcase, Zap, Target, Lightbulb, Rocket, Star, Heart, Gift, Music, Camera, Code, Book, Gamepad2, Coffee, Home, Building, Car, Plane, Map, Globe, Infinity, Croissant
} from 'lucide-react';

// Habit icon constant
export const HABIT_ICON = Croissant;

export const PROJECT_ICONS = [
  { name: 'folder', label: 'Folder', component: Folder },
  { name: 'briefcase', label: 'Briefcase', component: Briefcase },
  { name: 'zap', label: 'Zap', component: Zap },
  { name: 'target', label: 'Target', component: Target },
  { name: 'lightbulb', label: 'Lightbulb', component: Lightbulb },
  { name: 'rocket', label: 'Rocket', component: Rocket },
  { name: 'star', label: 'Star', component: Star },
  { name: 'heart', label: 'Heart', component: Heart },
  { name: 'gift', label: 'Gift', component: Gift },
  { name: 'music', label: 'Music', component: Music },
  { name: 'camera', label: 'Camera', component: Camera },
  { name: 'code', label: 'Code', component: Code },
  { name: 'book', label: 'Book', component: Book },
  { name: 'gamepad2', label: 'Gamepad', component: Gamepad2 },
  { name: 'coffee', label: 'Coffee', component: Coffee },
  { name: 'home', label: 'Home', component: Home },
  { name: 'building', label: 'Building', component: Building },
  { name: 'car', label: 'Car', component: Car },
  { name: 'plane', label: 'Plane', component: Plane },
  { name: 'map', label: 'Map', component: Map },
  { name: 'globe', label: 'Globe', component: Globe },
  { name: 'infinity', label: 'Infinity', component: Infinity },
] as const;

// Type for project icon names
export type ProjectIconName = typeof PROJECT_ICONS[number]['name'];
