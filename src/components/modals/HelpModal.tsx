import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Search, BookOpen, Calendar, PieChart, Folders, Settings as SettingsIcon, Zap, Menu, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const isBrowser = typeof window !== 'undefined';

interface HelpSubSection {
  id: string;
  label: string;
}

interface HelpSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
  subSections?: HelpSubSection[];
}

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: Zap,
    content: (
      <div className="space-y-8">
        <div id="welcome">
          <p className="text-gray-700 mb-4">
            Budgi is a time forecasting and project planning tool designed to help you visualize, 
            organize, and manage your projects effectively.
          </p>
          <p className="text-gray-700">
            This guide will help you understand the key features and how to make the most of the application.
          </p>
        </div>

        <div id="quick-start" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Start Guide</h3>
          <p className="text-gray-700 mb-4">Follow these steps to get started with Budgi:</p>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Create your first project in the Overview section</li>
            <li>Add events and milestones to your Timeline</li>
            <li>Set up your work hours in Settings</li>
            <li>Use the Planner to schedule your tasks</li>
          </ol>
        </div>
      </div>
    ),
    subSections: [
      { id: 'welcome', label: 'Welcome to Budgi' },
      { id: 'quick-start', label: 'Quick Start Guide' }
    ]
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: BookOpen,
    content: (
      <div className="space-y-8">
        <div id="timeline-overview">
          <p className="text-gray-700 mb-6">
            The Timeline view is your main workspace for visualizing and managing project schedules. 
            It provides a horizontal, time-based view of all your projects, events, and milestones.
          </p>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Features</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
            <li><strong>Project Rows:</strong> Each project appears as a horizontal row, showing all its events and milestones</li>
            <li><strong>Time Scale:</strong> View your timeline in days or weeks depending on your planning needs</li>
            <li><strong>Today Marker:</strong> A vertical line indicates the current date</li>
            <li><strong>Color Coding:</strong> Projects and events use colors to make visual identification easier</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 mb-3">Timeline Views</h3>
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

        <div id="timeline-navigation" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Navigating the Timeline</h3>
          
          <h4 className="text-lg font-semibold text-gray-900 mb-3 mt-6">Scrolling and Zooming</h4>
          <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
            <li><strong>Horizontal Scroll:</strong> Use your mouse wheel or trackpad to scroll left and right through time</li>
            <li><strong>Vertical Scroll:</strong> Scroll up and down to see different projects</li>
            <li><strong>Jump to Today:</strong> Click the "Today" button in the toolbar to quickly return to the current date</li>
          </ul>

          <h4 className="text-lg font-semibold text-gray-900 mb-3">Timeline Controls</h4>
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

        <div id="timeline-events" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Working with Events</h3>
          
          <h4 className="text-lg font-semibold text-gray-900 mb-3 mt-6">Creating Events</h4>
          <p className="text-gray-700 mb-3">Events represent work periods or tasks within your projects. To create an event:</p>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4 mb-6">
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

          <h4 className="text-lg font-semibold text-gray-900 mb-3">Editing Events</h4>
          <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
            <li><strong>Click to Edit:</strong> Click any event block to open its details and make changes</li>
            <li><strong>Drag to Move:</strong> Drag events horizontally to change their dates</li>
            <li><strong>Resize:</strong> Drag the edges of an event to adjust its duration</li>
            <li><strong>Delete:</strong> Open an event and click the delete button to remove it</li>
          </ul>

          <h4 className="text-lg font-semibold text-gray-900 mb-3">Event Status</h4>
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

        <div id="timeline-milestones" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Using Milestones</h3>
          <p className="text-gray-700 mb-6">
            Milestones are important dates or deadlines in your project that don't have a duration. 
            They appear as diamond markers on the timeline.
          </p>

          <h4 className="text-lg font-semibold text-gray-900 mb-3">Creating Milestones</h4>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4 mb-6">
            <li>Open a project from the Overview section</li>
            <li>Find the Milestones section</li>
            <li>Click "Add Milestone"</li>
            <li>Enter a title and select the due date</li>
            <li>Save to see it appear on your timeline</li>
          </ol>

          <h4 className="text-lg font-semibold text-gray-900 mb-3">Best Practices</h4>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Use milestones for deliverable deadlines</li>
            <li>Mark key decision points or review dates</li>
            <li>Keep milestone titles short and clear</li>
            <li>Overdue milestones will be highlighted in red</li>
          </ul>
        </div>

        <div id="timeline-workload" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Understanding Workload Calculations</h3>
          <p className="text-gray-700 mb-6">
            Budgi automatically calculates your workload based on your work hours settings and scheduled events.
          </p>

          <h4 className="text-lg font-semibold text-gray-900 mb-3">Workload Indicators</h4>
          <div className="space-y-3 mb-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h5 className="font-semibold text-green-900">Under Capacity (Green)</h5>
              <p className="text-sm text-green-800 mt-1">
                You have available time - you're not overbooked for this period
              </p>
            </div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h5 className="font-semibold text-yellow-900">At Capacity (Yellow)</h5>
              <p className="text-sm text-yellow-800 mt-1">
                You're fully booked - all available work hours are allocated
              </p>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h5 className="font-semibold text-red-900">Over Capacity (Red)</h5>
              <p className="text-sm text-red-800 mt-1">
                You're overbooked - more hours are scheduled than you have available
              </p>
            </div>
          </div>

          <h4 className="text-lg font-semibold text-gray-900 mb-3">Tips for Managing Workload</h4>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Set realistic work hours in Settings to get accurate capacity calculations</li>
            <li>Watch for red indicators and consider rescheduling events</li>
            <li>Include buffer time for unexpected tasks or delays</li>
            <li>Review your workload regularly to avoid burnout</li>
          </ul>
        </div>
      </div>
    ),
    subSections: [
      { id: 'timeline-navigation', label: 'Navigating the Timeline' },
      { id: 'timeline-events', label: 'Working with Events' },
      { id: 'timeline-milestones', label: 'Using Milestones' },
      { id: 'timeline-workload', label: 'Understanding Workload' }
    ]
  },
  {
    id: 'planner',
    label: 'Planner',
    icon: Calendar,
    content: (
      <div className="space-y-8">
        <div id="planner-overview">
          <p className="text-gray-700 mb-4">
            The Planner provides a calendar-style view of your scheduled tasks and events.
          </p>
          <p className="text-gray-700 italic">
            More detailed documentation coming soon...
          </p>
        </div>

        <div id="planner-scheduling" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Scheduling Tasks</h3>
          <p className="text-gray-700 italic">
            Documentation in progress...
          </p>
        </div>
      </div>
    ),
    subSections: [
      { id: 'planner-scheduling', label: 'Scheduling Tasks' }
    ]
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: PieChart,
    content: (
      <div className="space-y-8">
        <div id="insights-overview">
          <p className="text-gray-700">
            The Insights view provides analytics and visualizations of your project data, helping you understand time allocation, workload balance, and future commitments.
          </p>
        </div>

        <div id="insights-time-distribution" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Time Distribution</h3>
          <p className="text-gray-700 mb-4">
            Donut showing percentage of total time spent per project for the selected period.
          </p>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Keys</h4>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Each slice = a project, sized by hours</li>
            <li>Hover to see project, client, hours, and %</li>
            <li>Period: Last Week / Last Month / Custom range</li>
            <li>Includes only completed events with a project</li>
          </ul>
        </div>

        <div id="insights-availability-used" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Availability Used</h3>
          <p className="text-gray-700 mb-4">
            Grouped bars comparing available, utilized, and overbooked hours per period.
          </p>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Keys</h4>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{background:'#e7e5e4'}}></span>Available (capacity)</li>
            <li><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{background:'#02c0b7'}}></span>Utilized (booked)</li>
            <li><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{background:'#dc2626'}}></span>Overbooked (excess)</li>
            <li>Timeframes: Weekly / Monthly / Yearly with navigation</li>
          </ul>
        </div>

        <div id="insights-average-day" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Average Day Heatmap</h3>
          <p className="text-gray-700 mb-4">
            Stream chart showing average work hours throughout the day based on your completed events.
          </p>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">How to Read</h4>
          <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
            <li>X-axis: Time of day (00:00 to 23:30 in 30-min intervals)</li>
            <li>Y-axis: Hours worked (0 to 1.0 hour per time slot)</li>
            <li>Area shows average work duration for each time slot</li>
            <li>Higher peaks = more work during that time</li>
          </ul>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Layer Modes</h4>
          <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
            <li><strong>Single:</strong> Total work time across all projects</li>
            <li><strong>By Group:</strong> Separate layers for each group</li>
            <li><strong>By Project:</strong> Separate layers for each project</li>
          </ul>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Settings</h4>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Period: Last Week / Last Month / Last 6 Months</li>
            <li>Filters: Select specific groups/projects and days</li>
          </ul>
        </div>

        <div id="insights-future-commitments" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Future Commitments</h3>
          <p className="text-gray-700 mb-4">
            Summary of upcoming project workload based on estimated hours and start dates.
          </p>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Includes</h4>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Total estimated hours for future projects</li>
            <li>Upcoming projects count and next start in days</li>
            <li>Average project size (hours)</li>
          </ul>
        </div>
      </div>
    ),
    subSections: [
      { id: 'insights-time-distribution', label: 'Time Distribution' },
      { id: 'insights-availability-used', label: 'Availability Used' },
      { id: 'insights-average-day', label: 'Average Day Heatmap' },
      { id: 'insights-future-commitments', label: 'Future Commitments' }
    ]
  },
  {
    id: 'overview',
    label: 'Overview',
    icon: Folders,
    content: (
      <div className="space-y-8">
        <div id="overview-projects">
          <p className="text-gray-700 mb-4">
            The Overview section is where you create and manage your projects.
          </p>
          <p className="text-gray-700 italic">
            More detailed documentation coming soon...
          </p>
        </div>

        <div id="overview-clients" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Working with Clients</h3>
          <p className="text-gray-700 italic">
            Documentation in progress...
          </p>
        </div>
      </div>
    ),
    subSections: [
      { id: 'overview-clients', label: 'Working with Clients' }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    content: (
      <div className="space-y-8">
        <div id="settings-work-hours">
          <p className="text-gray-700 mb-4">
            Set your weekly work schedule to get accurate workload and capacity calculations.
          </p>
          <p className="text-gray-700 italic">
            More detailed documentation coming soon...
          </p>
        </div>

        <div id="settings-preferences" className="pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">General Preferences</h3>
          <p className="text-gray-700 italic">
            Documentation in progress...
          </p>
        </div>
      </div>
    ),
    subSections: [
      { id: 'settings-preferences', label: 'General Preferences' }
    ]
  }
];

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTopicId?: string;
}

export function HelpModal({ open, onOpenChange, initialTopicId }: HelpModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['getting-started']));
  const [activeSectionId, setActiveSectionId] = useState('getting-started');
  const [isMobile, setIsMobile] = useState(() => (isBrowser ? window.innerWidth < 768 : false));
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (!isBrowser) return false;
    return window.innerWidth >= 768;
  });
  const contentRef = useRef<HTMLDivElement>(null);

  // Set active section when modal opens with initialTopicId
  useEffect(() => {
    if (open && initialTopicId) {
      // Check if it's a section ID or a subsection ID
      const section = helpSections.find(s => s.id === initialTopicId);
      if (section) {
        // It's a main section
        setActiveSectionId(initialTopicId);
      } else {
        // It's a subsection - find parent section
        for (const s of helpSections) {
          if (s.subSections?.some(sub => sub.id === initialTopicId)) {
            setActiveSectionId(s.id);
            setExpandedSections(prev => new Set([...prev, s.id]));
            // After content loads, scroll to the subsection
            setTimeout(() => {
              const element = document.getElementById(initialTopicId);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 100);
            break;
          }
        }
      }
    }
  }, [open, initialTopicId]);

  // Detect mobile size
  useEffect(() => {
    if (!isBrowser) return;

    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      const wasMobile = isMobile;
      setIsMobile(mobile);

      if (mobile !== wasMobile) {
        if (!mobile) {
          setSidebarOpen(true);
        } else {
          setSidebarOpen(false);
        }
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobile]);

  // Filter sections based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return helpSections;

    const query = searchQuery.toLowerCase();
    return helpSections.filter(section =>
      section.label.toLowerCase().includes(query) ||
      section.subSections?.some(sub => sub.label.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  // Auto-expand sections when searching
  useEffect(() => {
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

  const handleSectionClick = (sectionId: string) => {
    setActiveSectionId(sectionId);
    if (isMobile) {
      setSidebarOpen(false);
    }
    // Scroll to top of content
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  };

  const handleSubSectionClick = (sectionId: string, subSectionId: string) => {
    setActiveSectionId(sectionId);
    if (isMobile) {
      setSidebarOpen(false);
    }
    // Scroll to the subsection
    setTimeout(() => {
      const element = document.getElementById(subSectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const activeSection = useMemo(() => {
    return helpSections.find(s => s.id === activeSectionId);
  }, [activeSectionId]);

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
                {/* Section Header - Now clickable to open the page */}
                <button
                  onClick={() => {
                    handleSectionClick(section.id);
                    if (!expandedSections.has(section.id) && section.subSections) {
                      toggleSection(section.id);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors rounded-lg",
                    activeSectionId === section.id
                      ? "bg-[#02c0b7] text-white"
                      : "text-gray-700 hover:bg-gray-200/70 hover:text-gray-900"
                  )}
                >
                  <section.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{section.label}</span>
                  {section.subSections && section.subSections.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection(section.id);
                      }}
                      className="p-1 hover:bg-black/10 rounded"
                    >
                      <ChevronLeft 
                        className={cn(
                          "w-3 h-3 transition-transform",
                          expandedSections.has(section.id) ? "-rotate-90" : ""
                        )}
                      />
                    </button>
                  )}
                </button>

                {/* Sub-sections - Now anchor links */}
                {expandedSections.has(section.id) && section.subSections && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {section.subSections.map((subSection) => (
                      <button
                        key={subSection.id}
                        onClick={() => handleSubSectionClick(section.id, subSection.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200/70 hover:text-gray-900 transition-colors rounded-lg text-left"
                      >
                        <span className="flex-1">{subSection.label}</span>
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
            {/* Header */}
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
              {sidebarOpen && <div className="w-0 h-8 flex-shrink-0" />}
              <h2 className="font-semibold text-gray-900">
                {activeSection?.label || 'Help'}
              </h2>
            </div>

            {/* Content Area */}
            <div ref={contentRef} className="flex-1 overflow-y-auto light-scrollbar">
              <div className="p-8 w-full max-w-4xl">
                {activeSection?.content}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
