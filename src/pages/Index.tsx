import React, { useState } from 'react';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { AppActionsProvider } from '@/contexts/AppActionsContext';
import { TimelineBar } from '@/components/timeline/TimelineBar';
import { AvailabilityCircles } from '@/components/timeline/AvailabilityCircles';
import { TimeSlotForm } from '@/components/forms/TimeSlotForm';
import { ScheduleGenerator } from '@/components/schedule/ScheduleGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Sparkles, BarChart3 } from 'lucide-react';

const Index = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <AppStateProvider>
      <AppActionsProvider>
        <div className="min-h-screen bg-gradient-subtle">
          <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="h-10 w-10 bg-gradient-primary rounded-xl flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Time Forecasting
                </h1>
              </div>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                AI-powered scheduling and time management platform for optimal productivity
              </p>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Timeline and Availability */}
              <div className="lg:col-span-2 space-y-6">
                {/* Availability Overview */}
                <AvailabilityCircles 
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                />

                {/* Timeline */}
                <Card className="bg-gradient-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Daily Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TimelineBar selectedDate={selectedDate} />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Controls */}
              <div className="space-y-6">
                <Tabs defaultValue="add-slot" className="w-full">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="add-slot" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Add Slot
                    </TabsTrigger>
                    <TabsTrigger value="generate" className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Generate
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="add-slot" className="mt-4">
                    <TimeSlotForm selectedDate={selectedDate} />
                  </TabsContent>
                  
                  <TabsContent value="generate" className="mt-4">
                    <ScheduleGenerator />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </AppActionsProvider>
    </AppStateProvider>
  );
};

export default Index;
