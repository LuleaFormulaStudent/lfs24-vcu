import Main from "../../main.js";
import {createServer, Server} from "node:net";
import {MavModeFlag} from "mavlink-mappings/dist/lib/minimal.js";

export default class HILController {

    server: Server | null = null

    constructor(private main: Main) {}

    async init() {
        if (this.main.isInSystemMode(MavModeFlag.HIL_ENABLED)) {
            await this.main.logs_controller.info("Initializing HIL server..")
            await this.activateHIL()
        }

        await this.main.logs_controller.debug("HIL controller initialized!")
    }

    async activateHIL() {
        this.server = createServer()

        this.server.on('error', (err) => {
            this.main.logs_controller.error("HIL Server error:", err)
        });

        this.server.on('connection', async (socket) => {
            await this.main.logs_controller.info("HIL Client connected!")

            socket.on("error", (err) => {
                this.main.logs_controller.error("Error on HIL Client socket", err)
            })

            socket.on("data", (data: Buffer) => {
                const values = []
                for (let i = 0; i < data.length / 8; i++) {
                    values.push(data.readDoubleLE(i*8))
                }

                this.main.data_controller.params.hv_cur_amp = values[0]
                this.main.data_controller.params.hv_cons_energy = values[1]
                this.main.data_controller.params.hv_cur_voltage = values[3]
                this.main.data_controller.params.hv_temp = values[4] - 273.15
                this.main.data_controller.params.hv_bdi = values[5]
                this.main.data_controller.params.gps_latitude = values[6]
                this.main.data_controller.params.gps_longitude = values[7]
                this.main.data_controller.params.vehicle_heading = values[8]
                this.main.data_controller.params.gps_altitude = values[9]
                this.main.data_controller.params.gps_speed = values[10]
                this.main.data_controller.params.acc_lon = values[11]
                this.main.data_controller.params.acc_lat = values[12]
                this.main.data_controller.params.acc_z = values[13]
                this.main.data_controller.params.gyro_lon = values[14]
                this.main.data_controller.params.gyro_lat = values[15]
                this.main.data_controller.params.gyro_z = values[16]
                this.main.data_controller.params.ts_torque = values[17]
                this.main.data_controller.params.ts_rpm = values[18]
                this.main.data_controller.params.vehicle_steering = values[19]
                this.main.data_controller.params.throttle_output = values[20]
                this.main.data_controller.params.brake_input = values[21]
                this.main.data_controller.params.hv_cur_amp = values[0]
                this.main.data_controller.params.hv_cons_energy = values[1]
                this.main.data_controller.params.hv_cur_voltage = values[3]
                this.main.data_controller.params.hv_temp = values[4] - 273.15
                this.main.data_controller.params.hv_bdi = values[5]
            })

            socket.on('close', () => {
                this.main.logs_controller.info("HIL Client disconnected!")
            });
        });

        this.server.listen({port: 6000, host: "0.0.0.0"}, () => {
            this.main.logs_controller.info("HIL Server started!")
        });
    }

    deactivateHIL() {
        this.main.setSystemMode(MavModeFlag.HIL_ENABLED, false)
    }
}