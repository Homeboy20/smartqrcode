# Password Reset Fix - Configuration Guide

## Issue Fixed
The Supabase auth recovery endpoint was returning a 500 error because the password reset flow was missing the required `redirectTo` URL parameter.

## Changes Made

### 1. Updated Password Reset Flow
**File**: `src/context/SupabaseAuthContext.tsx`

Added `redirectTo` parameter to `resetPasswordForEmail`:
```typescript
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
});
```

### 2. Created Reset Password Page
**File**: `src/app/reset-password/page.tsx`

New page that handles the password reset token callback:
- Validates the reset token from URL
- Allows user to enter new password
- Updates password using Supabase Auth
- Redirects to login on success

## Required Supabase Configuration

You need to add the reset password URL to your Supabase project's allowed redirect URLs:

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/ufdwqpxqgqhvqoovdssf

2. **Open Authentication Settings**
   - Click "Authentication" in left sidebar
   - Click "URL Configuration"

3. **Add Redirect URL**
   Add these URLs to "Redirect URLs" (one per line):
   ```
   http://localhost:3000/reset-password
   https://yourdomain.com/reset-password
   ```

4. **Configure Email Templates** (Optional but Recommended)
   - Go to Authentication → Email Templates
   - Select "Reset Password"
   - Customize the email template if needed
   - Make sure the link points to: `{{ .SiteURL }}/reset-password?token={{ .TokenHash }}`

5. **Save Changes**

## Testing the Fix

### 1. Test Forgot Password Flow
1. Go to `/forgot-password`
2. Enter your email
3. Submit
4. Check your email for reset link

### 2. Test Reset Link
1. Click the link in email
2. Should redirect to `/reset-password` page
3. Enter new password (min 6 characters)
4. Confirm password
5. Submit
6. Should see success message and redirect to login

### 3. Test New Password
1. Login with new password
2. Should work successfully

## Common Issues

### Issue: Still getting 500 error
**Solution**: Make sure you added the redirect URL in Supabase dashboard

### Issue: "Invalid or expired link"
**Solution**: 
- Password reset links expire after a certain time
- Request a new link from `/forgot-password`

### Issue: Email not received
**Solution**:
- Check spam folder
- Verify SMTP settings in Supabase (Authentication → Settings)
- For local development, check Supabase inbucket: http://localhost:54324

### Issue: "Invalid session" after clicking link
**Solution**:
- Clear browser cookies
- Request new reset link
- Check that URL includes proper token parameters

## Email Template Variables

If customizing the email template, use these variables:
- `{{ .SiteURL }}` - Your site URL
- `{{ .TokenHash }}` - The reset token
- `{{ .Email }}` - User's email address
- Full reset URL: `{{ .SiteURL }}/reset-password?token={{ .TokenHash }}&type=recovery`

## Security Notes

- Reset tokens expire (default: 1 hour)
- Tokens are single-use only
- Old password is automatically invalidated
- User session is created after successful reset
- All other sessions for that user remain valid (logout handled client-side)

---

**Status**: ✅ Fix implemented, requires Supabase dashboard configuration
**Date**: February 2, 2026
