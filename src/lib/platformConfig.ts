// Platform configuration for meeting integrations (Teams, Zoom, Google Meet)

export type MeetingPlatform = 'teams' | 'zoom' | 'google_meet';

export interface PlatformInfo {
  name: string;
  shortName: string;
  color: string;
  hoverColor: string;
  icon: 'teams' | 'zoom' | 'google_meet';
  placeholder: string;
  validator: RegExp;
}

export const platformConfig: Record<MeetingPlatform, PlatformInfo> = {
  teams: {
    name: 'Microsoft Teams',
    shortName: 'Teams',
    color: '#0078D4',
    hoverColor: '#106EBE',
    icon: 'teams',
    placeholder: 'https://teams.microsoft.com/l/meetup-join/...',
    validator: /^https:\/\/(teams\.microsoft\.com|teams\.live\.com|[a-z0-9-]+\.teams\.microsoft\.com)\/.+/i,
  },
  zoom: {
    name: 'Zoom',
    shortName: 'Zoom',
    color: '#2D8CFF',
    hoverColor: '#1a75e8',
    icon: 'zoom',
    placeholder: 'https://zoom.us/j/123456789...',
    validator: /^https:\/\/([a-z0-9]+\.)?zoom\.(us|com)\/j\/.+/i,
  },
  google_meet: {
    name: 'Google Meet',
    shortName: 'Meet',
    color: '#00897B',
    hoverColor: '#00695C',
    icon: 'google_meet',
    placeholder: 'https://meet.google.com/xxx-xxxx-xxx',
    validator: /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i,
  },
};

export function validatePlatformLink(platform: MeetingPlatform, link: string): boolean {
  const config = platformConfig[platform];
  return config.validator.test(link);
}

export function getPlatformFromLink(link: string): MeetingPlatform | null {
  for (const [platform, config] of Object.entries(platformConfig)) {
    if (config.validator.test(link)) {
      return platform as MeetingPlatform;
    }
  }
  return null;
}

export function getPlatformErrorMessage(platform: MeetingPlatform): string {
  const messages: Record<MeetingPlatform, string> = {
    teams: 'Link inválido. Use um link do Microsoft Teams válido.',
    zoom: 'Link inválido. Use um link do Zoom válido (ex: https://zoom.us/j/...).',
    google_meet: 'Link inválido. Use um link do Google Meet válido (ex: https://meet.google.com/xxx-xxxx-xxx).',
  };
  return messages[platform];
}
