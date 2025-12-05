# Compact Profile Header - Visual Preview

## Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌────┐  John Doe                                      │
│  │ J  │  john.doe@email.com                            │
│  └────┘                                                 │
│  60x60                                                  │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│    🔥        ▶️        📺        ⭐                     │
│    32px     32px     32px     32px                     │
│                                                         │
│     5        42       12       150                      │
│   18px      18px     18px     18px                     │
│                                                         │
│  Streak  Episodes  Shows   Points                      │
│   11px     11px     11px     11px                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Dimensions

- **Card Width:** Full width minus 40px margin (20px each side)
- **Card Height:** ~140px (auto-adjusts to content)
- **Avatar:** 60x60px
- **Icon Badges:** 32x32px
- **Spacing:** 16px padding, 12px gaps

## Color Scheme

### Light Mode
- **Card Background:** `Colors.surface` (light gray)
- **Border:** `Colors.border` (subtle gray)
- **Text:** `Colors.text` (dark)
- **Secondary Text:** `Colors.textSecondary` (gray)
- **Streak Badge:** Orange gradient (#FF6600 → #FF8833)
- **Icon Badges:** Card background with border

### Dark Mode
- **Card Background:** `Colors.surface` (dark gray)
- **Border:** `Colors.border` (subtle light gray)
- **Text:** `Colors.text` (white)
- **Secondary Text:** `Colors.textSecondary` (light gray)
- **Streak Badge:** Orange gradient (same)
- **Icon Badges:** Darker background with border

## Stat Icons

| Stat | Icon | Color | Badge Style |
|------|------|-------|-------------|
| Streak | 🔥 flame | White | Orange gradient |
| Episodes | ▶️ play-circle | Primary | Card with border |
| Shows | 📺 tv | Primary | Card with border |
| Points | ⭐ star | Primary | Card with border |

## Responsive Behavior

### Small Screens (< 375px)
- Stats remain in 4 columns
- Font sizes scale down slightly
- Icons remain 32px for touch targets

### Medium Screens (375px - 414px)
- Default sizing
- Optimal layout

### Large Screens (> 414px)
- Card maintains max width
- Extra space on sides
- Stats remain centered

## Animation Details

### On Mount
- Fade in: 400ms ease-out
- Scale from 0.9 to 1.0

### Streak Flame
- Continuous flicker when streak > 0
- Scale: 1.0 → 1.1 → 0.95 → 1.0
- Duration: 900ms loop
- Easing: Linear

### On Stat Update
- Counter animation (optional)
- Duration: 1000ms
- Easing: Ease-out

## Interaction States

### Default
- Normal appearance
- Subtle shadow

### Hover (Web)
- Slightly increased shadow
- Smooth transition

### Press (Mobile)
- Slight scale down (0.98)
- Haptic feedback

## Accessibility

### Text Sizes
- User Name: 20px (readable)
- Email: 14px (readable)
- Stat Values: 18px (prominent)
- Stat Labels: 11px (minimum readable)

### Touch Targets
- Icon badges: 32x32px (meets 44x44px with padding)
- Edit button: Full width, 44px height

### Screen Readers
- Avatar: "Profile picture for {name}"
- Stats: "{value} {label}"
- Streak: "Current streak: {value} days"

## Code Example

```tsx
<CompactProfileHeader
  userName="John Doe"
  userEmail="john.doe@email.com"
  stats={{
    currentStreak: 5,
    longestStreak: 12,
    totalEpisodes: 42,
    showsCompleted: 12,
    achievementPoints: 150,
    // ... other stats
  }}
/>
```

## Comparison with Old Design

| Aspect | Old Design | New Design | Improvement |
|--------|-----------|------------|-------------|
| Height | ~400px | ~140px | 65% reduction |
| Avatar Size | 120x120px | 60x60px | More compact |
| Stats Layout | 2x2 grid | 1x4 row | Easier to scan |
| Information Density | Low | High | More efficient |
| Scroll Required | Yes | No | Better UX |

## Integration

The compact header replaces:
1. ❌ Large centered avatar
2. ❌ Centered user name
3. ❌ Centered email
4. ❌ StatsGrid component (2x2 cards)

With:
1. ✅ Single compact card
2. ✅ Left-aligned avatar
3. ✅ Horizontal stats row
4. ✅ All info at a glance

## Benefits

1. **Space Efficiency:** Saves ~260px of vertical space
2. **Better Hierarchy:** Profile and stats grouped logically
3. **Improved Scanning:** Horizontal layout is easier to read
4. **Modern Design:** Card-based, clean, professional
5. **Mobile-First:** Optimized for small screens
6. **Consistent:** Matches app's design language

---

**Result:** A more compact, efficient, and modern profile header that displays all key information without sacrificing readability or functionality.
