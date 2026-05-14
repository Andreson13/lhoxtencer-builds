/**
 * Version Service - Checks GitHub releases for new versions
 *
 * This service fetches version information from:
 * https://api.github.com/repos/Andreson13/lhoxtencer-builds/releases
 */

const GITHUB_OWNER = "Andreson13";
const GITHUB_REPO = "lhoxtencer-builds";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

export interface GithubRelease {
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  body: string;
  assets: Array<{
    name: string;
    download_count: number;
    size: number;
  }>;
}

export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
  releaseName: string;
}

/**
 * Get current app version from environment or package.json
 */
export function getCurrentVersion(): string {
  return import.meta.env.VITE_APP_VERSION || "1.0.0";
}

/**
 * Fetch latest release from GitHub (or tags if no releases exist)
 */
export async function fetchLatestRelease(): Promise<GithubRelease | null> {
  try {
    // Try releases endpoint first
    const releaseResponse = await fetch(`${GITHUB_API_URL}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
    });

    if (releaseResponse.ok) {
      const release = await releaseResponse.json();
      return release;
    }

    // Fallback to tags if no releases
    if (releaseResponse.status === 404) {
      console.log("No official releases, checking tags...");
      const tagsResponse = await fetch(`${GITHUB_API_URL}/tags?per_page=1`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        cache: "no-store",
      });

      if (!tagsResponse.ok) {
        console.warn(`GitHub API tags returned ${tagsResponse.status}`);
        return null;
      }

      const tags = await tagsResponse.json();
      if (tags.length === 0) {
        console.warn("No tags found");
        return null;
      }

      const latestTag = tags[0];
      return {
        tag_name: latestTag.name,
        name: `Release ${latestTag.name}`,
        draft: false,
        prerelease: false,
        published_at: new Date().toISOString(),
        body: "Latest version from git tag",
        assets: [],
      };
    }

    console.warn(`GitHub API returned ${releaseResponse.status}`);
    return null;
  } catch (error) {
    console.error("❌ Failed to fetch latest release from GitHub:", error);
    return null;
  }
}

/**
 * Parse version string (e.g., "v1.0.0" -> "1.0.0")
 */
function parseVersion(tagName: string): string {
  return tagName.replace(/^v/, "");
}

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

/**
 * Check for app updates from GitHub
 */
export async function checkForUpdates(): Promise<VersionCheckResult> {
  const currentVersion = getCurrentVersion();

  try {
    const latestRelease = await fetchLatestRelease();

    if (!latestRelease) {
      console.warn("⚠️ Could not fetch release information from GitHub");
      return {
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        releaseNotes: "Could not check for updates",
        downloadUrl: "",
        publishedAt: "",
        releaseName: "",
      };
    }

    const latestVersion = parseVersion(latestRelease.tag_name);
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

    console.log("📦 Version Check Result:", {
      current: currentVersion,
      latest: latestVersion,
      updateAvailable,
    });

    return {
      currentVersion,
      latestVersion,
      updateAvailable,
      releaseNotes: latestRelease.body || "No release notes available",
      downloadUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${latestRelease.tag_name}`,
      publishedAt: latestRelease.published_at,
      releaseName: latestRelease.name || latestRelease.tag_name,
    };
  } catch (error) {
    console.error("❌ Version check failed:", error);
    return {
      currentVersion,
      latestVersion: currentVersion,
      updateAvailable: false,
      releaseNotes: "",
      downloadUrl: "",
      publishedAt: "",
      releaseName: "",
    };
  }
}

/**
 * Get download URL for a specific release
 */
export function getDownloadUrl(owner: string, repo: string, tag: string): string {
  return `https://github.com/${owner}/${repo}/releases/tag/${tag}`;
}

/**
 * Get GitHub repository info
 */
export function getRepositoryInfo() {
  return {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
    apiUrl: GITHUB_API_URL,
    releasesUrl: `${GITHUB_API_URL}/releases`,
  };
}
