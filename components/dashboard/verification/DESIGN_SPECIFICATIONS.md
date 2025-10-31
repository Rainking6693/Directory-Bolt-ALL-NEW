# DirectoryBolt Verification Action Center - UI Design Specifications

## Overview
The Verification Action Center provides a comprehensive interface for users to complete various verification requirements for their directory submissions. The design maintains consistency with the existing DirectoryBolt design system while providing intuitive, accessible, and mobile-first user experiences.

## Design System Integration

### Color Palette
- **Primary Action**: `volt-500` (#b3ff00) - High-energy neon green for CTAs
- **Background**: `secondary-800` (#27324a) - Dark card backgrounds
- **Border**: `secondary-700` (#3a4861) - Card borders and dividers
- **Text Primary**: `white` - Primary text content
- **Text Secondary**: `secondary-300` (#d1d9e6) - Secondary text content
- **Success**: `success-400` (#4ade80) - Success states
- **Warning**: `yellow-400` (#facc15) - Medium priority and warnings
- **Danger**: `danger-400` (#f87171) - High priority and errors

### Typography
- **Headers**: Inter font family, font-black (900) weight
- **Body Text**: Inter font family, regular (400) weight
- **Action Text**: Inter font family, font-bold (700) weight
- **Code/Numbers**: Monospace styling for verification codes

### Spacing
- **Component Padding**: 24px (p-6) for cards and containers
- **Element Gap**: 16px (gap-4) between related elements
- **Section Gap**: 32px (gap-8) between major sections

## Component Architecture

### 1. VerificationActionCenter (Main Container)
**Purpose**: Central hub for all verification actions with filtering and sorting capabilities.

**Key Features**:
- Action filtering (All, Urgent, Pending, In Progress)
- Sort by priority, due date, or estimated time
- Bulk action capabilities
- Real-time stats display
- Mobile-responsive grid layout

**Responsive Breakpoints**:
- Mobile (<640px): Single column, collapsible filters
- Tablet (640-1024px): Flexible grid, horizontal filters
- Desktop (>1024px): Multi-column layout, expanded view options

### 2. VerificationActionCard (Individual Action)
**Purpose**: Interactive card for each verification action with expandable interface.

**Visual Hierarchy**:
1. **Priority Badge**: Top-right, color-coded (High/Medium/Low)
2. **Verification Icon**: Large, type-specific emoji icon
3. **Title & Directory**: Bold title with directory name
4. **Description**: Clear explanation of required action
5. **Metadata**: Due date, estimated time, file requirements
6. **Action Button**: Primary CTA with hover/focus states

**States**:
- **Collapsed**: Summary view with CTA button
- **Expanded**: Full interface for completing verification
- **Processing**: Loading state during async operations
- **Completed**: Success state with confirmation

**Interaction Patterns**:
- Hover: Subtle scale (1.01x) and enhanced shadow
- Focus: 2px volt-colored ring with proper offset
- Click: Smooth expansion animation (300ms duration)

### 3. Verification Type Interfaces

#### SMS Verification Form
**Layout**: Two-step process with clear progress indication
1. **Step 1 - Phone Entry**: 
   - Formatted phone input with real-time validation
   - Clear labeling and helpful text
   - Primary/secondary button pairing
2. **Step 2 - Code Entry**:
   - 6-digit code input grid with auto-focus
   - Resend functionality with countdown timer
   - Auto-submission on completion

**Mobile Optimizations**:
- Larger touch targets (48px minimum)
- Numeric keyboard for code entry
- Proper input modes and patterns

#### Document Upload Interface
**Drag & Drop Zone**:
- Visual feedback for drag states
- File type and size indicators
- Progress bars for upload status
- Preview thumbnails for images

**File Management**:
- Upload status indicators (uploading/processing/completed)
- Individual file removal options
- Bulk upload capabilities
- Error handling for invalid files

**Accessibility**:
- Screen reader announcements for upload progress
- Keyboard navigation for file management
- High contrast mode support

#### Phone Call Scheduler
**Calendar Interface**:
- Week-based navigation
- Time slot grid layout
- Availability indicators
- Timezone display

**Selection Process**:
- Visual feedback for selected slots
- Confirmation display
- Contact information verification
- Schedule summary before confirmation

#### Email Verification Display
**Status Communication**:
- Clear status indicators with appropriate iconography
- Masked email display for privacy
- Resend functionality with success feedback
- Troubleshooting tips and help text

## Visual Design Specifications

### Priority Indicators
**High Priority**:
- Border: `border-danger-500/30`
- Background: `bg-danger-500/5`
- Badge: Red with white text
- Glow: Danger-colored shadow on expansion

**Medium Priority**:
- Border: `border-yellow-500/30`
- Background: `bg-yellow-500/5`
- Badge: Yellow with dark text
- Glow: Yellow-colored shadow on expansion

**Low Priority**:
- Border: `border-secondary-600`
- Background: `bg-secondary-800/50`
- Badge: Gray with light text
- Minimal glow effect

### Time Estimation Display
**Format**: Human-readable time estimates
- Under 1 hour: "X mins"
- 1+ hours: "Xh Ym"
- 1+ days: "X days"

**Visual Treatment**:
- Clock icon (⏱️) with estimated time
- Secondary text color
- Small font size (text-sm)

### Progress Indicators
**Upload Progress**:
- Animated progress bars with smooth transitions
- Percentage display (rounded to whole numbers)
- Color coding (volt-500 for active progress)
- Status text updates (uploading/processing/completed)

**Multi-step Process**:
- Step indicator with checkmarks
- Current step highlighting
- Clear navigation between steps

## Error States and Feedback

### Error Classifications
1. **Validation Errors**: Real-time field validation
2. **Network Errors**: API communication failures
3. **File Errors**: Upload and processing issues
4. **Timeout Errors**: Long-running operation failures

### Error Display Patterns
**Inline Errors**: Field-level validation with immediate feedback
**Card Errors**: Error banners within action cards
**Toast Notifications**: System-level errors with auto-dismiss
**Modal Errors**: Critical errors requiring user acknowledgment

### Success Feedback
**Micro-interactions**: Checkmark animations, color transitions
**Confirmation Messages**: Clear success states with next steps
**Progress Celebrations**: Achievement-style feedback for completions

## Mobile Responsive Design

### Breakpoint Strategy
```css
/* Mobile First Approach */
.verification-card {
  /* Base mobile styles */
  padding: 16px;
  margin: 8px 0;
}

@media (min-width: 640px) {
  /* Tablet adjustments */
  .verification-card {
    padding: 20px;
    margin: 12px 0;
  }
}

@media (min-width: 1024px) {
  /* Desktop enhancements */
  .verification-card {
    padding: 24px;
    margin: 16px 0;
  }
}
```

### Mobile-Specific Optimizations
1. **Touch Targets**: Minimum 44x44px clickable areas
2. **Input Modes**: Appropriate keyboard types (numeric, tel, email)
3. **Viewport Scaling**: Proper meta viewport configuration
4. **Performance**: Lazy loading for non-critical components

### Tablet Considerations
1. **Hybrid Interactions**: Support for both touch and mouse
2. **Orientation Changes**: Responsive layouts for portrait/landscape
3. **Split Views**: Compatible with tablet multitasking

## Accessibility Specifications (WCAG AA Compliance)

### Color Contrast
- **Text on Dark Background**: 4.5:1 minimum contrast ratio
- **Interactive Elements**: 3:1 minimum for non-text elements
- **Focus Indicators**: High contrast ring with sufficient thickness

### Keyboard Navigation
- **Tab Order**: Logical sequence through interactive elements
- **Focus Management**: Clear focus indicators and proper focus trapping
- **Shortcuts**: Escape key to close expanded interfaces

### Screen Reader Support
- **ARIA Labels**: Descriptive labels for complex interactions
- **Live Regions**: Dynamic content announcements
- **Semantic HTML**: Proper heading hierarchy and landmarks

### Motor Accessibility
- **Large Touch Targets**: 48px minimum on mobile
- **Hover Alternatives**: All hover interactions have focus equivalents
- **Reduced Motion**: Respect user's motion preferences

## Performance Considerations

### Asset Optimization
- **SVG Icons**: Vector graphics for scalability
- **Image Compression**: Optimized preview thumbnails
- **Bundle Splitting**: Lazy load verification forms

### Loading States
- **Skeleton Screens**: Content placeholders during load
- **Progressive Enhancement**: Core functionality without JavaScript
- **Graceful Degradation**: Fallbacks for unsupported features

## Integration Points

### API Endpoints
- `POST /api/verification/sms/send` - Send SMS verification code
- `POST /api/verification/sms/verify` - Verify SMS code
- `POST /api/verification/documents/upload` - Upload documents
- `POST /api/verification/phone/schedule` - Schedule phone call
- `GET /api/verification/actions` - Get user's verification actions

### State Management
- **Action Status Updates**: Real-time synchronization with backend
- **Upload Progress**: File upload progress tracking
- **Form Validation**: Client and server-side validation

### Notification Integration
- **Success Notifications**: Completion confirmations
- **Error Notifications**: Failure alerts with recovery actions
- **Progress Notifications**: Long-running operation updates

## Development Guidelines

### Component Props
All components follow TypeScript-first approach with comprehensive prop interfaces:

```typescript
interface VerificationActionCardProps {
  action: VerificationAction
  onStatusUpdate?: (status: VerificationAction['status']) => void
  className?: string
}
```

### Event Handling
Consistent event naming and parameter patterns:
- `onComplete`: Action successfully completed
- `onCancel`: User cancelled action
- `onError`: Error occurred during action
- `onStatusUpdate`: Status changed

### Testing Considerations
- **Unit Tests**: Individual component functionality
- **Integration Tests**: Form submission flows
- **Accessibility Tests**: Screen reader compatibility
- **Performance Tests**: Load time measurements

This specification ensures a cohesive, accessible, and performant verification experience that integrates seamlessly with the existing DirectoryBolt platform while providing exceptional user experience across all device types and accessibility needs.