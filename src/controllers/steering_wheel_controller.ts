import Main from "../../main.js";
import {SerialPort} from "serialport";
import {ReadlineParser} from "@serialport/parser-readline"
import {MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {DrivingMode} from "mavlink-lib/dist/lfs.js";

export default class SteeringWheelController {

    port: SerialPort | null = null
    readLineParser: any = null

    driving_mode_forward_timeout: any
    driving_mode_reverse_timeout: any
    activate_ts_timeout: any

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.port = new SerialPort({path: "/dev/ttyAMA0", baudRate: 115200});
            this.readLineParser = this.port.pipe(new ReadlineParser({delimiter: '\n'}))
        }
    }

    async init() {
        if (this.port) {
            this.readLineParser.on("data", (line: string) => {
                try {
                    const data = JSON.parse(line);
                    const [event, val] = Object.entries(data)[0];
                    if (event == "btn_p" && val == 3) {
                        this.driving_mode_forward_timeout = setTimeout(() => {
                            if (this.main.data_controller.params.driving_mode == DrivingMode.NEUTRAL) {
                                this.main.setDrivingMode(DrivingMode.FORWARD)
                            } else {
                                this.main.setDrivingMode(DrivingMode.NEUTRAL)
                            }
                        }, 1000)
                    } else if (event == "btn_r" && val == 3) {
                        clearTimeout(this.driving_mode_forward_timeout)
                    }
                    if (event == "btn_p" && val == 2) {
                        this.driving_mode_reverse_timeout = setTimeout(() => {
                            if (this.main.data_controller.params.driving_mode == DrivingMode.NEUTRAL) {
                                this.main.setDrivingMode(DrivingMode.REVERSE)
                            } else {
                                this.main.setDrivingMode(DrivingMode.NEUTRAL)
                            }
                        }, 1000)
                    } else if (event == "btn_r" && val == 2) {
                        clearTimeout(this.driving_mode_reverse_timeout)
                    }
                    if (event == "btn_p" && val == 1) {
                        this.activate_ts_timeout = setTimeout(() => {
                            if (this.main.data_controller.params.system_state == MavState.ACTIVE) {
                                this.main.traction_system_controller.deactivateTS()
                            } else {
                                this.main.traction_system_controller.activateTS()
                            }
                        }, 2000)
                    } else if (event == "btn_r" && val == 2) {
                        clearTimeout(this.activate_ts_timeout)
                    }
                    if (event == "cp") {
                        this.main.digital_outputs_controller.setCoolantPumpOutput(val == 1)
                    }
                    if (event == "cp_s") {
                        this.main.data_controller.params.cool_pump_start = val == 1
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
                    "t": this.main.data_controller.params.system_state == MavState.ACTIVE
                })

                this.port!.write(data + "\n")
            }, 100)
        }

        await this.main.logs_controller.debug("Steering wheel controller initialized!")
    }
}