#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";
// NOTE: Change this placeholder URL to your actual live backend address during integration!
const String serverUrl = "https://abcd-1234.ngrok-free.app/api/device-update";

// Left-side hardware input tracking pin alignment
const int PINS[] = {25, 26, 27, 14, 12}; 
const String NAMES[] = {"Light 1", "Light 2", "Light 3", "Fan 1", "Fan 2"};
bool lastStates[] = {false, false, false, false, false};

// INSTANT INSTRUMENT VALUES: Power allocation metrics per device type
const float POWER_VALUES[] = {15.0, 15.0, 15.0, 60.0, 60.0}; // Lights = 15W, Fans = 60W

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  Serial.begin(115200);
  
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Office Syncing...");

  for(int i = 0; i < 5; i++) {
    pinMode(PINS[i], INPUT_PULLDOWN); // Keeps line clean when switches are toggled off
  }

  WiFi.begin(ssid, password);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Booted!");
  delay(1000);
}

void loop() {
  // --- SECTION A: INSTANTANEOUS LOCAL DISPLAY ENGINE ---
  float totalCalculatedWatts = 0.0;
  int activeCount = 0;

  // Scan switch arrays to compute cumulative power metrics instantly
  for(int i = 0; i < 5; i++) {
    if(digitalRead(PINS[i]) == HIGH) {
      activeCount++;
      totalCalculatedWatts += POWER_VALUES[i];
    }
  }

  // Print results to the display monitor with zero latency
  lcd.setCursor(0, 0);
  lcd.print("Power: " + String(totalCalculatedWatts, 1) + " W   ");
  
  lcd.setCursor(0, 1);
  lcd.print("Active Devs: " + String(activeCount) + "/5 ");

  // --- SECTION B: LOW-LATENCY CLOUD METRICS DISPATCH ---
  if (WiFi.status() == WL_CONNECTED) {
    for(int i = 0; i < 5; i++) {
      bool currentState = digitalRead(PINS[i]);
      
      if(currentState != lastStates[i]) {
        lastStates[i] = currentState;
        
        String jsonPayload = "{\"room\":\"Drawing Room\",\"device\":\"" + NAMES[i] + "\",\"status\":\"" + String(currentState ? "on" : "off") + "\",\"room_power_watts\":" + String(totalCalculatedWatts) + "}";
        
        Serial.println("Cloud Dispatch: " + jsonPayload);
        
        HTTPClient http;
        
        // Strict network constraints force immediate execution recovery
        http.setConnectTimeout(100); 
        http.setTimeout(100);        
        
        http.begin(serverUrl);
        http.addHeader("Content-Type", "application/json");
        
        int httpResponseCode = http.POST(jsonPayload);
        http.end();
      }
    }
  }

  delay(50); // Fluid 50ms display scanning cycles
}