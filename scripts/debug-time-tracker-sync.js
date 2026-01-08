/**
 * Time Tracker Cross-Window Sync Debugger
 * 
 * This script helps diagnose cross-window synchronization issues.
 * 
 * USAGE:
 * 1. Open your app in TWO browser tabs
 * 2. Open DevTools console in BOTH tabs
 * 3. Paste this script into each console
 * 4. Start time tracking in ONE tab
 * 5. Watch the console output in BOTH tabs
 * 
 * WHAT TO LOOK FOR:
 * - "🔧 INIT" messages show BroadcastChannel setup
 * - "📢 BROADCAST" messages show state being sent
 * - "📥 RECEIVED" messages show state being received
 * - "✅ CALLBACK" messages show callbacks being triggered
 * - "❌ IGNORED" messages show own messages being filtered
 */

(function() {
  console.log('🚀 Time Tracker Cross-Window Sync Debugger Started');
  console.log('════════════════════════════════════════════════');
  
  // 1. Check BroadcastChannel support
  console.log('\n📋 BROWSER SUPPORT CHECK:');
  console.log('  BroadcastChannel supported:', typeof BroadcastChannel !== 'undefined');
  console.log('  LocalStorage supported:', typeof localStorage !== 'undefined');
  
  // 2. Check current tracking state
  console.log('\n📊 CURRENT STATE:');
  try {
    const backupKey = 'timeTracker_backup';
    const backup = localStorage.getItem(backupKey);
    if (backup) {
      const state = JSON.parse(backup);
      console.log('  Is Tracking:', state.isTracking);
      console.log('  Event ID:', state.eventId);
      console.log('  Project:', state.selectedProject?.name || 'None');
      console.log('  Start Time:', state.startTime);
    } else {
      console.log('  No backup state found in localStorage');
    }
  } catch (error) {
    console.error('  Error reading localStorage:', error);
  }
  
  // 3. Monitor BroadcastChannel messages
  if (typeof BroadcastChannel !== 'undefined') {
    console.log('\n🔧 SETTING UP MESSAGE MONITOR:');
    
    const windowId = `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('  Window ID:', windowId);
    
    const channel = new BroadcastChannel('timeTracker_crossWindowSync');
    console.log('  ✅ BroadcastChannel connected');
    
    channel.addEventListener('message', (event) => {
      const data = event.data;
      
      console.log('\n📥 BROADCAST MESSAGE RECEIVED:');
      console.log('  Type:', data.type);
      console.log('  From Window:', data.windowId);
      console.log('  This Window:', windowId);
      console.log('  Timestamp:', new Date(data.timestamp).toISOString());
      
      if (data.state) {
        console.log('  State:');
        console.log('    Is Tracking:', data.state.isTracking);
        console.log('    Event ID:', data.state.eventId);
        console.log('    Project:', data.state.selectedProject?.name || 'None');
        console.log('    Start Time:', data.state.startTime);
      }
      
      if (data.windowId === windowId) {
        console.log('  ❌ IGNORED (own message)');
      } else {
        console.log('  ✅ PROCESSING (from other window)');
      }
    });
    
    console.log('\n👀 WATCHING FOR MESSAGES...');
    console.log('Start tracking in another tab to see sync in action.');
    
    // Test send
    window.debugSendTestMessage = () => {
      const testMessage = {
        type: 'TIME_TRACKING_STATE_UPDATED',
        windowId: windowId,
        timestamp: Date.now(),
        state: {
          isTracking: true,
          eventId: 'test-event',
          selectedProject: { name: 'Test Project' },
          startTime: new Date().toISOString()
        }
      };
      
      console.log('\n📤 SENDING TEST MESSAGE:');
      console.log(testMessage);
      channel.postMessage(testMessage);
    };
    
    console.log('\n💡 TIP: Run `debugSendTestMessage()` to send a test message');
    
  } else {
    console.log('\n❌ BroadcastChannel NOT SUPPORTED in this browser');
    console.log('Cross-window sync will not work!');
  }
  
  // 4. Check for multiple instances
  console.log('\n🔍 CHECKING FOR ISSUES:');
  
  // Check if Supabase is configured
  if (typeof window !== 'undefined' && window.localStorage) {
    const supabaseKeys = Object.keys(localStorage).filter(k => k.includes('supabase'));
    console.log('  Supabase keys in localStorage:', supabaseKeys.length);
  }
  
  console.log('\n════════════════════════════════════════════════');
  console.log('✅ Debugger ready. Monitoring for cross-window sync events...');
})();
