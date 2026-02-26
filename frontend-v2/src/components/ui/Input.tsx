import { cn } from '@/lib/utils';
import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, className, ...props }, ref) => (
    <div className={cn('relative flex items-center', className)}>
      {icon && (
        <span className="absolute left-3 text-(--color-text-tertiary) pointer-events-none">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full h-10 bg-(--color-bg-input) text-(--color-text-primary) rounded-xl border-none outline-none transition-colors placeholder:text-(--color-text-tertiary) focus:ring-2 focus:ring-(--color-accent)/30',
          icon ? 'pl-10 pr-4' : 'px-4'
        )}
        {...props}
      />
    </div>
  )
);

Input.displayName = 'Input';
export default Input;
