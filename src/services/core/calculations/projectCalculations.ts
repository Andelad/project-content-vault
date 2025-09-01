import { CalendarEvent, Project, Group } from '../../../types';
import { calculateValidDays } from '../../insights/legacy/insightsCalculationService';

export class ProjectCalculationService {
  /**
   * Calculate weekly capacity based on work hours settings
   */
  static calculateWeeklyCapacity(
    settings: { weeklyWorkHours: { [key: string]: Array<{ duration: number }> } }
  ): number {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    return dayNames.reduce((total, dayName, index) => {
      const daySlots = settings.weeklyWorkHours[dayName] || [];
      const dayHours = daySlots.reduce((sum, slot) => sum + slot.duration, 0);
      return total + dayHours;
    }, 0);
  }

  /**
   * Calculate project hours summary for reporting
   */
  static calculateProjectHoursSummary(
    projects: Project[],
    events: CalendarEvent[]
  ): {
    totalEstimated: number;
    totalLogged: number;
    totalProjects: number;
  } {
    const totalEstimated = projects.reduce((sum, project) => sum + project.estimatedHours, 0);
    const totalLogged = events.reduce((sum, event) => {
      const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

    return {
      totalEstimated,
      totalLogged,
      totalProjects: projects.length
    };
  }

  /**
   * Calculate average hours per day from events data
   */
  static calculateAverageHoursPerDay(
    events: CalendarEvent[],
    projects: Project[],
    groups: Group[],
    averagePeriod: { start: Date; end: Date },
    settings: { weeklyWorkHours: { [key: string]: Array<{ duration: number }> } }
  ): {
    timeline: Array<{
      hour: number;
      time: string;
      groups: { [groupId: string]: number };
      totalHours: number;
    }>;
    totalAverageHours: number;
    validDays: number;
  } {
    // Determine included days from settings (days with work hours)
    const includedDaysArray = this.getIncludedDaysFromSettings(settings);
    
    // Convert number[] to IncludedDays boolean object
    const includedDays: { [key: string]: boolean } = {
      sunday: false, monday: false, tuesday: false, wednesday: false,
      thursday: false, friday: false, saturday: false
    };
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    includedDaysArray.forEach(dayIndex => {
      includedDays[dayNames[dayIndex]] = true;
    });
    
    // Filter events within the average period
    const periodEvents = events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate >= averagePeriod.start && eventDate <= averagePeriod.end;
    });

    // Calculate valid days (days in period that are included in work week)
    const totalValidDays = calculateValidDays(averagePeriod.start, averagePeriod.end, includedDays as any);

    // Initialize hourly data structure
    const hourlyData: { [hour: number]: { [groupId: string]: number } } = {};
    for (let hour = 0; hour < 24; hour++) {
      hourlyData[hour] = {};
      groups.forEach(group => {
        hourlyData[hour][group.id] = 0;
      });
    }

    // Process each event
    periodEvents.forEach(event => {
      try {
        const startTime = new Date(event.startTime);
        const endTime = new Date(event.endTime);

        // Skip if event is on excluded day
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const eventDayName = dayNames[startTime.getDay()];
        if (!includedDays[eventDayName]) {
          return;
        }

        // Find associated project and group
        const project = projects.find(p => p.id === event.projectId);
        if (!project) return;

        const group = groups.find(g => g.id === project.groupId);
        if (!group) return;

        const groupId = group.id;

        // Calculate hours that overlap with each hour of the day
        for (let hour = 0; hour < 24; hour++) {
          const hourStart = new Date(startTime);
          hourStart.setHours(hour, 0, 0, 0);
          const hourEnd = new Date(startTime);
          hourEnd.setHours(hour + 1, 0, 0, 0);

          // Find overlap between event and this hour
          const overlapStart = new Date(Math.max(startTime.getTime(), hourStart.getTime()));
          const overlapEnd = new Date(Math.min(endTime.getTime(), hourEnd.getTime()));

          if (overlapEnd > overlapStart) {
            const hourPortion = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
            hourlyData[hour][groupId] += hourPortion;
          }
        }
      } catch (error) {
        console.warn('Error processing event times:', event, error);
      }
    });

    // Calculate averages and create 24-hour timeline
    const timelineData = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourData = hourlyData[hour] || {};
      const groupTotals: { [groupId: string]: number } = {};

      Object.keys(hourData).forEach(groupId => {
        groupTotals[groupId] = totalValidDays > 0 ? hourData[groupId] / totalValidDays : 0;
      });

      timelineData.push({
        hour,
        time: `${hour.toString().padStart(2, '0')}:00`,
        groups: groupTotals,
        totalHours: Object.values(groupTotals).reduce((sum, hours) => sum + hours, 0)
      });
    }

    return {
      timeline: timelineData,
      totalAverageHours: timelineData.reduce((sum, hour) => sum + hour.totalHours, 0),
      validDays: totalValidDays
    };
  }

  /**
   * Get included days (days with work hours) from settings
   */
  private static getIncludedDaysFromSettings(
    settings: { weeklyWorkHours: { [key: string]: Array<{ duration: number }> } }
  ): number[] {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const includedDays: number[] = [];
    
    dayNames.forEach((dayName, index) => {
      const daySlots = settings.weeklyWorkHours[dayName] || [];
      const dayHours = daySlots.reduce((sum, slot) => sum + slot.duration, 0);
      if (dayHours > 0) {
        includedDays.push(index);
      }
    });
    
    return includedDays;
  }
}
