import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { RefreshCw, Check, AlertCircle, HardDrive, Zap } from 'lucide-react';

export const VersionSettings: React.FC = () => {
  const { versionInfo, checking, swReady, checkForUpdates, applyUpdate } = useVersionCheck();

  // Auto-check on mount
  useEffect(() => {
    checkForUpdates();
    // Check every hour
    const interval = setInterval(() => checkForUpdates(), 3600000);
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  return (
    <div className="space-y-4">
      {/* App Version Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Version Information
          </CardTitle>
          <CardDescription>Check app version and available updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Version */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-muted-foreground mb-2">Current Version</p>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-bold text-blue-600">
                  {versionInfo.current}
                </code>
                <Badge variant="default" className="bg-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Running
                </Badge>
              </div>
            </div>

            {/* Latest Version */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-muted-foreground mb-2">Latest Version</p>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-bold text-slate-800">
                  {versionInfo.latest}
                </code>
                {versionInfo.updateAvailable ? (
                  <Badge variant="destructive" className="bg-orange-600">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Update Available
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-green-600 text-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Up to Date
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Service Worker Status */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-muted-foreground mb-2">Auto-Update Status</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className={`h-5 w-5 ${swReady ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className="font-medium">
                  {swReady ? (
                    <span className="text-blue-600">✓ Service Worker Active</span>
                  ) : (
                    <span className="text-gray-600">Service Worker Registering...</span>
                  )}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {swReady ? 'Auto-updates enabled' : 'Initializing...'}
              </span>
            </div>
          </div>

          {/* Last Checked */}
          {versionInfo.lastChecked && (
            <div className="text-xs text-muted-foreground">
              Last checked: {versionInfo.lastChecked.toLocaleString()}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => checkForUpdates()}
              disabled={checking}
              variant="outline"
              className="flex-1"
            >
              {checking ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Check for Updates
                </>
              )}
            </Button>

            {versionInfo.updateAvailable && (
              <Button
                onClick={() => applyUpdate()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Zap className="h-4 w-4 mr-2" />
                Update Now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* How it Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Auto-Updates Work</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            ✓ <strong>Automatic Detection:</strong> The app checks for updates automatically every time you visit.
          </p>
          <p>
            ✓ <strong>Silent Background Updates:</strong> New versions download in the background without interrupting your work.
          </p>
          <p>
            ✓ <strong>Offline First:</strong> The app works offline using the latest cached version.
          </p>
          <p>
            ✓ <strong>No User Action Needed:</strong> Updates apply automatically on your next page visit.
          </p>
          <p>
            <strong>Current Status:</strong> Your app is set to automatically receive updates as they're released.
          </p>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Technical Details</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 font-mono text-muted-foreground">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">App Version</p>
              <p className="font-bold text-slate-900">{versionInfo.current}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Build Type</p>
              <p className="font-bold text-slate-900">
                {import.meta.env.PROD ? 'Production' : 'Development'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">SW Status</p>
              <p className="font-bold text-slate-900">
                {swReady ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cache Strategy</p>
              <p className="font-bold text-slate-900">Network-First</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
