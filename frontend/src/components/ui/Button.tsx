import { cn } from '../../lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

const variants: Record<string, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-kmi-dark shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-slate-200',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-red-600',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  outline: 'border border-border bg-card hover:bg-accent text-foreground',
};

const sizes: Record<string, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
export default Button;
