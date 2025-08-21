import { useState, useEffect } from 'react';
import { WorkHour } from '../types/core';

interface UseWorkHoursReturn {
  workHours: WorkHour[];
  loading: boolean;
  error: string | null;
  addWorkHour: (workHour: Omit<WorkHour, 'id'>) => Promise<WorkHour>;
  updateWorkHour: (id: string, updates: Partial<Omit<WorkHour, 'id'>>) => Promise<void>;
  deleteWorkHour: (id: string) => Promise<void>;
  refreshWorkHours: () => Promise<void>;
}

// Temporary in-memory storage until database table is created
let tempWorkHours: WorkHour[] = [];
let nextId = 1;

export const useWorkHours = (): UseWorkHoursReturn => {
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkHours = async () => {
    try {
      setError(null);
      // For now, use in-memory storage
      setWorkHours([...tempWorkHours]);
    } catch (err) {
      console.error('Error fetching work hours:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch work hours');
      setWorkHours([]);
    } finally {
      setLoading(false);
    }
  };

  const addWorkHour = async (workHourData: Omit<WorkHour, 'id'>): Promise<WorkHour> => {
    try {
      setError(null);
      
      const newWorkHour: WorkHour = {
        id: `temp-${nextId++}`,
        title: workHourData.title,
        description: workHourData.description || '',
        start: workHourData.start,
        end: workHourData.end,
      };

      tempWorkHours.push(newWorkHour);
      tempWorkHours.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      
      setWorkHours([...tempWorkHours]);
      return newWorkHour;
    } catch (err) {
      console.error('Error adding work hour:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add work hour';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateWorkHour = async (id: string, updates: Partial<Omit<WorkHour, 'id'>>): Promise<void> => {
    try {
      setError(null);
      
      const index = tempWorkHours.findIndex(wh => wh.id === id);
      if (index !== -1) {
        tempWorkHours[index] = { ...tempWorkHours[index], ...updates };
        tempWorkHours.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        setWorkHours([...tempWorkHours]);
      }
    } catch (err) {
      console.error('Error updating work hour:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update work hour';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteWorkHour = async (id: string): Promise<void> => {
    try {
      setError(null);
      
      tempWorkHours = tempWorkHours.filter(wh => wh.id !== id);
      setWorkHours([...tempWorkHours]);
    } catch (err) {
      console.error('Error deleting work hour:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete work hour';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const refreshWorkHours = async (): Promise<void> => {
    setLoading(true);
    await fetchWorkHours();
  };

  useEffect(() => {
    fetchWorkHours();
  }, []);

  return {
    workHours,
    loading,
    error,
    addWorkHour,
    updateWorkHour,
    deleteWorkHour,
    refreshWorkHours,
  };
};
