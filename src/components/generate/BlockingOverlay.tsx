interface BlockingOverlayProps {
  open: boolean;
  label: string;
}

export function BlockingOverlay({ open, label }: BlockingOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4 rounded-sm border border-border bg-card p-8 shadow-sm">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-border" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <p className="text-lg font-medium text-foreground">{label}</p>
      </div>
    </div>
  );
}
