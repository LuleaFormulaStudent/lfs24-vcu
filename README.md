
To autostart can network on boot, add to /etc/network/interfaces
````
auto can0
iface can0 inet manual
    pre-up /sbin/ip link set can0 type can bitrate 250000 triple-sampling on restart-ms 100
    up /sbin/ifconfig can0 up
    down /sbin/ifconfig can0 down
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

