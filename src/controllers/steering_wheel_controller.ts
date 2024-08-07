import Main from "../../main.js";
import {SerialPort} from "serialport";
import {ReadlineParser} from "@serialport/parser-readline"

export default class SteeringWheelController {

    port: SerialPort
    readLineParser: any

    driving_mode_forward_timeout: any

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.port = new SerialPort({path: "/dev/serial0", baudRate: 115200});
            this.readLineParser = this.port.pipe(new ReadlineParser({delimiter: '\n'}))
        }

        this.main.logs_controller.info("Steering wheel controller constructor initialized!")
    }

    async init() {
        if (this.main.in_production) {
            this.readLineParser.on("data", line => {
                try {
                    const data = JSON.parse(line);
                    const [event, val] = Object.entries(data)[0];
                    if (event == "btn_p" && val == 3) {
                        this.driving_mode_forward_timeout = setTimeout(() => {
                            this.main.setDrivingMode(1)
                        }, 2000)
                    } else if (event == "btn_r" && val == 3) {
                        clearTimeout(this.driving_mode_forward_timeout)
                    }
                    if (event == "btn_p" && val == 2) {
                        this.driving_mode_forward_timeout = setTimeout(() => {
                            this.main.setDrivingMode(0)
                        }, 200)
                    } else if (event == "btn_r" && val == 2) {
                        clearTimeout(this.driving_mode_forward_timeout)
                    }
                } catch (e) {
                    console.log(line)
                }
            });

            setInterval(() => {
                const data = JSON.stringify({
                    "s": this.main.data_controller.params.vehicle_speed,
                    "p": Math.round(this.main.data_controller.params.vehicle_power / 1000),
                    "b": Math.round(this.main.data_controller.params.hv_bdi * 100),
                    "m": this.main.data_controller.params.driving_mode,
                    "t": this.main.data_controller.params.tsal
                })

                this.port.write(data + "\n")
            }, 100)
        }
    }
}