export const ACCENTS = [
  { id: 'bosque', name: 'Bosque', hex: '#1f3228' },
  { id: 'salvia', name: 'Salvia', hex: '#5f8a68' },
  { id: 'oceano', name: 'Océano', hex: '#3b78b0' },
  { id: 'lavanda', name: 'Lavanda', hex: '#7a68c9' },
  { id: 'coral', name: 'Coral', hex: '#d9654f' },
  { id: 'ambar', name: 'Ámbar', hex: '#c98a1c' },
  { id: 'rosa', name: 'Rosa', hex: '#c9567f' },
  { id: 'menta', name: 'Menta', hex: '#2f9d86' },
  { id: 'grafito', name: 'Grafito', hex: '#3d3c39' },
]

export const LABEL_COLORS = [
  { id: 'gris', name: 'Gris', hex: '#8a857b' },
  { id: 'marron', name: 'Marrón', hex: '#9a6b4b' },
  { id: 'naranja', name: 'Naranja', hex: '#d9773a' },
  { id: 'ambar', name: 'Ámbar', hex: '#c99a1c' },
  { id: 'verde', name: 'Verde', hex: '#4f9a5f' },
  { id: 'menta', name: 'Menta', hex: '#2f9d86' },
  { id: 'azul', name: 'Azul', hex: '#3b78b0' },
  { id: 'morado', name: 'Morado', hex: '#7a68c9' },
  { id: 'rosa', name: 'Rosa', hex: '#c9567f' },
  { id: 'rojo', name: 'Rojo', hex: '#c4513f' },
]

export const colorHex = (id) => LABEL_COLORS.find((c) => c.id === id)?.hex || ACCENTS.find((c) => c.id === id)?.hex || '#8a857b'

export const PROJECT_ICONS = ['📁', '🚀', '💡', '🏠', '💼', '📚', '🎯', '🧪', '🎨', '💰', '🏋️', '✈️', '🌱', '🎮', '📷', '🛠️', '❤️', '🍳', '🎵', '🧠']
