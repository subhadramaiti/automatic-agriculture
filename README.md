# Automatic Agriculture – Smart Crop Water Advisor + Auto Pump

## Folder
- website/            -> index.html, style.css, script.js  (open index.html in Chrome; works on laptop and phone)
- esp32_firmware/     -> pump_controller/pump_controller.ino (upload with Arduino IDE)

## Use the website (no hardware)
1. Open the [deployed site](https://subhadramaiti.github.io/automatic-agriculture/) or website/index.html.
2. Tap a crop (Rice, Corn, Grapes, Potato, Olive, Tomato...) -> see water needed for the weather.
3. Pump Control -> Manual: set litres, Start. Pump stops automatically at the target.
4. Pump Control -> Auto (AI): one click. Weather is analysed and the plan is run automatically.
   Mode "Simulation" = demo (1 day = 20 s). Mode "Real pump - ESP32" = real hardware.

The hosted GitHub Pages site uses HTTPS, so browsers block its connection to an ESP32 over local-network HTTP. Use a local copy of the site on the same Wi-Fi for real pump control; the simulation works on the hosted site.

## Real hardware
Parts: ESP32, relay module (GPIO 26), YF-S201 flow sensor (GPIO 27), pump power supply.
1. Arduino IDE -> install the ArduinoJson library.
2. Open pump_controller.ino, set SSID, PASS and GMT_OFFSET_SEC, upload.
3. Serial Monitor shows the ESP32 IP. Type it in the app (ESP32 IP address box).
4. Open website/index.html from your computer/phone on the same Wi-Fi, choose "Real pump - ESP32",
   tap a crop, press Enable Auto once. The ESP32 then works alone every day, even if you are far away.

## Safety
- Pump stops at the target litres by itself, plus a 2-hour cut-off.
- Calibrate PULSES_PER_LITRE with a bucket. If the relay is active-HIGH, swap LOW/HIGH in pumpOn/pumpOff.
- Crop water values are typical approximations; adjust the CROPS list for your area.
