import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZE_MAP = {
  sm: { box: 'h-7 w-7 rounded-md', icon: 'h-3.5 w-3.5' },
  md: { box: 'h-9 w-9 rounded-md', icon: 'h-4 w-4' },
  lg: { box: 'h-12 w-12 rounded-lg', icon: 'h-6 w-6' },
} as const;

export function ProjectIcon({
  iconUrl,
  size = 'md',
  className,
}: {
  iconUrl?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}) {
  const { box, icon } = SIZE_MAP[size];

  if (iconUrl) {
    return (
      <div className={cn('shrink-0 overflow-hidden border border-primary/25 bg-background', box, className)}>
        <img src={iconUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center border border-primary/25 bg-gradient-to-br from-primary/15 to-primary/5',
        box,
        className
      )}
    >
      <BookOpen className={cn('text-primary', icon)} />
    </div>
  );
}
