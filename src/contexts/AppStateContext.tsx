import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  date: string;
  isAvailable: boolean;
  title?: string;
  description?: string;
}

export interface AppState {
  timeSlots: TimeSlot[];
  selectedDate: Date;
  viewMode: 'day' | 'week' | 'month';
  isLoading: boolean;
}

type AppAction =
  | { type: 'SET_TIME_SLOTS'; payload: TimeSlot[] }
  | { type: 'ADD_TIME_SLOT'; payload: TimeSlot }
  | { type: 'UPDATE_TIME_SLOT'; payload: { id: string; updates: Partial<TimeSlot> } }
  | { type: 'DELETE_TIME_SLOT'; payload: string }
  | { type: 'SET_SELECTED_DATE'; payload: Date }
  | { type: 'SET_VIEW_MODE'; payload: 'day' | 'week' | 'month' }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: AppState = {
  timeSlots: [],
  selectedDate: new Date(),
  viewMode: 'day',
  isLoading: false,
};

const appStateReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_TIME_SLOTS':
      return { ...state, timeSlots: action.payload };
    case 'ADD_TIME_SLOT':
      return { ...state, timeSlots: [...state.timeSlots, action.payload] };
    case 'UPDATE_TIME_SLOT':
      return {
        ...state,
        timeSlots: state.timeSlots.map(slot =>
          slot.id === action.payload.id
            ? { ...slot, ...action.payload.updates }
            : slot
        ),
      };
    case 'DELETE_TIME_SLOT':
      return {
        ...state,
        timeSlots: state.timeSlots.filter(slot => slot.id !== action.payload),
      };
    case 'SET_SELECTED_DATE':
      return { ...state, selectedDate: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

const AppStateContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appStateReducer, initialState);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};