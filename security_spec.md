# Security Specification: TITTU Photo Vault

## 1. Data Invariants
1. **Absolute Owner-Isolation**: Media, albums, album_items, and settings live strictly under `/users/{userId}/...` and can only ever be read, created, updated, or deleted by `request.auth.uid == userId`.
2. **Identity Integrity**: `ownerId` in any document must strictly match `request.auth.uid` upon creation, and must be immutable across updates.
3. **Storage & Verification Immutability**: Critical cloud integrity fields (`storagePath`, `fileSize`, `checksum`, `uploadedAt`, `id`) cannot be altered or spoofed after creation.
4. **Length & Type Guarding**: All document IDs, strings, numbers, and boolean values must pass strict bounds checks (`isValidId`, size constraints, enum constraints).
5. **No Blanket Reads**: All read and list operations require authenticated matching `request.auth.uid == userId`.

## 2. Dirty Dozen Payloads (Targeting Exploits)
1. **Cross-User Injection**: User A attempts to write to `/users/userB/media/photo1` with `ownerId: "userB"`. (Blocked by path userId == request.auth.uid check).
2. **Owner Spoofing**: User A writes to `/users/userA/media/photo1` with `ownerId: "userB"`. (Blocked by `incoming().ownerId == request.auth.uid`).
3. **Id Poisoning**: Attacker passes 500-char path ID with malicious characters. (Blocked by `isValidId()`).
4. **Shadow Field Injection**: Attacker injects extra field `isAdmin: true` or `bypassed: true`. (Blocked by strict key set and `hasOnly` checks).
5. **Storage Path Hijack**: User A updates `storagePath` of existing item to point to another user's cloud file. (Blocked by immutable `storagePath` check on update).
6. **Checksum Falsification**: User A updates `checksum` or `fileSize` on existing item to hide corrupted upload. (Blocked by immutability check).
7. **Size Bombing**: Attacker sends a 100,000-character string in `caption` or `fileName`. (Blocked by `caption.size() <= 500` and `fileName.size() <= 256`).
8. **Invalid Media Type**: Attacker sends `mediaType: "executable"` or `mediaType: "script"`. (Blocked by `mediaType in ['photo', 'video']`).
9. **Negative or Fraudulent File Size**: Attacker sends `fileSize: -500` or non-number. (Blocked by `fileSize is number && fileSize > 0`).
10. **State Shortcut on Album Deletion**: Deleting someone else's album mapping. (Blocked by `request.auth.uid == userId`).
11. **Unauthenticated Probe**: Anonymous or unauthenticated HTTP client reads `/users/userA/media`. (Blocked by `request.auth != null`).
12. **Malicious Setting Modification**: User B writes to `/users/userA/settings/config`. (Blocked by `userId == request.auth.uid`).
