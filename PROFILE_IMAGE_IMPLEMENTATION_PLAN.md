# Profile Image Upload Implementation Plan

## Overview
Add profile image upload functionality allowing users to select and display a custom profile picture.

## Implementation Steps

### 1. Update User Type
**File:** `types/index.ts`

Add `profileImage` field to User interface:
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  profileImage?: string | null; // URL or base64 string
}
```

### 2. Database Migration
**File:** `add_profile_image_column.sql`

```sql
-- Add profile_image column to users table
ALTER TABLE auth.users 
ADD COLUMN IF NOT EXISTS profile_image TEXT;

-- Add profile_image to user_metadata for easier access
-- This will be stored in the user's metadata JSON field
```

### 3. Update CompactProfileHeader Component
**File:** `components/profile/CompactProfileHeader.tsx`

Add profileImage prop and display logic:
```typescript
interface CompactProfileHeaderProps {
  userName: string;
  userEmail: string;
  stats: UserStats;
  onEditPress?: () => void;
  profileImage?: string | null; // Add this
}

// In the avatar section:
{profileImage ? (
  <Image 
    source={{ uri: profileImage }} 
    style={styles.avatarImage}
  />
) : (
  <Text style={styles.avatarText}>
    {userName.charAt(0).toUpperCase()}
  </Text>
)}
```

### 4. Update Edit Profile Screen
**File:** `app/edit-profile.tsx`

Add image picker functionality:
```typescript
import * as ImagePicker from 'expo-image-picker';

const [profileImage, setProfileImage] = useState(user?.profileImage || null);

const pickImage = async () => {
  // Request permissions
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please allow access to your photos');
    return;
  }

  // Launch image picker
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (!result.canceled) {
    setProfileImage(result.assets[0].uri);
  }
};
```

### 5. Update Auth Context
**File:** `contexts/AuthContext.tsx`

Update the `updateUser` function to handle profile images:
```typescript
const updateUser = async (updates: { 
  name?: string; 
  email?: string;
  profileImage?: string;
}) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: {
        name: updates.name,
        profile_image: updates.profileImage,
      }
    });

    if (error) throw error;

    // Update local user state
    setUser({
      ...user!,
      name: updates.name || user!.name,
      profileImage: updates.profileImage,
    });

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
};
```

### 6. Image Storage Options

#### Option A: Supabase Storage (Recommended)
- Upload to Supabase Storage bucket
- Store public URL in user metadata
- Pros: Scalable, CDN, proper storage
- Cons: Requires storage bucket setup

#### Option B: Base64 in Metadata
- Convert image to base64
- Store directly in user metadata
- Pros: Simple, no extra setup
- Cons: Size limitations, slower

### 7. Required Dependencies

Add to `package.json`:
```json
{
  "expo-image-picker": "~14.7.1"
}
```

Install:
```bash
npx expo install expo-image-picker
```

### 8. Update Profile Screen
**File:** `app/(tabs)/profile.tsx`

Pass profileImage to CompactProfileHeader:
```typescript
<CompactProfileHeader
  userName={user.name}
  userEmail={user.email}
  stats={userStats}
  profileImage={user.profileImage}
  onEditPress={() => router.push('/edit-profile' as any)}
/>
```

## UI/UX Flow

### Edit Profile Screen:
1. User taps on avatar
2. Image picker opens
3. User selects/crops image
4. Preview shows immediately
5. User taps "Save" (checkmark)
6. Image uploads to storage
7. URL saved to user metadata
8. Navigate back to profile

### Profile Screen:
1. If profileImage exists → Display image
2. If no profileImage → Show initial letter

## Styling Considerations

### Avatar Image Styles:
```typescript
avatarImage: {
  width: 60,
  height: 60,
  borderRadius: 30,
},

// For edit screen (larger):
avatarImageLarge: {
  width: 100,
  height: 100,
  borderRadius: 50,
},
```

### Camera Icon Overlay (Edit Screen):
```typescript
cameraIconOverlay: {
  position: 'absolute',
  bottom: 0,
  right: 0,
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: '#ff8a4c',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: '#0a0605',
}
```

## Implementation Priority

### Phase 1 (MVP):
1. ✅ Add profileImage to User type
2. ✅ Update CompactProfileHeader to display images
3. ✅ Add image picker to edit screen
4. ✅ Store as base64 in user metadata (simple)

### Phase 2 (Enhanced):
1. Upload to Supabase Storage
2. Image compression/optimization
3. Remove image option
4. Take photo with camera option

## Testing Checklist

- [ ] Image picker opens on avatar tap
- [ ] Selected image displays in preview
- [ ] Image saves successfully
- [ ] Image displays on profile screen
- [ ] Image persists after app restart
- [ ] Fallback to initials works
- [ ] Works on iOS
- [ ] Works on Android
- [ ] Handles permission denials gracefully
- [ ] Handles large images

## Security Considerations

1. **File Size Limits**: Max 5MB per image
2. **File Type Validation**: Only allow images (jpg, png)
3. **Compression**: Reduce quality to 0.8
4. **Sanitization**: Validate image data before upload

## Error Handling

```typescript
try {
  // Upload image
} catch (error) {
  if (error.code === 'PERMISSION_DENIED') {
    Alert.alert('Permission Required', 'Please enable photo access');
  } else if (error.code === 'FILE_TOO_LARGE') {
    Alert.alert('File Too Large', 'Please select a smaller image');
  } else {
    Alert.alert('Upload Failed', 'Please try again');
  }
}
```

## Next Steps

Would you like me to:
1. Implement the basic version (base64 storage)?
2. Implement the full version (Supabase Storage)?
3. Start with just the UI changes first?

Let me know which approach you prefer!
