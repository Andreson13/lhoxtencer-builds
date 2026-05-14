import { useState, useEffect, useCallback } from 'react';
import { checkForUpdates as checkGitHubUpdates, getCurrentVersion } from '@/services/versionService';

export interface VersionInfo {
  current: string;
  latest: string;
  updateAvailable: boolean;
  lastChecked: Date | null;
  swActive: boolean;
  releaseNotes?: string;
  downloadUrl?: string;
  publishedAt?: string;
  releaseName?: string;
}

export function useVersionCheck() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    current: getCurrentVersion(),
    latest: getCurrentVersion(),
    updateAvailable: false,
    lastChecked: null,
    swActive: false,
    releaseNotes: '',
    downloadUrl: '',
    publishedAt: '',
    releaseName: '',
  });

  const [checking, setChecking] = useState(false);
  const [swReady, setSwReady] = useState(false);

  // Check Service Worker status
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        const hasActive = registrations.some((reg) => reg.active);
        setSwReady(hasActive);
        setVersionInfo((prev) => ({
          ...prev,
          swActive: hasActive,
        }));
      });
    }
  }, []);

  // Check for updates from GitHub
  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    try {
      console.log('🔍 Checking GitHub for updates...');
      const result = await checkGitHubUpdates();

      setVersionInfo((prev) => ({
        ...prev,
        latest: result.latestVersion,
        current: result.currentVersion,
        updateAvailable: result.updateAvailable,
        lastChecked: new Date(),
        releaseNotes: result.releaseNotes,
        downloadUrl: result.downloadUrl,
        publishedAt: result.publishedAt,
        releaseName: result.releaseName,
      }));

      console.log('✅ Version Check Complete:', {
        current: result.currentVersion,
        latest: result.latestVersion,
        updateAvailable: result.updateAvailable,
      });

      return {
        updateAvailable: result.updateAvailable,
        current: result.currentVersion,
        latest: result.latestVersion,
        releaseNotes: result.releaseNotes,
      };
    } catch (error) {
      console.error('❌ Failed to check for updates:', error);
    } finally {
      setChecking(false);
    }

    return {
      updateAvailable: false,
      current: versionInfo.current,
      latest: versionInfo.latest,
    };
  }, [versionInfo.current, versionInfo.latest]);

  // Reload to apply update
  const applyUpdate = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
    }
    // Hard refresh to get latest
    window.location.reload();
  }, []);

  // Listen for SW updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleControllerChange = () => {
        console.log('🔄 New Service Worker version detected!');
        setVersionInfo((prev) => ({
          ...prev,
          updateAvailable: true,
          swActive: true,
        }));
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  return {
    versionInfo,
    checking,
    swReady,
    checkForUpdates,
    applyUpdate,
  };
}
