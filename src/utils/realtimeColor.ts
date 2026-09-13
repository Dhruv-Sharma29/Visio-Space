// 8 curated vintage colors that contrast well with dark/cream backgrounds
export const COLLABORATOR_COLORS = [
  { name: 'Vermilion', hex: '#E05A47', text: '#FFFFFF' },
  { name: 'Amber Gold', hex: '#E59838', text: '#211812' },
  { name: 'Verdigris', hex: '#2BA888', text: '#FFFFFF' },
  { name: 'Cobalt', hex: '#3B7FD8', text: '#FFFFFF' },
  { name: 'Moss Emerald', hex: '#3FA85E', text: '#FFFFFF' },
  { name: 'Terracotta', hex: '#D76442', text: '#FFFFFF' },
  { name: 'Amethyst', hex: '#9159B5', text: '#FFFFFF' },
  { name: 'Rosewood', hex: '#BE4B7B', text: '#FFFFFF' },
];

export function getCollaboratorColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLLABORATOR_COLORS.length;
  return COLLABORATOR_COLORS[index].hex;
}
