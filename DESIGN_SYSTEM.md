# Whisperoo Design System

## Brand Colors

### Primary Blue Palette
- **Primary Blue**: `#4A6FA5` - Main brand color (used in header, buttons, links)
- **Light Blue**: `#E8F2FF` - Chat bubbles, cards, backgrounds
- **Accent Blue**: `#6B8BC7` - Secondary elements, hover states
- **Deep Blue**: `#2C4870` - Dark text, headers

### Neutral Grays
- **Background Gray**: `#F8F9FA` - Main app background
- **Light Gray**: `#F5F6F7` - Card backgrounds, input fields
- **Medium Gray**: `#8A8A8A` - Secondary text, placeholders
- **Dark Gray**: `#2D3748` - Primary text, headers
- **Border Gray**: `#E2E8F0` - Borders, dividers

### Accent Colors
- **Success Green**: `#10B981` - Success states, positive feedback
- **Warning Orange**: `#F59E0B` - Warnings, attention needed
- **Error Red**: `#EF4444` - Errors, critical states
- **Purple Accent**: `#8B5CF6` - Expert/premium features

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

### Text Sizes
- **Heading 1**: `text-2xl font-bold` (24px, 700 weight)
- **Heading 2**: `text-xl font-semibold` (20px, 600 weight)
- **Heading 3**: `text-lg font-medium` (18px, 500 weight)
- **Body Large**: `text-base` (16px, 400 weight)
- **Body Regular**: `text-sm` (14px, 400 weight)
- **Body Small**: `text-xs` (12px, 400 weight)
- **Caption**: `text-xs text-gray-500` (12px, muted)

### Text Colors
- **Primary Text**: `text-gray-900` - Main content
- **Secondary Text**: `text-gray-600` - Supporting content
- **Muted Text**: `text-gray-500` - Captions, metadata
- **Brand Text**: `text-blue-600` - Links, brand elements

## Component Styles

### Header/Navigation
```css
background: white
border-bottom: 1px solid #E2E8F0
padding: 12px 16px
```
- Whisperoo logo in brand blue (#4A6FA5)
- Back arrow icon (left)
- Settings/menu icon (right)

### Chat Interface

#### Chat Messages
```css
/* User Messages */
background: #4A6FA5
color: white
border-radius: 16px 16px 4px 16px
margin-left: 20%
padding: 12px 16px

/* AI Messages */
background: #E8F2FF
color: #2D3748
border-radius: 16px 16px 16px 4px
margin-right: 20%
padding: 12px 16px
```

#### Input Field
```css
background: white
border: 1px solid #E2E8F0
border-radius: 24px
padding: 12px 20px
placeholder-color: #8A8A8A
```

### Cards and Containers

#### Content Cards
```css
background: white
border-radius: 12px
padding: 20px
border: 1px solid #E2E8F0
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
```

#### Feature Cards (like C-Section Recovery)
```css
background: linear-gradient(135deg, #4A6FA5 0%, #6B8BC7 100%)
color: white
border-radius: 16px
padding: 24px
```

### Buttons

#### Primary Button
```css
background: #4A6FA5
color: white
border-radius: 8px
padding: 12px 24px
font-weight: 600
hover:background: #2C4870
```

#### Secondary Button
```css
background: white
color: #4A6FA5
border: 1px solid #4A6FA5
border-radius: 8px
padding: 12px 24px
font-weight: 600
hover:background: #E8F2FF
```

#### Preview Button (Course/Product)
```css
background: white
color: #4A6FA5
border-radius: 8px
padding: 10px 20px
font-weight: 500
```

### Input Elements

#### Text Input
```css
background: white
border: 1px solid #E2E8F0
border-radius: 8px
padding: 12px 16px
focus:border-color: #4A6FA5
focus:ring: 2px #4A6FA5 opacity-20
```

#### Quick Response Pills
```css
background: white
border: 1px solid #E2E8F0
border-radius: 20px
padding: 8px 16px
color: #2D3748
hover:border-color: #4A6FA5
```

### Avatar/Profile Elements

#### User Avatar (Circle)
```css
width: 40px
height: 40px
border-radius: 50%
background: #4A6FA5
color: white
display: flex
align-items: center
justify-content: center
font-weight: 600
```

### Pricing Display
```css
font-size: 24px
font-weight: 700
color: #2D3748
```

## Layout Patterns

### Mobile-First Responsive
- **Mobile**: Full width with 16px side padding
- **Tablet**: Max width 768px with centered content
- **Desktop**: Max width 1024px with sidebar navigation

### Spacing Scale
- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px
- **xl**: 32px
- **2xl**: 48px

### Border Radius Scale
- **Small**: 4px - Small elements
- **Medium**: 8px - Buttons, inputs
- **Large**: 12px - Cards
- **XLarge**: 16px - Featured elements
- **Full**: 50% - Circular elements

## Component Library

### Chat Components
- MessageBubble (user vs AI styling)
- ChatInput with quick response pills
- TypingIndicator
- MessageActions (view/delete notes)

### Navigation
- HeaderBar with logo and icons
- BackButton
- TabBar (if needed)

### Content Cards
- WelcomeCard (introductory messages)
- FeatureCard (gradient background for premium content)
- ExpertCard (expert recommendations)
- CourseCard (product previews)

### Forms
- PrimaryInput
- SecondaryButton
- QuickResponsePill
- SubmitButton

### Overlays
- Modal backgrounds with blur
- Toast notifications
- Loading states

## Implementation Notes

### Tailwind CSS Classes
Use these Tailwind classes to implement the design:

```css
/* Brand Colors */
.bg-brand-primary { @apply bg-blue-600; }
.bg-brand-light { @apply bg-blue-50; }
.text-brand { @apply text-blue-600; }

/* Shadows */
.shadow-card { box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
.shadow-elevated { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }

/* Gradients */
.gradient-brand { background: linear-gradient(135deg, #4A6FA5 0%, #6B8BC7 100%); }
```

### Accessibility
- Minimum contrast ratio 4.5:1 for text
- Focus states with visible outlines
- Keyboard navigation support
- Screen reader friendly markup

This design system maintains the clean, professional, and family-friendly aesthetic shown in the screenshot while providing comprehensive guidance for implementation.