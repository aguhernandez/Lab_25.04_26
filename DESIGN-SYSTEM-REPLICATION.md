# Design System & UI Replication Guide for Asciende Metabolic Lab

**Para replicar exactamente el diseño, colores, menú y UI de esta aplicación en otro proyecto.**

---

## 1. COLORES (Color Palette)

### Colores Primarios
- **Primary Purple (Secundario principal)**: `#514163` - Usado en botones, textos, fondos
- **Primary Yellow (Acento principal)**: `#fdda36` - Botones destacados, bordes, estados activos
- **Secondary Purple**: `#6b5578` - Variante más clara del púrpura
- **Light Purple**: `#8a7396` - Versión aún más clara

### Colores de Texto
- **Text Primary**: `#1f2937` (gris oscuro) - Textos principales
- **Text Secondary**: `#4b5563` (gris) - Textos secundarios
- **Text Tertiary**: `#9ca3af` (gris claro) - Textos deshabilitados/helper

### Colores de Fondo
- **Background Primary**: `#ffffff` (blanco) - Fondo principal
- **Background Secondary**: `#f9fafb` (gris muy claro)
- **Background Tertiary**: `#f3f4f6` (gris claro)
- **Border Color**: `#e5e7eb` (gris borde)

### Colores de Acento
- **Accent Blue**: `#3b82f6` - Estados informativos
- **Accent Green**: `#10b981` - Estados de éxito
- **Accent Red**: `#ef4444` - Estados de error/peligro
- **Accent Yellow**: `#fdda36` - Estados de advertencia

### Dark Mode Colors (Agregar clase `dark` al HTML)
```css
.dark {
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-tertiary: #9ca3af;
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --bg-tertiary: #374151;
  --border-color: #374151;
}
```

---

## 2. TIPOGRAFÍA

### Fuentes
- **Heading Font**: `Krona One` (sans-serif) - Para h1, h2, h3, h4, h5, h6
- **Body Font**: `Jost` (fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)

### En HTML
```html
<link href="https://fonts.googleapis.com/css2?family=Krona+One&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
```

### En Tailwind Config
```javascript
fontFamily: {
  'heading': ['Krona One', 'sans-serif'],
  'body': ['Jost', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
}
```

### Pesos
- `font-body font-medium` = 500 (usado en botones, labels)
- `font-body font-semibold` = 600 (textos destacados)
- `font-heading` = 400 (headings)

---

## 3. LOGOOTIPOS

### Favicon (Ícono pequeño)
- **Ruta**: `/favicon.svg`
- **Tamaño**: 12x12 en sidebar (cuando está colapsado)
- **Uso**: Se muestra cuando el sidebar está hover/collapsed

### Logo Completo
- **Ruta**: `/logo_transp.png`
- **Tamaño**:
  - En sidebar expandido: ~w-48 h-auto
  - En header mobile: h-8 w-auto
- **Nombre de la app**: "Asciende Metabolic Lab"
- **Slogan**: "Advanced Exercise Testing & Prescription"

### En Header
- Desktop: Solo favicon en sidebar colapsado, logo en expandido
- Mobile: Logo + nombre app en top bar

---

## 4. COMPONENTES PRINCIPALES

### Botones
```
Primary Button:
  - Background: #fdda36 (yellow)
  - Text: #514163 (purple)
  - Padding: px-6 py-2
  - Border-radius: 12px
  - Font: font-body font-bold
  - Hover: bg-[#fdda36]/90 transform translateY(-2px)
  - Shadow on hover: 0 4px 12px rgba(253, 218, 54, 0.4)

Secondary Button:
  - Background: white
  - Text: #514163
  - Border: 2px solid #514163
  - Padding: px-6 py-2
  - Border-radius: 12px
  - Hover: background light gray, lighter border

Dark Secondary:
  - Background: #1f2937
  - Border: 2px solid #e5e7eb
  - Hover: border becomes #fdda36
```

### Cards
```
Card Estándar:
  - Background: rgba(138, 115, 150, 0.15) con semi-transparencia
  - Border: 3px solid #fdda36
  - Border-radius: 16px
  - Padding: 1.5rem
  - Box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1)
  - Hover:
    - transform translateY(-4px)
    - box-shadow: 0 12px 24px rgba(253, 218, 54, 0.3)

Card Content:
  - Background: white
  - Border: 2px solid #e5e7eb
  - Border-radius: 16px
  - Padding: 1.5rem
  - Box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05)
```

### Inputs
```
Input Estándar:
  - Width: 100%
  - Padding: 0.75rem 1rem
  - Border-radius: 12px
  - Border: 2px solid #e5e7eb
  - Background: white
  - Font: 'Jost', sans-serif
  - Focus:
    - Border-color: #fdda36
    - Box-shadow: 0 0 0 3px rgba(253, 218, 54, 0.1)
```

### Badges
```
Badge Base:
  - Display: inline-block
  - Padding: 0.25rem 0.75rem
  - Border-radius: 9999px
  - Font-size: 0.75rem (12px)
  - Font-weight: 600

Badge Blue:
  - Background: rgba(59, 130, 246, 0.2)
  - Color: #3b82f6

Badge Green:
  - Background: rgba(16, 185, 129, 0.2)
  - Color: #10b981

Badge Yellow:
  - Background: rgba(253, 218, 54, 0.2)
  - Color: #d97706

Badge Red:
  - Background: rgba(239, 68, 68, 0.2)
  - Color: #ef4444
```

---

## 5. SIDEBAR (Menú Lateral) - DESKTOP

### Estructura
- **Fixed Position**: top-0 left-0, height: 100vh
- **Width**:
  - Collapsed: w-20 (80px)
  - Expanded (hover): w-64 (256px)
  - Transition: 300ms smooth
- **Background**: white (light) / #1f2937 (dark)
- **Border**: right border 1px #e5e7eb

### Secciones

#### 1. Logo Section (Top)
- **Height**: 100px
- **Border**: bottom 1px #e5e7eb
- **Display**: flex items-center justify-center
- **Favicon**: w-12 h-12 (visible when collapsed)
- **Logo**: w-48 h-auto (visible when expanded, hidden when collapsed)
- **Alignment**: center always

#### 2. Navigation Items
- **Py**: 4 (16px) per item
- **Px**: 3 (12px)
- **Mb**: 1 (4px) gap between items
- **Border-radius**: 12px
- **Font**: font-body font-medium text-sm
- **Active State**:
  - Background: #fdda36
  - Color: #514163
  - Font-weight: bold
- **Inactive State**:
  - Color: #4b5563 (gray-700)
  - Hover: bg-gray-100
- **Icon + Label Layout**:
  - When collapsed: only icon, centered, w-5 h-5
  - When expanded: icon (flex-shrink-0) + label with opacity transition
  - Gap: 12px between icon and label

#### 3. Bottom Section (User/Settings)
- **Border**: top 1px #e5e7eb
- **Padding**: 4 (16px)
- **Language Button**:
  - Globe icon + "ES" or "EN" text
  - Opacity 0 when collapsed, visible when expanded
  - Hover: bg-gray-100
- **Theme Toggle**:
  - Sun/Moon icon
  - Opacity transitions with hover
  - Hover: bg-gray-100
- **User Avatar**:
  - Background: #fdda36
  - Color: #514163
  - Width/Height: w-10 h-10
  - Border-radius: 9999px (fully rounded)
  - Font: font-semibold text-sm
  - Shows first letter of user name
- **Logout Button**:
  - Red text: #ef4444
  - Icon + label
  - Hover: bg-red-50
  - Full width

---

## 6. NAVEGACIÓN MÓVIL (Bottom Tab Bar)

### Estructura
- **Fixed**: bottom-0 left-0 right-0
- **Position**: z-50
- **Background**: white / #1f2937
- **Border**: top 1px #e5e7eb
- **Height**: auto
- **Safe area**: bottom padding para notch
- **Display**: flex items-center justify-around

### Items
- **Max Items Visible**: 4 (primeros 4 del menú)
- **Layout**: flex-col items-center gap-1
- **Padding**: px-4 py-2
- **Border-radius**: 12px
- **Active State**:
  - Background: #fdda36
  - Color: #514163
- **Inactive State**:
  - Color: #4b5563
- **Icon Size**: w-6 h-6
- **Font**: text-xs font-body font-medium
- **Min Width**: min-w-[64px]

### "More" Menu (5+ items)
- **Trigger**: Three-dot icon (···)
- **Panel**:
  - Fixed bottom-20 left-0 right-0
  - Background: white / #1f2937
  - Border: top 1px #e5e7eb
  - Animation: slide-up 0.15s ease-out
  - Max-height: 60vh overflow-y-auto
  - Z-index: 50
- **Overlay**: fixed inset-0 z-40 para cerrar
- **Items**:
  - Full width
  - flex items-center gap-3
  - px-4 py-3
  - text-left
  - Active: same yellow background
- **Separators**: border-t #e5e7eb between sections

---

## 7. HEADER MOBILE (Top Bar)

### Estructura
- **Fixed**: top-0 left-0 right-0
- **Height**: auto (pt-3 pb-3)
- **Background**: white / #1f2937
- **Border**: bottom 1px #e5e7eb
- **Z-index**: 40
- **Display**: flex items-center justify-center gap-3

### Contenido
- **Logo**: h-8 w-auto object-contain
- **Title Section**:
  - Heading: "Asciende Metabolic Lab" (font-heading text-lg font-semibold)
  - Subtitle: "Advanced Exercise Testing & Prescription" (text-xs gray-600 font-body)
  - Centered layout

---

## 8. MAIN CONTENT AREA

### Desktop Layout
- **Margin-left**: lg:ml-20 (offset del sidebar)
- **Padding**: lg:p-8 (larger on desktop)
- **Max-width**: max-w-7xl (1280px)

### Mobile Layout
- **Padding-top**: pt-20 (espacio para top bar)
- **Padding-bottom**: pb-20 (espacio para bottom nav)
- **Padding-sides**: p-4 sm:p-6

### Header dentro de main
- **Background**: white / dark:bg-gray-800
- **Border-bottom**: 1px #e5e7eb
- **Padding**: px-4 sm:px-6 lg:px-8 py-4
- **Max-width container**: max-w-7xl mx-auto
- **Display**: flex justify-end items-center
- **Gap**: 3 (12px)

### Botones de Action en Header
- **Cuando athlete-detail**:
  - "Back to Athletes" (gray) + "New Test" (yellow)
- **Cuando athlete-selector**:
  - "Manage Athletes" (gray)
- **Styling**:
  - Gray button: bg-gray-100 text-gray-900 hover:bg-gray-200
  - Yellow button: bg-[#fdda36] text-[#514163] hover:bg-[#fdda36]/90
  - Padding: px-4 py-2
  - Border-radius: 12px
  - Font: font-body font-medium
  - Dark mode: bg-gray-700 dark:text-white

---

## 9. ANIMACIONES

### CSS Keyframes
```css
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(100px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### Clases Utility
- `.animate-slide-up`: slide-up 0.4s ease-out
- `.animate-slideUp`: slideUp 0.15s ease-out (rápida)
- `.animate-slide-in`: slide-in 0.3s ease-out

### Hover Animations
- Cards: hover:translateY(-4px)
- Buttons: hover:translateY(-2px)
- Sidebar items: smooth color transitions
- Opacity transitions en labels expandibles

---

## 10. ESPACIAMIENTO (8px Grid System)

### Padding/Margin Units (en Tailwind)
- `p-1` = 4px
- `p-2` = 8px
- `p-3` = 12px
- `p-4` = 16px
- `p-6` = 24px
- `p-8` = 32px

### Gaps
- `gap-1` = 4px
- `gap-2` = 8px
- `gap-3` = 12px
- `gap-4` = 16px

### Border Radius
- `rounded-lg` = 12px (botones, inputs)
- `rounded-xl` = 16px (cards)
- `rounded-full` = 9999px (avatars, badges)

---

## 11. RESPONSIVE BREAKPOINTS

### Mobile First
- **Mobile (default)**: < 640px
  - Sidebar: hidden
  - Bottom nav: visible
  - Top bar: visible
  - Single column layout

- **Tablet (sm)**: 640px+
  - Padding: sm:px-6

- **Desktop (lg)**: 1024px+
  - Sidebar: visible
  - Bottom nav: hidden
  - Top bar: hidden (header in main)
  - Padding: lg:p-8

### Utility Classes
- `hidden lg:flex` - hide mobile, show desktop
- `lg:hidden` - hide desktop, show mobile
- `pb-20 lg:pb-0` - padding for bottom nav on mobile
- `pt-20 lg:pt-0` - padding for top bar on mobile

---

## 12. DARK MODE

### Implementation
- **Tailwindcss darkMode**: `class`
- **Toggle**: Click button → add/remove `dark` class to `<html>`
- **CSS Variables**: Already defined with `.dark` selector

### Dark Mode Colors
- Text: lighter (f9fafb)
- Backgrounds: darker (1f2937, 111827)
- Borders: lighter gray (374151)
- Preserved: accent colors (yellow, blue, green, red)

---

## 13. ICONOS

### Todos los iconos usan SVG inline con Heroicons style
- **Size**: w-5 h-5 (normal), w-6 h-6 (mobile nav)
- **Stroke**: currentColor (heredan el color del text)
- **Stroke-width**: 2
- **Fill**: none
- **Stroke-linecap**: round
- **Stroke-linejoin**: round

### Iconos Principales
- **Dashboard**: Home/Grid icon
- **Users**: People icon
- **Activity**: Bar chart/activity
- **Settings**: Gear/cog icon
- **Profile**: Single person icon
- **Reporting**: Line chart/trending up
- **Language**: Globe icon
- **Theme**: Sun/Moon icon
- **Logout**: Exit/logout arrow icon

---

## 14. MENÚ ITEMS ESTRUCTURA

### Tipo de Datos
```javascript
interface MenuItem {
  path: string;           // '/dashboard', '/athletes', etc.
  label: string;          // Translated label
  icon: string;           // Icon name from getIconSVG
  requiredRoles?: string[];
}
```

### Menú por Rol

**ADMIN**:
- Dashboard
- Athletes
- Evaluations
- User Management
- Settings
- Reporting

**COACH**:
- Dashboard
- Athletes
- My Evaluations
- Settings
- Reporting

**ATHLETE**:
- Dashboard
- My Evaluations
- Profile
- Settings

---

## 15. LOADING & STATES

### Loading Screen
```
Background: gradient-to-br from-blue-600 to-blue-800
Content: centered white text, large font
Animation: smooth fade-in
```

### Error/Empty States
- Card white bg
- Icon in circle background
- Text centered
- Max-width: md (28rem)

---

## 16. ACCESSIBLE COLOR CONTRASTS

Todos los textos cumplen WCAG AA:
- Dark text (#1f2937) on white: 13.7:1
- Yellow (#fdda36) on purple (#514163): 8.5:1
- Purple (#514163) on white: 5.4:1
- Gray text (#4b5563) on white: 6.2:1

---

## 17. SAFE AREA (Notch Support)

Para dispositivos con notch (iPhone, etc.):
```css
.safe-area-top { padding-top: max(1rem, env(safe-area-inset-top)); }
.safe-area-bottom { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
.safe-area-left { padding-left: max(1rem, env(safe-area-inset-left)); }
.safe-area-right { padding-right: max(1rem, env(safe-area-inset-right)); }
```

---

## 18. PACKAGE NECESARIOS

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.4.19"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17"
  }
}
```

---

## 19. TAILWIND CONFIG NECESARIO

```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#fdda36',
        secondary: '#514163',
      },
      fontFamily: {
        'heading': ['Krona One', 'sans-serif'],
        'body': ['Jost', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

---

## 20. CSS CUSTOM PROPERTIES (en root)

```css
:root {
  --primary-purple: #514163;
  --primary-yellow: #fdda36;
  --secondary-purple: #6b5578;
  --light-purple: #8a7396;
  --text-primary: #1f2937;
  --text-secondary: #4b5563;
  --text-tertiary: #9ca3af;
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;
  --border-color: #e5e7eb;
  --accent-blue: #3b82f6;
  --accent-green: #10b981;
  --accent-red: #ef4444;
  --accent-yellow: #fdda36;
}
```

---

## QUICK COPY-PASTE SNIPPETS

### Primary Yellow Button
```jsx
<button className="px-4 py-2 rounded-lg bg-[#fdda36] text-[#514163] hover:bg-[#fdda36]/90 transition-colors font-body font-bold">
  Button Text
</button>
```

### Card
```jsx
<div className="card">
  <h3 className="text-lg font-heading">Title</h3>
  <p className="text-gray-600">Content</p>
</div>
```

### Badge
```jsx
<span className="badge badge-blue">Badge Text</span>
```

### Sidebar Menu Item (Active)
```jsx
<button className="bg-[#fdda36] text-[#514163] font-body font-bold">
  Item
</button>
```

### Sidebar Menu Item (Inactive)
```jsx
<button className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
  Item
</button>
```

---

**¡Listo! Con esto tienes todo lo que necesitas para replicar exactamente el diseño de Asciende LAB en cualquier otro proyecto. 🚀**