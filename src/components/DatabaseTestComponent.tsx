import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export const DatabaseTestComponent = () => {
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testDatabaseConnection = async () => {
    setLoading(true);
    setTestResult('Testing...');
    
    try {
      // First test authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setTestResult(`Auth error: ${authError.message}`);
        return;
      }
      
      if (!user) {
        setTestResult('No user authenticated');
        return;
      }
      
      console.log('User authenticated:', user.id);
      
      // Test a simple event creation
      const testEventData = {
        title: 'Database Test Event',
        description: 'Testing database connection',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        project_id: null,
        color: '#3b82f6',
        completed: false,
        duration: 1,
        event_type: 'planned',
        recurring_type: null,
        recurring_interval: null,
        recurring_end_date: null,
        recurring_count: null,
        recurring_group_id: null,
        user_id: user.id
      };
      
      console.log('Attempting to insert:', testEventData);
      
      const { data, error } = await supabase
        .from('calendar_events')
        .insert([testEventData])
        .select()
        .single();
      
      if (error) {
        console.error('Database error:', error);
        setTestResult(`Database error: ${error.message} (Code: ${error.code})`);
      } else {
        console.log('Success! Created event:', data);
        setTestResult(`Success! Created event with ID: ${data.id}`);
        
        // Clean up - delete the test event
        await supabase.from('calendar_events').delete().eq('id', data.id);
      }
      
    } catch (error) {
      console.error('Test error:', error);
      setTestResult(`Unexpected error: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      padding: '10px', 
      border: '1px solid #ccc',
      borderRadius: '5px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h3>Database Test</h3>
      <Button 
        onClick={testDatabaseConnection} 
        disabled={loading}
        size="sm"
      >
        {loading ? 'Testing...' : 'Test DB Connection'}
      </Button>
      {testResult && (
        <div style={{ 
          marginTop: '10px', 
          fontSize: '12px',
          background: testResult.includes('Success') ? '#d4edda' : '#f8d7da',
          padding: '5px',
          borderRadius: '3px'
        }}>
          {testResult}
        </div>
      )}
    </div>
  );
};
