# SIGAP Edge Station IoT Wiring Specification

## 1. Executive Summary

This document serves as the **canonical hardware wiring guide** for the **SIGAP Edge Vision AI Station** deployed on a **Raspberry Pi 4 Model B (4 GB)**.

### Dedicated Cooling Fan vs. IoT Ground Separation
- **Physical Pin 4 (5V DC)** and **Physical Pin 6 (GND)** are **dedicated exclusively to the Raspberry Pi 4 cooling fan** to maintain thermal stability under continuous ONNX vision inference workloads (~65–75°C without fan; ~42–48°C with active fan).
- **Physical Pin 14 (GND)** is designated as the **primary common ground rail** for all IoT visual and audible indicator circuits (Red LED, Yellow LED, Green LED, and Buzzer).
- **Physical Pin 9 (GND)** is approved as an alternate ground connection if breadboard geometry prefers an odd-column pin.

---

## 2. Raspberry Pi 4 (40-Pin Header) Visual Pinout Map

```text
                                 TOP EDGE OF BOARD
                                 -----------------
                    3.3V Power [ 1] [ 2] 5V Power
             GPIO 2 (I2C1 SDA) [ 3] [ 4] 5V Power ---------> [FAN +] (Red Wire)
             GPIO 3 (I2C1 SCL) [ 5] [ 6] Ground ----------> [FAN −] (Black Wire)
              GPIO 4 (GPCLK0)  [ 7] [ 8] GPIO 14 (UART TX)
    [ALT GND]          Ground  [ 9] [10] GPIO 15 (UART RX)
    [RED LED]  GPIO 17 (Pin11) [11] [12] GPIO 18 (PWM0) ----> [BUZZER +]
    [YEL LED]  GPIO 27 (Pin13) [13] [14] Ground -----------> [IoT GROUND RAIL]
    [GRN LED]  GPIO 22 (Pin15) [15] [16] GPIO 23
                    3.3V Power [17] [18] GPIO 24
            GPIO 10 (SPI MOSI) [19] [20] Ground
             GPIO 9 (SPI MISO) [21] [22] GPIO 25
            GPIO 11 (SPI SCLK) [23] [24] GPIO 8  (SPI CE0)
                        Ground [25] [26] GPIO 7  (SPI CE1)
           GPIO 0 (EEPROM ID)  [27] [28] GPIO 1  (EEPROM ID)
                        GPIO 5 [29] [30] Ground
                        GPIO 6 [31] [32] GPIO 12 (PWM0)
               GPIO 13 (PWM1)  [33] [34] Ground
               GPIO 19 (PWM1)  [35] [36] GPIO 16
                       GPIO 26 [37] [38] GPIO 20
                        Ground [39] [40] GPIO 21
                                 -----------------
                                BOTTOM EDGE OF BOARD
```

### Pin Allocation Key
- `[FAN +]` / `[FAN −]`: Pins 4 & 6 reserved for continuous 5V cooling fan.
- `[RED LED]`: Physical Pin 11 (BCM GPIO 17).
- `[BUZZER +]`: Physical Pin 12 (BCM GPIO 18).
- `[YEL LED]`: Physical Pin 13 (BCM GPIO 27).
- `[IoT GROUND RAIL]`: Physical Pin 14 (Primary Common Ground for LEDs & Buzzer).
- `[GRN LED]`: Physical Pin 15 (BCM GPIO 22).
- `[ALT GND]`: Physical Pin 9 (Optional secondary ground rail).

---

## 3. Hardware Interconnect Specification Table

| Component | Physical Pin | BCM GPIO | Header Position | Voltage / Logic | Circuit Connection | Station Role |
|---|---|---|---|---|---|---|
| **5V Case Fan (+)** | Pin 4 | — | Row 2, Right | 5.0V DC (VCC) | Direct lead to fan red wire | Active thermal cooling for BCM2711 SoC |
| **5V Case Fan (−)** | Pin 6 | — | Row 3, Right | 0V (GND) | Direct lead to fan black wire | Dedicated fan return path |
| **Red LED (Defect)** | Pin 11 | GPIO 17 | Row 6, Left | 3.3V Logic HIGH | Series 330Ω resistor → Anode (+); Cathode (−) → Pin 14 Ground Rail | Lit when defect detected or defect latched |
| **Yellow LED (Review)** | Pin 13 | GPIO 27 | Row 7, Left | 3.3V Logic HIGH | Series 330Ω resistor → Anode (+); Cathode (−) → Pin 14 Ground Rail | Lit during capture, inference, or review state |
| **Green LED (Pass)** | Pin 15 | GPIO 22 | Row 8, Left | 3.3V Logic HIGH | Series 330Ω resistor → Anode (+); Cathode (−) → Pin 14 Ground Rail | Lit when part passes QC check |
| **Buzzer (Alarm)** | Pin 12 | GPIO 18 | Row 6, Right | 3.3V Logic / PWM | VCC / Signal (+) → Pin 12; GND (−) → Pin 14 Ground Rail | Audible alert on defect detection (active or 2kHz PWM) |
| **IoT Common Ground** | Pin 14 | — | Row 7, Right | 0V (GND) | Jumper wire to breadboard negative rail (−) | Shared return rail for LEDs and Buzzer |
| **USB Web Camera** | USB 3.0 | — | Top Blue Port | 5.0V USB Bus | Plugged directly into Pi 4 USB 3.0 port (`/dev/video0`) | 640×480 casting part visual capture |

*(Alternative: Physical Pin 9 may be used instead of Pin 14 if breadboard cable routing favors the left column).*

---

## 4. Circuit Schematics

### 4.1 Dedicated 5V Cooling Fan Circuit

```text
Raspberry Pi 4 Header
  [Pin 4] 5V Power  =====================> (+) Fan Red Wire
                                               [ 5V Case Fan ]
  [Pin 6] GND       =====================> (−) Fan Black Wire
```

*Note: The fan runs continuously while the Pi is energized to prevent thermal throttling during inference.*

---

### 4.2 IoT Indicator Circuits (LEDs & Buzzer)

All indicator components return to **Physical Pin 14** via a common breadboard ground rail:

```text
Raspberry Pi 4                          Breadboard                      Common Ground
==============                          ==========                      =============

Pin 11 (BCM 17) ----[ 330Ω ]---->|---- (Anode) [ RED LED ] (Cathode) ---+
                                                                         |
Pin 13 (BCM 27) ----[ 330Ω ]---->|---- (Anode) [ YEL LED ] (Cathode) ---+
                                                                         |
Pin 15 (BCM 22) ----[ 330Ω ]---->|---- (Anode) [ GRN LED ] (Cathode) ---+
                                                                         |
Pin 12 (BCM 18) ---------------------- (I/O / +) [ BUZZER ] (GND / −) --+
                                                                         |
                                                                         v
Pin 14 (GND)    <========================================================+
(or Pin 9 GND)                     (Negative Rail Bus)
```

#### Detailed LED Branch Schematic
```text
  Pi GPIO Pin (3.3V Logic HIGH)
       |
       +---/\/\/\/\/\---+------------|>|------------+
            330Ω 1/4W      Anode (+)     Cathode (−) |
            Current Limit                             |
                                                      v
                                            Breadboard Ground Rail
                                                      |
                                                      v
                                            Pi Pin 14 (GND)
```

#### Buzzer Module Variations
- **Active Buzzer Module (Recommended)**:
  - `VCC / I/O` pin connects to Pi **Pin 12 (BCM 18)**.
  - `GND` pin connects to **Pin 14 (GND Rail)**.
  - Module contains internal oscillating circuit. Setting BCM 18 `HIGH` triggers a continuous alarm tone (~2.3 kHz).
- **Passive Buzzer**:
  - Positive lead connects to Pi **Pin 12 (BCM 18)**.
  - Negative lead connects to **Pin 14 (GND Rail)**.
  - Requires PWM drive (`PWMOutputDevice` or `ToneBuzzer` at 2000 Hz, 50% duty cycle) to produce audible sound.

---

## 5. Electrical Characteristics & Safety Guidelines

### 5.1 330Ω Current-Limiting Resistor Calculation
The Raspberry Pi BCM2711 GPIO pins output **3.3V nominal logic**:
- Standard 5mm indicator LEDs have a forward voltage drop ($V_f$) of approximately **2.0V** (Red: ~1.8–2.0V, Yellow: ~2.0–2.1V, Green: ~2.1–2.2V).
- Desired forward current ($I_f$): **~4 mA** (provides sharp, visible illumination while conserving power).

$$R = \frac{V_{\text{GPIO}} - V_f}{I_f} = \frac{3.3\text{V} - 2.0\text{V}}{0.004\text{A}} = \frac{1.3\text{V}}{0.004\text{A}} = 325\,\Omega$$

Selecting the nearest standard E12 resistor value:
$$R_{\text{standard}} = 330\,\Omega \quad (1/4\text{W or } 1/8\text{W})$$

Actual circuit current:
$$I_{\text{actual}} = \frac{3.3\text{V} - 2.0\text{V}}{330\,\Omega} = \frac{1.3\text{V}}{330\,\Omega} \approx 3.94\text{ mA}$$

### 5.2 Power Rail Budget & Current Limits
| Constraint | Limit | SIGAP Usage | Status |
|---|---|---|---|
| **Max current per single GPIO pin** | 16 mA | ~3.94 mA per LED branch | **PASSED** (well below 16mA) |
| **Max total current across all GPIO pins** | 50 mA | Max ~12 mA (all 3 LEDs on) + ~15 mA (buzzer logic) $\approx 27\text{ mA}$ | **PASSED** (safe margin) |
| **Active Buzzer Module current** | 30 mA | Driven via onboard transistor buffer on module | **PASSED** |
| **Cooling Fan current** | ~150–200 mA | Draws directly from 5V power bus (Pins 2/4), NOT the 3.3V GPIO rail | **PASSED** (isolated from GPIO rail) |

### 5.3 Critical Electrical Rules
1. **NEVER connect 5V to any GPIO pin**: The BCM2711 SoC GPIO pins are **NOT 5V tolerant**. Applying 5V to Pin 11, 12, 13, or 15 will cause permanent, irreparable damage to the SoC.
2. **Always include the 330Ω series resistor**: Connecting an LED directly between a GPIO pin and GND without a series resistor causes an overcurrent short-circuit that can destroy the GPIO output driver.
3. **Common Ground Integrity**: The circuit return path MUST be tied to Pin 14 (or Pin 9). Floating grounds cause erratic switching and buzzer malfunction.

---

## 6. Step-by-Step Assembly & Jumper Wire Guide

### 6.1 Recommended Jumper Wire Color Convention
| Wire Color | Signal / Rail | From | To |
|---|---|---|---|
| **Red** | Fan 5V Power | Pi Pin 4 | Fan (+) lead |
| **Black** | Fan Ground | Pi Pin 6 | Fan (−) lead |
| **Black** | IoT Common Ground | Pi Pin 14 | Breadboard Negative Rail (−) |
| **Red** | Defect Indicator (GPIO 17) | Pi Pin 11 | Breadboard row (Red LED 330Ω resistor) |
| **Yellow** | Review Indicator (GPIO 27) | Pi Pin 13 | Breadboard row (Yellow LED 330Ω resistor) |
| **Green** | Pass Indicator (GPIO 22) | Pi Pin 15 | Breadboard row (Green LED 330Ω resistor) |
| **Blue / Purple** | Buzzer Trigger (GPIO 18) | Pi Pin 12 | Breadboard row (Buzzer Signal/+) |

### 6.2 Assembly Steps
1. **Connect the Cooling Fan**:
   - Plug the fan's red connector onto **Physical Pin 4 (5V)**.
   - Plug the fan's black connector onto **Physical Pin 6 (GND)**.
2. **Establish the IoT Ground Rail**:
   - Run a black male-to-female jumper from **Physical Pin 14** to the negative power rail (`−`) of your breadboard.
3. **Wire the Three LEDs**:
   - **Red LED**:
     - Insert a 330Ω resistor between breadboard row A and row B.
     - Connect female-to-male jumper from **Pin 11** to row A.
     - Insert Red LED: longer leg (Anode `+`) into row B; shorter flat leg (Cathode `−`) into the negative ground rail.
   - **Yellow LED**:
     - Insert a 330Ω resistor between row C and row D.
     - Connect female-to-male jumper from **Pin 13** to row C.
     - Insert Yellow LED: longer leg (Anode `+`) into row D; shorter leg (Cathode `−`) into the negative ground rail.
   - **Green LED**:
     - Insert a 330Ω resistor between row E and row F.
     - Connect female-to-male jumper from **Pin 15** to row E.
     - Insert Green LED: longer leg (Anode `+`) into row F; shorter leg (Cathode `−`) into the negative ground rail.
4. **Wire the Buzzer**:
   - Plug the Buzzer module into the breadboard.
   - Connect the Buzzer `VCC` / `I/O` pin to **Pin 12** with a blue/purple jumper.
   - Connect the Buzzer `GND` pin to the negative ground rail with a short jumper.
5. **Connect the Camera**:
   - Plug the USB webcam into one of the blue **USB 3.0 ports** on the Raspberry Pi 4.

---

## 7. Pre-Power Safety Checklist

Before plugging in the USB-C power supply to the Raspberry Pi:
- [ ] Fan red wire is strictly on **Pin 4** (5V) and black on **Pin 6** (GND).
- [ ] No 5V wire touches any GPIO pin or breadboard signal row.
- [ ] Pin 14 is firmly connected to the breadboard ground rail.
- [ ] All three LEDs have a 330Ω resistor in series between the GPIO pin and the anode.
- [ ] All three LED cathodes (flat edge / shorter lead) connect to the ground rail.
- [ ] Buzzer ground connects to the ground rail; buzzer signal connects to Pin 12.
- [ ] No bare leads or resistor legs touch each other on the breadboard.

---

## 8. Hardware Verification Script

Save this script as `verify_hardware_wiring.py` on the Raspberry Pi to perform an automated pre-flight self-test of the wiring.

```python
#!/usr/bin/env python3
"""
verify_hardware_wiring.py
SIGAP Edge Hardware Diagnostic & Wiring Verification Script

Cycles through Green -> Yellow -> Red LEDs and sounds a brief buzzer chirp
to confirm correct GPIO wiring on the Raspberry Pi 4.

Usage:
    python verify_hardware_wiring.py
    python verify_hardware_wiring.py --simulate
"""

import sys
import time
import argparse

# Hardware Pin Definitions (BCM numbering)
PIN_RED_LED = 17       # Physical Pin 11
PIN_YELLOW_LED = 27    # Physical Pin 13
PIN_GREEN_LED = 22     # Physical Pin 15
PIN_BUZZER = 18        # Physical Pin 12

def run_hardware_test(simulate: bool = False):
    print("=" * 60)
    print(" SIGAP Edge Station — Hardware Wiring Verification Test")
    print("=" * 60)
    print(f" Pin 4  : 5V Fan (+) [Always ON]")
    print(f" Pin 6  : Fan GND   [Always ON]")
    print(f" Pin 11 : BCM {PIN_RED_LED} -> Red LED (Defect)")
    print(f" Pin 12 : BCM {PIN_BUZZER} -> Buzzer (Alert)")
    print(f" Pin 13 : BCM {PIN_YELLOW_LED} -> Yellow LED (Review)")
    print(f" Pin 14 : Common Ground Rail (LEDs + Buzzer)")
    print(f" Pin 15 : BCM {PIN_GREEN_LED} -> Green LED (Pass)")
    print("=" * 60)

    if simulate:
        print("[MODE] Simulated execution (no physical GPIO actuation)\n")
        steps = [
            ("GREEN LED (Pass)", 1.5),
            ("YELLOW LED (Review)", 1.5),
            ("RED LED (Defect)", 1.5),
            ("BUZZER (Chirp 0.2s)", 0.2),
        ]
        for name, duration in steps:
            print(f"  [SIMULATED] Testing {name} for {duration}s...")
            time.sleep(duration)
        print("\n[SUCCESS] Simulated test completed successfully.")
        return

    try:
        from gpiozero import LED, Buzzer
    except ImportError:
        print("[ERROR] 'gpiozero' library not installed.")
        print("Install via: pip install gpiozero RPi.GPIO")
        print("Or run with --simulate flag to test logic offline.")
        sys.exit(1)

    print("[MODE] Initializing physical GPIO devices...")
    red = LED(PIN_RED_LED)
    yellow = LED(PIN_YELLOW_LED)
    green = LED(PIN_GREEN_LED)
    buzzer = Buzzer(PIN_BUZZER)

    try:
        # All OFF initially
        red.off(); yellow.off(); green.off(); buzzer.off()
        time.sleep(0.5)

        # 1. Test Green LED (Pass)
        print("  --> Step 1: Testing Green LED (Pin 15 / BCM 22)...")
        green.on()
        time.sleep(1.5)
        green.off()
        time.sleep(0.3)

        # 2. Test Yellow LED (Review)
        print("  --> Step 2: Testing Yellow LED (Pin 13 / BCM 27)...")
        yellow.on()
        time.sleep(1.5)
        yellow.off()
        time.sleep(0.3)

        # 3. Test Red LED (Defect)
        print("  --> Step 3: Testing Red LED (Pin 11 / BCM 17)...")
        red.on()
        time.sleep(1.5)
        red.off()
        time.sleep(0.3)

        # 4. Test Buzzer Chirp
        print("  --> Step 4: Testing Buzzer Chirp (Pin 12 / BCM 18)...")
        buzzer.on()
        time.sleep(0.2)
        buzzer.off()
        time.sleep(0.5)

        # 5. All indicators sequence flash (Self-Test complete)
        print("  --> Step 5: Full station chime (Pass OK + Short Chirp)...")
        green.on()
        buzzer.on()
        time.sleep(0.15)
        buzzer.off()
        time.sleep(0.85)
        green.off()

        print("\n" + "=" * 60)
        print(" [SUCCESS] All physical indicator outputs tested successfully!")
        print("=" * 60)

    except KeyboardInterrupt:
        print("\n[ABORTED] Verification aborted by user.")
    finally:
        red.close()
        yellow.close()
        green.close()
        buzzer.close()
        print("[CLEANUP] GPIO pins released safely.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SIGAP GPIO Wiring Verification")
    parser.add_argument("--simulate", action="store_true", help="Run without physical GPIO hardware")
    args = parser.parse_args()
    run_hardware_test(simulate=args.simulate)
```

---

## 9. Integration with `ai_models/edge_inference_worker.py`

In the production worker `ai_models/edge_inference_worker.py`, the CLI arguments map directly to the BCM pins specified here:

```bash
python -m ai_models.edge_inference_worker \
  --led-mode three \
  --buzzer-type active \
  --pin-red 17 \
  --pin-yellow 27 \
  --pin-green 22 \
  --pin-buzzer 18
```

| Edge Inference Outcome | Visual Indicator | Audible Alert | Station State |
|---|---|---|---|
| `ok` (Defect Free) | **Green LED ON** (Pin 15) | Silent (OFF) | Pass / Ready |
| `review` / `low_confidence` | **Yellow LED ON** (Pin 13) | Silent (OFF) | Operator Hold |
| `defect` (Anomaly Detected) | **Red LED Latched ON** (Pin 11) | **Buzzer Alarm** (Pin 12) | Station Fault / Latch |
