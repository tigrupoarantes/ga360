import { Button } from '@/components/ui/button';
import { ExternalLink, Video } from 'lucide-react';
import { platformConfig, MeetingPlatform } from '@/lib/platformConfig';

interface MeetingPlatformButtonProps {
  platform: MeetingPlatform;
  link: string;
  size?: 'sm' | 'default' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function MeetingPlatformButton({
  platform,
  link,
  size = 'sm',
  showIcon = true,
  className = '',
}: MeetingPlatformButtonProps) {
  const config = platformConfig[platform];

  const handleClick = () => {
    window.open(link, '_blank');
  };

  return (
    <Button
      size={size}
      className={className}
      style={{
        backgroundColor: config.color,
        color: 'white',
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = config.hoverColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = config.color;
      }}
    >
      {showIcon && <Video className="h-4 w-4 mr-1" />}
      {config.shortName}
      <ExternalLink className="h-3 w-3 ml-1" />
    </Button>
  );
}

// Export a simpler version for use in execution page
interface MeetingPlatformLinkButtonProps {
  platform?: MeetingPlatform | null;
  link?: string | null;
  size?: 'sm' | 'default' | 'lg';
}

export function MeetingPlatformLinkButton({
  platform,
  link,
  size = 'default',
}: MeetingPlatformLinkButtonProps) {
  if (!platform || !link) return null;

  const config = platformConfig[platform];

  return (
    <Button
      variant="outline"
      size={size}
      onClick={() => window.open(link, '_blank')}
    >
      <Video className="mr-2 h-4 w-4" />
      Abrir {config.shortName}
      <ExternalLink className="ml-2 h-3 w-3" />
    </Button>
  );
}
