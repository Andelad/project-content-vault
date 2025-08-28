// Project modal constants and utilities
import {
  Folder, Briefcase, Zap, Target, Lightbulb, Rocket, Star, Heart, Gift, Music, Camera, Code, Book, Gamepad2, Coffee, Home, Building, Car, Plane, Map, Globe, Infinity
} from 'lucide-react';

// Project colors using OKLCH color space for better accessibility
export const OKLCH_PROJECT_COLORS = [
  'oklch(0.65 0.15 25)',   // Warm red
  'oklch(0.65 0.15 45)',   // Orange
  'oklch(0.65 0.15 85)',   // Yellow
  'oklch(0.65 0.15 145)',  // Lime green
  'oklch(0.65 0.15 165)',  // Green
  'oklch(0.65 0.15 205)',  // Teal
  'oklch(0.65 0.15 245)',  // Blue
  'oklch(0.65 0.15 285)',  // Purple
  'oklch(0.65 0.15 325)',  // Pink
  'oklch(0.65 0.15 15)',   // Deep red
  'oklch(0.55 0.08 25)',   // Muted red
  'oklch(0.55 0.08 85)',   // Muted yellow
  'oklch(0.55 0.08 165)',  // Muted green
  'oklch(0.55 0.08 245)',  // Muted blue
  'oklch(0.55 0.08 325)',  // Muted pink
];

// Project icons mapping
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
];
