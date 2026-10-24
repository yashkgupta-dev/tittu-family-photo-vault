-- ==============================================================================
-- TITTU PHOTO VAULT: SUPABASE STORAGE ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Object Path Schema in TITTU:
--   users/<userId>/media/<mediaId>_<cleanFileName>
--
-- Note on folder extraction:
--   (storage.foldername(name))[1] is 'users'
--   (storage.foldername(name))[2] is '<userId>'
--   (storage.foldername(name))[3] is 'media'
--
-- WARNING: Do NOT assume the first folder is user_id. The first folder is 'users'!
-- ==============================================================================

-- 1. Ensure Row Level Security is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Ensure bucket is 100% private (never public)
UPDATE storage.buckets
SET public = false
WHERE id = 'Family photo' OR name = 'Family photo';

-- 3. Clean up any existing legacy or overly permissive policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow All" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Individual User Access" ON storage.objects;
DROP POLICY IF EXISTS "TITTU Owner Read" ON storage.objects;
DROP POLICY IF EXISTS "TITTU Owner Insert" ON storage.objects;
DROP POLICY IF EXISTS "TITTU Owner Update" ON storage.objects;
DROP POLICY IF EXISTS "TITTU Owner Delete" ON storage.objects;
DROP POLICY IF EXISTS "TITTU Authenticated Read" ON storage.objects;
DROP POLICY IF EXISTS "TITTU Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "TITTU Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "TITTU Authenticated Delete" ON storage.objects;

-- 4. LEAST-PRIVILEGE POLICIES

-- Policy 1: SELECT (Read / Download / List / View)
-- Grants read access ONLY to the owner whose authenticated UID matches segment 2 of the path
CREATE POLICY "TITTU Authenticated Read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'Family photo'
  AND (storage.foldername(name))[1] = 'users'
  AND (
    (storage.foldername(name))[2] = (auth.jwt() ->> 'sub')
    OR (storage.foldername(name))[2] = (auth.jwt() ->> 'user_id')
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- Policy 2: INSERT (Upload new photos)
-- Allows uploads ONLY into the user's own folder users/<userId>/media/
CREATE POLICY "TITTU Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Family photo'
  AND (storage.foldername(name))[1] = 'users'
  AND (
    (storage.foldername(name))[2] = (auth.jwt() ->> 'sub')
    OR (storage.foldername(name))[2] = (auth.jwt() ->> 'user_id')
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- Policy 3: UPDATE (Overwrite / Update existing photos)
-- Allows updates ONLY to objects inside the user's own folder
CREATE POLICY "TITTU Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'Family photo'
  AND (storage.foldername(name))[1] = 'users'
  AND (
    (storage.foldername(name))[2] = (auth.jwt() ->> 'sub')
    OR (storage.foldername(name))[2] = (auth.jwt() ->> 'user_id')
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'Family photo'
  AND (storage.foldername(name))[1] = 'users'
  AND (
    (storage.foldername(name))[2] = (auth.jwt() ->> 'sub')
    OR (storage.foldername(name))[2] = (auth.jwt() ->> 'user_id')
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- Policy 4: DELETE (Permanent removal)
-- Allows deletion ONLY by the owner of the object
CREATE POLICY "TITTU Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'Family photo'
  AND (storage.foldername(name))[1] = 'users'
  AND (
    (storage.foldername(name))[2] = (auth.jwt() ->> 'sub')
    OR (storage.foldername(name))[2] = (auth.jwt() ->> 'user_id')
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);
