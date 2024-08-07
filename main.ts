import StatusLed from "./src/controllers/status_led.js";
import ThrottleController from "./src/controllers/throttle_controller.js";
import SteeringWheelController from "./src/controllers/steering_wheel_controller.js";
import DataController, {DrivingMode} from "./src/controllers/data_controller.js";
import DigitalOutputsController from "./src/controllers/digital_outputs_controller.js";
import BrakeController from "./src/controllers/brake_controller.js";
import MavlinkController from "./src/controllers/mavlink_controller.js";
import {MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {createServer, Server, Socket} from "node:net";
import LogsController from "./src/controllers/logs_controller.js";
import package_info from "./package.json" assert {type: "json"};

export default class Main {

    data_controller: DataController
    status_led: StatusLed
    throttle_controller: ThrottleController
    brake_controller: BrakeController
    steering_wheel_controller: SteeringWheelController
    digital_outputs_controller: DigitalOutputsController
    mavlink_controller: MavlinkController
    logs_controller: LogsController

    in_production: boolean = false
    in_sim_mode: boolean = true

    tcp_server: Server
    tcp_server_connections: Socket[] = []
    simulink_server: Server

    version: string = package_info.version

    async init() {
        this.logs_controller = new LogsController(this)
        await this.logs_controller.info("Starting initialization of system..")
        await this.logs_controller.info("Version: " + this.version)
        await this.setSystemState(MavState.BOOT)

        await this.logs_controller.info("Starting initializing constructors..")
        this.logs_controller = new LogsController(this)
        this.data_controller = new DataController(this)
        this.status_led = new StatusLed(this)
        this.throttle_controller = new ThrottleController(this)
        this.digital_outputs_controller = new DigitalOutputsController(this)
        this.brake_controller = new BrakeController(this)
        this.steering_wheel_controller = new SteeringWheelController(this)
        this.mavlink_controller = new MavlinkController(this)
        await this.logs_controller.info("Initializing constructors done!")

        if (process.env.NODE_ENV == 'production') {
            this.in_production = true
            await this.logs_controller.info("System is in production mode.")
        } else {
            await this.logs_controller.info("System is in development mode.")
        }

        await this.logs_controller.info("Initializing TCP server..")
        this.tcp_server = createServer()

        this.tcp_server.on('error', (err) => {
            this.logs_controller.error("TCP Server error:", err)
        });

        this.tcp_server.on('connection', async (socket) => {
            this.tcp_server_connections.push(socket);
            await this.logs_controller.info("New connection to client.")

            socket.on("error", (err) => {
                this.logs_controller.error("Error on client socket", err)
            })

            socket.on("data", (data) => {
                this.tcp_server_connections.forEach((connection) => {
                    if (connection !== socket) {
                        connection.write(data);
                    }
                });
            })

            socket.on('close', () => {
                this.tcp_server_connections.splice(this.tcp_server_connections.indexOf(socket), 1);
            });
        });

        this.tcp_server.listen({port: 5432, host: "0.0.0.0"}, () => {
            this.logs_controller.info("TCP Server started!")
        });

        if (this.in_sim_mode) {
            await this.logs_controller.info("Initializing Simulink server..")
            this.simulink_server = createServer()

            this.simulink_server.on('error', (err) => {
                this.logs_controller.error("Simulink server error:", err)
            });

            this.simulink_server.on("data", (data: any) => {
                console.log(data)
            })

            this.simulink_server.on('connection', async (socket) => {
                await this.logs_controller.info("Simulink connected!")

                socket.on("error", (err) => {
                    this.logs_controller.error("Error on client socket", err)
                })

                socket.on("data", (data: Buffer) => {
                    const values = []
                    for (let i = 0; i < data.length / 8; i++) {
                        values.push(data.readDoubleLE(i*8))
                    }
                    this.data_controller.onSimData(values)
                })

                socket.on('close', () => {
                    this.logs_controller.info("Simulink disconnected!")
                });
            });

            this.simulink_server.listen({port: 6000, host: "0.0.0.0"}, () => {
                this.logs_controller.info("Simulink server started!")
            });
        }

        await this.digital_outputs_controller.init()
        await this.data_controller.init()
        await this.throttle_controller.init()
        await this.brake_controller.init()
        await this.steering_wheel_controller.init()
        await this.mavlink_controller.init()


        await this.logs_controller.info("Done initializing system!")
        await this.setSystemState(MavState.STANDBY)
    }

    async setSystemState(state: MavState) {
        this.data_controller.params.system_state = state
        await this.logs_controller.info("Setting system in " + MavState[state].toLowerCase())
    }

    setDrivingMode(mode: DrivingMode) {
        this.data_controller.params.driving_mode = mode
        if (this.in_production) {
            if (this.data_controller.params.driving_mode == DrivingMode.DRIVING_MODE_NEUTRAL) {
                this.digital_outputs_controller.setReverseSwitch(false)
                this.digital_outputs_controller.setForwardSwitch(false)
            } else if (this.data_controller.params.driving_mode == DrivingMode.DRIVING_MODE_FORWARD) {
                this.digital_outputs_controller.setReverseSwitch(false)
                this.digital_outputs_controller.setForwardSwitch(true)
            } else if (this.data_controller.params.driving_mode == DrivingMode.DRIVING_MODE_REVERSE) {
                this.digital_outputs_controller.setForwardSwitch(false)
                this.digital_outputs_controller.setReverseSwitch(true)
            }
        }
    }
}

(new Main().init())

// Fixa Grön LED
// Fixa Ouput 3 relay board