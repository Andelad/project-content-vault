import React, { useState, useRef } from 'react';
import { Button } from '@/presentation/components/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/presentation/components/shadcn/card';
import { Label } from '@/presentation/components/shadcn/label';
import { Input } from '@/presentation/components/shadcn/input';
import { Progress } from '@/presentation/components/shadcn/progress';
import { Alert, AlertDescription } from '@/presentation/components/shadcn/alert';
import { Badge } from '@/presentation/components/shadcn/badge';
import { Separator } from '@/presentation/components/shadcn/separator';
import { Upload, Calendar, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { parseICalFile, type ImportResult } from '@/application/queries/imports/calendarImport';
import { CalendarImportOrchestrator } from '@/application/orchestrators/CalendarImportOrchestrator';
import { useCalendarConnections } from '@/presentation/hooks/calendar/useCalendarConnections';
import { useToast } from '@/presentation/hooks/ui/use-toast';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';

export function CalendarImport() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importHistory, refetch } = useCalendarConnections();
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Enhanced file validation
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit
    const allowedMimeTypes = ['text/calendar', 'application/octet-stream', 'text/plain'];
    
    // Check file size
    if (file.size > maxFileSize) {
      toast({
        title: "File Too Large",
        description: "Calendar file must be smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.ics')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a valid .ics calendar file",
        variant: "destructive",
      });
      return;
    }

    // Validate MIME type if available
    if (file.type && !allowedMimeTypes.includes(file.type)) {
      toast({
        title: "Invalid File Format",
        description: "File format not supported. Please select a valid .ics file",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportProgress(10);
    setImportResult(null);

    try {
      // Read and validate file content
      const fileContent = await file.text();
      
      // Basic content validation
      if (!fileContent.trim()) {
        throw new Error('File appears to be empty');
      }
      
      // Check for basic iCal structure
      if (!fileContent.includes('BEGIN:VCALENDAR') || !fileContent.includes('END:VCALENDAR')) {
        throw new Error('Invalid iCal file format - missing calendar structure');
      }
      
      setImportProgress(30);

      // Parse iCal events
      const events = parseICalFile(fileContent);
      setImportProgress(60);

      if (events.length === 0) {
        throw new Error('No events found in the calendar file');
      }

      // Import events
      const result = await CalendarImportOrchestrator.executeImportWorkflow(events);
      setImportProgress(90);

      // Import history is now recorded automatically by the orchestrator

      setImportProgress(100);
      setImportResult(result);
      refetch(); // Refresh import history

      toast({
        title: "Import Complete",
        description: `Successfully imported ${result.imported} events, updated ${result.updated} events`,
      });

    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarImport', action: 'Import error:' });
      const errorResult: ImportResult = {
        success: false,
        imported: 0,
        updated: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
      
      setImportResult(errorResult);
      
      // Import history is now recorded automatically by the orchestrator

      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : 'Failed to import calendar',
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setImportProgress(0);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-warning" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'ical_file': return 'iCal File';
      case 'google': return 'Google Calendar';
      case 'outlook': return 'Outlook Calendar';
      default: return source;
    }
  };

  return (
    <div className="space-y-6">
      {/* iCal File Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Import Calendar (.ics file)
          </CardTitle>
          <CardDescription>
            Upload an iCal (.ics) file to import events from other calendar applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calendar-file">Calendar File</Label>
            <div className="flex items-center gap-4">
              <Input
                id="calendar-file"
                type="file"
                accept=".ics"
                ref={fileInputRef}
                onChange={handleFileUpload}
                disabled={importing}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="whitespace-nowrap"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>
          </div>

          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importing events...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}

          {importResult && (
            <Alert className={importResult.success ? "border-success bg-success/10" : "border-destructive bg-destructive/10"}>
              <div className="flex items-start space-x-2">
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                )}
                <div className="space-y-1">
                  <AlertDescription>
                    <div className="font-medium">
                      {importResult.success ? 'Import Successful' : 'Import Failed'}
                    </div>
                    <div className="text-sm space-y-1">
                      <div>Imported: {importResult.imported} events</div>
                      <div>Updated: {importResult.updated} events</div>
                      {importResult.failed > 0 && (
                        <div>Failed: {importResult.failed} events</div>
                      )}
                      {importResult.errors.length > 0 && (
                        <div className="mt-2">
                          <div className="font-medium">Errors:</div>
                          {importResult.errors.map((error, index) => (
                            <div key={index} className="text-xs opacity-90">{error}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import History
          </CardTitle>
          <CardDescription>
            Recent calendar import activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {importHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No import history yet
            </div>
          ) : (
            <div className="space-y-4">
              {importHistory.map((record) => (
                <div key={record.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(record.import_status)}
                      <div>
                        <div className="font-medium">
                          {getSourceLabel(record.import_source)}
                          {record.file_name && (
                            <span className="text-muted-foreground ml-2">
                              ({record.file_name})
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(record.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {record.import_type}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground ml-7">
                    <span>Imported: {record.events_imported}</span>
                    <span>Updated: {record.events_updated}</span>
                    {record.events_failed > 0 && (
                      <span className="text-destructive">Failed: {record.events_failed}</span>
                    )}
                  </div>

                  {record.error_message && (
                    <div className="ml-7 text-sm text-destructive bg-destructive/10 p-2 rounded">
                      {record.error_message}
                    </div>
                  )}

                  <Separator className="last:hidden" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}