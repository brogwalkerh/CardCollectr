export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className={`${sizeClasses[size]} border-2 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin`} />
  );
}
