import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-secondary/60',
        outline: 'border border-border bg-transparent hover:border-primary/40 hover:bg-secondary/50',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md',
        link: 'text-primary underline-offset-4 hover:underline',
        floating:
          'rounded-md bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.7)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_hsl(var(--primary)/0.8)] active:translate-y-0',
        'floating-outline':
          'rounded-md border border-border/80 bg-card/60 backdrop-blur-sm text-foreground shadow-[0_6px_20px_-10px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.7)] active:translate-y-0',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-6',
        xl: 'h-[3.25rem] px-8 py-3.5 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
