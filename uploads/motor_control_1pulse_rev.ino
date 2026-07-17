/*
  MOTOR SPEED CONTROL + RPM MONITORING
  Updated for 1 PULSE PER REVOLUTION disk (half blocked, half open).

  Since there's only 1 pulse per revolution, RPM is calculated from the
  TIME BETWEEN consecutive pulses, not by counting pulses in a fixed window.
  This gives accurate readings at both low and high RPM.

  Wiring:
    IBT-2 RPWM -> D9
    IBT-2 LPWM -> D3   (unused, tied LOW - unidirectional)
    IBT-2 L_EN -> D4
    IBT-2 R_EN -> D5
    IBT-2 VCC  -> Arduino 5V
    IBT-2 GND  -> Arduino GND
    IBT-2 B+/B- -> external motor power supply
    IBT-2 M+/M- -> motor

    IR sensor OUT -> D8
    IR sensor VCC -> Arduino 5V
    IR sensor GND -> Arduino GND

  Serial commands (115200 baud):
    P<value>   set PWM directly, 0-255, e.g. P120
    S          stop motor (PWM = 0)
*/

// ---------- Motor pins ----------
const uint8_t PIN_RPWM = 9;
const uint8_t PIN_LPWM = 3;
const uint8_t PIN_L_EN = 4;
const uint8_t PIN_R_EN = 5;

// ---------- IR sensor ----------
const uint8_t PIN_IR = 8;
const uint16_t SLOTS_PER_REV = 1;   // <-- updated: single open/close per revolution

// ---------- Timing-based pulse capture ----------
volatile unsigned long lastPulseMicros = 0;
volatile unsigned long pulsePeriodMicros = 0;   // time between last two pulses
volatile bool newPulseFlag = false;
volatile unsigned long lastPulseMillis = 0;     // for timeout check (millis space)
volatile uint8_t lastIrState = HIGH;

ISR(PCINT0_vect) {
  uint8_t state = digitalRead(PIN_IR);
  if (lastIrState == HIGH && state == LOW) {
    unsigned long now = micros();
    pulsePeriodMicros = now - lastPulseMicros;
    lastPulseMicros = now;
    lastPulseMillis = millis();
    newPulseFlag = true;
  }
  lastIrState = state;
}

void setupPCINT() {
  PCICR  |= (1 << PCIE0);
  PCMSK0 |= (1 << PCINT0);
}

// ---------- State ----------
int currentPWM = 0;
float currentRPM = 0;

const unsigned long RPM_TIMEOUT_MS = 1000; // if no pulse for 1s, assume stopped -> RPM = 0
const unsigned long PRINT_INTERVAL_MS = 200;
unsigned long lastPrintTime = 0;

void setup() {
  Serial.begin(115200);

  pinMode(PIN_RPWM, OUTPUT);
  pinMode(PIN_LPWM, OUTPUT);
  pinMode(PIN_L_EN, OUTPUT);
  pinMode(PIN_R_EN, OUTPUT);

  digitalWrite(PIN_L_EN, HIGH);
  digitalWrite(PIN_R_EN, HIGH);
  digitalWrite(PIN_LPWM, LOW);
  analogWrite(PIN_RPWM, 0);

  pinMode(PIN_IR, INPUT_PULLUP);   // switch to plain INPUT if you added an external pull-up resistor
  lastIrState = digitalRead(PIN_IR);
  setupPCINT();

  lastPrintTime = millis();

  Serial.println("Motor + RPM monitor ready (1 pulse/rev mode).");
  Serial.println("Send: P<value>  (0-255) to set speed, e.g. P120");
  Serial.println("Send: S to stop");
}

void loop() {
  handleSerialInput();
  updateRPM();

  if (millis() - lastPrintTime >= PRINT_INTERVAL_MS) {
    lastPrintTime = millis();
    Serial.print("PWM: ");
    Serial.print(currentPWM);
    Serial.print(" | RPM: ");
    Serial.println(currentRPM);
  }
}

void updateRPM() {
  noInterrupts();
  unsigned long period = pulsePeriodMicros;
  unsigned long lastPulseMs = lastPulseMillis;
  bool gotNew = newPulseFlag;
  newPulseFlag = false;
  interrupts();

  // If too long since last pulse, motor is stopped or too slow -> report 0
  if (lastPulseMs == 0 || (millis() - lastPulseMs) > RPM_TIMEOUT_MS) {
    currentRPM = 0;
    return;
  }

  if (gotNew && period > 0) {
    // period is microseconds per revolution (1 pulse = 1 rev now)
    currentRPM = 60000000.0 / (float)period;
  }
}

void handleSerialInput() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd.length() == 0) return;

    if (cmd.equalsIgnoreCase("S")) {
      currentPWM = 0;
      analogWrite(PIN_RPWM, currentPWM);
      Serial.println("Motor stopped.");
    }
    else if (cmd.startsWith("P") || cmd.startsWith("p")) {
      int val = cmd.substring(1).toInt();
      val = constrain(val, 0, 255);
      currentPWM = val;
      analogWrite(PIN_RPWM, currentPWM);
      Serial.print("PWM set to: ");
      Serial.println(currentPWM);
    }
    else {
      Serial.println("Unknown command. Use P<value> or S.");
    }
  }
}
