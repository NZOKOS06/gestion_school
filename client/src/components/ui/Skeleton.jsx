const Skeleton = ({ className = '', width, height, rounded = 'sm', style = {}, ...props }) => (
  <div
    className={`skeleton ${className}`}
    style={{
      width: width || '100%',
      height: height || 14,
      borderRadius: `var(--radius-${rounded})`,
      ...style,
    }}
    {...props}
  />
);

export default Skeleton;
