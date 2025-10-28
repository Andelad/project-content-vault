import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Search, BookOpen, Calendar, PieChart, Folders, Settings as SettingsIcon, Zap, Menu, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const isBrowser = typeof window !== 'undefined';

interface HelpSubTopic {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface HelpSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subTopics: HelpSubTopic[];
}

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: Zap,
    subTopics: [
      {
        id: 'welcome',
        label: 'Welcome to Budgi',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Welcome to Budgi</h2>
            <p className="text-gray-700">
              Budgi is a time forecasting and project planning tool designed to help you visualize, 
              organize, and manage your projects effectively.
            </p>
            <p className="text-gray-700">
              This guide will help you understand the key features and how to make the most of the application.
            </p>
          </div>
        )
      },
      {
        id: 'quick-start',
        label: 'Quick Start Guide',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Quick Start Guide</h2>
            <p className="text-gray-700">Follow these steps to get started with Budgi:</p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Create your first project in the Overview section</li>
              <li>Add events and milestones to your Timeline</li>
              <li>Set up your work hours in Settings</li>
              <li>Use the Planner to schedule your tasks</li>
            </ol>
          </div>
        )
      }
    ]
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: BookOpen,
    subTopics: [
      {
        id: 'timeline-overview',
        label: 'Timeline Overview',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Understanding the Timeline</h2>
            <p className="text-gray-700">
              The Timeline view is your main workspace for visualizing and managing project schedules. 
              It provides a horizontal, time-based view of all your projects, events, and milestones.
            </p>
            
            <h3 className="text-lg font-semibold text-gray-900 mt-6">Key Features</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Project Rows:</strong> Each project appears as a horizontal row, showing all its events and milestones</li>
              <li><strong>Time Scale:</strong> View your timeline in days or weeks depending on your planning needs</li>
              <li><strong>Today Marker:</strong> A vertical line indicates the current date</li>
              <li><strong>Color Coding:</strong> Projects and events use colors to make visual identification easier</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6">Timeline Views</h3>
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900">Days View</h4>
                <p className="text-sm text-blue-800 mt-1">
                  Shows each individual day as a column. Best for detailed, short-term planning and tracking daily progress.
                </p>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900">Weeks View</h4>
                <p className="text-sm text-green-800 mt-1">
                  Shows weeks as columns. Ideal for long-term planning and seeing the bigger picture of your projects.
                </p>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'timeline-navigation',
        label: 'Navigating the Timeline',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Navigating the Timeline</h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mt-6">Scrolling and Zooming</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Horizontal Scroll:</strong> Use your mouse wheel or trackpad to scroll left and right through time</li>
              <li><strong>Vertical Scroll:</strong> Scroll up and down to see different projects</li>
              <li><strong>Jump to Today:</strong> Click the "Today" button in the toolbar to quickly return to the current date</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6">Timeline Controls</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Badge>View Toggle</Badge>
                <p className="text-sm text-gray-700">Switch between Days and Weeks view using the toggle in the toolbar</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Badge>Filters</Badge>
                <p className="text-sm text-gray-700">Filter projects by client, label, or status to focus on what matters</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Badge>Search</Badge>
                <p className="text-sm text-gray-700">Use the search bar to quickly find specific projects or events</p>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'timeline-events',
        label: 'Working with Events',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Working with Events</h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mt-6">Creating Events</h3>
            <p className="text-gray-700">Events represent work periods or tasks within your projects. To create an event:</p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
              <li>Click the "+" button next to a project row</li>
              <li>Fill in the event details:
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>Title and description</li>
                  <li>Start and end dates</li>
                  <li>Allocated hours</li>
                  <li>Status (planned, in progress, completed)</li>
                </ul>
              </li>
              <li>Click "Save" to add the event to your timeline</li>
            </ol>

            <h3 className="text-lg font-semibold text-gray-900 mt-6">Editing Events</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Click to Edit:</strong> Click any event block to open its details and make changes</li>
              <li><strong>Drag to Move:</strong> Drag events horizontally to change their dates</li>
              <li><strong>Resize:</strong> Drag the edges of an event to adjust its duration</li>
              <li><strong>Delete:</strong> Open an event and click the delete button to remove it</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6">Event Status</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <div>
                  <p className="font-semibold text-gray-900">Planned</p>
                  <p className="text-sm text-gray-600">Event is scheduled but not yet started</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <div>
                  <p className="font-semibold text-gray-900">In Progress</p>
                  <p className="text-sm text-gray-600">Currently working on this event</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <div>
                  <p className="font-semibold text-gray-900">Completed</p>
                  <p className="text-sm text-gray-600">Event is finished</p>
                </div>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'timeline-milestones',
        label: 'Using Milestones',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Using Milestones</h2>
            <p className="text-gray-700">
              Milestones are important dates or deadlines in your project that don't have a duration. 
              They appear as diamond markers on the timeline.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6">Creating Milestones</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
              <li>Open a project from the Overview section</li>
              <li>Find the Milestones section</li>
              <li>Click "Add Milestone"</li>
              <li>Enter a title and select the due date</li>
              <li>Save to see it appear on your timeline</li>
            </ol>

            <h3 className="text-lg font-semibold text-gray-900 mt-6">Best Practices</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Use milestones for deliverable deadlines</li>
              <li>Mark key decision points or review dates</li>
              <li>Keep milestone titles short and clear</li>
              <li>Overdue milestones will be highlighted in red</li>
            </ul>
          </div>
        )
      },
      {
        id: 'timeline-workload',
        label: 'Understanding Workload',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Understanding Workload Calculations</h2>
            <p className="text-gray-700">
              Budgi automatically calculates your workload based on your work hours settings and scheduled events.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6">Workload Indicators</h3>
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900">Under Capacity (Green)</h4>
                <p className="text-sm text-green-800 mt-1">
                  You have available time - you're not overbooked for this period
                </p>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-900">At Capacity (Yellow)</h4>
                <p className="text-sm text-yellow-800 mt-1">
                  You're fully booked - all available work hours are allocated
                </p>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-semibold text-red-900">Over Capacity (Red)</h4>
                <p className="text-sm text-red-800 mt-1">
                  You're overbooked - more hours are scheduled than you have available
                </p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mt-6">Tips for Managing Workload</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Set realistic work hours in Settings to get accurate capacity calculations</li>
              <li>Watch for red indicators and consider rescheduling events</li>
              <li>Include buffer time for unexpected tasks or delays</li>
              <li>Review your workload regularly to avoid burnout</li>
            </ul>
          </div>
        )
      }
    ]
  },
  {
    id: 'planner',
    label: 'Planner',
    icon: Calendar,
    subTopics: [
      {
        id: 'planner-overview',
        label: 'Planner Overview',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Planner Overview</h2>
            <p className="text-gray-700">
              The Planner provides a calendar-style view of your scheduled tasks and events.
            </p>
            <p className="text-gray-700 italic">
              More detailed documentation coming soon...
            </p>
          </div>
        )
      },
      {
        id: 'planner-scheduling',
        label: 'Scheduling Tasks',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Scheduling Tasks</h2>
            <p className="text-gray-700 italic">
              Documentation in progress...
            </p>
          </div>
        )
      }
    ]
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: PieChart,
    subTopics: [
      {
        id: 'insights-overview',
        label: 'Insights Overview',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Insights Overview</h2>
            <p className="text-gray-700">
              The Insights view provides analytics and visualizations of your project data.
            </p>
            <p className="text-gray-700 italic">
              More detailed documentation coming soon...
            </p>
          </div>
        )
      }
    ]
  },
  {
    id: 'overview',
    label: 'Overview',
    icon: Folders,
    subTopics: [
      {
        id: 'overview-projects',
        label: 'Managing Projects',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Managing Projects</h2>
            <p className="text-gray-700">
              The Overview section is where you create and manage your projects.
            </p>
            <p className="text-gray-700 italic">
              More detailed documentation coming soon...
            </p>
          </div>
        )
      },
      {
        id: 'overview-clients',
        label: 'Working with Clients',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Working with Clients</h2>
            <p className="text-gray-700 italic">
              Documentation in progress...
            </p>
          </div>
        )
      }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    subTopics: [
      {
        id: 'settings-work-hours',
        label: 'Configuring Work Hours',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Configuring Work Hours</h2>
            <p className="text-gray-700">
              Set your weekly work schedule to get accurate workload and capacity calculations.
            </p>
            <p className="text-gray-700 italic">
              More detailed documentation coming soon...
            </p>
          </div>
        )
      },
      {
        id: 'settings-preferences',
        label: 'General Preferences',
        content: (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">General Preferences</h2>
            <p className="text-gray-700 italic">
              Documentation in progress...
            </p>
          </div>
        )
      }
    ]
  }
];

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['getting-started']));
  const [activeTopicId, setActiveTopicId] = useState('welcome');
  const [isMobile, setIsMobile] = useState(() => (isBrowser ? window.innerWidth < 768 : false));
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (!isBrowser) return false;
    // Start open on desktop, closed on mobile
    return window.innerWidth >= 768;
  });

  // Detect mobile size (< 768px)
  useEffect(() => {
    if (!isBrowser) return;

    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      const wasMobile = isMobile;
      setIsMobile(mobile);

      // Only auto-open/close if transitioning between mobile and desktop
      if (mobile !== wasMobile) {
        if (!mobile) {
          // Transitioning to desktop - open sidebar
          setSidebarOpen(true);
        } else {
          // Transitioning to mobile - close sidebar
          setSidebarOpen(false);
        }
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobile]);

  // Filter topics based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return helpSections;

    const query = searchQuery.toLowerCase();
    return helpSections
      .map(section => ({
        ...section,
        subTopics: section.subTopics.filter(topic =>
          topic.label.toLowerCase().includes(query) ||
          section.label.toLowerCase().includes(query)
        )
      }))
      .filter(section => section.subTopics.length > 0);
  }, [searchQuery]);

  // Auto-expand sections when searching
  React.useEffect(() => {
    if (searchQuery.trim()) {
      const allSectionIds = filteredSections.map(s => s.id);
      setExpandedSections(new Set(allSectionIds));
    }
  }, [searchQuery, filteredSections]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleTopicClick = (sectionId: string, topicId: string) => {
    setActiveTopicId(topicId);
    if (!expandedSections.has(sectionId)) {
      toggleSection(sectionId);
    }
    // Close sidebar on mobile after selecting a topic
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const activeContent = useMemo(() => {
    for (const section of helpSections) {
      const topic = section.subTopics.find(t => t.id === activeTopicId);
      if (topic) return topic.content;
    }
    return null;
  }, [activeTopicId]);

  const activeTopicLabel = useMemo(() => {
    for (const section of helpSections) {
      const topic = section.subTopics.find(t => t.id === activeTopicId);
      if (topic) return topic.label;
    }
    return 'Help';
  }, [activeTopicId]);

  // Sidebar content component
  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Help & Documentation</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(false)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto light-scrollbar p-2">
        {filteredSections.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No topics found matching "{searchQuery}"
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSections.map((section) => (
              <div key={section.id}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200/70 hover:text-gray-900 transition-colors rounded-lg"
                >
                  <section.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{section.label}</span>
                </button>

                {/* Sub-topics */}
                {expandedSections.has(section.id) && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {section.subTopics.map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => handleTopicClick(section.id, topic.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors rounded-lg",
                          activeTopicId === topic.id
                            ? "bg-[#02c0b7] text-white font-medium"
                            : "text-gray-600 hover:bg-gray-200/70 hover:text-gray-900"
                        )}
                      >
                        <span className="flex-1 text-left">{topic.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </nav>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1216px] w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] h-[90vh] p-0 gap-0 rounded-lg">
        <div className="h-full flex overflow-hidden rounded-lg relative">
          {/* Mobile: Sidebar slides over content */}
          {isMobile && (
            <div 
              className={cn(
                "absolute inset-y-0 left-0 z-20 w-80 bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out",
                sidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full shadow-none"
              )}
            >
              <SidebarContent />
            </div>
          )}

          {/* Desktop: Sidebar squeezes content */}
          <div 
            className={cn(
              "relative flex-shrink-0 bg-gray-50 transition-all duration-300 ease-in-out overflow-hidden",
              !isMobile && sidebarOpen ? "w-80 border-r border-gray-200" : "w-0"
            )}
          >
            <div className="h-full flex flex-col w-80">
              <SidebarContent />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* Header - Always visible with hamburger + title */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              {!sidebarOpen && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                  className="h-8 w-8 p-0 flex-shrink-0"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}
              {sidebarOpen && <div className="w-8 h-8 flex-shrink-0" />}
              <h2 className="font-semibold text-gray-900">
                {activeTopicLabel}
              </h2>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto light-scrollbar">
              <div className="p-8 w-full max-w-4xl">
                {activeContent}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
