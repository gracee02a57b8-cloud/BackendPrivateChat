import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const variants = {
  primary: 'bg-(--color-accent) text-white hover:bg-(--color-accent-hover) active:scale-[0.97]',
  secondary: 'bg-(--color-bg-tertiary) text-(--color-text-primary) hover:bg-(--color-bg-active)',
  ghost: 'text-(--color-text-secondary) hover:bg-(--color-bg-hover)',
  danger: 'bg-(--color-danger) text-white hover:opacity-90',
};

const sizeCls = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl',
  icon: 'h-10 w-10 rounded-full flex items-center justify-center',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none',
        variants[variant],
        sizeCls[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = 'Button';
export default Button;
