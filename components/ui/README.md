# UI Components

## Select Component

Enhanced dropdown selectors with custom styling that aligns with the SPECTRE design system.

### Features

- Custom dropdown arrow with proper visual feedback
- Hover and focus states
- Disabled state styling
- Consistent typography using Geist font
- Auto-width by default (sizes to content)
- Responsive design
- Accessible with ARIA support

### Usage

#### Using the Select Component (Recommended)

```tsx
import { Select } from '@/components/ui'

const options = [
  { value: 'all', label: 'All items' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
]

// Auto-width (for filters/toolbars)
<Select
  value={selectedValue}
  onChange={setSelectedValue}
  options={options}
  placeholder="Choose an option..."
/>

// Full width (for forms)
<Select
  value={selectedValue}
  onChange={setSelectedValue}
  options={options}
  className="w-full"
  placeholder="Choose an option..."
/>
```

#### Using CSS Class Directly

```tsx
<!-- Auto-width (for filters) -->
<select className="select">
  <option value="all">All items</option>
  <option value="active">Active</option>
  <option value="inactive">Inactive</option>
</select>

<!-- Full width (for forms) -->
<select className="select w-full">
  <option value="all">All items</option>
  <option value="active">Active</option>
  <option value="inactive">Inactive</option>
</select>
```

### Width Behavior

- **Default**: Auto-width - dropdown sizes to fit its content (ideal for filters, toolbars)
- **Full Width**: Add `w-full` class for form inputs that should span their container
- **Custom Width**: Use any Tailwind width class like `w-48`, `w-64`, etc.

### Styling Classes

- `.select` - Enhanced dropdown styling with custom arrow
- `.input` - Basic input styling (use for text inputs, not selects)

### Design System

The Select component follows the SPECTRE design system:
- Font: Geist
- Colors: Gray palette (50-950)
- Borders: 1px solid with rounded corners
- Focus states: Gray-900 ring
- Hover states: Gray-400 border with subtle shadow 