/**
 * Semantic spacer component for consistent vertical spacing
 * Replaces hardcoded <div className="py-8 md:py-12" /> throughout the codebase
 */

interface SpacerProps {
  /**
   * Size of the spacer
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Optional className for additional customization
   */
  className?: string;
}

/**
 * Spacer component for vertical spacing between sections
 *
 * @example
 * <Spacer /> // Default medium spacing
 * <Spacer size="lg" /> // Large spacing
 * <Spacer size="sm" /> // Small spacing
 */
export function Spacer({ size = 'md', className = '' }: SpacerProps) {
  const sizeClasses = {
    sm: 'py-4 md:py-6',
    md: 'py-8 md:py-12',
    lg: 'py-12 md:py-16',
  };

  return (
    <div
      className={`${sizeClasses[size]} ${className}`.trim()}
      aria-hidden="true"
      role="presentation"
    />
  );
}
