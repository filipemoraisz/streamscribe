# "At a Glance" Hero Section - Design Specification

## Overview
A visually stunning hero section that greets users when they open the app, showcasing their key stats in an engaging, motivating way.

---

## Design Concept: "Your Journey"

### Visual Style
**Premium Card with Gradient Background**
- Dark gradient background (deep purple to dark blue)
- Subtle animated shimmer effect on the background
- Elevated shadow for depth
- Rounded corners (20px)
- Full-width with horizontal margins

### Layout Structure

```
┌─────────────────────────────────────────────────┐
│  ✨ Your Journey                                │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   🔥     │  │   📺     │  │   🏆     │     │
│  │   15     │  │   247    │  │   12/25  │     │
│  │  Days    │  │ Episodes │  │Unlocked  │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│                                                  │
│  "Keep the streak alive! 🎯"                   │
└─────────────────────────────────────────────────┘
```

---

## Design Options

### **Option A: Horizontal Cards** (Recommended)
**Layout:** Three equal-width cards in a row
**Pros:** 
- Clean, balanced layout
- Easy to scan left-to-right
- Works well on all screen sizes
- Modern, dashboard-like feel

**Visual Details:**
- Each stat in its own mini-card with subtle background
- Large icon at top (32px)
- Big number in the middle (36px, bold)
- Small label at bottom (12px)
- Subtle hover/press animation
- Color-coded icons:
  - Streak: Orange gradient (#FF5C00 → #FF8F00)
  - Episodes: Blue gradient (#3B82F6 → #60A5FA)
  - Achievements: Gold gradient (#F59E0B → #FBBF24)

---

### **Option B: Featured Stat + Grid**
**Layout:** Large streak card on top, two smaller cards below

```
┌─────────────────────────────────────┐
│  🔥  15 Day Streak                  │
│  "You're on fire!"                  │
└─────────────────────────────────────┘
┌──────────────┐  ┌──────────────────┐
│ 📺 247       │  │ 🏆 12/25         │
│ Episodes     │  │ Achievements     │
└──────────────┘  └──────────────────┘
```

**Pros:**
- Emphasizes the streak (most motivating metric)
- Creates visual hierarchy
- More dynamic layout

---

### **Option C: Vertical Stack with Progress Bars**
**Layout:** Stacked stats with visual progress indicators

```
┌─────────────────────────────────────┐
│  🔥 Watch Streak                    │
│  15 Days  ▓▓▓▓▓▓▓▓▓░░░░░░░  30     │
│                                      │
│  📺 Episodes Watched                │
│  247      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  500     │
│                                      │
│  🏆 Achievements                    │
│  12/25    ▓▓▓▓▓▓░░░░░░░░░░  48%    │
└─────────────────────────────────────┘
```

**Pros:**
- Shows progress toward goals
- More detailed information
- Gamification element

**Cons:**
- Takes more vertical space
- Requires goal-setting logic

---

## Recommended: **Option A - Horizontal Cards**

### Detailed Specifications

#### Container
- **Background:** Linear gradient from `#1E1B4B` to `#1E3A8A`
- **Padding:** 20px all around
- **Margin:** 16px horizontal, 12px top
- **Border Radius:** 20px
- **Shadow:** 
  - Color: `rgba(0, 0, 0, 0.3)`
  - Offset: (0, 4)
  - Blur: 12px
  - Elevation: 6

#### Header
- **Text:** "Your Journey" or "At a Glance"
- **Font Size:** 16px
- **Font Weight:** 600
- **Color:** `rgba(255, 255, 255, 0.9)`
- **Icon:** ✨ sparkles (optional)
- **Margin Bottom:** 16px

#### Stat Cards (3 cards in row)
- **Layout:** Flex row with equal spacing
- **Gap:** 12px between cards
- **Background:** `rgba(255, 255, 255, 0.1)`
- **Border:** 1px solid `rgba(255, 255, 255, 0.15)`
- **Border Radius:** 16px
- **Padding:** 16px vertical, 12px horizontal
- **Backdrop Blur:** 10px (glassmorphism effect)

#### Each Stat Card Contains:
1. **Icon** (top)
   - Size: 32px
   - Animated on mount (scale + fade in)
   - Color: Gradient specific to metric

2. **Value** (middle)
   - Font Size: 32px
   - Font Weight: 700
   - Color: White
   - Animated counter on mount

3. **Label** (bottom)
   - Font Size: 11px
   - Font Weight: 500
   - Color: `rgba(255, 255, 255, 0.7)`
   - Text Transform: Uppercase
   - Letter Spacing: 0.5px

#### Footer Message (Optional)
- **Text:** Dynamic based on streak
  - 0 days: "Start your journey today! 🎬"
  - 1-6 days: "Keep it going! 💪"
  - 7-13 days: "One week strong! 🔥"
  - 14-29 days: "You're unstoppable! ⚡"
  - 30+ days: "Legendary streak! 👑"
- **Font Size:** 13px
- **Color:** `rgba(255, 255, 255, 0.8)`
- **Alignment:** Center
- **Margin Top:** 12px

---

## Interactions

### Tap Behavior
**Entire card is tappable** → Navigates to Profile screen

**Press Animation:**
- Scale down to 0.98
- Slight opacity reduction to 0.9
- Duration: 150ms
- Haptic feedback on press

### Loading State
- Show skeleton with shimmer animation
- Same dimensions as final card
- Smooth fade-in when data loads

### Empty State (New Users)
- Show "0" for all metrics
- Encouraging message: "Your journey starts now! 🎬"
- Slightly different styling to indicate it's a starting point

---

## Animations

### On Mount
1. **Container:** Fade in + slide up (300ms, ease-out)
2. **Icons:** Scale from 0 to 1, staggered (100ms delay between each)
3. **Numbers:** Count up animation from 0 to actual value (500ms)
4. **Labels:** Fade in (200ms delay)

### On Update (when stats change)
- Number pulses briefly (scale 1 → 1.1 → 1)
- Subtle glow effect
- Confetti animation if achievement unlocked

---

## Color Palette

### Streak (Fire)
- **Primary:** `#FF5C00`
- **Secondary:** `#FF8F00`
- **Glow:** `rgba(255, 92, 0, 0.3)`

### Episodes (TV)
- **Primary:** `#3B82F6`
- **Secondary:** `#60A5FA`
- **Glow:** `rgba(59, 130, 246, 0.3)`

### Achievements (Trophy)
- **Primary:** `#F59E0B`
- **Secondary:** `#FBBF24`
- **Glow:** `rgba(245, 158, 11, 0.3)`

---

## Accessibility

- **Minimum touch target:** 48x48px for each stat card
- **Color contrast:** All text meets WCAG AA standards
- **Screen reader labels:** 
  - "Watch streak: 15 days"
  - "Episodes watched: 247"
  - "Achievements unlocked: 12 out of 25"
- **Reduced motion:** Disable animations if user prefers reduced motion

---

## Technical Notes

### Data Source
```typescript
interface AtAGlanceStats {
  currentStreak: number;      // from UserStats
  totalEpisodes: number;      // from UserStats
  achievementsUnlocked: number; // from UserStats
  achievementsTotal: number;    // from UserStats
}
```

### Component Props
```typescript
interface AtAGlanceProps {
  stats: AtAGlanceStats;
  loading?: boolean;
  onPress?: () => void;
}
```

---

## Implementation Priority

1. ✅ Create new `AtAGlanceHero` component
2. ✅ Implement Option A layout (horizontal cards)
3. ✅ Add gradient background and glassmorphism
4. ✅ Implement animations (mount, counter, press)
5. ✅ Add dynamic footer message
6. ✅ Connect to UserStats data
7. ✅ Replace ImpactHeader in home screen
8. ✅ Test on various screen sizes
9. ✅ Add accessibility features
10. ✅ Polish and refine

---

## Success Metrics

This hero section should:
- ✨ Create an immediate positive emotional response
- 🎯 Motivate users to maintain their streak
- 📊 Provide quick insight into their progress
- 🎨 Set the visual tone for the entire app
- 👆 Encourage engagement (taps to profile)

---

**Ready to implement?** This design will make your home screen feel premium and engaging!


---

## Update: Savings Metric Implementation

### Change Summary
Replaced **Achievements** metric with **Total Savings** to provide more tangible value to users.

### New Layout

```
┌─────────────────────────────────────────────────┐
│  ✨ Your Journey                                │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   🔥     │  │   📺     │  │   💰     │     │
│  │   15     │  │   247    │  │  $247    │     │
│  │  Days    │  │ Episodes │  │  Saved   │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│                                                  │
│  "Keep the streak alive! 🎯"                   │
└─────────────────────────────────────────────────┘
```

### Design Philosophy
The three metrics now tell a complete story:
- 🔥 **Streak** = Consistency & Engagement
- 📺 **Episodes** = Activity & Usage  
- 💰 **Savings** = Value & Financial Benefit

### Savings Card Specifications

#### Visual Design
- **Icon:** 💰 wallet (Ionicons: "wallet")
- **Icon Color:** `#10B981` (emerald green)
- **Background:** `rgba(16, 185, 129, 0.15)` (green tint)
- **Border:** `rgba(16, 185, 129, 0.3)` (green border)
- **Value Color:** `#10B981` (green text)

#### Number Formatting
- Values under $1,000: Display rounded (e.g., "$247")
- Values $1,000+: Display with "k" suffix, rounded (e.g., "$1k", "$10k")
- Format: `${value >= 1000 ? Math.round(value / 1000) + 'k' : Math.round(value)}`
- Always displays clean, round numbers (no decimals like 9.99999)

#### Updated Interface
```typescript
interface AtAGlanceStats {
  currentStreak: number;      // from UserStats
  totalEpisodes: number;      // from UserStats
  totalSavings: number;       // from UserStats (replaces achievements)
}
```

### Why This Change?

**More Tangible Value:**
- Savings is a concrete, measurable benefit
- Easier for users to understand the app's value proposition
- Creates a stronger emotional connection (saving money)

**Better Motivation:**
- Financial incentive is universally motivating
- Complements engagement metrics (streak, episodes)
- Reinforces the app's core value: optimizing streaming costs

**Visual Distinction:**
- Green color creates visual variety
- Stands out from the orange/amber gradient
- Universally associated with money/savings

### Implementation Complete ✅
- Updated `AtAGlanceHero.tsx` component
- Modified interface to use `totalSavings`
- Added green-themed styling for savings card
- Updated home screen to pass correct stats
- Implemented smart number formatting
- Integrated with optimizer service to calculate real-time savings
- All diagnostics passing

### Data Source
The `totalSavings` value is calculated in real-time by the `optimizerService.generateOptimizationPlan()` method, which:
- Analyzes the user's watchlist
- Clusters content by streaming provider
- Calculates optimal subscription rotation strategy
- Compares subscription costs vs. rental costs
- Returns projected annual savings

This ensures the savings metric always reflects the user's current watchlist and provides accurate, actionable financial data.
