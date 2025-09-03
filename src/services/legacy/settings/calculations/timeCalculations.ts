/**
 * Time Calculations for Settings
 * Time-related calculations and formatting for settings functionality
 */

/**
 * Generates time options for dropdowns in 15-minute increments
 */
export function generateTimeOptions(use24Hour: boolean = false): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      let label: string;
      if (use24Hour) {
        label = timeValue;
      } else {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        label = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
      }

      options.push({ value: timeValue, label });
    }
  }

  return options;
}