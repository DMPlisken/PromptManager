# Bug Registry

## BUG-001: Sessions page blank — TypeError on undefined substring
- **Symptom**: Sessions page at `/sessions` renders completely blank (no sidebar, no content). Console shows `TypeError: Cannot read properties of undefined (reading 'substring')`.
- **Root cause**: `s.initialPrompt.substring(0, 60)` in the sidebar session list crashes when `initialPrompt` is undefined/null (e.g., sessions loaded from API with missing field). Similarly `s.id.substring()` could crash if session ID is undefined.
- **Fix**: Added null guards: `(s.initialPrompt ?? "").substring(...)` and `(s.id ? s.id.substring(...) : "Session")` in both the tab bar and sidebar list.
- **Affected files**: `services/frontend/src/pages/SessionsPage.tsx`
- **Date**: 2026-04-05

## BUG-002: Test output shows "(no output received)" despite messages existing
- **Symptom**: Machine test passes (green checkmark, status: completed, Messages: 5) but output area shows "(no output received)".
- **Root cause**: Backend test endpoint in `test_machine()` only extracted text from `msg.content`, but Claude's stream-json output stores actual response text in `msg.metadata_json` (content field can be empty for some message types).
- **Fix**: Updated output extraction to also parse `metadata_json` — checks for direct text field, nested `message.content` array (Claude stream-json format), top-level `content` array, and `result` field.
- **Affected files**: `services/backend/app/routers/machines.py`
- **Date**: 2026-04-05

## BUG-003: Setup wizard creates stale pairing records when cancelled
- **Symptom**: Clicking through the setup wizard and cancelling leaves a "Pending" machine record in the database with status "pairing".
- **Root cause**: `generate_pairing_code` endpoint creates a placeholder Machine record, but if the user cancels the wizard, no cleanup occurs.
- **Fix**: (1) Added `machine_id` to `PairingCodeResponse` schema so frontend receives the placeholder record's ID. (2) Added `handleCancel` callback in `SetupWizard` that calls `DELETE /api/machines/{id}` on the pending record before closing. All Cancel buttons and overlay click now use `handleCancel`.
- **Affected files**: `services/backend/app/schemas/machine.py`, `services/backend/app/routers/machines.py`, `services/frontend/src/types/machine.ts`, `services/frontend/src/components/machines/SetupWizard.tsx`
- **Date**: 2026-04-05

## BUG-004: MachineCard crashes on undefined machine_uuid.substring
- **Symptom**: MachineCard crashes when rendering a machine in "pairing" status if `machine_uuid` is null/undefined.
- **Root cause**: `machine.machine_uuid.substring(0, 6).toUpperCase()` called without null check.
- **Fix**: Changed to `(machine.machine_uuid ?? "").substring(0, 6).toUpperCase()`.
- **Affected files**: `services/frontend/src/components/machines/MachineCard.tsx`
- **Date**: 2026-04-05
