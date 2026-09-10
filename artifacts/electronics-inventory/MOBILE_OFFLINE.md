# Offline + Android build

The inventory app is designed to work offline after its first successful load. Product data, purchases, sales and stock history are stored locally with `localStorage`; the service worker caches the application shell and product images as they are viewed.

## Install as an app

On Android Chrome, open the deployed app and use **Add to Home screen / Install app**. The manifest is configured for standalone display and the service worker provides offline navigation.

## Build a real APK with Capacitor

The repository includes `capacitor.config.ts` with the Android app id `com.keystone.electronicsinventory`.

From `artifacts/electronics-inventory`:

```bash
pnpm add @capacitor/core @capacitor/android
pnpm add -D @capacitor/cli
pnpm build
npx cap add android
npx cap sync android
npx cap open android
```

Then build the APK from Android Studio. The Capacitor app bundles `dist/public`, so the inventory UI itself does not require a server at runtime.

## Offline image note

The catalog currently uses real product photography from the configured image URLs. Those images are cached by the service worker after they are fetched, so previously viewed products remain available offline. If a completely fresh APK must contain every product image before the first network connection, the next step is to move the catalog photography into `public/products/` and point the seed data at those local assets.
