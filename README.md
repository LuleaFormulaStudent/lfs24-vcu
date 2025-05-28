
To autostart can network on boot, add to /etc/network/interfaces
````
auto can0
iface can0 inet manual
    pre-up /sbin/ip link set can0 type can bitrate 250000 triple-sampling on restart-ms 100
    up /sbin/ifconfig can0 up
    down /sbin/ifconfig can0 down
````

or via systemd:
````
[Unit]
Description=CAN Setup
After=network.target

[Service]
ExecStartPre=/sbin/ip link set can0 type can bitrate 250000 triple-sampling on restart-ms 100
ExecStart=ifconfig can0 up
#ExecStop=ifconfig can0 down
#Restart=always

[Install]
WantedBy=multi-user.target
````

add to config.txt (Uses BCM pins)
````
gpio=26,6,21,23,24,16,20,17,27,22=op,pd,dl
gpio=26,23,24,16,20,17,27,22=dh

dtparam=spi=on
dtoverlay=mcp2515-can0,oscillator=12000000,interrupt=25,spimaxfrequency=2000000
dtoverlay=uart2
dtoverlay=uart5
dtoverlay=disable-wifi
````

To get all GPIO Numbers:
````
cat /sys/kernel/debug/gpio
````

## ToDO

- [ ] Lägga in styrsensorn
- [x] Implementera mavlink med de andra systemen
- [ ] Addera hastighets beräkning för IMU
- [x] Lägga till estimering av effektförbrukning från både LV och HV
- [x] Lägga till estimering av HV spänning tills det mäts
- [x] Lägg till stöd för track drive profile
- [x] Sänka throttle output om bilen är i back
- [ ] Implementera one pedal mode

## Consumed and charged
Consumed: 91.36
chraged, 19,9938 + 19,807 + 13,049 + 12,951 / 2

32.9

0,36

