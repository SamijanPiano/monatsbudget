function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?'
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="sal-avatar" aria-hidden="true">
      {initials(name)}
    </span>
  )
}
