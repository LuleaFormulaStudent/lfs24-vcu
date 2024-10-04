import StatusLed from "./src/controllers/status_led.js";
import TractionSystemController from "./src/controllers/traction_system_controller.js";
import SteeringWheelController from "./src/controllers/steering_wheel_controller.js";
import DataController from "./src/controllers/data_controller.js";
import DigitalOutputsController from "./src/controllers/digital_outputs_controller.js";
import MavlinkController from "./src/controllers/mavlink_controller.js";
import {MavModeFlag, MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {createServer, Server, Socket} from "node:net";
import LogsController from "./src/controllers/logs_controller.js";
import package_info from "./package.json" assert {type: "json"};
import {configDotenv} from "dotenv";
import HILController from "./src/controllers/hil_controller.js";
import {DrivingMode} from "mavlink-lib/dist/lfs.js";
import {waitFor} from "node-mavlink";
import {exec} from "node:child_process";
import AdmZip from "adm-zip";
import fs from "fs";
import {DrivingModeMessage} from "mavlink-lib/dist/lfs.js"

configDotenv()

export default class Main {

    data_controller: DataController
    status_led: StatusLed
    traction_system_controller: TractionSystemController
    steering_wheel_controller: SteeringWheelController
    digital_outputs_controller: DigitalOutputsController
    mavlink_controller: MavlinkController
    logs_controller: LogsController
    hil_controller: HILController

    tcp_server: Server
    tcp_server_connections: Socket[] = []
    tcp_server_stared = false

    in_production: boolean = process.env.NODE_ENV == 'production'
    start_time: number = Date.now()
    version: string = package_info.version

    constructor() {
        this.logs_controller = new LogsController(this)
        this.data_controller = new DataController(this)
        this.digital_outputs_controller = new DigitalOutputsController(this)
        this.status_led = new StatusLed(this)
        this.traction_system_controller = new TractionSystemController(this)
        this.steering_wheel_controller = new SteeringWheelController(this)
        this.mavlink_controller = new MavlinkController(this)
        this.hil_controller = new HILController(this)
        this.tcp_server = createServer()
    }

    async init() {
        await this.logs_controller.init()
        await this.logs_controller.info("Starting initialization of system..")
        await this.logs_controller.info("Version: " + this.version)
        await this.setSystemState(MavState.BOOT)
        this.setSystemMode(MavModeFlag.HIL_ENABLED, true)

        if (this.in_production) {
            const onExit = async (err: any) => {
                this.digital_outputs_controller.setCoolantPumpOutput(false)
                this.digital_outputs_controller.setForwardSwitch(false)
                this.digital_outputs_controller.setReverseSwitch(false)

                if (this.data_controller.params.system_state == MavState.ACTIVE) {
                    await this.traction_system_controller.deactivateTS()
                    this.digital_outputs_controller.setTSActiveRelay(false)
                }

                this.status_led.setGreenLED(false)
                this.status_led.setBlueLED(false)
                if (err) {
                    this.status_led.setRedLED(true)
                    console.error(err)
                }
                await this.logs_controller.info("Exiting..")
            }
            process.on('exit', onExit);
            process.on('SIGINT', onExit);
            process.on('SIGUSR1',onExit);
            process.on('SIGUSR2', onExit);
            process.on('uncaughtException', onExit);

            await this.logs_controller.info("System is in production mode.")
        } else {
            await this.logs_controller.info("System is in development mode.")
        }

        await this.logs_controller.info("Initializing TCP server..")
        this.tcp_server.on('error', (err) => {
            this.logs_controller.error("TCP Server error:", err)
        });

        if (!this.in_production) {
            this.tcp_server.on('connection', (socket) => {
                this.tcp_server_connections.push(socket);

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
                this.logs_controller.debug("New tcp connection.")
            });

            this.tcp_server.listen({port: 5432, host: "0.0.0.0"}, () => {
                this.logs_controller.info("TCP Server started!")
                this.tcp_server_stared = true
            });

            await waitFor(() => this.tcp_server_stared, 1000)
        }

        await this.data_controller.init()
        await this.digital_outputs_controller.init()
        await this.traction_system_controller.init()
        await this.steering_wheel_controller.init()
        await this.hil_controller.init()
        await this.mavlink_controller.init()

        await this.logs_controller.info("Done initializing system!")
        await this.setSystemState(MavState.STANDBY)
        this.status_led.setBlueLED(false)
        this.status_led.setGreenLED(true)
    }

    async setSystemState(state: MavState) {
        this.data_controller.params.system_state = state
        await this.logs_controller.info("Setting system in " + MavState[state].toLowerCase() + " state.")
    }

    isInSystemState(state: MavState): boolean {
        return this.data_controller.params.system_state == state
    }

    get uptime(): number {
        return Date.now() - this.start_time
    }

    setSystemMode(mode: MavModeFlag, active: boolean) {
        if (active) {
            this.data_controller.params.system_mode |= mode;
        } else {
            this.data_controller.params.system_mode &= ~mode;
        }
    }

    isInSystemMode(mode: MavModeFlag): boolean {
        return (this.data_controller.params.system_mode & mode) != 0
    }

    setDrivingMode(mode: DrivingMode) {
        this.data_controller.params.driving_mode = mode
        if (this.data_controller.params.driving_mode == DrivingMode.NEUTRAL) {
            this.digital_outputs_controller.setReverseSwitch(false, false)
            this.digital_outputs_controller.setForwardSwitch(false)
        } else if (this.data_controller.params.driving_mode == DrivingMode.FORWARD) {
            this.digital_outputs_controller.setReverseSwitch(false, false)
            this.digital_outputs_controller.setForwardSwitch(true)
        } else if (this.data_controller.params.driving_mode == DrivingMode.REVERSE) {
            this.digital_outputs_controller.setForwardSwitch(false, false)
            this.digital_outputs_controller.setReverseSwitch(true)
        }

        const msg = new DrivingModeMessage()
        msg.drivingMode = this.data_controller.params.driving_mode
        this.mavlink_controller.send(msg).catch(async () => {
            await this.logs_controller.error("Failed to send driving mode message!")
        }).then(async () => {
            await this.logs_controller.info("Setting vehicle in " + DrivingMode[mode].toLowerCase() + " mode.")
        })
    }

    async handleNewFirmware(file_name: string) {
        try {
            const zip = new AdmZip(file_name)
            const test_result = zip.test()
            if (test_result) {
                await this.logs_controller.info("Testing firmware passed!")
                await this.logs_controller.info("Extracting files..")
                if (fs.existsSync("./source")) {
                    await zip.extractAllToAsync("./source", true)
                } else {
                    await this.logs_controller.error("Source folder does not exists! Skipping extracting")
                }
                await this.logs_controller.info("Done!")
                //const new_package_info = (await import("./package.json", {assert: { type: "json" }})).default
                //console.log(new_package_info)
                //await this.logs_controller.info("New version: " + new_package_info.version)
                await this.logs_controller.info("Rebooting system..")
                exec('sudo /sbin/shutdown -r now');
            } else {
                await this.logs_controller.error("Firmware did not pass testing, maybe it is corrupt")
            }
        } catch (e) {
            console.log(e)
            await this.logs_controller.error("Problem parsing zip, maybe it is corrupt")
        }
    }
}

(new Main().init())

// Fixa Ouput 3 relay board