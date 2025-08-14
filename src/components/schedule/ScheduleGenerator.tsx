import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useAppActions } from '@/contexts/AppActionsContext';
import { useAppState } from '@/contexts/AppStateContext';
import { Sparkles, Settings, Clock } from 'lucide-react';

export const ScheduleGenerator: React.FC = () => {
  const { generateSchedule } = useAppActions();
  const { state } = useAppState();
  const [preferences, setPreferences] = useState({
    workHoursStart: '09:00',
    workHoursEnd: '17:00',
    includeBreaks: true,
    meetingDuration: [60],
    priority: 'balanced',
  });

  const handleGenerate = () => {
    generateSchedule(preferences);
  };

  const handleSliderChange = (value: number[]) => {
    setPreferences(prev => ({ ...prev, meetingDuration: value }));
  };

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Schedule Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="workStart" className="text-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Work Start
            </Label>
            <Select
              value={preferences.workHoursStart}
              onValueChange={(value) => setPreferences(prev => ({ ...prev, workHoursStart: value }))}
            >
              <SelectTrigger className="bg-background border-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 6;
                  const timeString = `${hour.toString().padStart(2, '0')}:00`;
                  return (
                    <SelectItem key={timeString} value={timeString}>
                      {timeString}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workEnd" className="text-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Work End
            </Label>
            <Select
              value={preferences.workHoursEnd}
              onValueChange={(value) => setPreferences(prev => ({ ...prev, workHoursEnd: value }))}
            >
              <SelectTrigger className="bg-background border-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 12;
                  const timeString = `${hour.toString().padStart(2, '0')}:00`;
                  return (
                    <SelectItem key={timeString} value={timeString}>
                      {timeString}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="duration" className="text-foreground">
            Default Meeting Duration: {preferences.meetingDuration[0]} minutes
          </Label>
          <Slider
            id="duration"
            min={15}
            max={180}
            step={15}
            value={preferences.meetingDuration}
            onValueChange={handleSliderChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>15 min</span>
            <span>3 hours</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority" className="text-foreground flex items-center gap-1">
            <Settings className="h-3 w-3" />
            Schedule Priority
          </Label>
          <Select
            value={preferences.priority}
            onValueChange={(value) => setPreferences(prev => ({ ...prev, priority: value }))}
          >
            <SelectTrigger className="bg-background border-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="early">Early Bird (Morning Focus)</SelectItem>
              <SelectItem value="balanced">Balanced Distribution</SelectItem>
              <SelectItem value="late">Late Starter (Afternoon Focus)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="breaks" className="text-foreground font-medium">
              Include breaks
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically add break times between meetings
            </p>
          </div>
          <Switch
            id="breaks"
            checked={preferences.includeBreaks}
            onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, includeBreaks: checked }))}
          />
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={state.isLoading}
          className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {state.isLoading ? 'Generating Schedule...' : 'Generate AI Schedule'}
        </Button>
      </CardContent>
    </Card>
  );
};