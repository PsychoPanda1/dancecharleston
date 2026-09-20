# DanceCharleston digital invite

The public `/go/` entry point is for reusable NFC cards, Wallet passes and a saved phone QR. The Share button always sends the pinned `/go/friday-sep-25-2026/` invitation. Changing the featured selection never retargets an earlier event invitation or the existing printed QR.

## Event maintenance

`go/featured.json` selects a calendar UID and presentation copy. Builds match the public calendar UID to current event data. Missing, cancelled or past events show a status and do not offer an ICS download. Keep each invitation record after its event ends so its permalink remains available. Do not reuse an invitation ID for a different event. Add artwork and run `scripts/make-invite-qr.py` when adding an invitation. The regular site build creates HTML and calendar downloads. After changing schedules, also review the presentation copy for lesson/dance times and price against the organizer.

## NFC

Write one NDEF URL record containing `https://dancecharleston.com/go/` to a standard NFC card/tag with NFC Tools. Test on an iPhone and Android before locking the tag. The QR asset `go/qr.svg` is the camera fallback. NFC does not automatically exchange personal contact information. Programming requires a physical NFC tag and compatible phone; it cannot be completed from this desktop alone.

## Apple Wallet

Native passes require an Apple Pass Type ID, Apple team identifier and signing certificate/private key. No credentials were found or provisioned in this task. Create a generic pass using the reusable URL as a QR barcode, label it DanceCharleston and describe it as a community link, not a paid admission ticket. Sign outside the public repository using an established pass signer. Publish the signed `.pkpass` as a static downloadable artifact and set `wallet.apple` in the configuration to its HTTPS URL. Private keys/certificates must never be committed. Confirm the production server serves an appropriate pass MIME type and test installation on iPhone before enabling.

## Google Wallet

Requires a Google Wallet issuer account with publishing access and a service account authorized for that issuer. Create a Generic Class and Generic Object, with the reusable URL in its QR barcode and no ticket/admission entitlement. Sign a Save to Google Wallet JWT server-side and set `wallet.google` to the resulting `https://pay.google.com/gp/v/save/...` link. Do not ship private keys in client JS. Test outside demo users before enabling. Links are hidden until configured; the Home Screen and downloadable PNG remain fully usable.

## Release

Run `pnpm test`, `pnpm build`, `pnpm validate`; review `/go/` and its pinned invitation at phone and desktop sizes. Verify both QR targets, the native share/copy fallback, directions, calendar file, phone image download, expired states and keyboard dialog closing. This repository had pre-existing uncommitted site changes when this feature was built; review those separately before publishing any combined release.
