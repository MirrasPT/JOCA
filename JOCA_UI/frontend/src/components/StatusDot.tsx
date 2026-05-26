interface Props {
  status: 'working' | 'idle' | 'done';
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusDot({ status, size = 'md' }: Props) {
  return (
    <span
      className={`status-dot status-dot--${status} status-dot--${size}`}
      aria-label={status}
      role="img"
    />
  );
}
