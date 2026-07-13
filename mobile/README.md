# Trip Expenses Guide — iOS app (React Native / Expo)

Native version of the web app. Same screens, same dark theme, and it syncs with
the web app in real time: trips created on the website work in the app and
vice-versa (same 6-letter codes).

## Run it on your iPhone (free, no Mac needed)

**One-time setup on your PC:**
1. Install Node.js LTS from https://nodejs.org
2. Open a terminal (PowerShell) and run:

```
npx create-expo-app@latest TripExpensesGuide --template blank
cd TripExpensesGuide
npm install gun @react-native-async-storage/async-storage
```

3. Replace the generated `App.js` with the `App.js` from this folder.
4. Optional: copy `icon.png` from this folder over `assets/icon.png`, and in
   `app.json` set `"name": "Trip Expenses Guide"`.

**Run:**
```
npx expo start
```

**On your iPhone:**
1. Install **Expo Go** from the App Store.
2. Make sure the iPhone and PC are on the same Wi-Fi.
3. Scan the QR code shown in the terminal with the iPhone camera.

The app opens live on your phone. Edits to App.js reload instantly.

## Notes

- **Live sync**: same relay network and trip codes as the web app.
- **Delete an expense**: long-press it.
- **AI money coach**: the free in-browser AI (Puter) only works on the web, so
  the app ships built-in country saving tips plus a button that opens the full
  AI coach in the web app.
- **App Store**: when you want a real App Store listing you need an Apple
  Developer account ($99/year), then run `npx eas build --platform ios` and
  `npx eas submit`. Expo's cloud does the building — still no Mac needed.
