import { cn, getInitials, getAvatarColor } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

const sizes = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const dotSizes = {
  xs: 'w-2 h-2 border',
  sm: 'w-2.5 h-2.5 border-[1.5px]',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-2',
  xl: 'w-4 h-4 border-2',
};

export default function Avatar({ src, name, size = 'md', online, className }: AvatarProps) {
  return (
    <div className={cn('relative shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt=""
          className={cn('rounded-full object-cover', sizes[size])}
          draggable={false}
        />
      ) : (
        <div
          className={cn('rounded-full flex items-center justify-center text-white font-medium', sizes[size])}
          style={{ background: getAvatarColor(name) }}
        >
          {getInitials(name)}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-[color:var(--color-bg-sidebar)]',
            dotSizes[size],
            online ? 'bg-(--color-online)' : 'bg-(--color-text-tertiary)'
          )}
        />
      )}
    </div>
  );
}
