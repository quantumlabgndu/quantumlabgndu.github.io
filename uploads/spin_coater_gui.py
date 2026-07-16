"""
Spin Coater Operating System
Modern GUI for controlling and monitoring a spin coater via Arduino.
Features intelligent RPM interpolation for noisy 1-pulse/rev sensors.
"""

import customtkinter as ctk
import tkinter as tk
import serial
import serial.tools.list_ports
import threading
import time
import re
import math
from collections import deque

# ── Color Palette ──────────────────────────────────────────
C = {
    "bg":         "#0d1117",
    "card":       "#161b22",
    "elevated":   "#21262d",
    "border":     "#30363d",
    "accent":     "#00d4aa",
    "accent_dim": "#00836a",
    "text":       "#e6edf3",
    "text_dim":   "#8b949e",
    "danger":     "#f85149",
    "success":    "#3fb950",
    "warning":    "#d29922",
    "chart_grid": "#1c2333",
    "chart_raw":  "#484f58",
}

FONT_MONO = ("Consolas", 14)
FONT_MONO_BIG = ("Consolas", 52, "bold")
FONT_LABEL = ("Segoe UI", 13)
FONT_HEADING = ("Segoe UI", 15, "bold")
FONT_SMALL = ("Segoe UI", 10)
FONT_INPUT = ("Consolas", 18)
FONT_BUTTON = ("Segoe UI", 15, "bold")
FONT_BUTTON_BIG = ("Segoe UI", 18, "bold")


# ════════════════════════════════════════════════════════════
# RPM Signal Processing
# ════════════════════════════════════════════════════════════
class RPMFilter:
    """
    Filters noisy RPM from a 1-pulse-per-rev sensor that frequently
    reports 0 due to a half-open / half-blocked encoder disc.

    Strategy:
      1. Discard 0-readings when recent valid data exists (sensor dropout).
      2. Median-filter valid readings to reject outliers.
      3. Apply Exponential Moving Average (EMA) for final smoothing.
      4. Only report 0 if no valid pulse arrives within `timeout` seconds.
    """

    def __init__(self, buf_size=15, ema_alpha=0.25, timeout=2.0,
                 fast_alpha=0.6, fast_samples=5):
        self.buf = deque(maxlen=buf_size)
        self.alpha = ema_alpha
        self.fast_alpha = fast_alpha    # faster tracking right after reset
        self.fast_samples = fast_samples
        self._sample_count = 0
        self.timeout = timeout
        self.smoothed = 0.0
        self.last_valid_t = 0.0
        self.raw = 0.0

    def update(self, raw_rpm: float) -> float:
        self.raw = raw_rpm
        now = time.time()

        if raw_rpm > 0:
            self.buf.append(raw_rpm)
            self.last_valid_t = now
            self._sample_count += 1

            # Outlier rejection via median
            if len(self.buf) >= 3:
                median = sorted(self.buf)[len(self.buf) // 2]
                if abs(raw_rpm - median) / max(median, 1) > 0.20:
                    return self.smoothed

            # Adaptive EMA — fast ramp after reset, then normal smoothing
            if self.smoothed < 1:
                self.smoothed = raw_rpm
            else:
                a = self.fast_alpha if self._sample_count <= self.fast_samples else self.alpha
                self.smoothed = a * raw_rpm + (1 - a) * self.smoothed
        else:
            # 0-reading: dropout or actual stop?
            if now - self.last_valid_t > self.timeout:
                self.smoothed = 0.0
                self.buf.clear()
                self._sample_count = 0

        return self.smoothed

    @property
    def warmed_up(self) -> bool:
        """True once we have enough samples for a reliable reading."""
        return self._sample_count >= self.fast_samples

    def reset(self):
        self.buf.clear()
        self.smoothed = 0.0
        self.last_valid_t = 0.0
        self._sample_count = 0


# ════════════════════════════════════════════════════════════
# Fast RPM Filter for PID Control (minimal lag)
# ════════════════════════════════════════════════════════════
class ControlRPMFilter:
    """
    Ultra-low-lag RPM filter for PID feedback.
    Uses a tiny 3-sample median to reject outliers, but NO EMA —
    so it tracks actual RPM with near-zero delay.
    Zero-readings are held (dropout rejection) until timeout.
    """

    def __init__(self, timeout=1.0):
        self.value = 0.0
        self.last_valid_t = 0.0
        self.timeout = timeout
        self._recent = deque(maxlen=3)

    def update(self, raw_rpm: float) -> float:
        now = time.time()
        if raw_rpm > 0:
            self._recent.append(raw_rpm)
            self.last_valid_t = now
            if len(self._recent) >= 3:
                self.value = sorted(self._recent)[1]   # median of 3
            else:
                self.value = raw_rpm
        else:
            if now - self.last_valid_t > self.timeout:
                self.value = 0.0
                self._recent.clear()
        return self.value

    @property
    def warmed_up(self) -> bool:
        return len(self._recent) >= 2

    def reset(self):
        self.value = 0.0
        self.last_valid_t = 0.0
        self._recent.clear()


# ════════════════════════════════════════════════════════════
# PID Controller  (feedforward + PI + lock-on-target)
# ════════════════════════════════════════════════════════════
class PIDController:
    """
    Feedforward + PI controller with automatic PWM lock.

    How it works:
      1. Feedforward estimates PWM from target using known RPM/PWM ratio.
      2. A small PI loop corrects the residual error.
      3. Derivative is computed on *measurement* (not error) to avoid kick.
      4. Once RPM stays within `lock_pct`% of target for `lock_time` seconds,
         the current PWM is frozen — giving rock-stable speed.
      5. Lock is released only when the user sets a new target.
    """

    RPM_PER_PWM = 31.0  # approx from user data: PWM 70 → ~2200 RPM

    def __init__(self, kp=0.05, ki=0.02, kd=0.005,
                 lock_pct=2.5, lock_time=3.0):
        self.kp, self.ki, self.kd = kp, ki, kd
        self.lock_pct = lock_pct      # % error band to consider "on target"
        self.lock_time = lock_time    # seconds within band before locking

        self.integral = 0.0
        self.prev_measured = 0.0
        self.last_t = None
        self.output = 0.0
        self._warmup_cycles = 0       # feedforward-only during warmup

        # Lock state
        self.locked = False
        self.locked_pwm = 0.0
        self._in_band_since = None

    def compute(self, setpoint: float, measured: float,
                filter_ready: bool = True) -> float:
        # If locked, just return the frozen PWM
        if self.locked:
            return self.locked_pwm

        now = time.time()
        ff = max(0, min(255, setpoint / self.RPM_PER_PWM))

        # First call → seed with feedforward
        if self.last_t is None:
            self.last_t = now
            self.prev_measured = measured
            self._warmup_cycles = 0
            self.output = ff
            return self.output

        dt = now - self.last_t
        if dt < 0.1:          # run at ~10 Hz
            return self.output
        self.last_t = now
        self._warmup_cycles += 1

        # During warmup (filter not ready), use feedforward only
        # to avoid integral windup from stale/zero RPM readings
        if not filter_ready or self._warmup_cycles <= 5:
            self.prev_measured = measured
            self.output = ff
            return self.output

        err = setpoint - measured

        # --- PI ---
        self.integral += err * dt
        # Clamp integral contribution to ±60 PWM units
        max_int = 60.0 / max(self.ki, 1e-9)
        self.integral = max(-max_int, min(max_int, self.integral))

        # --- Derivative on measurement (smooth, no kick) ---
        d_meas = (measured - self.prev_measured) / dt
        self.prev_measured = measured

        correction = self.kp * err + self.ki * self.integral - self.kd * d_meas
        self.output = ff + correction
        self.output = max(0.0, min(255.0, self.output))

        # --- Lock detection ---
        if setpoint > 0:
            pct_err = abs(err) / setpoint * 100.0
            if pct_err <= self.lock_pct:
                if self._in_band_since is None:
                    self._in_band_since = now
                elif now - self._in_band_since >= self.lock_time:
                    self.locked = True
                    self.locked_pwm = self.output
            else:
                self._in_band_since = None   # reset band timer

        return self.output

    def reset(self):
        self.integral = 0.0
        self.prev_measured = 0.0
        self.last_t = None
        self.output = 0.0
        self._warmup_cycles = 0
        self.locked = False
        self.locked_pwm = 0.0
        self._in_band_since = None


# ════════════════════════════════════════════════════════════
# Live RPM Chart (Canvas-based)
# ════════════════════════════════════════════════════════════
class LiveChart:
    MARGIN = {"l": 48, "r": 10, "t": 10, "b": 22}

    def __init__(self, parent, width=540, height=140):
        self.w, self.h = width, height
        self.canvas = tk.Canvas(parent, width=width, height=height,
                                bg=C["bg"], highlightthickness=0, bd=0)
        self.interp = deque(maxlen=300)   # ~60 s @ 5 Hz
        self.raw = deque(maxlen=300)
        self.y_max = 500

    def pack(self, **kw):
        self.canvas.pack(**kw)

    def add(self, interp_rpm, raw_rpm):
        self.interp.append(interp_rpm)
        self.raw.append(raw_rpm)
        self._draw()

    def _draw(self):
        c = self.canvas
        c.delete("all")
        m = self.MARGIN
        px, py = m["l"], m["t"]
        pw = self.w - m["l"] - m["r"]
        ph = self.h - m["t"] - m["b"]

        # Auto-scale Y
        vals = [v for v in self.interp if v > 0] + [v for v in self.raw if v > 0]
        if vals:
            ceiling = max(vals) * 1.25
            for nice in [200, 500, 1000, 2000, 3000, 5000, 8000, 10000, 15000]:
                if nice >= ceiling:
                    self.y_max = nice
                    break
            else:
                self.y_max = int(ceiling)

        # Grid lines
        for i in range(6):
            y = py + ph - (i / 5) * ph
            rpm_v = (i / 5) * self.y_max
            c.create_line(px, y, px + pw, y, fill=C["chart_grid"], dash=(2, 4))
            c.create_text(px - 4, y, text=str(int(rpm_v)),
                          anchor="e", fill=C["text_dim"], font=("Consolas", 8))

        c.create_rectangle(px, py, px + pw, py + ph, outline=C["border"])

        n = len(self.interp)
        if n < 2:
            return

        def xp(i):
            return px + (i / (n - 1)) * pw

        def yp(v):
            return py + ph - (v / max(self.y_max, 1)) * ph

        # Raw dots
        for i, v in enumerate(self.raw):
            if v > 0:
                x, y = xp(i), yp(v)
                c.create_oval(x - 1.5, y - 1.5, x + 1.5, y + 1.5,
                              fill=C["chart_raw"], outline="")

        # Interpolated line
        pts = []
        for i, v in enumerate(self.interp):
            pts.extend([xp(i), yp(v)])
        if len(pts) >= 4:
            c.create_line(pts, fill=C["accent"], width=2, smooth=True)

    def clear(self):
        self.interp.clear()
        self.raw.clear()
        self.canvas.delete("all")


# ════════════════════════════════════════════════════════════
# Main Application
# ════════════════════════════════════════════════════════════
class SpinCoaterApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")

        self.title("Spin Coater OS")
        self.geometry("720x860")
        self.minsize(700, 820)
        self.configure(fg_color=C["bg"])

        # State
        self.ser: serial.Serial | None = None
        self.connected = False
        self.rpm_filter = RPMFilter()
        self.control_filter = ControlRPMFilter()
        self.pid = PIDController()
        self.pid_active = False
        self.current_pwm = 0
        self.current_raw_rpm = 0.0
        self.current_interp_rpm = 0.0
        self._control_rpm = 0.0         # fast-tracked RPM for PID (no lag)
        self.mode = "PWM"           # "PWM" or "RPM"
        self._target_rpm = 0.0
        self.start_time = None
        self._timer_duration = 0      # seconds, 0 = no auto-stop
        self._timer_end = None
        self._timer_running = False
        self._run_start_time = None   # tracks elapsed time

        self._build_ui()
        self._refresh_ports()

        # Periodic UI refresh (200 ms)
        self._tick()

    # ── UI Construction ────────────────────────────────────
    def _build_ui(self):
        pad = {"padx": 14, "pady": 6}

        # ── Title Bar ──
        title_frame = ctk.CTkFrame(self, fg_color=C["card"], corner_radius=0, height=48)
        title_frame.pack(fill="x")
        title_frame.pack_propagate(False)
        ctk.CTkLabel(title_frame, text="⟳  SPIN COATER OS",
                     font=("Segoe UI", 17, "bold"),
                     text_color=C["accent"]).pack(side="left", padx=16)
        self.status_dot = ctk.CTkLabel(title_frame, text="● Disconnected",
                                       font=FONT_LABEL, text_color=C["text_dim"])
        self.status_dot.pack(side="right", padx=16)

        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=14, pady=10)

        # ── Connection ──
        conn = ctk.CTkFrame(body, fg_color=C["card"], corner_radius=12)
        conn.pack(fill="x", **pad)

        row = ctk.CTkFrame(conn, fg_color="transparent")
        row.pack(fill="x", padx=14, pady=12)

        ctk.CTkLabel(row, text="COM Port", font=FONT_HEADING).pack(side="left")
        self.port_var = ctk.StringVar()
        self.port_cb = ctk.CTkComboBox(row, variable=self.port_var, width=160,
                                       state="readonly", font=FONT_MONO,
                                       height=36)
        self.port_cb.pack(side="left", padx=(12, 8))

        ctk.CTkButton(row, text="⟳", width=38, height=36,
                      command=self._refresh_ports,
                      fg_color=C["elevated"], hover_color=C["border"],
                      font=("Segoe UI", 16)).pack(side="left", padx=(0, 8))

        self.conn_btn = ctk.CTkButton(row, text="Connect", width=120, height=36,
                                      command=self._toggle_connect,
                                      fg_color=C["accent_dim"],
                                      hover_color=C["accent"],
                                      font=FONT_BUTTON)
        self.conn_btn.pack(side="left")

        # ── RPM Display ──
        rpm_card = ctk.CTkFrame(body, fg_color=C["card"], corner_radius=12)
        rpm_card.pack(fill="x", **pad)

        ctk.CTkLabel(rpm_card, text="INTERPOLATED RPM",
                     font=("Segoe UI", 11, "bold"),
                     text_color=C["text_dim"]).pack(anchor="w", padx=18, pady=(12, 0))

        self.rpm_display = ctk.CTkLabel(rpm_card, text="0",
                                        font=FONT_MONO_BIG,
                                        text_color=C["accent"])
        self.rpm_display.pack(padx=18, pady=(0, 4))

        info_row = ctk.CTkFrame(rpm_card, fg_color="transparent")
        info_row.pack(fill="x", padx=18, pady=(0, 12))

        self.raw_label = ctk.CTkLabel(info_row, text="Raw: 0",
                                      font=FONT_MONO, text_color=C["text_dim"])
        self.raw_label.pack(side="left")

        self.pwm_label = ctk.CTkLabel(info_row, text="PWM: 0",
                                      font=FONT_MONO, text_color=C["text_dim"])
        self.pwm_label.pack(side="left", padx=(24, 0))

        self.motor_status = ctk.CTkLabel(info_row, text="● Idle",
                                         font=FONT_HEADING, text_color=C["text_dim"])
        self.motor_status.pack(side="right")

        # ── Controls (now ABOVE chart for easier access) ──
        ctrl = ctk.CTkFrame(body, fg_color=C["card"], corner_radius=12)
        ctrl.pack(fill="x", **pad)

        # -- Mode selector --
        mode_row = ctk.CTkFrame(ctrl, fg_color="transparent")
        mode_row.pack(fill="x", padx=20, pady=(14, 8))

        ctk.CTkLabel(mode_row, text="MODE", font=("Segoe UI", 12, "bold"),
                     text_color=C["text_dim"]).pack(side="left", padx=(0, 16))

        self.mode_var = ctk.StringVar(value="PWM")
        ctk.CTkRadioButton(mode_row, text="Direct PWM (0-255)",
                           variable=self.mode_var, value="PWM",
                           command=self._on_mode_change,
                           font=FONT_LABEL, radiobutton_width=20, radiobutton_height=20
                           ).pack(side="left", padx=(0, 20))
        ctk.CTkRadioButton(mode_row, text="Target RPM (PID)",
                           variable=self.mode_var, value="RPM",
                           command=self._on_mode_change,
                           font=FONT_LABEL, radiobutton_width=20, radiobutton_height=20
                           ).pack(side="left")

        # -- Centered input area --
        input_center = ctk.CTkFrame(ctrl, fg_color="transparent")
        input_center.pack(fill="x", padx=20, pady=(4, 6))
        # Use column weights to center the content
        input_center.columnconfigure(0, weight=1)
        input_center.columnconfigure(1, weight=0)
        input_center.columnconfigure(2, weight=0)
        input_center.columnconfigure(3, weight=1)

        self.target_label = ctk.CTkLabel(input_center, text="PWM Value:",
                                         font=FONT_HEADING)
        self.target_label.grid(row=0, column=1, padx=(0, 10), sticky="e")

        self.target_entry = ctk.CTkEntry(input_center, width=200, height=44,
                                         font=FONT_INPUT,
                                         placeholder_text="0",
                                         corner_radius=10)
        self.target_entry.grid(row=0, column=2, sticky="w")
        self.target_entry.bind("<Return>", lambda e: self._set_target())

        # -- Timer row, also centered --
        timer_center = ctk.CTkFrame(ctrl, fg_color='transparent')
        timer_center.pack(fill='x', padx=20, pady=(2, 8))
        timer_center.columnconfigure(0, weight=1)
        timer_center.columnconfigure(1, weight=0)
        timer_center.columnconfigure(2, weight=0)
        timer_center.columnconfigure(3, weight=0)
        timer_center.columnconfigure(4, weight=1)

        ctk.CTkLabel(timer_center, text='Timer (sec):',
                     font=FONT_HEADING).grid(row=0, column=1, padx=(0, 10), sticky='e')
        self.timer_entry = ctk.CTkEntry(timer_center, width=140, height=44,
                                         font=FONT_INPUT,
                                         placeholder_text='0',
                                         corner_radius=10)
        self.timer_entry.grid(row=0, column=2, sticky='w')
        ctk.CTkLabel(timer_center, text='(0 = no limit)',
                     font=FONT_SMALL, text_color=C['text_dim']
                     ).grid(row=0, column=3, padx=(10, 0), sticky='w')

        # -- BIG Start / Stop buttons, side by side, centered --
        btn_frame = ctk.CTkFrame(ctrl, fg_color="transparent")
        btn_frame.pack(pady=(6, 16))

        self.start_btn = ctk.CTkButton(
            btn_frame, text="▶  START", width=180, height=54,
            command=self._set_target,
            fg_color=C["accent_dim"], hover_color=C["accent"],
            text_color=C["text"],
            corner_radius=12,
            font=FONT_BUTTON_BIG)
        self.start_btn.pack(side="left", padx=(0, 12))

        self.stop_btn = ctk.CTkButton(
            btn_frame, text="⏹  STOP", width=180, height=54,
            command=self._stop_motor,
            fg_color="#5a1d1d", hover_color=C["danger"],
            text_color=C["danger"],
            corner_radius=12,
            font=FONT_BUTTON_BIG)
        self.stop_btn.pack(side="left")

        # -- Timer display --
        self.timer_display = ctk.CTkLabel(ctrl, text='⏱ --:--',
                                           font=('Consolas', 20, 'bold'),
                                           text_color=C['text_dim'])
        self.timer_display.pack(pady=(0, 12))

        # ── Chart (smaller, below controls) ──
        chart_card = ctk.CTkFrame(body, fg_color=C["card"], corner_radius=12)
        chart_card.pack(fill="x", **pad)
        ctk.CTkLabel(chart_card, text="RPM HISTORY",
                     font=("Segoe UI", 10, "bold"),
                     text_color=C["text_dim"]).pack(anchor="w", padx=16, pady=(8, 2))

        self.chart = LiveChart(chart_card, width=660, height=140)
        self.chart.pack(padx=10, pady=(0, 6))

        legend = ctk.CTkFrame(chart_card, fg_color="transparent")
        legend.pack(fill="x", padx=16, pady=(0, 6))
        ctk.CTkLabel(legend, text="━ Interpolated", font=FONT_SMALL,
                     text_color=C["accent"]).pack(side="left")
        ctk.CTkLabel(legend, text="● Raw", font=FONT_SMALL,
                     text_color=C["chart_raw"]).pack(side="left", padx=(16, 0))

        # ── Credit Footer ──
        ctk.CTkLabel(body, text="Designed and Created at Quantum Lab, GNDU",
                     font=("Segoe UI", 10, "italic"),
                     text_color=C["text_dim"]).pack(pady=(8, 0))


    # ── Port Helpers ───────────────────────────────────────
    def _refresh_ports(self):
        ports = [p.device for p in serial.tools.list_ports.comports()]
        self.port_cb.configure(values=ports)
        if ports:
            self.port_var.set(ports[0])

    # ── Connect / Disconnect ──────────────────────────────
    def _toggle_connect(self):
        if not self.connected:
            port = self.port_var.get()
            if not port:
                return
            try:
                self.ser = serial.Serial(port, 115200, timeout=0.5)
                self.connected = True
                self.start_time = time.time()
                self.conn_btn.configure(text="Disconnect",
                                        fg_color="#5a1d1d",
                                        hover_color=C["danger"])
                self.port_cb.configure(state="disabled")
                self.status_dot.configure(text=f"● Connected  ({port})",
                                          text_color=C["success"])
                # Start reader thread
                threading.Thread(target=self._serial_loop, daemon=True).start()
            except Exception as ex:
                self.status_dot.configure(text=f"✖ {ex}", text_color=C["danger"])
        else:
            self._stop_motor()
            self.connected = False
            self.conn_btn.configure(text="Connect",
                                    fg_color=C["accent_dim"],
                                    hover_color=C["accent"])
            self.port_cb.configure(state="readonly")
            self.status_dot.configure(text="● Disconnected",
                                      text_color=C["text_dim"])
            if self.ser:
                self.ser.close()

    # ── Serial Reader Thread ──────────────────────────────
    def _serial_loop(self):
        pattern = re.compile(r"PWM:\s*(\d+)\s*\|\s*RPM:\s*([\d.]+)")
        while self.connected:
            try:
                if self.ser and self.ser.in_waiting:
                    line = self.ser.readline().decode("utf-8", errors="ignore").strip()
                    m = pattern.search(line)
                    if m:
                        self.current_pwm = int(m.group(1))
                        raw = float(m.group(2))
                        self.current_raw_rpm = raw
                        self.current_interp_rpm = self.rpm_filter.update(raw)
                        self._control_rpm = self.control_filter.update(raw)

                # PID loop (~10 Hz from here, gated inside compute)
                if self.pid_active:
                    pwm_out = self.pid.compute(self._target_rpm,
                                               self._control_rpm,
                                               filter_ready=self.control_filter.warmed_up)
                    self._send_pwm(int(pwm_out))

                time.sleep(0.02)
            except Exception as ex:
                print(f"Serial error: {ex}")
                self.connected = False
                break

    # ── Periodic UI Update ────────────────────────────────
    def _tick(self):
        interp = self.current_interp_rpm
        raw = self.current_raw_rpm

        # Big RPM number
        self.rpm_display.configure(text=f"{interp:,.1f}")

        # Info row
        self.raw_label.configure(text=f"Raw: {raw:.1f}")
        self.pwm_label.configure(text=f"PWM: {self.current_pwm}")

        if self.connected:
            if self.pid_active and self.pid.locked:
                self.motor_status.configure(text="🔒 LOCKED",
                                            text_color=C["accent"])
            elif self.pid_active:
                self.motor_status.configure(text="⟳ PID Active",
                                            text_color=C["warning"])
            elif interp > 10:
                self.motor_status.configure(text="● Running",
                                            text_color=C["success"])
            else:
                self.motor_status.configure(text="● Idle",
                                            text_color=C["text_dim"])
        else:
            self.motor_status.configure(text="● Offline",
                                        text_color=C["text_dim"])

        # Chart
        if self.connected:
            self.chart.add(interp, raw)

        # Timer countdown / elapsed
        if self._timer_running and self._timer_end:
            remaining = self._timer_end - time.time()
            if remaining <= 0:
                self._stop_motor()
                self.timer_display.configure(text="\u23f1 00:00  DONE",
                                              text_color=C["danger"])
            else:
                mins, secs = int(remaining) // 60, int(remaining) % 60
                color = C["warning"] if remaining < 10 else C["accent"]
                self.timer_display.configure(text=f"\u23f1 {mins:02d}:{secs:02d}",
                                              text_color=color)
        elif self._run_start_time and self.current_pwm > 0:
            elapsed = time.time() - self._run_start_time
            mins, secs = int(elapsed) // 60, int(elapsed) % 60
            self.timer_display.configure(text=f"\u23f1 {mins:02d}:{secs:02d}",
                                          text_color=C["text_dim"])
        else:
            self.timer_display.configure(text="\u23f1 --:--",
                                          text_color=C["text_dim"])

        self.after(200, self._tick)

    # ── Mode / Target ─────────────────────────────────────
    def _on_mode_change(self):
        mode = self.mode_var.get()
        self.pid_active = False
        self.pid.reset()
        if mode == "PWM":
            self.target_label.configure(text="PWM Value:")
            self.target_entry.configure(placeholder_text="0-255")
        else:
            self.target_label.configure(text="Target RPM:")
            self.target_entry.configure(placeholder_text="e.g. 2000")

    def _set_target(self):
        if not self.connected:
            return
        txt = self.target_entry.get().strip()
        if not txt:
            return
        try:
            val = float(txt)
        except ValueError:
            return

        # Reset filters so stale values don't cause PID overshoot
        self.rpm_filter.reset()
        self.control_filter.reset()

        # Parse timer duration
        timer_txt = self.timer_entry.get().strip()
        try:
            self._timer_duration = max(0, int(float(timer_txt)))
        except (ValueError, TypeError):
            self._timer_duration = 0

        mode = self.mode_var.get()
        if mode == "PWM":
            self.pid_active = False
            pwm = max(0, min(255, int(val)))
            self._send_pwm(pwm)
        else:  # RPM via PID
            self._target_rpm = max(0, val)
            self.pid.reset()
            self.pid_active = True

        # Start timer if duration > 0, otherwise track elapsed
        self._run_start_time = time.time()
        if self._timer_duration > 0:
            self._timer_end = time.time() + self._timer_duration
            self._timer_running = True
        else:
            self._timer_end = None
            self._timer_running = False

    def _stop_motor(self):
        self.pid_active = False
        self._timer_running = False
        self._timer_end = None
        self._run_start_time = None
        if self.connected and self.ser:
            self.ser.write(b"S\n")
        self.rpm_filter.reset()
        self.control_filter.reset()

    def _send_pwm(self, val: int):
        if self.connected and self.ser:
            self.ser.write(f"P{val}\n".encode())

    # ── Cleanup ───────────────────────────────────────────
    def destroy(self):
        self.connected = False
        if self.ser:
            try:
                self.ser.close()
            except Exception:
                pass
        super().destroy()


# ── Entry Point ────────────────────────────────────────────
if __name__ == "__main__":
    app = SpinCoaterApp()
    app.mainloop()
