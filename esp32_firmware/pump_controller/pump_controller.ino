/*
  AgriWater pump controller – ESP32  (MANUAL + AUTO)
  Needs libraries: ArduinoJson (install from Library Manager). Board: ESP32.
  Wiring: Relay IN -> GPIO 26 (active LOW) | YF-S201 flow sensor signal -> GPIO 27

  MANUAL (app on same Wi-Fi):
    /start?litres=NN   /stop   /status
  AUTO (works even when the owner is far away – no phone/Bluetooth needed):
    /auto?on=1&base=&k=&area=&lat=&lon=&hour=&min=   (saved in flash, sent once by the app)
    /auto?on=0
  Every day at the saved time the ESP32 downloads the weather itself (Open-Meteo, free, no key),
  uses the SAME formula as the app, and waters like a farmer would:
    - rain >= 10 mm or demand < 0.3 mm  -> skip
    - humidity > 85%                    -> water -10%
    - temperature >= 35 C               -> split: half now, half at 18:00
  The pump always stops by itself at the target litres (+ 2 h safety cut-off).
*/
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <time.h>

const char* SSID = "YOUR_WIFI_NAME";
const char* PASS = "YOUR_WIFI_PASSWORD";
const long  GMT_OFFSET_SEC = 19800;          // India (UTC+5:30). Change for your country.

const int RELAY_PIN = 26, FLOW_PIN = 27;
const float PULSES_PER_LITRE = 450.0;        // calibrate with a bucket
const unsigned long MAX_RUN_MS = 2UL*60*60*1000;

WebServer server(80);
Preferences prefs;
volatile unsigned long pulses = 0;
bool running = false;
float targetL = 0, secondL = 0;
unsigned long startedAt = 0;

// auto settings
bool autoOn = false; float aBase=0, aK=1, aArea=1, aLat=0, aLon=0; int aHour=6, aMin=0;
int lastDay = -1, lastSecondDay = -1;

void IRAM_ATTR onPulse(){ pulses++; }
float litres(){ return pulses / PULSES_PER_LITRE; }
void pumpOn(){ digitalWrite(RELAY_PIN, LOW); running = true; }
void pumpOff(){ digitalWrite(RELAY_PIN, HIGH); running = false; }
void startRun(float L){ targetL = L; noInterrupts(); pulses = 0; interrupts(); startedAt = millis(); pumpOn(); }
void cors(){ server.sendHeader("Access-Control-Allow-Origin","*"); }

void sendStatus(){
  cors();
  server.send(200,"application/json","{\"running\":"+String(running?"true":"false")+",\"litres\":"+String(litres(),2)+
    ",\"target\":"+String(targetL,1)+",\"auto\":"+String(autoOn?"true":"false")+"}");
}

// same water formula as the web app
float netMm(float base,float k,float t,float h,float w,float rain){
  float gross = max(0.0f, base*k*(1+0.04f*(t-25))*(1+(50-h)/200.0f)*(1+0.03f*(w-2)));
  return max(0.0f, gross - rain*0.8f);
}

void autoDecideAndRun(){
  WiFiClientSecure c; c.setInsecure(); HTTPClient http;
  String url = "https://api.open-meteo.com/v1/forecast?latitude="+String(aLat,4)+"&longitude="+String(aLon,4)+
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=precipitation_sum&wind_speed_unit=ms&timezone=auto&forecast_days=1";
  if(!http.begin(c,url)) return;
  if(http.GET()!=200){ Serial.println("Weather fetch failed – will retry"); http.end(); lastDay=-1; return; }
  JsonDocument doc; deserializeJson(doc, http.getString()); http.end();
  float t=doc["current"]["temperature_2m"], h=doc["current"]["relative_humidity_2m"],
        w=doc["current"]["wind_speed_10m"], r=doc["daily"]["precipitation_sum"][0];
  float net = netMm(aBase,aK,t,h,w,r);
  float L = net*10000*aArea;
  Serial.printf("AI: %.1fC %.0f%% %.1fm/s rain %.1fmm -> need %.2f mm = %.0f L\n",t,h,w,r,net,L);
  if(r>=10 || net<0.3){ Serial.println("AI: skip today"); return; }
  if(h>85) L*=0.9f;
  if(t>=35){ secondL = L/2; L = L/2; }
  startRun(L);
}

void setup(){
  Serial.begin(115200);
  pinMode(RELAY_PIN,OUTPUT); pumpOff();
  pinMode(FLOW_PIN,INPUT_PULLUP); attachInterrupt(digitalPinToInterrupt(FLOW_PIN),onPulse,FALLING);

  prefs.begin("agri",false);
  autoOn=prefs.getBool("on",false); aBase=prefs.getFloat("base",0); aK=prefs.getFloat("k",1);
  aArea=prefs.getFloat("area",1); aLat=prefs.getFloat("lat",0); aLon=prefs.getFloat("lon",0);
  aHour=prefs.getInt("hour",6); aMin=prefs.getInt("min",0);

  WiFi.begin(SSID,PASS);
  while(WiFi.status()!=WL_CONNECTED){ delay(500); Serial.print("."); }
  Serial.print("\nIP for the app: "); Serial.println(WiFi.localIP());
  configTime(GMT_OFFSET_SEC,0,"pool.ntp.org");

  server.on("/start",[](){ float L=server.arg("litres").toFloat();
    if(L<=0){ cors(); server.send(400,"application/json","{\"error\":\"litres\"}"); return; }
    secondL=0; startRun(L); sendStatus(); });
  server.on("/stop",[](){ pumpOff(); sendStatus(); });
  server.on("/status",sendStatus);
  server.on("/auto",[](){
    autoOn = server.arg("on")=="1";
    prefs.putBool("on",autoOn);
    if(autoOn){
      aBase=server.arg("base").toFloat(); aK=server.arg("k").toFloat(); aArea=server.arg("area").toFloat();
      aLat=server.arg("lat").toFloat(); aLon=server.arg("lon").toFloat();
      aHour=server.arg("hour").toInt(); aMin=server.arg("min").toInt(); lastDay=-1;
      prefs.putFloat("base",aBase); prefs.putFloat("k",aK); prefs.putFloat("area",aArea);
      prefs.putFloat("lat",aLat); prefs.putFloat("lon",aLon); prefs.putInt("hour",aHour); prefs.putInt("min",aMin);
    }
    sendStatus(); });
  server.begin();
}

void loop(){
  server.handleClient();

  if(running){
    if(litres()>=targetL){ pumpOff(); Serial.println("Target reached – pump OFF"); }
    else if(millis()-startedAt>MAX_RUN_MS){ pumpOff(); Serial.println("Safety timeout – pump OFF"); }
  }

  if(autoOn && !running){
    struct tm tm; if(getLocalTime(&tm,10)){
      int today = tm.tm_yday;
      if(lastDay!=today && tm.tm_hour==aHour && tm.tm_min>=aMin){ lastDay=today; autoDecideAndRun(); }
      else if(secondL>0 && lastSecondDay!=today && tm.tm_hour==18){ lastSecondDay=today; float L=secondL; secondL=0; startRun(L); }
    }
  }
}
