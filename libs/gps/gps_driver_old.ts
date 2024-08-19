import {SerialPort} from "serialport"
import {ReadlineParser} from "@serialport/parser-readline"
import Parser from "@signalk/nmea0183-signalk"
import EventEmitter from "node:events";
import {common} from "node-mavlink";

export default class GPSDriver extends EventEmitter {
    port: SerialPort
    readLineParser: any
    gps_parser: any

    constructor() {
        super();
        this.port = new SerialPort({path: "/dev/ttyAMA5", baudRate: 9600});
        this.readLineParser = this.port.pipe(new ReadlineParser({delimiter: '\r\n'}))
        this.gps_parser = new Parser()

        this.port.open(() => {
            this.readLineParser.on("data", (line: string) => {
                try {
                    const packet = this.gps_parser.parse(line)
                    if (packet !== null) {
                        const speed_packet = packet["updates"][0]["values"].find((v: any) => v.path == "navigation.speedOverGround")
                        if (speed_packet != null) {
                            this.emit("data", {gps_speed: speed_packet.value >= 1 ? speed_packet.value : 0})
                        }
                        const navigation_packet = packet["updates"][0]["values"].find((v: any) => v.path == "navigation.position")
                        if (navigation_packet != null) {
                            this.emit("data", {
                                gps_longitude: navigation_packet.value.longitude,
                                gps_latitude: navigation_packet.value.latitude
                            })
                        }
                        const satellites_packet = packet["updates"][0]["values"].find((v: any) => v.path == "navigation.gnss.satellitesInView")
                        if (satellites_packet != null) {
                            this.emit("data", {
                                gps_num_sats: satellites_packet.value.count
                            })
                        }

                        const altitude_packet = packet["updates"][0]["values"].find((v: any) => v.path == "navigation.gnss.antennaAltitude")
                        if (altitude_packet != null) {
                            this.emit("data", {
                                gps_altitude: altitude_packet.value
                            })
                        }

                        const gps_mode_packet = packet["updates"][0]["values"].find((v: any) => v.path == "navigation.gnss.methodQuality")
                        if (gps_mode_packet != null) {
                            switch (gps_mode_packet.value.toString().toLowerCase()) {
                                case "gnss fix":
                                    this.emit("data", {gps_mode: common.GpsFixType.GPS_FIX_TYPE_3D_FIX});
                                    break
                                case "estimated (dr) mode":
                                    this.emit("data", {gps_mode: common.GpsFixType.DGPS});
                                    break
                                default:
                                    this.emit("data", {gps_mode: common.GpsFixType.NO_FIX})
                            }
                            this.emit("data", {
                                gps_mode: (gps_mode_packet.value.toString().toLowerCase() == "gnss fix" ? common.GpsFixType.GPS_FIX_TYPE_3D_FIX : common.GpsFixType.NO_FIX)
                            })
                        }

                        const horizontal_dilution_packet = packet["updates"][0]["values"].find((v: any) => v.path == "navigation.gnss.horizontalDilution")
                        if (horizontal_dilution_packet != null) {
                            this.emit("data", {
                                gps_horiz_dil: horizontal_dilution_packet.value
                            })
                        }
                    }
                } catch (error) {
                    console.error("Got bad packet!");
                }
            })
        })
    }
}