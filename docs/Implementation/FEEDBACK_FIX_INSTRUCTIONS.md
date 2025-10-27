# Feedback Feature - Storage Fix Instructions

**For Lovable AI Assistant**  
**Priority**: High - Fixes accessibility issues with uploaded feedback attachments

---

## 🎯 What This Fixes

**Problem 1**: Can't access uploaded images/screenshots via Supabase dashboard  
**Problem 2**: Hard to see which attachments belong to which feedback

**Solution**: Make storage public + add direct URLs to attachment records

---

## ✅ Step 1: Make Storage Bucket Public

Run this in **Supabase SQL Editor**:

```sql
UPDATE storage.buckets 
SET public = true 
WHERE id = 'feedback-attachments';
```

**Why?** This allows the uploaded files to be accessible via public URLs.

---

## ✅ Step 2: Add Storage URL Column

Run this in **Supabase SQL Editor**:

```sql
ALTER TABLE feedback_attachments 
ADD COLUMN storage_url text;

COMMENT ON COLUMN feedback_attachments.storage_url IS 'Public URL to access the uploaded file';
```

**Why?** Stores the direct URL for each attachment, making them easy to view.

---

## ✅ Step 3: Code Already Updated

The following file has already been updated:
- ✅ `src/components/views/FeedbackView.tsx`

The upload logic now automatically saves the `storage_url` when a file is uploaded.

---

## 🧪 How to Test

1. Go to feedback form in the app
2. Submit feedback with an image attachment
3. Open **Supabase** → **Table Editor** → **feedback_attachments**
4. You should see a `storage_url` column with a clickable URL
5. Click the URL - the image should open in a new tab

---

## 📊 Useful Queries After Fix

**View all feedback with attachments:**
```sql
SELECT 
  f.id,
  f.feedback_type,
  f.feedback_text,
  f.created_at,
  f.user_email,
  COALESCE(
    json_agg(
      json_build_object(
        'file_name', fa.file_name,
        'storage_url', fa.storage_url,
        'file_size', fa.file_size
      )
    ) FILTER (WHERE fa.id IS NOT NULL),
    '[]'
  ) as attachments
FROM feedback f
LEFT JOIN feedback_attachments fa ON f.id = fa.feedback_id
GROUP BY f.id
ORDER BY f.created_at DESC;
```

**View all attachments with context:**
```sql
SELECT 
  fa.file_name,
  fa.storage_url,
  fa.created_at as uploaded_at,
  f.feedback_type,
  f.feedback_text,
  f.user_email
FROM feedback_attachments fa
JOIN feedback f ON fa.feedback_id = f.id
ORDER BY fa.created_at DESC;
```

---

## ✨ Benefits

- ✅ Click URLs directly in Supabase to view screenshots
- ✅ No manual URL construction needed
- ✅ Easier debugging when users report upload issues
- ✅ Better feedback review workflow
- ✅ Visual context for bug reports

---

## 📋 Summary

**Execute in Supabase:**
1. Run SQL to make bucket public
2. Run SQL to add storage_url column

**Code:**
- Already updated ✅

**Test:**
- Submit feedback with image
- Verify URL appears in feedback_attachments table
- Click URL to view image

Done! 🎉
