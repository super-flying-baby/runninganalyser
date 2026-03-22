import os, sys, io
import M5
from M5 import *
from hardware import Timer
import time



lbl_title = None
lbl_btn = None
lbl_vx = None
lbl_vy = None
lbl_vz = None
lbl_tick = None
lbl_debug = None
lbl_maxx = None
lbl_maxy = None
lbl_maxz = None
line0 = None
label3 = None
lbl_power = None
timer0 = None
file_0 = None


is_rec = None
filename = None
rec_start = None
vx = None
vy = None
vz = None
current_second = None
rec_len = None
maxx = None
maxy = None
maxz = None
txtline = None
tuple_time = None
g1 = None
g2 = None
g3 = None

# Describe this functionality...
def stopRec():
  global is_rec, filename, rec_start, vx, vy, vz, current_second, rec_len, maxx, maxy, maxz, txtline, tuple_time, g1, g2, g3, lbl_title, lbl_btn, lbl_vx, lbl_vy, lbl_vz, lbl_tick, lbl_debug, lbl_maxx, lbl_maxy, lbl_maxz, line0, label3, lbl_power, timer0, file_0
  file_0.flush()
  file_0.close()
  is_rec = False
  rec_start = 0
  lbl_btn.setText(str('    Record'))
  lbl_tick.setText(str(''))
  Speaker.tone(10000, 50)


def timer0_cb(t):
  global lbl_title, lbl_btn, lbl_vx, lbl_vy, lbl_vz, lbl_tick, lbl_debug, lbl_maxx, lbl_maxy, lbl_maxz, line0, label3, lbl_power, timer0, file_0, is_rec, filename, rec_start, vx, vy, vz, current_second, rec_len, maxx, maxy, maxz, txtline, tuple_time, g1, g2, g3
  if is_rec:
    lbl_tick.setText(str((time.time()) - rec_start))
    (vx, vy, vz) = Imu.getAccel()
    lbl_vx.setText(str(vx))
    lbl_vy.setText(str(vy))
    lbl_vz.setText(str(vz))
    if vx > maxx:
      maxx = vx
    if vy > maxy:
      maxy = vy
    if vz > maxz:
      maxz = vz
    txtline = (str('"') + str(((time.localtime())[3])))
    txtline = (str(txtline) + str(':'))
    txtline = (str(txtline) + str(((time.localtime())[4])))
    txtline = (str(txtline) + str(':'))
    txtline = (str(txtline) + str(((time.localtime())[5])))
    txtline = (str(txtline) + str('",'))
    txtline = (str(txtline) + str((time.ticks_ms())))
    txtline = (str(txtline) + str(','))
    txtline = (str(txtline) + str(((Imu.getAccel())[0])))
    txtline = (str(txtline) + str(','))
    txtline = (str(txtline) + str(((Imu.getAccel())[1])))
    txtline = (str(txtline) + str(','))
    txtline = (str(txtline) + str(((Imu.getAccel())[2])))
    txtline = (str(txtline) + str(','))
    (g1, g2, g3) = Imu.getGyro()
    txtline = (str(txtline) + str(g1))
    txtline = (str(txtline) + str(','))
    txtline = (str(txtline) + str(g2))
    txtline = (str(txtline) + str(','))
    txtline = (str(txtline) + str(g3))
    lbl_maxx.setText(str(maxx))
    lbl_maxy.setText(str(maxy))
    lbl_maxz.setText(str(maxz))
    file_0.write(txtline)
    file_0.write('\r\n')


def btnA_wasClicked_event(state):
  global lbl_title, lbl_btn, lbl_vx, lbl_vy, lbl_vz, lbl_tick, lbl_debug, lbl_maxx, lbl_maxy, lbl_maxz, line0, label3, lbl_power, timer0, file_0, is_rec, filename, rec_start, vx, vy, vz, current_second, rec_len, maxx, maxy, maxz, txtline, tuple_time, g1, g2, g3
  if is_rec:
    stopRec()
  else:
    file_0 = open('/flash/' + str(filename), 'a+')
    is_rec = True
    rec_start = time.time()
    Speaker.tone(2000, 50)


def setup():
  global lbl_title, lbl_btn, lbl_vx, lbl_vy, lbl_vz, lbl_tick, lbl_debug, lbl_maxx, lbl_maxy, lbl_maxz, line0, label3, lbl_power, timer0, file_0, is_rec, filename, rec_start, vx, vy, vz, current_second, rec_len, maxx, maxy, maxz, txtline, tuple_time, g1, g2, g3

  M5.begin()
  Widgets.setRotation(0)
  Widgets.fillScreen(0x000000)
  lbl_title = Widgets.Title("RUN METER", 3, 0xffffff, 0x0000FF, Widgets.FONTS.DejaVu18)
  lbl_btn = Widgets.Label("    Record", 10, 217, 1.0, 0xffffff, 0x000000, Widgets.FONTS.DejaVu18)
  lbl_vx = Widgets.Label("IMU x", 3, 26, 1.0, 0xffffff, 0x222222, Widgets.FONTS.DejaVu18)
  lbl_vy = Widgets.Label("IMU y", 2, 50, 1.0, 0xffffff, 0x222222, Widgets.FONTS.DejaVu18)
  lbl_vz = Widgets.Label("IMU z", 3, 75, 1.0, 0xffffff, 0x222222, Widgets.FONTS.DejaVu18)
  lbl_tick = Widgets.Label("label", 111, 217, 1.0, 0xffffff, 0x222222, Widgets.FONTS.DejaVu18)
  lbl_debug = Widgets.Label("", 3, 196, 1.0, 0xffffff, 0xc50f0f, Widgets.FONTS.DejaVu18)
  lbl_maxx = Widgets.Label("label", 0, 123, 1.0, 0xffffff, 0x222222, Widgets.FONTS.DejaVu18)
  lbl_maxy = Widgets.Label("label", 0, 146, 1.0, 0xffffff, 0x222222, Widgets.FONTS.DejaVu18)
  lbl_maxz = Widgets.Label("label", 0, 171, 1.0, 0xffffff, 0x222222, Widgets.FONTS.DejaVu18)
  line0 = Widgets.Line(1, 112, 133, 112, 0xffffff)
  label3 = Widgets.Label("Max", 20, 100, 1.0, 0xffffff, 0x222222, Widgets.FONTS.DejaVu18)
  lbl_power = Widgets.Label("00", 85, 102, 1.0, 0xffffff, 0x222222, Widgets.FONTS.DejaVu18)

  BtnA.setCallback(type=BtnA.CB_TYPE.WAS_CLICKED, cb=btnA_wasClicked_event)

  time.timezone('GMT+8')
  is_rec = False
  current_second = time.time()
  rec_start = 0
  rec_len = 30
  maxx = 0
  maxy = 0
  maxz = 0
  tuple_time = time.localtime()
  filename = (str('rec_') + str((tuple_time[1])))
  filename = (str(filename) + str('_'))
  filename = (str(filename) + str((tuple_time[2])))
  filename = (str(filename) + str(' '))
  filename = (str(filename) + str((tuple_time[3])))
  filename = (str(filename) + str('_'))
  filename = (str(filename) + str((tuple_time[4])))
  filename = (str(filename) + str('_'))
  filename = (str(filename) + str((tuple_time[5])))
  file_0 = open('/flash/' + str(filename), 'a+')
  timer0 = Timer(0)
  timer0.deinit()
  timer0.init(mode=Timer.PERIODIC, period=100, callback=timer0_cb)
  lbl_power.setText(str(Power.getBatteryLevel()))
  filename = (str(filename) + str('.csv'))


def loop():
  global lbl_title, lbl_btn, lbl_vx, lbl_vy, lbl_vz, lbl_tick, lbl_debug, lbl_maxx, lbl_maxy, lbl_maxz, line0, label3, lbl_power, timer0, file_0, is_rec, filename, rec_start, vx, vy, vz, current_second, rec_len, maxx, maxy, maxz, txtline, tuple_time, g1, g2, g3
  if (time.time()) % 10 == 0:
    lbl_power.setText(str(Power.getBatteryLevel()))
  if is_rec:
    if (time.time()) % 2 == 0:
      lbl_btn.setText(str('Record...'))
    else:
      lbl_btn.setText(str('Record.'))
    if (time.time()) > rec_start + rec_len:
      stopRec()
    M5.update()
  M5.update()


if __name__ == '__main__':
  try:
    setup()
    while True:
      loop()
  except (Exception, KeyboardInterrupt) as e:
    try:
      from utility import print_error_msg
      print_error_msg(e)
    except ImportError:
      print("please update to latest firmware")
