import {SerialPort} from "serialport"
import {ReadlineParser} from "@serialport/parser-readline"
import EventEmitter from "node:events";
import GPS from "gps";

export enum GGAQuality {
    'fix'       = 1,
    'dgps-fix'  = 2,
    'pps-fix'   = 3,
    'rtk'       = 4,
    'rtk-float' = 5,
    'estimated' = 6,
    'manual'    = 7,
    'simulated' = 8
}

export default class GPSDriver extends EventEmitter {
    port: SerialPort
    gps: GPS

    private prev_lat = 0
    private prev_lon = 0
    private current_lat = 0
    private current_lon = 0

    get heading(): number {
        if (this.prev_lat != 0 && this.prev_lon != 0) {
            return GPS.Heading(this.prev_lat, this.prev_lon, this.current_lat, this.current_lon)
        } else {
            return 0
        }
    }

    constructor() {
        super();

        this.gps = new GPS()
        this.port = new SerialPort({path: "/dev/ttyAMA5", baudRate: 9600});
        const pipe = this.port.pipe(new ReadlineParser({delimiter: '\r\n'}))

        pipe.on('data', data => this.gps.update(data))

        this.gps.on("data", data => {
            if (data.hasOwnProperty("lat") && data.hasOwnProperty("lon")) {
                this.prev_lat = this.current_lat
                this.prev_lon = this.current_lon
                this.current_lat = data.lat
                this.current_lon = data.lon
            }
            this.emit("data", data)
        })
        this.gps.on("error", err => this.emit("error", err))
        this.port.open(() => this.emit("open"))
    }
}